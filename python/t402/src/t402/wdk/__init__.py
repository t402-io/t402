"""
T402 WDK Python Adapter

Provides wallet functionality for T402 payments using Tether WDK-compatible
seed phrase derivation.

Example:
    ```python
    from t402.wdk import WDKSigner, generate_seed_phrase

    # Generate a new seed phrase
    seed = generate_seed_phrase()

    # Create signer
    signer = WDKSigner(
        seed_phrase=seed,
        chains={"arbitrum": "https://arb1.arbitrum.io/rpc"}
    )
    await signer.initialize()

    # Get address
    address = signer.get_address("evm")

    # Get balances
    balances = await signer.get_all_balances()
    ```
"""

from .signer import (
    WDKSigner,
    generate_seed_phrase,
    validate_seed_phrase,
    format_token_amount,
)
from .types import (
    # Core types
    WDKConfig,
    ChainConfig,
    NetworkType,
    # Token types
    TokenInfo,
    TokenBalance,
    ChainBalance,
    AggregatedBalance,
    # Payment types
    PaymentParams,
    PaymentResult,
    SignedTypedData,
    TypedDataDomain,
    # Bridge types
    BridgeParams,
    BridgeResult,
)
from .chains import (
    # Chain configuration
    DEFAULT_CHAINS,
    CHAIN_TOKENS,
    # Token addresses
    USDT0_ADDRESSES,
    USDC_ADDRESSES,
    USDT_LEGACY_ADDRESSES,
    # Utility functions
    get_chain_config,
    get_chain_id,
    get_network_from_chain,
    get_chain_from_network,
    get_usdt0_chains,
    get_chain_tokens,
    get_preferred_token,
    get_token_address,
    is_testnet,
)
from .errors import (
    # Error classes
    WDKError,
    WDKInitializationError,
    SignerError,
    SigningError,
    ChainError,
    BalanceError,
    TransactionError,
    BridgeError,
    # Error codes
    WDKErrorCode,
    # Utilities
    is_wdk_error,
)


__all__ = [
    # Signer
    "WDKSigner",
    "generate_seed_phrase",
    "validate_seed_phrase",
    "format_token_amount",
    # Core types
    "WDKConfig",
    "ChainConfig",
    "NetworkType",
    # Token types
    "TokenInfo",
    "TokenBalance",
    "ChainBalance",
    "AggregatedBalance",
    # Payment types
    "PaymentParams",
    "PaymentResult",
    "SignedTypedData",
    "TypedDataDomain",
    # Bridge types
    "BridgeParams",
    "BridgeResult",
    # Chain configuration
    "DEFAULT_CHAINS",
    "CHAIN_TOKENS",
    "USDT0_ADDRESSES",
    "USDC_ADDRESSES",
    "USDT_LEGACY_ADDRESSES",
    # Chain utilities
    "get_chain_config",
    "get_chain_id",
    "get_network_from_chain",
    "get_chain_from_network",
    "get_usdt0_chains",
    "get_chain_tokens",
    "get_preferred_token",
    "get_token_address",
    "is_testnet",
    # Error classes
    "WDKError",
    "WDKInitializationError",
    "SignerError",
    "SigningError",
    "ChainError",
    "BalanceError",
    "TransactionError",
    "BridgeError",
    "WDKErrorCode",
    "is_wdk_error",
]
