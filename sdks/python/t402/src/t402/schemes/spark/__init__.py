"""Spark (Bitcoin L2) Payment Schemes.

This package provides payment scheme implementations for Spark,
a Bitcoin L2 with instant transfers.

Supported payment types:
- spark: Direct Spark transfer, verified by transfer_id lookup
- lightning: Lightning Network payment routed through Spark,
  verified by SHA256(preimage) == payment_hash

Usage:
    ```python
    from t402.schemes.spark import (
        # Facilitator scheme
        SparkFacilitatorScheme,
        # Types
        SparkPayload,
        SparkSigner,
        TransferInfo,
        TransferStatus,
        SparkRequirementsExtra,
        # Constants
        SPARK_MAINNET,
        SPARK_TESTNET,
        SCHEME_EXACT,
        PAYMENT_TYPE_SPARK,
        PAYMENT_TYPE_LIGHTNING,
    )
    ```
"""

# Facilitator scheme
from t402.schemes.spark.exact import SparkFacilitatorScheme

# Types
from t402.schemes.spark.types import (
    SparkPayload,
    SparkSigner,
    TransferInfo,
    TransferStatus,
    SparkRequirementsExtra,
)

# Constants
from t402.schemes.spark.types import (
    SPARK_MAINNET,
    SPARK_TESTNET,
    SCHEME_EXACT,
    SPARK_CAIP_FAMILY,
    SPARK_NETWORKS,
    PAYMENT_TYPE_SPARK,
    PAYMENT_TYPE_LIGHTNING,
)

__all__ = [
    # Facilitator scheme
    "SparkFacilitatorScheme",
    # Types
    "SparkPayload",
    "SparkSigner",
    "TransferInfo",
    "TransferStatus",
    "SparkRequirementsExtra",
    # Constants
    "SPARK_MAINNET",
    "SPARK_TESTNET",
    "SCHEME_EXACT",
    "SPARK_CAIP_FAMILY",
    "SPARK_NETWORKS",
    "PAYMENT_TYPE_SPARK",
    "PAYMENT_TYPE_LIGHTNING",
]
