"""EVM ERC-7710 Delegation Payment Scheme.

This package provides the ERC-7710 delegation-based payment scheme implementation
for EVM networks using smart contract accounts (ERC-4337, ERC-7579).

The ERC-7710 scheme enables payments via delegation where a facilitator calls
DelegationManager.redeemDelegations() to execute token transfers on behalf of
the delegator.
"""

from t402.schemes.evm.erc7710.facilitator import (
    ERC7710EvmFacilitatorScheme,
    ERC7710EvmFacilitatorSigner,
    ERC7710TransactionConfirmation,
    encode_erc7579_execution,
    parse_erc7710_payload,
    SCHEME_EXACT,
    SINGLE_CALL_MODE,
    REDEEM_DELEGATIONS_ABI,
)

__all__ = [
    "ERC7710EvmFacilitatorScheme",
    "ERC7710EvmFacilitatorSigner",
    "ERC7710TransactionConfirmation",
    "encode_erc7579_execution",
    "parse_erc7710_payload",
    "SCHEME_EXACT",
    "SINGLE_CALL_MODE",
    "REDEEM_DELEGATIONS_ABI",
]
