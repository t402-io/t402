"""Up-To Payment Scheme.

The upto scheme authorizes transfer of up to a maximum amount,
enabling usage-based billing where the final settlement amount
is determined by actual usage.

This is useful for:
- AI inference billing (pay per token)
- Metered API access (pay per request)
- Streaming services (pay per second/minute)
- Data transfer (pay per byte)

Example:
    ```python
    from t402.schemes.upto import (
        UptoPaymentRequirements,
        UptoSettlement,
        create_payment_requirements,
        create_settlement,
    )

    # Server specifies requirements
    requirements = create_payment_requirements(
        network="eip155:8453",
        max_amount="1000000",  # $1.00 max
        asset="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        pay_to="0x...",
    )

    # After service delivery, settle for actual usage
    settlement = create_settlement(
        settle_amount="150000",  # $0.15 actual
        units_consumed=1500,
        unit_price="100",
        unit_type="token",
    )
    ```
"""

from t402.schemes.upto.types import (
    # Constants
    SCHEME_UPTO,
    DEFAULT_MIN_AMOUNT,
    DEFAULT_MAX_TIMEOUT_SECONDS,
    SUPPORTED_UNITS,
    # Models
    UptoExtra,
    UptoPaymentRequirements,
    UptoUsageDetails,
    UptoSettlement,
    UptoSettlementResponse,
    UptoValidationResult,
    # Type guards
    is_upto_payment_requirements,
    is_valid_unit,
    # Factory functions
    create_payment_requirements,
    create_settlement,
)

__all__ = [
    # Constants
    "SCHEME_UPTO",
    "DEFAULT_MIN_AMOUNT",
    "DEFAULT_MAX_TIMEOUT_SECONDS",
    "SUPPORTED_UNITS",
    # Models
    "UptoExtra",
    "UptoPaymentRequirements",
    "UptoUsageDetails",
    "UptoSettlement",
    "UptoSettlementResponse",
    "UptoValidationResult",
    # Type guards
    "is_upto_payment_requirements",
    "is_valid_unit",
    # Factory functions
    "create_payment_requirements",
    "create_settlement",
]
