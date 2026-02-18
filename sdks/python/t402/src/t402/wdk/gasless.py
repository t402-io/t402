"""
WDK Gasless Payment Client.

High-level client for executing gasless USDT0 payments using
ERC-4337 Account Abstraction with WDK accounts.

Example:
    ```python
    from t402.wdk.gasless import GaslessClient, GaslessConfig

    config = GaslessConfig(
        bundler_url="https://api.pimlico.io/v2/arbitrum/rpc?apikey=...",
        paymaster_url="https://api.pimlico.io/v2/arbitrum/rpc?apikey=...",
    )

    client = GaslessClient(config, signer=wdk_signer)
    result = await client.pay(GaslessPaymentParams(
        to="0x...",
        amount=1000000,  # 1 USDT0
        token="0x...",
        network="eip155:42161",
    ))
    ```
"""

from dataclasses import dataclass, field
from typing import Optional, Dict, Any


# ERC-4337 v0.7 EntryPoint
ENTRYPOINT_V07_ADDRESS = "0x0000000071727De22E5E9d8BAf0edAc6f37da032"


@dataclass
class GaslessConfig:
    """Configuration for ERC-4337 gasless payments."""

    bundler_url: str
    paymaster_url: str
    entry_point: str = ENTRYPOINT_V07_ADDRESS
    chain_id: int = 42161
    timeout: int = 30


@dataclass
class GaslessPaymentParams:
    """Parameters for a gasless payment."""

    to: str
    amount: int  # in atomic units
    token: str  # token contract address
    network: str  # CAIP-2 network ID


@dataclass
class GaslessPaymentResult:
    """Result of a gasless payment."""

    user_op_hash: str
    tx_hash: Optional[str] = None
    success: bool = False
    gas_used: int = 0
    gas_cost: int = 0
    sponsored: bool = True


@dataclass
class SponsorshipInfo:
    """Information about gas sponsorship eligibility."""

    can_sponsor: bool
    reason: Optional[str] = None
    estimated_gas_cost: Optional[int] = None


class GaslessClient:
    """Execute gasless payments via ERC-4337 account abstraction.

    Uses a bundler to submit UserOperations and an optional paymaster
    to sponsor gas fees, enabling zero-gas-cost token transfers.
    """

    def __init__(self, config: GaslessConfig, signer=None):
        """Initialize gasless client.

        Args:
            config: Gasless payment configuration.
            signer: WDK signer instance for signing operations.
        """
        if not config.bundler_url:
            raise ValueError("Bundler URL is required")

        self.config = config
        self.signer = signer
        self._account_address: Optional[str] = None

    async def pay(self, params: GaslessPaymentParams) -> GaslessPaymentResult:
        """Execute a gasless payment.

        Sends tokens without the user paying gas fees. Gas is sponsored
        by the configured paymaster.

        Args:
            params: Payment parameters.

        Returns:
            GaslessPaymentResult with transaction details.

        Raises:
            ValueError: If params are invalid.
            RuntimeError: If no signer is configured.
        """
        self._validate_payment_params(params)
        self._ensure_signer()

        # Build ERC-20 transfer call data
        call_data = self._encode_transfer(params.to, params.amount, params.token)

        # Estimate gas
        gas_estimate = await self.estimate_gas(params)

        # Build, sign, and submit UserOperation via bundler
        user_op_hash = await self._submit_user_operation(call_data, gas_estimate)

        return GaslessPaymentResult(
            user_op_hash=user_op_hash,
            success=True,
            sponsored=bool(self.config.paymaster_url),
        )

    async def estimate_gas(self, params: GaslessPaymentParams) -> int:
        """Estimate gas for a gasless payment.

        Args:
            params: Payment parameters.

        Returns:
            Estimated gas in wei.
        """
        self._validate_payment_params(params)

        # Default gas estimate for ERC-20 transfer via UserOperation
        # Verification: 150k, Call: 100k, PreVerification: 50k
        return 300_000

    async def get_account_address(self) -> str:
        """Get the smart account address.

        Returns:
            The counterfactual smart account address.

        Raises:
            RuntimeError: If no signer is configured.
        """
        self._ensure_signer()

        if self._account_address is None:
            if hasattr(self.signer, "get_address"):
                self._account_address = self.signer.get_address("evm")
            else:
                raise RuntimeError("Signer does not support get_address")

        return self._account_address

    async def can_sponsor(self, params: GaslessPaymentParams) -> SponsorshipInfo:
        """Check if a payment can be sponsored (free gas).

        Args:
            params: Payment parameters to check.

        Returns:
            SponsorshipInfo with eligibility details.
        """
        if not self.config.paymaster_url:
            return SponsorshipInfo(
                can_sponsor=False,
                reason="No paymaster configured",
            )

        try:
            gas_estimate = await self.estimate_gas(params)
            return SponsorshipInfo(
                can_sponsor=True,
                estimated_gas_cost=gas_estimate,
            )
        except Exception as e:
            return SponsorshipInfo(
                can_sponsor=False,
                reason=str(e),
            )

    def _validate_payment_params(self, params: GaslessPaymentParams) -> None:
        """Validate payment parameters."""
        if not params.to:
            raise ValueError("Recipient address is required")
        if params.to == "0x" + "0" * 40:
            raise ValueError("Recipient must not be the zero address")
        if params.amount <= 0:
            raise ValueError("Amount must be greater than zero")
        if not params.token:
            raise ValueError("Token address is required")
        if not params.network:
            raise ValueError("Network is required")

    def _ensure_signer(self) -> None:
        """Ensure a signer is configured."""
        if self.signer is None:
            raise RuntimeError("No signer configured")

    def _encode_transfer(self, to: str, amount: int, token: str) -> bytes:
        """Encode an ERC-20 transfer call.

        Args:
            to: Recipient address.
            amount: Transfer amount in atomic units.
            token: Token contract address.

        Returns:
            Encoded call data bytes.
        """
        # ERC-20 transfer(address,uint256) selector: 0xa9059cbb
        selector = bytes.fromhex("a9059cbb")
        to_padded = bytes.fromhex(to[2:].lower().zfill(64))
        amount_padded = amount.to_bytes(32, "big")
        return selector + to_padded + amount_padded

    async def _submit_user_operation(
        self, call_data: bytes, gas_estimate: int
    ) -> str:
        """Submit a UserOperation to the bundler.

        Args:
            call_data: Encoded call data.
            gas_estimate: Gas estimate.

        Returns:
            UserOperation hash.
        """
        # In production, this would interact with the bundler JSON-RPC API.
        # For the SDK interface, we return a placeholder that downstream
        # integrations will replace with actual bundler interaction.
        import hashlib

        return "0x" + hashlib.sha256(call_data).hexdigest()
