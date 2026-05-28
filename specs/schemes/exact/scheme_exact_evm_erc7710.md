# Scheme: `exact` on EVM — ERC-7710 Delegation Variant

## Status

**Production.** Implemented across all four t402 reference SDKs (TypeScript, Go, Python, Java).

## Summary

This document specifies how the `exact` scheme on EVM chains is settled when the payer is a **smart account that has issued an ERC-7710 delegation** to a third party. The wire format retains `scheme: "exact"`; the authorization material is a pre-existing delegation rather than a per-payment signature.

ERC-7710 ("Permissions" / "Delegation") allows a smart account to grant a third party the right to execute specific actions on its behalf. In t402, the delegation grants the **facilitator** (or any holder of the `permissionContext`) the right to redeem the delegation to transfer the token amount to the payee.

The defining property of this variant: **no signing happens at payment time.** The delegation issued out-of-band already authorizes the action. This is the natural fit for agent-mediated payments, where an autonomous agent (the delegate) makes payments under a previously-granted budget.

## Prerequisites

- ERC-7579 modular smart account (or compatible with ERC-7710 execution mode) deployed for the payer.
- ERC-7710 Delegation Manager contract deployed and known to both client and facilitator. The `delegationManager` address is per-deployment; the reference SDK resolves it from a chain-specific registry.
- A valid, unexpired, unrevoked delegation issued by the payer's smart account to the delegate (typically the facilitator or an agent owned by the payer).

The delegation is obtained out-of-band via one of:

- ERC-7715 permission request flow (wallet-mediated)
- Direct wallet interaction (custom UX)
- Pre-configured session keys (issued at account creation)

## PaymentRequirements

The `accepted` field of `PaymentRequirements` MUST set `scheme: "exact"`. The `accepted.extra` field MAY include:

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | No | Reserved for future use (not required for ERC-7710) |
| `delegation` | object | No | Server hints for delegation requirements (see below) |
| `delegation.delegationManager` | address | No | Expected DelegationManager contract address |
| `delegation.executionMode` | hex(bytes32) | No | Expected ERC-7579 execution mode (defaults to single-call mode `0x00...00`) |

## PaymentPayload

The `payload` field carries the delegation reference rather than a fresh signature:

```json
{
  "delegationManager": "0xDDDDDDDDDDDD000000000000000000000000DDDD",
  "permissionContext": "0xabcdef0123...",
  "delegator": "0x4337AccountThatIssuedTheDelegation"
}
```

Field definitions:

| Field | Type | Required | Description |
|---|---|---|---|
| `delegationManager` | address | Yes | Address of the ERC-7710 Delegation Manager contract on the target chain |
| `permissionContext` | bytes (hex) | Yes | ABI-encoded delegation proof — what `redeemDelegations` consumes |
| `delegator` | address | Yes | The smart account that issued the delegation (the actual payer of record) |

There is no `signature` field. The signature is embedded inside `permissionContext` per the ERC-7710 spec.

Full `PaymentPayload` example:

```json
{
  "t402Version": 2,
  "resource": {
    "url": "https://api.example.com/premium-data",
    "description": "Access to premium market data",
    "mimeType": "application/json"
  },
  "accepted": {
    "scheme": "exact",
    "network": "eip155:8453",
    "amount": "10000",
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "payTo": "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
    "maxTimeoutSeconds": 60,
    "extra": {
      "delegation": {
        "delegationManager": "0xDDDDDDDDDDDD000000000000000000000000DDDD",
        "executionMode": "0x0000000000000000000000000000000000000000000000000000000000000000"
      }
    }
  },
  "payload": {
    "delegationManager": "0xDDDDDDDDDDDD000000000000000000000000DDDD",
    "permissionContext": "0xabcdef0123...",
    "delegator": "0x4337AccountThatIssuedTheDelegation"
  }
}
```

## Verification

Verification is **entirely simulation-based**. The facilitator does not parse the delegation envelope; it asks the Delegation Manager to validate it via `eth_call`.

The facilitator MUST:

1. **Validate payload shape** — all three fields (`delegationManager`, `permissionContext`, `delegator`) MUST be present and non-empty. Reject with `T402-4200` (malformed delegation payload) if not.
2. **Construct the execution call data** — ABI-encode the ERC-20 `transfer(payTo, amount)` call against the `asset` from `PaymentRequirements`, then wrap in ERC-7579 single-call format:
   ```
   target (20 bytes) + value (32 bytes, zero) + calldata
   ```
   Reference: `encodeERC7579Execution(asset, payTo, amount)` in the TS SDK.
3. **Simulate redemption** — invoke `simulateContract(delegationManager, "redeemDelegations", [[permissionContext], [SINGLE_CALL_MODE], [executionCallData]])` via `eth_call`. If the simulation reverts, the delegation is invalid (expired, revoked, scope-exceeded, or malformed); return `isValid: false`.
4. **Return `payer` = `delegator`** — the smart account address that issued the delegation, NOT the immediate caller. This is the address charged accounting-wise.

The facilitator does NOT need to:

- Parse the delegation's caveat tree (the Delegation Manager does this in simulation)
- Track delegation revocations (the simulation will revert if revoked)
- Track delegation budgets (caveats enforce them on-chain)

## Settlement

Settlement is performed by the facilitator submitting `redeemDelegations` to the Delegation Manager:

```solidity
DelegationManager.redeemDelegations(
  _permissionContexts: [permissionContext],
  _modes: [SINGLE_CALL_MODE],
  _executionCallDatas: [executionCallData]
)
```

`SINGLE_CALL_MODE` is the ERC-7579 mode constant `0x0000000000000000000000000000000000000000000000000000000000000000` representing single non-batched execution.

The facilitator:

1. Sends the `redeemDelegations` transaction from its own EOA (paying gas).
2. Waits for transaction confirmation (`waitForTransaction`).
3. Returns the transaction hash, the `delegator` as the payer of record, and the network from `PaymentRequirements`.

A failed `redeemDelegations` (revert at submission, e.g. because of race condition between simulation and settlement) MUST be reported as settlement failure with `T402-4201` (delegation redemption failed onchain) — distinct from verification failure.

## Batched Delegation Redemption

The Delegation Manager natively supports batch redemption via parallel arrays. Multiple t402 payments from the same or different delegators MAY be batched into a single `redeemDelegations` call to amortize gas. The wire-level batching follows the [`batch-settlement` scheme](../batch-settlement/scheme_batch_settlement_evm.md) (once finalized) or is internal to the facilitator's settlement pipeline.

The single transaction containing batched redemptions returns one transaction hash to t402; per-payment settlement evidence is the same `transactionHash` plus an event-log index. Facilitators implementing batching SHOULD return per-payment receipts with a log-index field.

## Why ERC-7710 in t402

The delegation pattern unlocks **agent-mediated payments** with strong on-chain enforceable budgets:

1. **Agent A** receives a delegation from owner's smart account allowing it to spend ≤ $100/month.
2. **Resource server S** advertises a t402 endpoint.
3. **Agent A** makes the payment by submitting just the delegation reference — no per-payment signature, no wallet popup.
4. **Caveat enforcement** is on-chain: the Delegation Manager rejects redemptions that exceed budget or are out of scope.

This eliminates the trust gap between agent autonomy and payer control. Combined with [ERC-4337](./scheme_exact_evm_erc4337.md) (for the smart account itself), ERC-7710 is the t402-native solution to programmable budget delegation — a use case that x402's base schemes do not address.

## Error Codes

In addition to the base `exact_evm` error codes, ERC-7710 settlement MAY return:

| Code | Meaning |
|---|---|
| T402-4200 | Malformed delegation payload (missing required fields) |
| T402-4201 | Delegation redemption failed on-chain (revert during settlement) |
| T402-4202 | Simulation revert — delegation expired, revoked, or scope exceeded |
| T402-4203 | DelegationManager address mismatch (server expected a specific Manager, payload referenced a different one) |
| T402-4204 | Execution mode mismatch (server expected single-call, payload referenced batch) |

## Appendix

### Reference Implementation

- TypeScript SDK:
  - Client: `sdks/typescript/packages/mechanisms/evm/src/erc7710/client/scheme.ts` — `ERC7710ClientScheme` produces the wire payload from a delegation triple
  - Facilitator: `sdks/typescript/packages/mechanisms/evm/src/erc7710/facilitator/scheme.ts` — `ERC7710FacilitatorScheme` verifies via simulation, settles via `redeemDelegations`
  - Encoding helper: `encodeERC7579Execution(tokenAddress, recipient, amount)` packs the inner ERC-20 transfer into ERC-7579 single-call format
- Go SDK: `sdks/go/mechanisms/evm/erc7710/`
- Python SDK: `sdks/python/t402/src/t402/schemes/evm/erc7710/`
- Java SDK: `sdks/java/src/main/java/io/t402/schemes/evm/erc7710/`

### Type Reference

`ExactERC7710Payload` is exported from `@t402/evm-core` as the canonical wire shape:

```typescript
interface ExactERC7710Payload {
  delegationManager: string;  // ERC-7710 Delegation Manager address
  permissionContext: string;  // Hex-encoded delegation envelope
  delegator: string;          // The smart account that issued the delegation
}
```

### Related specifications

- [Base `exact_evm` scheme](./scheme_exact_evm.md)
- [ERC-4337 variant](./scheme_exact_evm_erc4337.md)
- [USDT Token Coverage](../../usdt-tokens.md)
- Upstream: [ERC-7710 Smart Account Permissions / Delegation](https://eips.ethereum.org/EIPS/eip-7710)
- Upstream: [ERC-7715 Wallet Permission Request](https://eips.ethereum.org/EIPS/eip-7715)
- Upstream: [ERC-7579 Modular Smart Account](https://eips.ethereum.org/EIPS/eip-7579)

### Changelog

| Date | Version | Change |
|---|---|---|
| 2026-05-28 | 1 | Initial draft. Documents the delegation-based variant of `exact_evm`. No new wire-format scheme; same `"exact"` identifier with payload-shape disambiguation by SDK. Mirrors implementation in `mechanisms/evm/src/erc7710/`. |
