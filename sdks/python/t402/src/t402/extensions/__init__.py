"""T402 Protocol Extensions."""

from t402.extensions.payment_id import (
    PaymentIdExtensionInfo,
    PaymentIdExtension,
    PaymentIdPayload,
    declare_payment_id_extension,
    parse_payment_id_payload,
    validate_payment_id,
)
from t402.extensions.siwx import (
    SIWxExtensionInfo,
    SIWxExtension,
    SIWxPayload,
    declare_siwx_extension,
    parse_siwx_payload,
    validate_siwx_message,
)
from t402.extensions.erc8004 import (
    ERC8004Extension,
    ERC8004PayloadExtension,
    ERC8004_EXTENSION_KEY,
    declare_erc8004_extension,
    get_erc8004_extension,
    create_erc8004_payload_extension,
    verify_agent_identity,
    parse_agent_registry,
)

__all__ = [
    "PaymentIdExtensionInfo",
    "PaymentIdExtension",
    "PaymentIdPayload",
    "declare_payment_id_extension",
    "parse_payment_id_payload",
    "validate_payment_id",
    "SIWxExtensionInfo",
    "SIWxExtension",
    "SIWxPayload",
    "declare_siwx_extension",
    "parse_siwx_payload",
    "validate_siwx_message",
    "ERC8004Extension",
    "ERC8004PayloadExtension",
    "ERC8004_EXTENSION_KEY",
    "declare_erc8004_extension",
    "get_erc8004_extension",
    "create_erc8004_payload_extension",
    "verify_agent_identity",
    "parse_agent_registry",
]
