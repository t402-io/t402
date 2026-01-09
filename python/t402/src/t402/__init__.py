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
    get_network_type,
)
from t402.types import (
    PaymentRequirements,
    PaymentPayload,
    VerifyResponse,
    SettleResponse,
    TonAuthorization,
    TonPaymentPayload,
    TronAuthorization,
    TronPaymentPayload,
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

def hello() -> str:
    return "Hello from t402!"


__all__ = [
    # Core
    "hello",
    "t402_VERSION",
    # Common utilities
    "parse_money",
    "process_price_to_atomic_amount",
    "find_matching_payment_requirements",
    # Network utilities
    "is_ton_network",
    "is_tron_network",
    "is_evm_network",
    "get_network_type",
    # Types
    "PaymentRequirements",
    "PaymentPayload",
    "VerifyResponse",
    "SettleResponse",
    "TonAuthorization",
    "TonPaymentPayload",
    "TronAuthorization",
    "TronPaymentPayload",
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
]
