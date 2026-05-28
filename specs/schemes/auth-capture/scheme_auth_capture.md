# Scheme: `auth-capture`

## Status

**Spec Draft.** SDK implementation tracked in [PROTOCOL-REFINEMENT-PLAN-2026-05-19](../../README.md) Phase B Weeks 4-5. This document is the t402 specification of the `auth-capture` scheme, structurally compatible with x402's [scheme_auth_capture spec](https://github.com/x402-foundation/x402/blob/main/specs/schemes/auth-capture/scheme_auth_capture.md) (merged 2026-05-13, PR #1425) so that t402 facilitators can settle payments authored by x402 clients and vice versa, modulo the documented wire-version field shim.

## Summary

`auth-capture` is a payment scheme where funds can be held and settled later. The client authorizes a maximum amount, and the facilitator submits it — either locking funds in escrow for later settlement (two-phase) or sending them directly to the receiver with refund capability (single-shot).

The **captureAuthorizer** is the entity authorized to authorize, capture, void, refund, or charge a payment. In a facilitator-submits flow, that is either the facilitator itself or any smart contract that ends up calling the underlying escrow (e.g., a dispute arbiter, a multisig, or a programmable policy contract).

Unlike `exact`, which has no built-in mechanism for returning funds, `auth-capture` supports returning funds to the client through **void**, **refund**, and **reclaim**.

## Why t402 ships this scheme

The base [`exact`](../exact/scheme_exact_evm.md) scheme has no refund or reversal path — once the client signs and the facilitator settles, the transaction is final. For three use cases that t402 explicitly targets, this is unacceptable:

- **Refundable agent-mediated commerce** — the client's agent should be able to cancel or partially refund an unsatisfactory transaction without out-of-band coordination.
- **Subscription billing** — recurring authorization with periodic captures, common in indie SaaS billing migrating from Stripe / Coinbase Commerce.
- **Resource delivery with delay** — services where the resource is delivered asynchronously and the client needs recourse if delivery fails.

`auth-capture` closes this gap and is the foundational scheme for the t402 [dispute extension](../../extensions/dispute.md) (forthcoming).

## Example Use Cases

- Refundable payments with buyer protection
- Delayed delivery where the client needs recourse if the service is unsatisfactory
- Subscription or session billing with periodic captures against a single authorization
- Agent-mediated commerce with reversibility guarantees

## Settlement Paths

The scheme supports two settlement paths, selected via `extra.autoCapture`:

| `autoCapture` | Behavior |
|---|---|
| `false` (default) | **Two-phase.** Funds held in escrow. CaptureAuthorizer can capture, void, or refund. Client can reclaim if capture deadline passes. |
| `true` | **Single-shot.** Funds sent directly to receiver. CaptureAuthorizer can refund post-settlement within the refund window. |

### Two-phase flow (`autoCapture: false`, default)

```
AUTHORIZE → RESOURCE DELIVERED → CAPTURE / VOID → (REFUND)
                                       ↘
                                    RECLAIM (if capture deadline elapses)
```

1. **Authorize**: Client's authorization is submitted; funds locked in escrow.
2. **Resource delivered**: Server returns the resource (HTTP 200).
3. **Capture or void**: The captureAuthorizer either finalizes funds to the receiver (`capture`) or releases them back to the client (`void`).
4. **Reclaim**: If the capture deadline passes without action, the client can reclaim escrowed funds directly.
5. **Refund**: After capture, the captureAuthorizer can refund within the refund window.

### Single-shot flow (`autoCapture: true`)

```
CHARGE → RESOURCE DELIVERED → (REFUND)
```

1. **Charge**: Client's authorization is submitted; funds sent directly to receiver.
2. **Resource delivered**: Server returns the resource (HTTP 200).
3. **Refund**: The captureAuthorizer can refund within the refund window.

Funds are never held in escrow in the single-shot path. There is no capture, void, or reclaim — only the refund window applies.

## Core Properties

### Fund Safety

- Cannot overcharge — settlement amount is capped by the client-signed maximum.
- Two-phase path: client can reclaim escrowed funds after the capture deadline if no action is taken (the escrow contract enforces this with on-chain timestamps).
- Fee bounds are client-signed and enforced at settlement — the captureAuthorizer's fee is constrained to `[minFeeBps, maxFeeBps]`.

### Replay Prevention

- Each payment has a unique nonce derived from the payment parameters and a fresh client-generated salt.
- Nonce is consumed on-chain at settlement, preventing double-spend.

### Expiry Enforcement

Two absolute-timestamp deadlines govern the payment lifecycle (network-specific implementations MAY add a derived pre-approval expiry from `maxTimeoutSeconds`):

- **Capture deadline** (`captureDeadline`): Last moment to capture escrowed funds (two-phase); after this, the client can reclaim.
- **Refund deadline** (`refundDeadline`): Last moment to issue a refund on captured or charged payments.

Deadlines MUST satisfy `now + maxTimeoutSeconds <= captureDeadline <= refundDeadline`.

## Relationship to `exact`

| Aspect | `exact` | `auth-capture` |
|---|---|---|
| Settlement | Immediate transfer | Via escrow (two-phase) or direct with refund capability (single-shot) |
| Refundable | No | Yes (both paths) |
| Fee system | None at protocol level | Configurable (min/max bounds, client-signed) |
| Two-step capture | No | Yes (two-phase path only) |
| Reclaim by client | No | Yes (two-phase path only, after capture deadline) |
| Spec footprint | Small (`exact_evm.md` ≈ 110 LOC) | Larger (network impls 900+ LOC) due to escrow contract surface |

A server SHOULD advertise both schemes when feasible and let the client choose; `exact` is faster (single transaction, no contract dependency) while `auth-capture` provides reversibility.

## Relationship to x402

This scheme is **wire-compatible with x402's [auth-capture scheme](https://github.com/x402-foundation/x402/blob/main/specs/schemes/auth-capture/)** (merged 2026-05-13). The only wire-format delta is the protocol version field name:

- x402: `x402Version`
- t402: `t402Version`

Compatibility layer in `@t402/core/src/http/x402Compat.ts` handles cross-protocol roundtrip. A t402 facilitator MAY accept x402-shaped payloads if it implements the shim; the same applies in reverse.

The underlying on-chain contracts ([base/commerce-payments](https://github.com/base/commerce-payments) `AuthCaptureEscrow` + token collectors) are deployed by Coinbase / Base team and have universal canonical addresses across supported chains. T402 implementations point at the **same canonical addresses** rather than deploying parallel contracts; this preserves liquidity and operator interchangeability between the two protocols.

## Appendix

Network-specific implementation details (contracts, signature formats, verification logic, error codes) are in per-network documents:

- [`scheme_auth_capture_evm.md`](./scheme_auth_capture_evm.md) — EVM chains (EIP-3009 + Permit2 collectors against the AuthCaptureEscrow singleton)

Other networks (TRON, TON, SVM) will be added as escrow primitives mature on those chains. The TRON variant is t402-leading research; see [PROTOCOL-REFINEMENT-PLAN-2026-05-19](../../README.md) Phase B Week 5 for the t402 TRON authCapture work.

### Related specifications

- [Base `exact_evm` scheme](../exact/scheme_exact_evm.md) — the scheme `auth-capture` extends
- Dispute extension (forthcoming `extensions/dispute.md`) — builds on `auth-capture`'s refund semantics
- Upstream x402 reference: <https://github.com/x402-foundation/x402/blob/main/specs/schemes/auth-capture/>

### References

- [Escrow Scheme Proposal — Agentokratia (x402 Issue #834)](https://github.com/coinbase/x402/issues/834)
- [Escrow Scheme Proposal — x402r (x402 Issue #1011)](https://github.com/coinbase/x402/issues/1011)
- [base/commerce-payments contracts](https://github.com/base/commerce-payments)

### Changelog

| Date | Version | Change |
|---|---|---|
| 2026-05-28 | 1 | Initial t402 draft, mirroring x402 PR #1425 (merged 2026-05-13). Wire format and conceptual model identical to x402; SDK implementation tracked in PROTOCOL-REFINEMENT-PLAN-2026-05-19 Phase B Weeks 4-5. |
