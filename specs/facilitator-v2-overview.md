# T402 Facilitator v2 — API Surface Overview

**Status:** Overview stub. The authoritative API contract is the OpenAPI document at `services/facilitator/facilitator/api/openapi.yaml` (currently v2.0.0). This document maps the OpenAPI surface to t402's self-host wedge by enumerating the eight endpoint categories and the headers third-party implementers MUST honor for protocol compatibility.

**Full per-endpoint spec:** deferred. Tracked in [PROTOCOL-REFINEMENT-PLAN-2026-05-19](./README.md) for a future sprint. The stub form is sufficient to make wedge 3 ("self-host facilitator") implementable: a third party who reads `openapi.yaml` and this overview has the contract surface they need to ship a compatible facilitator without further reverse-engineering the t402 reference implementation.

## Scope

The t402 protocol defines client and server behavior; the **facilitator** is the optional but recommended third-party that performs verification and settlement on the server's behalf. The protocol-level facilitator surface in [`t402-specification-v2.md`](./t402-specification-v2.md) defines just three endpoints — `/verify`, `/settle`, `/supported`. In production, the reference facilitator exposes seven additional categories of endpoints (streaming, intent routing, settlements explorer, etc.) that integrators commonly need.

This document is the t402-spec-level acknowledgment of those endpoint categories. A self-hosted facilitator MAY:

- Implement only the core (`/verify`, `/settle`, `/supported`) and remain protocol-compliant for synchronous payments
- Add the streaming category to support [`batch-settlement`](./schemes/batch-settlement/scheme_batch_settlement_evm.md) channels
- Add the intent category to support cross-chain payment routing
- Add discovery to participate in the [Bazaar](./extensions/bazaar.md) extension's resource catalog
- Add admin / stats endpoints to operate in production

The categories are independent; an operator chooses which to ship based on their use case.

## Endpoint Categories

| Category | Routes | Purpose |
|---|---|---|
| **Health** | `/`, `/info`, `/health`, `/ready`, `/metrics` | Liveness / readiness probes, build metadata, Prometheus metrics |
| **Core Settlement** | `/verify`, `/settle`, `/supported` | The protocol-level surface defined in [t402-specification-v2.md](./t402-specification-v2.md) |
| **Settlements Explorer** | `/v1/settlements`, `/v1/settlements/{id}` | Read-only lookups for past settlements (audit trail, customer support, accounting export) |
| **Stats** | `/stats/requests`, `/stats/settlements` | Aggregated counters for operator dashboards |
| **Streaming** | `/v1/stream`, `/v1/stream/open`, `/v1/stream/update`, `/v1/stream/close`, `/v1/stream/{id}`, `/v1/stream/{id}/pause`, `/v1/stream/{id}/resume` | Payment channel lifecycle for [`batch-settlement`](./schemes/batch-settlement/scheme_batch_settlement_evm.md). Open / update / close map to the on-chain channel ops; pause / resume are facilitator-level scheduling controls |
| **Intent** | `/v1/intent`, `/v1/intent/{id}`, `/v1/intent/{id}/route`, `/v1/intent/{id}/execute`, `/v1/intent/{id}/cancel`, `/v1/intent/{id}/refresh`, `/v1/intent/stats` | Cross-chain intent routing — a client expresses "pay $10 USDC; source from whatever chain has the best price" and the facilitator routes the settlement across chains |
| **Discovery (Bazaar)** | `/v1/discovery/resources`, `/v1/discovery/resources/{id}`, `/v1/discovery/register` | Server-side surface for the [Bazaar extension](./extensions/bazaar.md) — registry of payable resources |
| **Admin** | `/admin/auto-settle/pause`, `/admin/auto-settle/resume`, `/admin/auto-settle/status` | Operator-only controls (require admin auth). Pause / resume the auto-settle worker without taking the facilitator offline |

Total: 31 endpoints across 8 categories.

## Required Headers

A protocol-compliant facilitator MUST accept the following headers on mutating endpoints (`/settle`, all `/v1/stream/*` mutators, all `/v1/intent/*` mutators):

### Authentication

| Header | Purpose |
|---|---|
| `X-API-Key` | Operator-level API key (free tier or paid tier; rate-limit applied per key) |
| `Authorization: Bearer ...` | Reserved for future operator OAuth integration; not currently in use |

### Idempotency

| Header | Required | Description |
|---|---|---|
| `Idempotency-Key` | Recommended on `POST` mutators | Client-generated unique key (UUIDv4 or equivalent, max 64 chars alphanumeric+hyphens). If two requests with the same `Idempotency-Key` from the same API key arrive within the idempotency window (default 24h), the facilitator MUST return the response from the first request without re-executing settlement. The same key on a request in progress MUST 409 with code T402-1409 (idempotency conflict). |
| `X-Idempotency-Replayed` | Set by facilitator on the response | `true` if the response was served from idempotency cache, `false` otherwise. Operators use this to distinguish "we actually settled" from "we returned the cached result". |

The idempotency contract is critical for production reliability: it protects against duplicate settlement when a client retries after a timeout that occurred *after* the on-chain transaction was submitted. Without it, a retry could double-settle.

### Tracing

| Header | Purpose |
|---|---|
| `X-Request-ID` | Client-supplied trace ID; echoed in response and in facilitator logs |

### CORS

Allowed headers on cross-origin requests (per OpenAPI v2.0.0):

```
Origin, Content-Type, Accept, Authorization, X-Request-ID, X-API-Key, Idempotency-Key
```

## Error Code Categories

The facilitator extends the core t402 error codes (T402-1xxx through T402-4xxx) with three additional categories:

| Category | Range | Purpose |
|---|---|---|
| Streaming | T402-6xxx | Channel state errors specific to `batch-settlement` flow (e.g. `T402-6401 voucher_below_total_claimed`) |
| Intent | T402-7xxx | Cross-chain routing errors (e.g. `T402-7503 no_route_found`) |
| Discovery | T402-8xxx | Bazaar registry errors (e.g. `T402-8404 resource_not_found`) |

Detailed per-endpoint error tables are in the OpenAPI document.

## Compatibility Promises

A facilitator implementation that claims t402-v2 compatibility MUST:

1. Implement `/verify`, `/settle`, `/supported` per the request/response shapes in `t402-specification-v2.md`.
2. Accept the `Idempotency-Key` header on `POST /settle` and honor the idempotency contract above.
3. Honor `X-Request-ID` (echo unchanged in responses and logs).
4. Return T402-xxxx error codes from the [core error code table](./t402-specification-v2.md#error-codes) for the categories it implements.

It MAY:

- Skip Streaming, Intent, Discovery, Admin, Settlements Explorer, and Stats categories entirely (only Core Settlement is required for protocol compliance)
- Add facilitator-specific endpoints under a non-conflicting prefix (e.g. `/v1/<vendor>/...`)
- Implement custom auth (Bearer token, mTLS) beyond `X-API-Key`

## Why this stub exists (and not the full spec)

A full per-endpoint specification of the 31 facilitator routes is ~5-7 days of writing. The wedge-3 ("self-host facilitator") credibility comes more from (a) ensuring the OpenAPI is the source-of-truth and (b) documenting the integration contract surface than from re-typesetting every endpoint into a t402 spec document.

This stub closes the credibility gap by:

1. Naming the categories — a third party can reason about which subset they need to implement.
2. Documenting required headers — the Idempotency-Key contract is the most-asked integration question and was absent from the protocol-level spec.
3. Establishing error-code ranges for the facilitator categories — preventing collision with future core protocol error codes.
4. Pointing at `services/facilitator/facilitator/api/openapi.yaml` as the source of truth, with explicit version (v2.0.0).

A future sprint MAY promote this overview into a full `specs/facilitator-v2.md` with per-endpoint sections; the current stub is sufficient for the t402 protocol spec layer to acknowledge the facilitator surface as part of the documented protocol.

## References

- Source-of-truth API document: `services/facilitator/facilitator/api/openapi.yaml` (v2.0.0)
- Core protocol surface: [t402-specification-v2.md](./t402-specification-v2.md)
- `batch-settlement` channel binding: [scheme_batch_settlement_evm.md](./schemes/batch-settlement/scheme_batch_settlement_evm.md)
- Bazaar discovery extension: [bazaar.md](./extensions/bazaar.md)
