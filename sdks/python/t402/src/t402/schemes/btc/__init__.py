"""Bitcoin & Lightning Network Payment Schemes.

This package provides payment scheme implementations for Bitcoin on-chain
(via PSBT) and Lightning Network (via BOLT11) payments.

Supported schemes:
- exact (on-chain): PSBT-based Bitcoin payments
- exact (lightning): BOLT11 invoice-based Lightning payments

Usage:
    ```python
    from t402.schemes.btc import (
        # On-chain schemes
        ExactBtcClientScheme,
        ExactBtcServerScheme,
        ExactBtcFacilitatorScheme,
        # Lightning schemes
        LightningClientScheme,
        LightningServerScheme,
        LightningFacilitatorScheme,
        # Signer protocols
        ClientBtcSigner,
        ClientLightningSigner,
        FacilitatorBtcSigner,
        FacilitatorLightningSigner,
        # Constants
        BTC_MAINNET,
        BTC_TESTNET,
        LIGHTNING_MAINNET,
        LIGHTNING_TESTNET,
    )
    ```
"""

# On-chain (exact) schemes
from t402.schemes.btc.exact import (
    ExactBtcClientScheme,
    ExactBtcServerScheme,
    ExactBtcFacilitatorScheme,
)
from t402.schemes.btc.exact.client import ExactBtcClientConfig
from t402.schemes.btc.exact.server import ExactBtcServerConfig
from t402.schemes.btc.exact.facilitator import ExactBtcFacilitatorConfig

# Lightning schemes
from t402.schemes.btc.lightning import (
    LightningClientScheme,
    LightningServerScheme,
    LightningFacilitatorScheme,
)
from t402.schemes.btc.lightning.server import LightningServerConfig, InvoiceGenerator

# Signer protocols
from t402.schemes.btc.types import (
    ClientBtcSigner,
    ClientLightningSigner,
    FacilitatorBtcSigner,
    FacilitatorLightningSigner,
    BtcOnchainPayload,
    LightningPayload,
)

# Constants
from t402.schemes.btc.constants import (
    SCHEME_EXACT,
    BTC_MAINNET,
    BTC_TESTNET,
    BTC_SIGNET,
    LIGHTNING_MAINNET,
    LIGHTNING_TESTNET,
    BTC_NETWORKS,
    LIGHTNING_NETWORKS,
    ALL_NETWORKS,
    DUST_LIMIT,
    MIN_RELAY_FEE,
    SATS_PER_BTC,
    DEFAULT_VALIDITY_DURATION,
    MAINNET_ADDRESS_PREFIXES,
    TESTNET_ADDRESS_PREFIXES,
    BTC_CAIP_FAMILY,
    LIGHTNING_CAIP_FAMILY,
    # Validation functions
    is_valid_btc_network,
    is_valid_lightning_network,
    is_valid_network,
    validate_bitcoin_address,
    is_mainnet_address,
    is_testnet_address,
    validate_bolt11_invoice,
    is_valid_hex,
    satoshis_to_btc,
    btc_to_satoshis,
    get_supported_networks,
)

__all__ = [
    # On-chain scheme implementations
    "ExactBtcClientScheme",
    "ExactBtcServerScheme",
    "ExactBtcFacilitatorScheme",
    # On-chain configurations
    "ExactBtcClientConfig",
    "ExactBtcServerConfig",
    "ExactBtcFacilitatorConfig",
    # Lightning scheme implementations
    "LightningClientScheme",
    "LightningServerScheme",
    "LightningFacilitatorScheme",
    # Lightning configurations
    "LightningServerConfig",
    "InvoiceGenerator",
    # Signer protocols
    "ClientBtcSigner",
    "ClientLightningSigner",
    "FacilitatorBtcSigner",
    "FacilitatorLightningSigner",
    # Payload types
    "BtcOnchainPayload",
    "LightningPayload",
    # Constants
    "SCHEME_EXACT",
    "BTC_MAINNET",
    "BTC_TESTNET",
    "BTC_SIGNET",
    "LIGHTNING_MAINNET",
    "LIGHTNING_TESTNET",
    "BTC_NETWORKS",
    "LIGHTNING_NETWORKS",
    "ALL_NETWORKS",
    "DUST_LIMIT",
    "MIN_RELAY_FEE",
    "SATS_PER_BTC",
    "DEFAULT_VALIDITY_DURATION",
    "MAINNET_ADDRESS_PREFIXES",
    "TESTNET_ADDRESS_PREFIXES",
    "BTC_CAIP_FAMILY",
    "LIGHTNING_CAIP_FAMILY",
    # Validation functions
    "is_valid_btc_network",
    "is_valid_lightning_network",
    "is_valid_network",
    "validate_bitcoin_address",
    "is_mainnet_address",
    "is_testnet_address",
    "validate_bolt11_invoice",
    "is_valid_hex",
    "satoshis_to_btc",
    "btc_to_satoshis",
    "get_supported_networks",
]
