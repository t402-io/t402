"""Cross-Chain Payment Router for USDT0 bridging."""

from typing import Optional

from .client import Usdt0Bridge
from .constants import DEFAULT_SLIPPAGE, get_bridgeable_chains, supports_bridging
from .scan import LayerZeroScanClient
from .types import (
    BridgeExecuteParams,
    BridgeQuote,
    BridgeQuoteParams,
    BridgeSigner,
    CrossChainPaymentParams,
    CrossChainPaymentResult,
    LayerZeroMessage,
    WaitForDeliveryOptions,
)


class CrossChainPaymentRouter:
    """Cross-Chain Payment Router.

    Routes payments across chains using USDT0 bridge.
    Handles fee estimation, bridge execution, and delivery tracking.

    Example:
        ```python
        from t402.bridge import CrossChainPaymentRouter

        router = CrossChainPaymentRouter(signer, 'arbitrum')

        # Route payment from Arbitrum to Ethereum
        result = await router.route_payment(CrossChainPaymentParams(
            source_chain='arbitrum',
            destination_chain='ethereum',
            amount=100_000000,  # 100 USDT0
            pay_to=recipient_address,
            payer=user_address,
        ))

        # Track delivery
        message = await router.track_message(result.message_guid)
        ```
    """

    def __init__(self, signer: BridgeSigner, source_chain: str) -> None:
        """Create a cross-chain payment router.

        Args:
            signer: Wallet signer for bridge operations
            source_chain: Chain where user's funds are located
        """
        self._bridge = Usdt0Bridge(signer, source_chain)
        self._scan_client = LayerZeroScanClient()
        self._source_chain = source_chain.lower()

    async def route_payment(
        self, params: CrossChainPaymentParams
    ) -> CrossChainPaymentResult:
        """Route payment across chains.

        This method:
        1. Bridges USDT0 from source chain to destination chain
        2. Sends funds to the payer's address on destination chain
        3. Returns tracking info for monitoring delivery

        After delivery, the payer can use the bridged funds to pay
        on the destination chain.

        Args:
            params: Payment routing parameters

        Returns:
            Result with transaction hash and tracking info

        Raises:
            ValueError: If parameters are invalid or transaction fails
        """
        self._validate_params(params)

        slippage = (
            params.slippage_tolerance
            if params.slippage_tolerance > 0
            else DEFAULT_SLIPPAGE
        )

        # Execute bridge transaction
        result = await self._bridge.send(
            BridgeExecuteParams(
                from_chain=params.source_chain,
                to_chain=params.destination_chain,
                amount=params.amount,
                recipient=params.payer,  # Bridge to payer's address
                slippage_tolerance=slippage,
            )
        )

        return CrossChainPaymentResult(
            bridge_tx_hash=result.tx_hash,
            message_guid=result.message_guid,
            amount_bridged=result.amount_sent,
            estimated_receive_amount=result.amount_to_receive,
            source_chain=params.source_chain,
            destination_chain=params.destination_chain,
            estimated_delivery_time=result.estimated_time,
        )

    async def estimate_fees(self, params: CrossChainPaymentParams) -> BridgeQuote:
        """Get estimated fees for routing a payment.

        Args:
            params: Payment parameters

        Returns:
            Quote with native fee and estimated receive amount
        """
        return await self._bridge.quote(
            BridgeQuoteParams(
                from_chain=params.source_chain,
                to_chain=params.destination_chain,
                amount=params.amount,
                recipient=params.payer,
            )
        )

    async def track_message(self, message_guid: str) -> LayerZeroMessage:
        """Track message delivery status.

        Args:
            message_guid: LayerZero message GUID from route_payment result

        Returns:
            Current message status
        """
        return await self._scan_client.get_message(message_guid)

    async def wait_for_delivery(
        self,
        message_guid: str,
        options: Optional[WaitForDeliveryOptions] = None,
    ) -> LayerZeroMessage:
        """Wait for payment to be delivered on destination chain.

        Args:
            message_guid: LayerZero message GUID from route_payment result
            options: Wait options (timeout, poll interval, callbacks)

        Returns:
            Final message state when delivered
        """
        return await self._scan_client.wait_for_delivery(message_guid, options)

    def can_route(self, source_chain: str, destination_chain: str) -> bool:
        """Check if routing between two chains is supported.

        Args:
            source_chain: Source chain name
            destination_chain: Destination chain name

        Returns:
            True if routing is supported
        """
        return (
            source_chain.lower() != destination_chain.lower()
            and supports_bridging(source_chain)
            and supports_bridging(destination_chain)
        )

    def get_supported_destinations(self) -> list[str]:
        """Get all supported destination chains from source chain.

        Returns:
            List of supported destination chain names
        """
        return self._bridge.get_supported_destinations()

    @staticmethod
    def get_bridgeable_chains() -> list[str]:
        """Get all bridgeable chains.

        Returns:
            List of all chains that support bridging
        """
        return get_bridgeable_chains()

    async def close(self) -> None:
        """Close the router and release resources."""
        await self._scan_client.close()

    def _validate_params(self, params: CrossChainPaymentParams) -> None:
        """Validate routing parameters."""
        if params.source_chain.lower() != self._source_chain:
            raise ValueError(
                f'Source chain mismatch: router initialized for "{self._source_chain}" '
                f'but got "{params.source_chain}"'
            )

        if not self.can_route(params.source_chain, params.destination_chain):
            raise ValueError(
                f'Cannot route payment from "{params.source_chain}" to '
                f'"{params.destination_chain}". '
                f'Supported chains: {", ".join(get_bridgeable_chains())}'
            )

        if params.amount <= 0:
            raise ValueError("Amount must be greater than 0")


def create_cross_chain_payment_router(
    signer: BridgeSigner, source_chain: str
) -> CrossChainPaymentRouter:
    """Create a cross-chain payment router.

    Args:
        signer: Wallet signer
        source_chain: Chain where funds are located

    Returns:
        New router instance
    """
    return CrossChainPaymentRouter(signer, source_chain)
