"""Bitcoin On-chain Exact Payment Scheme.

This package provides the exact payment scheme implementation for Bitcoin on-chain.
Uses PSBTs (Partially Signed Bitcoin Transactions) for payment.

Components:
    - ExactBtcClientScheme: Client-side (builds and signs PSBTs)
    - ExactBtcServerScheme: Server-side (parses prices, enhances requirements)
    - ExactBtcFacilitatorScheme: Facilitator-side (verifies PSBTs, broadcasts txs)
"""

from t402.schemes.btc.exact.client import ExactBtcClientScheme
from t402.schemes.btc.exact.server import ExactBtcServerScheme
from t402.schemes.btc.exact.facilitator import ExactBtcFacilitatorScheme

__all__ = [
    "ExactBtcClientScheme",
    "ExactBtcServerScheme",
    "ExactBtcFacilitatorScheme",
]
