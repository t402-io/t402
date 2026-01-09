# Re-export commonly used items for convenience
from t402.common import (
    parse_money,
    process_price_to_atomic_amount,
    find_matching_payment_requirements,
    t402_VERSION,
)
from t402.networks import (
    is_ton_network,
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
from t402.paywall import (
    get_paywall_html,
    get_paywall_template,
    is_browser_request,
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
    "is_evm_network",
    "get_network_type",
    # Types
    "PaymentRequirements",
    "PaymentPayload",
    "VerifyResponse",
    "SettleResponse",
    "TonAuthorization",
    "TonPaymentPayload",
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
    # Paywall
    "get_paywall_html",
    "get_paywall_template",
    "is_browser_request",
]
