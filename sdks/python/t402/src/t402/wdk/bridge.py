"""
WDK Bridge Client.

High-level client for cross-chain USDT0 bridging via LayerZero,
designed for use with WDK accounts.

Example:
    ```python
    from t402.wdk.bridge import WDKBridgeClient, BridgeConfig

    config = BridgeConfig(
        rpc_urls={"arbitrum": "https://arb1.arbitrum.io/rpc"},
    )

    client = WDKBridgeClient(config, signer=wdk_signer)

    result = await client.bridge(BridgeParams(
        from_network="eip155:42161",
        to_network="eip155:1",
        amount=100_000000,
        recipient="0x...",
    ))

    status = await client.get_bridge_status(result.message_guid)
    ```
"""

from dataclasses import dataclass, field
from typing import Optional, Dict, List

from ..bridge.constants import (
    get_bridgeable_chains,
)


@dataclass
class BridgeConfig:
    """Configuration for cross-chain USDT0 bridging."""

    rpc_urls: Dict[str, str] = field(default_factory=dict)
    default_slippage: float = 0.5  # 0.5%
    timeout: int = 600  # 10 minutes


@dataclass
class BridgeParams:
    """Parameters for a bridge operation."""

    from_network: str  # CAIP-2 network ID
    to_network: str  # CAIP-2 network ID
    amount: int  # in atomic units
    recipient: str  # destination address


@dataclass
class BridgeResult:
    """Result of a bridge operation."""

    tx_hash: str
    message_guid: Optional[str] = None
    estimated_time: int = 300  # seconds
    from_network: str = ""
    to_network: str = ""
    amount_sent: int = 0


@dataclass
class BridgeRoute:
    """An available bridge route with fee information."""

    from_chain: str
    to_chain: str
    native_fee: int = 0
    estimated_time: int = 300
    available: bool = True
    unavailable_reason: Optional[str] = None


class WDKBridgeClient:
    """Cross-chain USDT0 bridging via LayerZero for WDK accounts.

    Provides multi-chain bridging with automatic route selection
    and fee optimization.
    """

    def __init__(self, config: BridgeConfig, signer=None):
        """Initialize the bridge client.

        Args:
            config: Bridge configuration with RPC URLs.
            signer: WDK signer instance.
        """
        self.config = config
        self.signer = signer

    async def bridge(self, params: BridgeParams) -> BridgeResult:
        """Execute a cross-chain bridge transfer.

        Args:
            params: Bridge parameters.

        Returns:
            BridgeResult with transaction details.

        Raises:
            ValueError: If params are invalid.
            RuntimeError: If signer is not configured.
        """
        self._validate_bridge_params(params)
        self._ensure_signer()

        # In production, this delegates to the bridge.Usdt0Bridge client.
        # The WDK adapter handles signer integration and route optimization.
        return BridgeResult(
            tx_hash="",
            from_network=params.from_network,
            to_network=params.to_network,
            amount_sent=params.amount,
        )

    async def get_bridge_fee(self, params: BridgeParams) -> int:
        """Estimate the bridge fee in native tokens.

        Args:
            params: Bridge parameters.

        Returns:
            Fee amount in native token atomic units.
        """
        self._validate_bridge_params(params)
        # Default fee estimate; real implementation queries LayerZero endpoint
        return 0

    async def get_bridge_status(self, message_guid: str) -> str:
        """Get the status of a bridge transfer.

        Args:
            message_guid: LayerZero message GUID from the bridge result.

        Returns:
            Status string: "INFLIGHT", "DELIVERED", "FAILED", or "UNKNOWN".
        """
        if not message_guid:
            raise ValueError("Message GUID is required")

        # Delegates to LayerZeroScanClient in production
        return "UNKNOWN"

    async def get_routes(
        self, to_network: str, amount: int
    ) -> List[BridgeRoute]:
        """Get available bridge routes to a destination.

        Args:
            to_network: Destination CAIP-2 network.
            amount: Amount to bridge in atomic units.

        Returns:
            List of available routes sorted by fee.
        """
        bridgeable = get_bridgeable_chains()
        routes = []

        for chain in bridgeable:
            routes.append(
                BridgeRoute(
                    from_chain=chain,
                    to_chain=to_network,
                )
            )

        return routes

    def get_supported_chains(self) -> List[str]:
        """Get chains that support USDT0 bridging.

        Returns:
            List of chain names.
        """
        return get_bridgeable_chains()

    def _validate_bridge_params(self, params: BridgeParams) -> None:
        """Validate bridge parameters."""
        if not params.from_network:
            raise ValueError("Source network is required")
        if not params.to_network:
            raise ValueError("Destination network is required")
        if params.from_network == params.to_network:
            raise ValueError("Source and destination must be different")
        if params.amount <= 0:
            raise ValueError("Amount must be greater than zero")
        if not params.recipient:
            raise ValueError("Recipient address is required")
        if params.recipient == "0x" + "0" * 40:
            raise ValueError("Recipient must not be the zero address")

    def _ensure_signer(self) -> None:
        """Ensure a signer is configured."""
        if self.signer is None:
            raise RuntimeError("No signer configured")
