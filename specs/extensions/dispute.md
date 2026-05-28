# Extension: Dispute

**Extension Key:** `dispute`
**Status:** Draft (t402-leading)
**Version:** 1
**Upstream PR target:** x402-foundation/x402 (after t402 reference implementation ships)

## Overview

The Dispute extension provides cryptographic envelopes for the post-settlement reversibility cycle in t402 payments:

- **SignedDispute**: A client (or its delegate) signs a complaint against a previously-issued receipt, requesting a full or partial refund.
- **SignedResolution**: A designated arbiter signs a verdict resolving the dispute, optionally referencing an on-chain refund transaction.

Together with the existing [`offer-receipt`](./offer-and-receipt.md) extension, this completes the four-step chain that gives t402 payments enforceable buyer-side recourse:

```
Offer  →  Receipt  →  Dispute  →  Resolution
(server  (server   (client-     (arbiter
 commits) confirms)  initiated)   verdict)
```

## Motivation

The base `exact` scheme produces irreversible transactions; once settled, neither side can reverse the payment. For three use cases t402 explicitly targets, this is unacceptable:

1. **Non-US merchant chargeback equivalence** — credit-card networks provide chargebacks; t402 must provide an equivalent recourse path for jurisdictions where merchants accept this risk.
2. **Service-not-delivered protection** — clients buying a resource asynchronously (data API delayed delivery, AI agent task with deferred output) need recourse if the service is not delivered.
3. **Quality dispute** — the resource is delivered but does not meet specification.

The [`auth-capture`](../schemes/auth-capture/scheme_auth_capture.md) and [`batch-settlement`](../schemes/batch-settlement/scheme_batch_settlement_evm.md) schemes provide the **on-chain** primitives for reversal (refund window, cooperative refund). The Dispute extension provides the **off-chain coordination layer** — who can dispute, what the dispute claims, who arbitrates, what the verdict binds.

Without this extension, every t402 integrator must invent its own dispute envelope, breaking interoperability. With it, t402 becomes the first HTTP-native stablecoin payment protocol with a standardized dispute primitive.

### Relationship to x402

As of 2026-05-28, x402 has **no merged dispute or refund extension**. The PSD2-regulatory PRs #2493 (compliance-receipt), #2494 (refund-receipt + cancellation-receipt), and #2495 (pre-payment-compliance-gate) opened 2026-05-27 by chopmob-cloud are an adjacent regulatory substrate without an EIP-712-signed envelope. The Dispute extension described here is **upstream-PR ready** as a complementary crypto-primitives layer; it does not conflict with the PSD2 receipts and is intended to be co-submitted.

## Extension Data

### In `PaymentRequired` (402 Response)

Servers MAY declare dispute terms in the 402 response by including the `dispute` extension. This advertises (a) which arbiter the server uses, (b) the dispute window, and (c) the supported dispute reasons.

```json
{
  "extensions": {
    "dispute": {
      "info": {
        "arbiter": "0xArbiterAddress",
        "arbiterScheme": "facilitator",
        "disputeWindow": 1296000,
        "supportedReasons": ["not_delivered", "quality_issue", "partial_delivery"],
        "evidenceUriSchemes": ["ipfs", "arweave", "https"]
      }
    }
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `arbiter` | string (address) | yes | Address authorized to issue `SignedResolution` for disputes against this server |
| `arbiterScheme` | string | yes | One of `"facilitator"` (the t402 facilitator acts as arbiter), `"contract"` (a smart-contract arbiter resolves on-chain), `"external"` (a third-party off-chain arbiter), `"none"` (disputes accepted but resolution is informal) |
| `disputeWindow` | integer | yes | Maximum seconds after `issuedAt` (on the underlying receipt) during which a client MAY file a dispute |
| `supportedReasons` | array of string | yes | Subset of [Dispute Reasons](#dispute-reasons) the server accepts |
| `evidenceUriSchemes` | array of string | no | URI schemes acceptable in the `evidence[]` field; default `["ipfs", "arweave", "https"]` |

### In Dispute Submission

Disputes are not transmitted on the payment-request path. They are submitted separately to a dispute endpoint advertised by the server or facilitator (e.g. `POST /v2/dispute`). The transport-level binding is:

```json
{
  "extensions": {
    "dispute": {
      "info": {
        "submission": {
          "format": "eip712",
          "payload": {
            "version": 1,
            "receiptHash": "0xcafedade...",
            "reason": "not_delivered",
            "requestedAmount": "1000000",
            "validUntil": 1712016000,
            "evidence": [
              "ipfs://Qm.../complaint.json",
              "https://merchant.com/receipts/12345/proof"
            ]
          },
          "signature": "0xabcdef..."
        }
      }
    }
  }
}
```

### In Resolution Response

Resolutions are returned in the response to a dispute submission (or pushed as a webhook event for asynchronous resolution).

```json
{
  "extensions": {
    "dispute": {
      "info": {
        "resolution": {
          "format": "eip712",
          "payload": {
            "version": 1,
            "disputeHash": "0xbeefface...",
            "verdict": "upheld_partial",
            "settledAmount": "750000",
            "arbiter": "0xArbiterAddress",
            "issuedAt": 1712019600,
            "refundTransaction": "0xrefundtx..."
          },
          "signature": "0x987654..."
        }
      }
    }
  }
}
```

## Types

### DisputePayload

| Field | Type | Required | Description |
|---|---|---|---|
| `version` | integer | yes | Extension version (currently `1`) |
| `receiptHash` | string (hex) | yes | EIP-712 hash of the `SignedReceipt` being disputed (from [`offer-receipt`](./offer-and-receipt.md)) |
| `reason` | string | yes | One of the [Dispute Reasons](#dispute-reasons) |
| `requestedAmount` | string | yes | Amount being requested as refund, in smallest unit. `"0"` MAY be used for "no refund requested, just on-record dispute" |
| `validUntil` | integer | yes | Unix timestamp after which the dispute envelope is no longer valid |
| `evidence` | array of string | no | URIs pointing to dispute evidence (e.g. screenshots, transaction logs, server response captures) |

### ResolutionPayload

| Field | Type | Required | Description |
|---|---|---|---|
| `version` | integer | yes | Extension version (currently `1`) |
| `disputeHash` | string (hex) | yes | EIP-712 hash of the `SignedDispute` being resolved |
| `verdict` | string | yes | One of `"upheld_full"`, `"upheld_partial"`, `"denied"`, `"void"` |
| `settledAmount` | string | yes | Actual refund amount granted, in smallest unit. MUST equal `0` for `denied` or `void` |
| `arbiter` | string (address) | yes | Address of the arbiter issuing the resolution; MUST match the `arbiter` advertised on the receipt's offer |
| `issuedAt` | integer | yes | Unix timestamp of resolution issuance |
| `refundTransaction` | string | no | On-chain refund transaction hash (present when the resolution triggered an on-chain refund via `auth-capture` or `batch-settlement`) |

### SignedDispute

| Field | Type | Required | Description |
|---|---|---|---|
| `format` | string | yes | `"eip712"` or `"jws"` |
| `payload` | DisputePayload | yes* | Present for `eip712` format |
| `signature` | string (hex) | yes | Signature of the payer (or its delegate, e.g. via [ERC-7710](../schemes/exact/scheme_exact_evm_erc7710.md)) |
| `signer` | string (address) | no | Explicit signer address when the dispute is signed by a delegate rather than the payer themselves |

### SignedResolution

| Field | Type | Required | Description |
|---|---|---|---|
| `format` | string | yes | `"eip712"` or `"jws"` |
| `payload` | ResolutionPayload | yes* | Present for `eip712` format |
| `signature` | string (hex) | yes | Signature of the arbiter |

## Dispute Reasons

Closed enum for `DisputePayload.reason`. Servers MAY declare which subset they accept via `supportedReasons` in the 402 response.

| Reason | Description |
|---|---|
| `not_delivered` | Resource was paid for but never delivered |
| `partial_delivery` | Resource was partially delivered; refund requested for the missing portion |
| `quality_issue` | Resource was delivered but does not meet the specification or quality stated in the offer |
| `unauthorized` | The payment was unauthorized (e.g. agent exceeded its delegation budget; key compromise) |
| `service_unavailable` | Resource was accessed but the service was non-functional / errored |
| `duplicate_charge` | The same logical service was charged twice (idempotency key collision or replay) |
| `other` | Free-form reason; SHOULD include URI in `evidence[]` describing the issue |

Servers MAY define additional values prefixed `x_*` (e.g. `x_gdpr_violation`) for non-standard reasons. Such values are non-interoperable.

## Signature Formats

### EIP-712

Disputes and resolutions are signed using EIP-712 typed data with domain:

```
EIP712Domain {
  name: "T402Dispute",
  version: "1"
}
```

Primary types:

```
Dispute {
  uint256 version,
  bytes32 receiptHash,
  string reason,
  uint256 requestedAmount,
  uint256 validUntil,
  string[] evidence
}

Resolution {
  uint256 version,
  bytes32 disputeHash,
  string verdict,
  uint256 settledAmount,
  address arbiter,
  uint256 issuedAt,
  string refundTransaction
}
```

Note that `Dispute.reason` and `Resolution.verdict` are strings, not enums in the typed-data, to allow `x_*` namespace extension without spec rev. Validators MUST parse the string against the enum at deserialize time.

### JWS

JSON Web Signature format for non-EVM contexts. Reserved for future specification; expected to use ES256K and the same payload structure with JCS canonicalization.

## Flow

### Two-phase scheme (`auth-capture`)

```
Client                  Server               Arbiter            Facilitator
  |                       |                     |                    |
  |--- payment+offer ---->|                     |                    |
  |<-- 200 + receipt -----|                     |                    |
  |                       |                     |                    |
  |    [service fails]    |                     |                    |
  |                       |                     |                    |
  |--- POST /dispute ---->|                     |                    |
  |    (SignedDispute)    |--- forward -------->|                    |
  |                       |                     |--- verify rcpt ----|
  |                       |                     |<-- valid -----------|
  |                       |                     |                    |
  |                       |   [arbiter         ]|                    |
  |                       |   [evaluates       ]|                    |
  |                       |   [evidence        ]|                    |
  |                       |                     |                    |
  |                       |<-- SignedResolution-|--- refund ------>|
  |<-- resolution --------|                     |    (auth-capture  |
  |    (verdict)          |                     |     refund call)  |
```

### Single-step scheme (`exact`)

The dispute path is identical except the `refund` step is omitted from the on-chain layer. The resolution still binds the arbiter to a verdict; if the verdict is `upheld_*`, the merchant settles the refund off-chain (e.g. via wire transfer or out-of-band crypto transfer) and submits the refund evidence URI inside `Resolution.refundTransaction` (which MAY be a non-hash string like `"offchain://wire/2026-05-28/INV-123"` for non-on-chain refunds).

### Streaming scheme (`batch-settlement`)

The arbiter issues a `SignedResolution` whose `refundTransaction` references a `refundWithSignature` transaction against the corresponding `x402BatchSettlement` channel. The on-chain refund reduces the channel's claimed amount.

## Trust Model

Three arbiter schemes are supported, declared via `arbiterScheme` in the 402 response:

### `facilitator`

The t402 facilitator that processed the payment acts as arbiter. The arbiter address matches the facilitator's signing key. This is the default for self-hosted merchants who delegate trust to the facilitator they already use.

**Trust assumption**: payer trusts the facilitator to act impartially. Suitable when the facilitator is reputation-staked (well-known operator, large customer base).

### `contract`

A smart contract resolves the dispute on-chain. The contract receives the `SignedDispute`, evaluates programmable conditions (e.g. on-chain proof that the resource was not delivered, third-party oracle attestation), and emits a `SignedResolution` via an EIP-1271 signature against the arbiter contract's address.

**Trust assumption**: payer and merchant trust the contract code. Suitable for fully on-chain commerce (no off-chain delivery to dispute about) and oracle-attested data products.

### `external`

A third-party off-chain arbitration service resolves the dispute. The arbiter address is the service's signing key. The service operates outside the facilitator's trust boundary.

**Trust assumption**: payer and merchant both trust a specific third party. Suitable for high-value transactions (>$1000) where neither party trusts the other's facilitator. Future extension may add Kleros or similar decentralized arbitration as a reference implementation.

### `none`

The server accepts dispute submissions but does not commit to a resolution. The dispute is on-record but resolution is informal. Useful for low-stakes resources where the dispute is informational only.

**Trust assumption**: none — dispute is unenforceable.

## Composability

The Dispute extension composes with other t402 schemes and extensions as follows:

| Combination | Behavior |
|---|---|
| Dispute + `auth-capture` | Resolution `upheld_*` triggers on-chain refund via `AuthCaptureEscrow.refund(...)` within the `refundDeadline`. |
| Dispute + `batch-settlement` | Resolution `upheld_*` triggers `refundWithSignature` against the corresponding channel. |
| Dispute + `exact` | No on-chain refund path; merchant settles off-chain. Resolution is the audit trail. |
| Dispute + `offer-receipt` | `Dispute.receiptHash` binds to a `SignedReceipt`; required to make the dispute provable. |
| Dispute + `payment-identifier` | `paymentId` is a parallel correlator; `receiptHash` is the canonical reference. |
| Dispute + [ERC-8004](./erc8004-integration.md) | Arbiter reputation MAY be tracked via the on-chain Reputation registry. Disputed receipts SHOULD be linkable from the registry. |

## Verification

A receiver of a `SignedDispute` MUST:

1. **Recover signer** — recover the address from the EIP-712 signature against the canonical domain.
2. **Verify signer authority** — the signer MUST be either:
   - The `payer` from the disputed receipt, OR
   - A delegate of the payer (e.g. an ERC-7710 delegation that authorizes dispute submission). The delegate proof is conveyed in `SignedDispute.signer` (if absent, the signature is presumed to be by the payer themselves).
3. **Resolve `receiptHash`** — locate the corresponding `SignedReceipt` (server-side database lookup). If unfound, reject with `dispute_unknown_receipt`.
4. **Check window** — current time MUST be within `[receipt.issuedAt, receipt.issuedAt + disputeWindow]`.
5. **Validate reason** — `reason` MUST be in the server's `supportedReasons` list (declared in the 402 offer).
6. **Validate amount** — `requestedAmount <= receipt.transaction.value`. For `partial_delivery`, the amount represents the partial portion; for `not_delivered`, typically equal to the full receipt amount.
7. **Validate evidence URIs** — each `evidence[i]` MUST use a scheme listed in `evidenceUriSchemes`.

A receiver of a `SignedResolution` MUST:

1. **Recover signer** — and assert it matches the declared `arbiter` from the offer.
2. **Resolve `disputeHash`** — locate the corresponding `SignedDispute`.
3. **Validate verdict ↔ amount consistency** — `denied`/`void` → `settledAmount == 0`; `upheld_full` → `settledAmount == dispute.requestedAmount`; `upheld_partial` → `0 < settledAmount <= dispute.requestedAmount`.
4. **Validate `refundTransaction`** — if present and on-chain (starts with `0x` followed by 64 hex chars), assert the transaction completed and the refund amount matches `settledAmount`.

## SDK Support

| SDK | Package | Status |
|---|---|---|
| TypeScript | `@t402/extensions/dispute` | Planned (tracked in PROTOCOL-REFINEMENT-PLAN Phase B Week 7) |
| Go | `sdks/go/extensions/dispute/` | Planned |
| Python | `t402.extensions.dispute` | Planned |
| Java | `extensions.dispute` module | Planned |

## Security Considerations

- **Replay protection**: `Dispute.validUntil` SHOULD be set to a reasonable window (typically 24-48 hours from signing) to prevent stale disputes from being re-submitted. Arbiters SHOULD track `disputeHash` to prevent duplicate resolutions on the same dispute.
- **Arbiter compromise**: a compromised arbiter key can falsely issue `denied` resolutions, blocking legitimate disputes. Mitigations: (a) require arbiter key rotation via on-chain registry, (b) provide an escalation path to an `external` arbiter when `facilitator` denials are contested, (c) use ERC-8004 reputation registry to track arbiter behavior over time.
- **Evidence integrity**: evidence URIs MUST be content-addressed (IPFS, Arweave, hash-anchored HTTPS) so that off-chain evidence cannot be silently modified post-dispute. URIs that resolve to mutable content (raw HTTPS without content hash) MUST be treated as advisory only.
- **Dispute griefing**: an attacker MAY file many low-quality disputes to harass merchants. Arbiters and facilitators SHOULD rate-limit dispute submissions per payer and may charge a dispute-fee (refunded on `upheld_*` resolutions).
- **Receipt forgery**: the dispute is only as good as the receipt it binds to. Receipts MUST be signed by the merchant (per the `offer-receipt` extension) and the receipt's signature MUST be re-verified by the arbiter, not trusted blindly from the dispute submission.
- **Asymmetric information**: arbiters typically have access only to the data the merchant chooses to expose. For `not_delivered` disputes, the arbiter SHOULD seek server-side delivery logs as additional evidence. The `evidence[]` array is the payer's input; the merchant's counter-evidence is provided out-of-band to the arbiter.

## Privacy

- **Evidence pointers are public** — IPFS / Arweave URIs are world-readable. Sensitive dispute material (PII, financial records) SHOULD be encrypted to the arbiter's public key and the encrypted blob referenced by URI.
- **Dispute existence is metadata** — even when resolved `denied`, the existence of a dispute against a merchant is a reputation signal. Arbiters operating under stricter privacy regimes (GDPR, PIPL) SHOULD provide a "dispute fully retracted" verdict (`void`) that deletes from public registries.
- **Payer identity exposure** — the `Dispute.signature` recovers the payer's signing key, which may be the same as their payment-time signing key. This links the dispute to the payment. For privacy-sensitive use cases, payers SHOULD use a fresh ERC-7710 delegate key per dispute, with the dispute signed by the delegate.

## Version History

| Version | Date | Change |
|---|---|---|
| 1 | 2026-05-28 | Initial draft. Closed enum `reason`, four-verdict `verdict` field, EIP-712 envelope mirroring offer-and-receipt structure. Three arbiter schemes (`facilitator` / `contract` / `external` / `none`). Composability matrix with `auth-capture`, `batch-settlement`, `exact`. |

## References

- [Offer and Receipt extension](./offer-and-receipt.md) — provides the receipt envelope this extension binds to
- [Auth-Capture scheme](../schemes/auth-capture/scheme_auth_capture.md) — on-chain refund primitive for `upheld_*` resolutions
- [Batch-Settlement scheme](../schemes/batch-settlement/scheme_batch_settlement_evm.md) — channel-refund primitive for streaming dispute settlement
- [ERC-7710 delegation variant](../schemes/exact/scheme_exact_evm_erc7710.md) — agent-mediated dispute filing
- [ERC-8004 Integration](./erc8004-integration.md) — arbiter reputation registry
- Related x402 work in progress (NOT direct dependencies):
  - x402 PR #2494 — `refund-receipt-v1` / `cancellation-receipt-v1` (PSD2 regulatory receipts)
  - x402 PR #2493 — `compliance-receipt-v1`
  - x402 PR #2495 — `pre-payment-compliance-gate-v1`
