# Scheme: `batch-settlement`

## Status

**Spec Draft.** SDK implementation tracked in [PROTOCOL-REFINEMENT-PLAN-2026-05-19](../../README.md) Phase B Week 6. This document is the t402 specification of the `batch-settlement` scheme, structurally compatible with x402's [scheme_batch_settlement spec](https://github.com/x402-foundation/x402/blob/main/specs/schemes/batch-settlement/scheme_batch_settlement.md) (merged 2026-04-15, PR #1145) and the deployed reference contract from x402 commit `84ffb641` (2026-05-15).

## Summary

`batch-settlement` is a payment scheme in which the client provides a cryptographic payment commitment at request time, but the transfer of value is **not** executed synchronously during that request. The commitment is accepted, access is granted immediately, and financial settlement occurs later through a process defined by the network binding.

Per-request on-chain settlement is not always ideal:

- Gas fees may exceed the value of individual requests (sub-cent micropayments)
- Block confirmation time is incompatible with HTTP response latency (sub-second resource delivery)
- Request volume requires batched settlement (high-frequency agent traffic)
- Settlement happens through infrastructure that operates asynchronously from HTTP (payment channels, fiat billing systems, stablecoin invoices)

The model of how a commitment is formed, what backs it, and how it is eventually redeemed is defined entirely by the network binding.

The `batch-settlement` scheme supports **dynamic pricing**: the client commits up to the maximum per-request price (`PaymentRequirements.amount`), but the server MAY charge a lower actual price after executing the request. The actual charge is communicated via the `PAYMENT-RESPONSE` header.

## Why t402 ships this scheme

The base [`exact`](../exact/scheme_exact_evm.md) scheme forces an on-chain settlement transaction per HTTP request. For three workloads t402 explicitly targets, this is economically and operationally untenable:

1. **Agent-driven micropayments** — an AI agent calling a t402 API at $0.001 per request cannot afford even Base-mainnet gas. Settlement MUST be batched.
2. **High-volume streaming** — content licensing for AI crawlers consumes thousands of requests per minute against a single ceiling. Per-request settlement is impossible.
3. **Subscription billing for indie SaaS** — recurring monthly invoices against a single signed authorization, mapped to a Stripe-style accounting model.

`batch-settlement` is the foundational scheme for all three. Without it, t402 cannot offer competitive economics against credit-card billing systems for high-frequency workloads.

## Protocol behavior

For `exact` and `upto`, verification and settlement happen in a single pass: the commitment is validated, a transaction is broadcast, and value has moved. The settlement result contains an on-chain transaction hash.

For `batch-settlement`, verification confirms the commitment is valid, but settlement stores it rather than executing a transfer. The settlement result contains a **commitment identifier**, but value moves later, through the network binding's redemption process.

### Commitment identifier

The settlement result MUST include a non-empty commitment identifier on success. This identifier is meaningful to the network binding — a voucher hash, channel state digest, account ledger reference, or equivalent.

## Commitment models

Network bindings MAY choose one of two trust models for backing the client's commitment.

### Capital-backed

The client's commitment is backed by on-chain capital committed before or during the session — pre-funded escrow, a payment channel, or a delegated authorization against a wallet balance. The trust anchor is the client's own funds. No network intermediary is required to underwrite access.

This is the model t402's reference EVM binding implements.

### Credit-backed

The client's commitment is backed by a verified identity associated with a billing account managed by a trusted network intermediary. No on-chain capital is required from the client. The network authenticates the identity, underwrites the access obligation, and settles with the resource server through off-chain infrastructure on a defined schedule.

Credit-backed bindings are forward-compatible future work for t402 (e.g. credit-line integrations with regulated stablecoin issuers).

## Use cases

**Escrow-backed micropayments.** An AI agent pre-funds an on-chain escrow at session start. Each sub-cent API call produces a signed voucher drawn against that balance. The provider accumulates vouchers and redeems them in a single on-chain transaction at session end, keeping per-request gas cost effectively zero.

**Payment channel streaming.** A client and provider open a payment channel once. Each request increments a signed running total (a receipt / cumulative voucher). The provider closes the channel periodically, collecting accumulated value in one settlement regardless of how many individual requests occurred.

**Delegated authorization.** A client delegates spending authority to an operator against their wallet balance (e.g. via [ERC-7710 delegation](../exact/scheme_exact_evm_erc7710.md)). The operator signs commitments per request on the client's behalf. The provider collects authorizations and settles them through the delegation contract.

**Credit-backed content licensing.** A content publisher monetizes AI crawler access. Crawlers authenticate via a network-registered identity backed by a billing account. The network verifies each request, accumulates usage, and invoices the crawler operator on a billing cycle with no wallet or on-chain interaction required from the client.

## Settlement lifecycle

All `batch-settlement` network bindings share this abstract lifecycle. The network binding defines the specifics of each phase.

1. **Commit.** The client produces a cryptographic payment commitment and attaches it to the request. The commitment is validated and stored. The resource is served immediately.
2. **Accumulate.** The network retains the commitment in a voucher store, channel state, account ledger, or billing system. The network binding defines who stores commitments, where, and for how long.
3. **Redeem.** Value is transferred out of band through an on-chain contract call, a channel close, a fiat batch invoice, or any rail the network defines. The trigger, timing, and mechanism are network-defined.

## Network requirements

Every `batch-settlement` network binding MUST specify:

1. **Commitment format** — the structure and encoding of the payment payload, including all fields required for verification and redemption.
2. **Verification rules** — how the commitment is validated: signature scheme, balance or credit check, replay prevention, expiry.
3. **Storage behavior** — what constitutes a stored commitment for this network, and what the commitment identifier contains on success.
4. **Double-spend prevention** — how the network ensures the same commitment cannot be accepted or redeemed more than once.
5. **Commitment expiry** — when commitments become invalid and what happens to unaccepted commitments after expiry.
6. **Redemption** — who triggers redemption, when, and through what rail.
7. **Trust model** — whether the trust anchor is the client's on-chain capital (capital-backed) or a network intermediary (credit-backed), and what guarantee the seller has of eventual settlement.

## Relationship to x402

This scheme is **wire-compatible with x402's [batch-settlement scheme](https://github.com/x402-foundation/x402/blob/main/specs/schemes/batch-settlement/)** (merged 2026-04-15). The only wire-format delta is the protocol version field name:

- x402: `x402Version`
- t402: `t402Version`

Compatibility layer in `@t402/core/src/http/x402Compat.ts` handles cross-protocol roundtrip.

The underlying on-chain contract (`x402BatchSettlement`) is deployed by the x402 Foundation / Coinbase team. T402 implementations MUST point at the same canonical contract address rather than deploying a parallel contract. This preserves liquidity, simplifies operator due diligence, and keeps the audit surface single-source.

## Relationship to other schemes

| Aspect | `exact` | `upto` | `batch-settlement` |
|---|---|---|---|
| Settlement timing | Synchronous (per request) | Synchronous (per request) | Asynchronous (deferred) |
| Per-request gas | Yes | Yes | No (claimed in batch) |
| Variable amount | No | Yes | Yes (capped per-voucher) |
| Refundable | No | No | Yes (cooperative refund + escape-hatch withdrawal) |
| On-chain identity | Transaction hash | Transaction hash | Channel ID / voucher hash |
| Best for | Single high-value payment | Capped variable-cost call | Streaming / micropayments / subscriptions |

## Appendix

Network-specific implementation details (commitment formats, verification rules, storage, redemption) are in per-network documents:

- [`scheme_batch_settlement_evm.md`](./scheme_batch_settlement_evm.md) — EVM chains using the canonical `x402BatchSettlement` payment-channel contract with EIP-3009 + Permit2 deposit collectors

Future bindings under consideration (not in current scope):

- SVM (Solana payment channels)
- TON (state channel via Jetton allowance)
- TRON (analogous on-chain escrow + cumulative voucher)

### Related specifications

- [Base `exact_evm` scheme](../exact/scheme_exact_evm.md) — per-request synchronous settlement
- [Up-to scheme](../upto/scheme_upto.md) — synchronous variable-amount settlement
- [`auth-capture` scheme](../auth-capture/scheme_auth_capture.md) — two-phase with refund window (different settlement model)
- [ERC-7710 delegation variant](../exact/scheme_exact_evm_erc7710.md) — composable with batch-settlement for delegated authorization
- Upstream x402 reference: <https://github.com/x402-foundation/x402/blob/main/specs/schemes/batch-settlement/>

### Changelog

| Date | Version | Change |
|---|---|---|
| 2026-05-28 | 1 | Initial t402 draft, mirroring x402 PR #1145 (merged 2026-04-15) plus contract commit `84ffb641` (2026-05-15). Conceptual model identical to x402; SDK implementation tracked in PROTOCOL-REFINEMENT-PLAN-2026-05-19 Phase B Week 6. |
