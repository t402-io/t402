"""Spark Exact Payment Scheme.

This package provides the exact payment scheme implementation for Spark
(Bitcoin L2) payments.

Spark has instant finality, so settlement is a confirmation no-op.

Components:
    - SparkFacilitatorScheme: Facilitator-side (verifies transfers, confirms Lightning)
"""

from t402.schemes.spark.exact.facilitator import SparkFacilitatorScheme

__all__ = [
    "SparkFacilitatorScheme",
]
