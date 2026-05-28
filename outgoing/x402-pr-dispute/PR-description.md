# PR: Add `dispute` extension specification

## Summary

Adds `specs/extensions/extension-dispute.md` — a draft extension defining cryptographic envelopes (`SignedDispute` and `SignedResolution`) for the post-settlement reversibility cycle, building directly on the existing [`offer-receipt`](./specs/extensions/extension-offer-and-receipt.md) extension.

Together with offer-receipt, the four-step chain is:

```
Offer  ->  Receipt  ->  Dispute  ->  Resolution
```

This gives x402 a standardized, interoperable buyer-side recourse path that does not yet exist in the protocol.

## Motivation

The base `exact` scheme is irreversible. PRs #2493 / #2494 / #2495 introduce a PSD2-regulatory receipt substrate but do not standardize the EIP-712-signed envelope that binds a client complaint to a receipt and an arbiter verdict to that complaint.

Without `dispute`, every integrator handling chargebacks, service-not-delivered protection, or quality complaints must invent its own envelope. The result is fragmentation across the ecosystem and incompatible buyer-side protections.

This extension fills that gap. It is **complementary, not duplicative**, to PRs #2493-2495 — the PSD2 receipts capture compliance metadata; this extension captures the cryptographic envelope. When both are present, the PSD2 `refund-receipt` can be referenced from `Resolution.refundTransaction` as an `offchain://psd2/<receipt-id>` URI.

## Design highlights

- **Mirrors offer-receipt structure**: same `format` / `payload` / `signature` shape, same EIP-712 domain pattern (`name: "x402 dispute"`, `version: "1"`, `chainId: 1`).
- **Closed enums for `reason` (7 values) and `verdict` (4 values)** with `x_*` namespace for extensions.
- **Four arbiter schemes**: `facilitator` (default), `contract` (on-chain), `external` (third-party), `none` (informational).
- **Composability matrix** with `auth-capture` (on-chain refund), `batch-settlement` (channel refund), and `exact` (off-chain settlement).
- **Seven-step verification pipeline** with typed error codes for the receiver.

## Reference implementations

Reference implementations of this extension exist in the [t402 protocol fork](https://github.com/t402-io/t402) across four SDKs, demonstrating the same wire format and verification pipeline. The t402 implementations use a fork-specific EIP-712 domain (`"T402Dispute"`); on adoption upstream, they will migrate to `"x402 dispute"`.

| SDK        | Path                                                                                                                  | Tests |
|------------|-----------------------------------------------------------------------------------------------------------------------|-------|
| TypeScript | [`sdks/typescript/packages/extensions/src/dispute/`](https://github.com/t402-io/t402/tree/main/sdks/typescript/packages/extensions/src/dispute) | 58 unit tests |
| Go         | [`sdks/go/extensions/dispute/`](https://github.com/t402-io/t402/tree/main/sdks/go/extensions/dispute)                                                                       | 37 unit tests |
| Python     | [`sdks/python/t402/src/t402/extensions/dispute.py`](https://github.com/t402-io/t402/blob/main/sdks/python/t402/src/t402/extensions/dispute.py) | 64 unit tests |
| Java       | [`sdks/java/src/main/java/io/t402/extensions/dispute/`](https://github.com/t402-io/t402/tree/main/sdks/java/src/main/java/io/t402/extensions/dispute) | 63 unit tests |

The reference impls all exercise the verdict ↔ settledAmount consistency rule, the seven-step `ValidateDispute` pipeline, and the `facilitator` arbiterScheme handler. Cross-SDK byte-level interop is verified by the shared EIP-712 domain and identical typed-data tables.

## Files added

- `specs/extensions/extension-dispute.md` — draft v1 specification (~360 LOC)

No other files modified. SDK / contract / facilitator changes are out of scope for this spec PR.

## Open questions for review

1. **Wire-format alignment** — the extension reuses `extensions["dispute"].info.*` shape consistent with existing extensions. If a different placement is preferred (e.g. top-level `disputes[]` array on the receipt itself), happy to adjust.
2. **JWS format** — currently reserved for future spec rev; the reference impls reject JWS-format inputs at runtime. Should this PR include the JWS section, or defer to a follow-up?
3. **Relationship to PRs #2493-2495** — the spec text explicitly positions this as complementary. If a co-submission approach is preferred (combining the PSD2 receipt and the dispute envelope into one PR), I am happy to coordinate.
4. **Smart-contract arbiter** — the `contract` arbiterScheme references EIP-1271 verification. If a reference smart-contract implementation is desired before merging, I can prepare it; the existing facilitator-as-arbiter reference impls cover the more common case.

## Disclosure

Most of this PR (spec drafting + reference impl ports) was assisted by an AI coding agent. I have reviewed every line of the spec text personally and verified each section against the existing x402 extension conventions (`extension-offer-and-receipt.md`, `extension-auth-hints.md`), the existing scheme docs (`scheme_auth_capture.md`, `scheme_batch_settlement_evm.md`), and the corresponding reference implementations.

## Test plan

This is a docs-only change. No SDK changes are proposed in this PR. The reference implementations linked above are not part of this PR's diff but provide an executable demonstration of the spec.

- [ ] Maintainers review wire shape alignment vs existing extensions
- [ ] Maintainers review composability matrix (especially interaction with PRs #2493-2495 if they are still in flight)
- [ ] Maintainers decide on JWS section: include now vs follow-up PR
- [ ] Optional: if a reference smart-contract arbiter is desired, follow-up PR
