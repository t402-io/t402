# Package version
__version__ = "1.7.1"

# Re-export commonly used items for convenience
from t402.common import (
    parse_money,
    process_price_to_atomic_amount,
    find_matching_payment_requirements,
    t402_VERSION,
)
from t402.networks import (
    is_ton_network,
    is_tron_network,
    is_evm_network,
    is_svm_network,
    get_network_type,
)
from t402.types import (
    # Protocol version constants
    T402_VERSION,
    T402_VERSION_V1,
    T402_VERSION_V2,
    Network,
    # V1 Types (Legacy)
    PaymentRequirements,
    PaymentRequirementsV1,
    PaymentPayload,
    PaymentPayloadV1,
    t402PaymentRequiredResponse,
    t402PaymentRequiredResponseV1,
    # V2 Types (Current)
    ResourceInfo,
    PaymentRequirementsV2,
    PaymentRequiredV2,
    PaymentPayloadV2,
    PaymentResponseV2,
    # Facilitator Types
    SupportedKind,
    SupportedResponse,
    # Common Types
    VerifyResponse,
    SettleResponse,
    TonAuthorization,
    TonPaymentPayload,
    TronAuthorization,
    TronPaymentPayload,
)
from t402.encoding import (
    # Base64 utilities
    safe_base64_encode,
    safe_base64_decode,
    is_valid_base64,
    # Header name constants
    HEADER_PAYMENT_SIGNATURE,
    HEADER_PAYMENT_REQUIRED,
    HEADER_PAYMENT_RESPONSE,
    HEADER_X_PAYMENT,
    HEADER_X_PAYMENT_RESPONSE,
    # Encoding/Decoding functions
    encode_payment_signature_header,
    decode_payment_signature_header,
    encode_payment_required_header,
    decode_payment_required_header,
    encode_payment_response_header,
    decode_payment_response_header,
    # Header detection utilities
    get_payment_header_name,
    get_payment_response_header_name,
    detect_protocol_version_from_headers,
    extract_payment_from_headers,
    extract_payment_required_from_response,
)
from t402.facilitator import FacilitatorClient, FacilitatorConfig
from t402.exact import (
    prepare_payment_header,
    sign_payment_header,
    encode_payment,
    decode_payment,
)
from t402.ton import (
    TON_MAINNET,
    TON_TESTNET,
    USDT_MAINNET_ADDRESS,
    USDT_TESTNET_ADDRESS,
    validate_ton_address,
    get_usdt_address,
    get_network_config as get_ton_network_config,
    get_default_asset as get_ton_default_asset,
    prepare_ton_payment_header,
    parse_amount as parse_ton_amount,
    format_amount as format_ton_amount,
    validate_boc,
    is_testnet as is_ton_testnet,
)
from t402.tron import (
    TRON_MAINNET,
    TRON_NILE,
    TRON_SHASTA,
    USDT_MAINNET_ADDRESS as TRON_USDT_MAINNET_ADDRESS,
    USDT_NILE_ADDRESS as TRON_USDT_NILE_ADDRESS,
    USDT_SHASTA_ADDRESS as TRON_USDT_SHASTA_ADDRESS,
    validate_tron_address,
    get_usdt_address as get_tron_usdt_address,
    get_network_config as get_tron_network_config,
    get_default_asset as get_tron_default_asset,
    prepare_tron_payment_header,
    parse_amount as parse_tron_amount,
    format_amount as format_tron_amount,
    is_testnet as is_tron_testnet,
)
from t402.svm import (
    # Constants
    SOLANA_MAINNET,
    SOLANA_DEVNET,
    SOLANA_TESTNET,
    USDC_MAINNET_ADDRESS as SVM_USDC_MAINNET_ADDRESS,
    USDC_DEVNET_ADDRESS as SVM_USDC_DEVNET_ADDRESS,
    TOKEN_PROGRAM_ADDRESS as SVM_TOKEN_PROGRAM_ADDRESS,
    TOKEN_2022_PROGRAM_ADDRESS as SVM_TOKEN_2022_PROGRAM_ADDRESS,
    # Address/Network utilities
    validate_svm_address,
    get_usdc_address as get_svm_usdc_address,
    get_network_config as get_svm_network_config,
    get_default_asset as get_svm_default_asset,
    prepare_svm_payment_header,
    parse_amount as parse_svm_amount,
    format_amount as format_svm_amount,
    is_testnet as is_svm_testnet,
    validate_transaction as validate_svm_transaction,
    normalize_network as normalize_svm_network,
    get_rpc_url as get_svm_rpc_url,
    # Transaction utilities
    decode_transaction as decode_svm_transaction,
    decode_versioned_transaction,
    encode_transaction as encode_svm_transaction,
    get_transaction_fee_payer as get_svm_fee_payer,
    get_token_payer_from_transaction as get_svm_token_payer,
    parse_transfer_checked_instruction,
    TransferDetails as SvmTransferDetails,
    # Signer interfaces and implementations
    ClientSvmSigner,
    FacilitatorSvmSigner,
    KeypairSvmSigner,
    RpcSvmSigner,
    # Scheme implementations
    ExactSvmClientScheme,
    ExactSvmServerScheme,
    ExactSvmFacilitatorScheme,
    # Factory functions
    create_client_scheme as create_svm_client_scheme,
    create_server_scheme as create_svm_server_scheme,
    create_facilitator_scheme as create_svm_facilitator_scheme,
    check_solana_available,
    # Types
    SvmAuthorization,
    SvmPaymentPayload,
    SvmVerifyMessageResult,
    SvmTransactionConfirmation,
    ExactSvmPayloadV2,
)
from t402.paywall import (
    get_paywall_html,
    get_paywall_template,
    is_browser_request,
)
from t402.erc4337 import (
    # Constants
    ENTRYPOINT_V07_ADDRESS,
    ENTRYPOINT_V06_ADDRESS,
    SAFE_4337_ADDRESSES,
    SUPPORTED_CHAINS as ERC4337_SUPPORTED_CHAINS,
    # Types
    UserOperation,
    PackedUserOperation,
    PaymasterData,
    GasEstimate,
    UserOperationReceipt,
    # Bundlers
    GenericBundlerClient,
    PimlicoBundlerClient,
    AlchemyBundlerClient,
    create_bundler_client,
    # Paymasters
    PimlicoPaymaster,
    BiconomyPaymaster,
    StackupPaymaster,
    create_paymaster,
    # Accounts
    SafeSmartAccount,
    SafeAccountConfig,
    create_smart_account,
)
from t402.bridge import (
    # Client
    Usdt0Bridge,
    create_usdt0_bridge,
    # LayerZero Scan
    LayerZeroScanClient,
    create_layerzero_scan_client,
    # Router
    CrossChainPaymentRouter,
    create_cross_chain_payment_router,
    # Constants
    LAYERZERO_ENDPOINT_IDS,
    USDT0_OFT_ADDRESSES,
    LAYERZERO_SCAN_BASE_URL,
    get_bridgeable_chains,
    supports_bridging,
    # Types
    BridgeQuoteParams,
    BridgeQuote,
    BridgeExecuteParams,
    BridgeResult,
    LayerZeroMessage,
    LayerZeroMessageStatus,
    CrossChainPaymentParams,
    CrossChainPaymentResult,
)
from t402.wdk import (
    # Signer
    WDKSigner,
    generate_seed_phrase,
    validate_seed_phrase,
    # Types
    WDKConfig,
    ChainConfig as WDKChainConfig,
    NetworkType,
    TokenInfo as WDKTokenInfo,
    TokenBalance,
    ChainBalance,
    AggregatedBalance,
    PaymentParams,
    PaymentResult,
    SignedTypedData,
    # Chain utilities
    DEFAULT_CHAINS as WDK_DEFAULT_CHAINS,
    USDT0_ADDRESSES as WDK_USDT0_ADDRESSES,
    get_chain_config as get_wdk_chain_config,
    get_usdt0_chains as get_wdk_usdt0_chains,
    # Errors
    WDKError,
    WDKInitializationError,
    SignerError,
    SigningError,
    BalanceError as WDKBalanceError,
    WDKErrorCode,
)
from t402.schemes import (
    # Interfaces
    SchemeNetworkClient,
    SchemeNetworkServer,
    SchemeNetworkFacilitator,
    BaseSchemeNetworkClient,
    BaseSchemeNetworkServer,
    BaseSchemeNetworkFacilitator,
    # Registry
    SchemeRegistry,
    ClientSchemeRegistry,
    ServerSchemeRegistry,
    FacilitatorSchemeRegistry,
    get_client_registry,
    get_server_registry,
    get_facilitator_registry,
    reset_global_registries,
)
from t402.schemes.evm import (
    ExactEvmClientScheme,
    ExactEvmServerScheme,
    EvmSigner,
)
from t402.schemes.ton import (
    ExactTonClientScheme,
    ExactTonServerScheme,
    TonSigner,
)
from t402.schemes.tron import (
    ExactTronClientScheme,
    ExactTronServerScheme,
    TronSigner,
)

# FastAPI Integration
from t402.fastapi import (
    PaymentMiddleware as FastAPIPaymentMiddleware,
    PaymentConfig as FastAPIPaymentConfig,
    PaymentDetails as FastAPIPaymentDetails,
    PaymentRequired,
    require_payment as fastapi_require_payment,
    get_payment_details,
    settle_payment,
)

def hello() -> str:
    return "Hello from t402!"


__all__ = [
    # Version
    "__version__",
    # Core
    "hello",
    "t402_VERSION",
    # Protocol Version Constants
    "T402_VERSION",
    "T402_VERSION_V1",
    "T402_VERSION_V2",
    "Network",
    # Common utilities
    "parse_money",
    "process_price_to_atomic_amount",
    "find_matching_payment_requirements",
    # Network utilities
    "is_ton_network",
    "is_tron_network",
    "is_evm_network",
    "is_svm_network",
    "get_network_type",
    # V1 Types (Legacy)
    "PaymentRequirements",
    "PaymentRequirementsV1",
    "PaymentPayload",
    "PaymentPayloadV1",
    "t402PaymentRequiredResponse",
    "t402PaymentRequiredResponseV1",
    # V2 Types (Current)
    "ResourceInfo",
    "PaymentRequirementsV2",
    "PaymentRequiredV2",
    "PaymentPayloadV2",
    "PaymentResponseV2",
    # Facilitator Types
    "SupportedKind",
    "SupportedResponse",
    # Common Types
    "VerifyResponse",
    "SettleResponse",
    "TonAuthorization",
    "TonPaymentPayload",
    "TronAuthorization",
    "TronPaymentPayload",
    # Encoding utilities
    "safe_base64_encode",
    "safe_base64_decode",
    "is_valid_base64",
    # Header constants
    "HEADER_PAYMENT_SIGNATURE",
    "HEADER_PAYMENT_REQUIRED",
    "HEADER_PAYMENT_RESPONSE",
    "HEADER_X_PAYMENT",
    "HEADER_X_PAYMENT_RESPONSE",
    # Header encoding/decoding
    "encode_payment_signature_header",
    "decode_payment_signature_header",
    "encode_payment_required_header",
    "decode_payment_required_header",
    "encode_payment_response_header",
    "decode_payment_response_header",
    # Header detection
    "get_payment_header_name",
    "get_payment_response_header_name",
    "detect_protocol_version_from_headers",
    "extract_payment_from_headers",
    "extract_payment_required_from_response",
    # Facilitator
    "FacilitatorClient",
    "FacilitatorConfig",
    # EVM payment
    "prepare_payment_header",
    "sign_payment_header",
    "encode_payment",
    "decode_payment",
    # TON utilities
    "TON_MAINNET",
    "TON_TESTNET",
    "USDT_MAINNET_ADDRESS",
    "USDT_TESTNET_ADDRESS",
    "validate_ton_address",
    "get_usdt_address",
    "get_ton_network_config",
    "get_ton_default_asset",
    "prepare_ton_payment_header",
    "parse_ton_amount",
    "format_ton_amount",
    "validate_boc",
    "is_ton_testnet",
    # TRON utilities
    "TRON_MAINNET",
    "TRON_NILE",
    "TRON_SHASTA",
    "TRON_USDT_MAINNET_ADDRESS",
    "TRON_USDT_NILE_ADDRESS",
    "TRON_USDT_SHASTA_ADDRESS",
    "validate_tron_address",
    "get_tron_usdt_address",
    "get_tron_network_config",
    "get_tron_default_asset",
    "prepare_tron_payment_header",
    "parse_tron_amount",
    "format_tron_amount",
    "is_tron_testnet",
    # SVM (Solana) utilities - Constants
    "SOLANA_MAINNET",
    "SOLANA_DEVNET",
    "SOLANA_TESTNET",
    "SVM_USDC_MAINNET_ADDRESS",
    "SVM_USDC_DEVNET_ADDRESS",
    "SVM_TOKEN_PROGRAM_ADDRESS",
    "SVM_TOKEN_2022_PROGRAM_ADDRESS",
    # SVM - Address/Network utilities
    "validate_svm_address",
    "get_svm_usdc_address",
    "get_svm_network_config",
    "get_svm_default_asset",
    "prepare_svm_payment_header",
    "parse_svm_amount",
    "format_svm_amount",
    "is_svm_testnet",
    "validate_svm_transaction",
    "normalize_svm_network",
    "get_svm_rpc_url",
    # SVM - Transaction utilities
    "decode_svm_transaction",
    "decode_versioned_transaction",
    "encode_svm_transaction",
    "get_svm_fee_payer",
    "get_svm_token_payer",
    "parse_transfer_checked_instruction",
    "SvmTransferDetails",
    # SVM - Signer interfaces
    "ClientSvmSigner",
    "FacilitatorSvmSigner",
    "KeypairSvmSigner",
    "RpcSvmSigner",
    # SVM - Scheme implementations
    "ExactSvmClientScheme",
    "ExactSvmServerScheme",
    "ExactSvmFacilitatorScheme",
    # SVM - Factory functions
    "create_svm_client_scheme",
    "create_svm_server_scheme",
    "create_svm_facilitator_scheme",
    "check_solana_available",
    # SVM - Types
    "SvmAuthorization",
    "SvmPaymentPayload",
    "SvmVerifyMessageResult",
    "SvmTransactionConfirmation",
    "ExactSvmPayloadV2",
    # Paywall
    "get_paywall_html",
    "get_paywall_template",
    "is_browser_request",
    # ERC-4337 Account Abstraction
    "ENTRYPOINT_V07_ADDRESS",
    "ENTRYPOINT_V06_ADDRESS",
    "SAFE_4337_ADDRESSES",
    "ERC4337_SUPPORTED_CHAINS",
    "UserOperation",
    "PackedUserOperation",
    "PaymasterData",
    "GasEstimate",
    "UserOperationReceipt",
    "GenericBundlerClient",
    "PimlicoBundlerClient",
    "AlchemyBundlerClient",
    "create_bundler_client",
    "PimlicoPaymaster",
    "BiconomyPaymaster",
    "StackupPaymaster",
    "create_paymaster",
    "SafeSmartAccount",
    "SafeAccountConfig",
    "create_smart_account",
    # USDT0 Bridge
    "Usdt0Bridge",
    "create_usdt0_bridge",
    "LayerZeroScanClient",
    "create_layerzero_scan_client",
    "CrossChainPaymentRouter",
    "create_cross_chain_payment_router",
    "LAYERZERO_ENDPOINT_IDS",
    "USDT0_OFT_ADDRESSES",
    "LAYERZERO_SCAN_BASE_URL",
    "get_bridgeable_chains",
    "supports_bridging",
    "BridgeQuoteParams",
    "BridgeQuote",
    "BridgeExecuteParams",
    "BridgeResult",
    "LayerZeroMessage",
    "LayerZeroMessageStatus",
    "CrossChainPaymentParams",
    "CrossChainPaymentResult",
    # WDK - Signer
    "WDKSigner",
    "generate_seed_phrase",
    "validate_seed_phrase",
    # WDK - Types
    "WDKConfig",
    "WDKChainConfig",
    "NetworkType",
    "WDKTokenInfo",
    "TokenBalance",
    "ChainBalance",
    "AggregatedBalance",
    "PaymentParams",
    "PaymentResult",
    "SignedTypedData",
    # WDK - Chain utilities
    "WDK_DEFAULT_CHAINS",
    "WDK_USDT0_ADDRESSES",
    "get_wdk_chain_config",
    "get_wdk_usdt0_chains",
    # WDK - Errors
    "WDKError",
    "WDKInitializationError",
    "SignerError",
    "SigningError",
    "WDKBalanceError",
    "WDKErrorCode",
    # Scheme Interfaces
    "SchemeNetworkClient",
    "SchemeNetworkServer",
    "SchemeNetworkFacilitator",
    "BaseSchemeNetworkClient",
    "BaseSchemeNetworkServer",
    "BaseSchemeNetworkFacilitator",
    # Scheme Registry
    "SchemeRegistry",
    "ClientSchemeRegistry",
    "ServerSchemeRegistry",
    "FacilitatorSchemeRegistry",
    "get_client_registry",
    "get_server_registry",
    "get_facilitator_registry",
    "reset_global_registries",
    # EVM Schemes
    "ExactEvmClientScheme",
    "ExactEvmServerScheme",
    "EvmSigner",
    # TON Schemes
    "ExactTonClientScheme",
    "ExactTonServerScheme",
    "TonSigner",
    # TRON Schemes
    "ExactTronClientScheme",
    "ExactTronServerScheme",
    "TronSigner",
    # FastAPI Integration
    "FastAPIPaymentMiddleware",
    "FastAPIPaymentConfig",
    "FastAPIPaymentDetails",
    "PaymentRequired",
    "fastapi_require_payment",
    "get_payment_details",
    "settle_payment",
]
