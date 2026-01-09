"""USDT0 Bridge Client for LayerZero OFT transfers."""

from typing import Optional

from .constants import (
    DEFAULT_EXTRA_OPTIONS,
    DEFAULT_SLIPPAGE,
    ERC20_APPROVE_ABI,
    ESTIMATED_BRIDGE_TIME,
    OFT_SEND_ABI,
    OFT_SENT_EVENT_TOPIC,
    address_to_bytes32,
    get_bridgeable_chains,
    get_endpoint_id,
    get_usdt0_oft_address,
    supports_bridging,
)
from .types import (
    BridgeExecuteParams,
    BridgeQuote,
    BridgeQuoteParams,
    BridgeResult,
    BridgeSigner,
    BridgeTransactionReceipt,
    MessagingFee,
    SendParam,
)


class Usdt0Bridge:
    """USDT0 Bridge Client for LayerZero OFT transfers.

    Provides cross-chain USDT0 transfers using LayerZero OFT standard.

    Example:
        ```python
        from t402.bridge import Usdt0Bridge

        bridge = Usdt0Bridge(signer, 'arbitrum')

        # Get quote
        quote = await bridge.quote(BridgeQuoteParams(
            from_chain='arbitrum',
            to_chain='ethereum',
            amount=100_000000,  # 100 USDT0
            recipient='0x...',
        ))

        print(f"Fee: {quote.native_fee} wei")

        # Execute bridge
        result = await bridge.send(BridgeExecuteParams(
            from_chain='arbitrum',
            to_chain='ethereum',
            amount=100_000000,
            recipient='0x...',
        ))

        print(f"Bridge tx: {result.tx_hash}")
        print(f"Message GUID: {result.message_guid}")
        ```
    """

    def __init__(self, signer: BridgeSigner, chain: str) -> None:
        """Create a new bridge client.

        Args:
            signer: Wallet signer with read/write capabilities
            chain: Source chain name (e.g., 'arbitrum', 'ethereum')

        Raises:
            ValueError: If chain doesn't support bridging
        """
        if not supports_bridging(chain):
            raise ValueError(
                f'Chain "{chain}" does not support USDT0 bridging. '
                f'Supported chains: {", ".join(get_bridgeable_chains())}'
            )

        self._signer = signer
        self._chain = chain.lower()

    async def quote(self, params: BridgeQuoteParams) -> BridgeQuote:
        """Get a quote for bridging USDT0.

        Args:
            params: Bridge parameters

        Returns:
            Quote with fee and amount information

        Raises:
            ValueError: If parameters are invalid
        """
        self._validate_params(params)

        send_param = self._build_send_param(
            params.to_chain, params.amount, params.recipient, DEFAULT_SLIPPAGE
        )
        oft_address = get_usdt0_oft_address(params.from_chain)

        # Get quote from contract
        fee = await self._signer.read_contract(
            oft_address,
            OFT_SEND_ABI,
            "quoteSend",
            self._send_param_to_tuple(send_param),
            False,
        )

        native_fee = fee[0] if isinstance(fee, (list, tuple)) else fee.get("nativeFee", 0)

        return BridgeQuote(
            native_fee=int(native_fee),
            amount_to_send=params.amount,
            min_amount_to_receive=send_param.min_amount_ld,
            estimated_time=ESTIMATED_BRIDGE_TIME,
            from_chain=params.from_chain,
            to_chain=params.to_chain,
        )

    async def send(self, params: BridgeExecuteParams) -> BridgeResult:
        """Execute a bridge transaction.

        Args:
            params: Bridge execution parameters

        Returns:
            Bridge result with transaction hash and message GUID

        Raises:
            ValueError: If parameters are invalid or transaction fails
        """
        self._validate_params(
            BridgeQuoteParams(
                from_chain=params.from_chain,
                to_chain=params.to_chain,
                amount=params.amount,
                recipient=params.recipient,
            )
        )

        slippage = params.slippage_tolerance if params.slippage_tolerance > 0 else DEFAULT_SLIPPAGE
        oft_address = get_usdt0_oft_address(params.from_chain)
        send_param = self._build_send_param(
            params.to_chain, params.amount, params.recipient, slippage
        )
        refund_address = params.refund_address or self._signer.address

        # Get fee quote
        fee_result = await self._signer.read_contract(
            oft_address,
            OFT_SEND_ABI,
            "quoteSend",
            self._send_param_to_tuple(send_param),
            False,
        )

        if isinstance(fee_result, (list, tuple)):
            native_fee = int(fee_result[0])
            lz_token_fee = int(fee_result[1]) if len(fee_result) > 1 else 0
        else:
            native_fee = int(fee_result.get("nativeFee", 0))
            lz_token_fee = int(fee_result.get("lzTokenFee", 0))

        fee = MessagingFee(native_fee=native_fee, lz_token_fee=lz_token_fee)

        # Check and approve allowance if needed
        await self._ensure_allowance(oft_address, params.amount)

        # Execute bridge transaction
        tx_hash = await self._signer.write_contract(
            oft_address,
            OFT_SEND_ABI,
            "send",
            self._send_param_to_tuple(send_param),
            (fee.native_fee, fee.lz_token_fee),
            refund_address,
            value=fee.native_fee,
        )

        # Wait for transaction confirmation
        receipt = await self._signer.wait_for_transaction_receipt(tx_hash)

        if receipt.status != 1:
            raise ValueError(f"Bridge transaction failed: {tx_hash}")

        # Extract message GUID from OFTSent event logs
        message_guid = self._extract_message_guid(receipt)

        return BridgeResult(
            tx_hash=tx_hash,
            message_guid=message_guid,
            amount_sent=params.amount,
            amount_to_receive=send_param.min_amount_ld,
            from_chain=params.from_chain,
            to_chain=params.to_chain,
            estimated_time=ESTIMATED_BRIDGE_TIME,
        )

    def get_supported_destinations(self) -> list[str]:
        """Get all supported destination chains from current chain.

        Returns:
            List of supported destination chain names
        """
        return [c for c in get_bridgeable_chains() if c != self._chain]

    def supports_destination(self, to_chain: str) -> bool:
        """Check if a destination chain is supported.

        Args:
            to_chain: Destination chain name

        Returns:
            True if supported
        """
        return to_chain.lower() != self._chain and supports_bridging(to_chain)

    def _validate_params(self, params: BridgeQuoteParams) -> None:
        """Validate bridge parameters."""
        if params.from_chain.lower() != self._chain:
            raise ValueError(
                f'Source chain mismatch: bridge initialized for "{self._chain}" '
                f'but got "{params.from_chain}"'
            )

        if not supports_bridging(params.from_chain):
            raise ValueError(
                f'Source chain "{params.from_chain}" does not support USDT0 bridging'
            )

        if not supports_bridging(params.to_chain):
            raise ValueError(
                f'Destination chain "{params.to_chain}" does not support USDT0 bridging'
            )

        if params.from_chain.lower() == params.to_chain.lower():
            raise ValueError("Source and destination chains must be different")

        if params.amount <= 0:
            raise ValueError("Amount must be greater than 0")

    def _build_send_param(
        self, to_chain: str, amount: int, recipient: str, slippage: float
    ) -> SendParam:
        """Build the LayerZero SendParam struct."""
        dst_eid = get_endpoint_id(to_chain)
        if dst_eid is None:
            raise ValueError(f"Unknown destination chain: {to_chain}")

        to_bytes = address_to_bytes32(recipient)

        # Calculate minimum amount with slippage
        slippage_bps = int(slippage * 100)
        min_amount = amount - (amount * slippage_bps) // 10000

        return SendParam(
            dst_eid=dst_eid,
            to=to_bytes,
            amount_ld=amount,
            min_amount_ld=min_amount,
            extra_options=DEFAULT_EXTRA_OPTIONS,
            compose_msg=b"",
            oft_cmd=b"",
        )

    def _send_param_to_tuple(self, param: SendParam) -> tuple:
        """Convert SendParam to tuple for contract call."""
        return (
            param.dst_eid,
            param.to,
            param.amount_ld,
            param.min_amount_ld,
            param.extra_options,
            param.compose_msg,
            param.oft_cmd,
        )

    async def _ensure_allowance(self, oft_address: str, amount: int) -> None:
        """Check and approve token allowance if needed."""
        signer_address = self._signer.address

        # Check current allowance
        allowance = await self._signer.read_contract(
            oft_address,
            ERC20_APPROVE_ABI,
            "allowance",
            signer_address,
            oft_address,
        )

        allowance_int = int(allowance) if not isinstance(allowance, int) else allowance

        # Approve if needed
        if allowance_int < amount:
            await self._signer.write_contract(
                oft_address,
                ERC20_APPROVE_ABI,
                "approve",
                oft_address,
                amount,
            )

    def _extract_message_guid(self, receipt: BridgeTransactionReceipt) -> str:
        """Extract LayerZero message GUID from OFTSent event logs."""
        for log in receipt.logs:
            if len(log.topics) >= 2 and log.topics[0].lower() == OFT_SENT_EVENT_TOPIC.lower():
                # GUID is the first indexed parameter (topics[1])
                return log.topics[1]

        raise ValueError(
            "Failed to extract message GUID from transaction logs. "
            "The OFTSent event was not found in the transaction receipt."
        )


def create_usdt0_bridge(signer: BridgeSigner, chain: str) -> Usdt0Bridge:
    """Create a bridge client for a specific chain.

    Args:
        signer: Wallet signer
        chain: Source chain name

    Returns:
        New bridge client instance
    """
    return Usdt0Bridge(signer, chain)
