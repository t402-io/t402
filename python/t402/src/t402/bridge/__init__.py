"""USDT0 Cross-Chain Bridge Module.

Provides cross-chain USDT0 transfers using LayerZero OFT standard,
with message tracking via LayerZero Scan API.

Example:
    ```python
    from t402.bridge import (
        Usdt0Bridge,
        LayerZeroScanClient,
        CrossChainPaymentRouter,
        get_bridgeable_chains,
    )

    # Check supported chains
    print(get_bridgeable_chains())  # ['ethereum', 'arbitrum', 'ink', ...]

    # Create bridge client
    bridge = Usdt0Bridge(signer, 'arbitrum')

    # Get quote
    quote = await bridge.quote(BridgeQuoteParams(
        from_chain='arbitrum',
        to_chain='ethereum',
        amount=100_000000,
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

    # Track message delivery
    scan_client = LayerZeroScanClient()
    message = await scan_client.wait_for_delivery(
        result.message_guid,
        on_status_change=lambda s: print(f"Status: {s}")
    )
    print(f"Delivered! Dest TX: {message.dst_tx_hash}")
    ```
"""

# Bridge client
from .client import Usdt0Bridge, create_usdt0_bridge

# LayerZero Scan client
from .scan import LayerZeroScanClient, create_layerzero_scan_client

# Cross-chain payment router
from .router import CrossChainPaymentRouter, create_cross_chain_payment_router

# Constants
from .constants import (
    LAYERZERO_ENDPOINT_IDS,
    USDT0_OFT_ADDRESSES,
    LAYERZERO_SCAN_BASE_URL,
    NETWORK_TO_CHAIN,
    CHAIN_TO_NETWORK,
    get_endpoint_id,
    get_endpoint_id_from_network,
    get_usdt0_oft_address,
    supports_bridging,
    get_bridgeable_chains,
    address_to_bytes32,
    bytes32_to_address,
)

# Types
from .types import (
    # Bridge types
    BridgeQuoteParams,
    BridgeQuote,
    BridgeExecuteParams,
    BridgeResult,
    BridgeStatus,
    BridgeSigner,
    SendParam,
    MessagingFee,
    TransactionLog,
    BridgeTransactionReceipt,
    # LayerZero Scan types
    LayerZeroMessage,
    LayerZeroMessageStatus,
    WaitForDeliveryOptions,
    # Cross-chain payment types
    CrossChainPaymentParams,
    CrossChainPaymentResult,
)

__all__ = [
    # Bridge client
    "Usdt0Bridge",
    "create_usdt0_bridge",
    # LayerZero Scan client
    "LayerZeroScanClient",
    "create_layerzero_scan_client",
    # Cross-chain payment router
    "CrossChainPaymentRouter",
    "create_cross_chain_payment_router",
    # Constants
    "LAYERZERO_ENDPOINT_IDS",
    "USDT0_OFT_ADDRESSES",
    "LAYERZERO_SCAN_BASE_URL",
    "NETWORK_TO_CHAIN",
    "CHAIN_TO_NETWORK",
    "get_endpoint_id",
    "get_endpoint_id_from_network",
    "get_usdt0_oft_address",
    "supports_bridging",
    "get_bridgeable_chains",
    "address_to_bytes32",
    "bytes32_to_address",
    # Bridge types
    "BridgeQuoteParams",
    "BridgeQuote",
    "BridgeExecuteParams",
    "BridgeResult",
    "BridgeStatus",
    "BridgeSigner",
    "SendParam",
    "MessagingFee",
    "TransactionLog",
    "BridgeTransactionReceipt",
    # LayerZero Scan types
    "LayerZeroMessage",
    "LayerZeroMessageStatus",
    "WaitForDeliveryOptions",
    # Cross-chain payment types
    "CrossChainPaymentParams",
    "CrossChainPaymentResult",
]
