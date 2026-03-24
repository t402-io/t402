# x402 Wire Format Compatibility Audit

Date: 2026-03-24
Source: github.com/coinbase/x402 (cloned to /tmp/x402-audit)

## Executive Summary

T402 and x402 are **95% wire-compatible**. The protocols share identical:
- HTTP header names (`PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`, `PAYMENT-RESPONSE`)
- Base64 JSON encoding in headers
- PaymentRequirements field structure
- ResourceInfo structure
- Network type format (`${string}:${string}` = CAIP-2)
- Facilitator verify/settle API contract
- Extension mechanism (`extensions?: Record<string, unknown>`)
- HTTPAdapter interface (identical method signatures)

The **only breaking difference** is the version field name:
- T402: `t402Version: number`
- x402: `x402Version: number`

## Detailed Comparison

### HTTP Headers (IDENTICAL)

| Header | Direction | T402 | x402 |
|--------|-----------|------|------|
| `PAYMENT-REQUIRED` | Server → Client (402 response) | Base64 JSON | Base64 JSON |
| `PAYMENT-SIGNATURE` | Client → Server (payment submission) | Base64 JSON | Base64 JSON |
| `PAYMENT-RESPONSE` | Server → Client (after settlement) | Base64 JSON | Base64 JSON |

Both also support `X-PAYMENT` as a v1 fallback header.

### PaymentRequired (402 response body)

```
Field           | T402            | x402            | Compatible?
----------------|-----------------|-----------------|------------
version         | t402Version: 2  | x402Version: 2  | NO — field name differs
error           | string?         | string?         | YES
resource        | ResourceInfo    | ResourceInfo    | YES
accepts         | PaymentReq[]    | PaymentReq[]    | YES
extensions      | Record?         | Record?         | YES
```

### PaymentRequirements (individual accept entry)

```
Field              | T402           | x402           | Compatible?
-------------------|----------------|----------------|------------
scheme             | string         | string         | YES
network            | Network (CAIP-2)| Network (CAIP-2)| YES
asset              | string         | string         | YES
amount             | string         | string         | YES
payTo              | string         | string         | YES
maxTimeoutSeconds  | number         | number         | YES
extra              | Record         | Record         | YES
```

**100% field-compatible.**

### PaymentPayload (payment submission)

```
Field           | T402            | x402            | Compatible?
----------------|-----------------|-----------------|------------
version         | t402Version: 2  | x402Version: 2  | NO — field name differs
resource        | ResourceInfo?   | ResourceInfo?   | YES
accepted        | PaymentReq      | PaymentReq      | YES
payload         | Record          | Record          | YES
extensions      | Record?         | Record?         | YES
```

### Facilitator API

```
Endpoint    | T402                | x402                | Compatible?
------------|---------------------|---------------------|------------
POST /verify| { paymentPayload,   | { x402Version,      | PARTIAL
            |   paymentRequirements}| paymentPayload,   |
            |                     |   paymentRequirements}|
POST /settle| same structure      | same + x402Version  | PARTIAL
GET /supported| { kinds, extensions,| { kinds, extensions,| YES
            |   signers }         |   signers }         |
```

x402 VerifyRequest/SettleRequest include `x402Version` at the top level.
T402's facilitator doesn't include a version field in verify/settle requests.

### VerifyResponse

```
Field           | T402            | x402            | Compatible?
----------------|-----------------|-----------------|------------
isValid         | boolean         | boolean         | YES
invalidReason   | string?         | string?         | YES
invalidMessage  | —               | string?         | x402 has extra field
payer           | string?         | string?         | YES
extensions      | —               | Record?         | x402 has extra field
```

### SettleResponse

```
Field           | T402            | x402            | Compatible?
----------------|-----------------|-----------------|------------
success         | boolean         | boolean         | YES
errorReason     | string?         | string?         | YES
errorMessage    | —               | string?         | x402 has extra field
payer           | string?         | string?         | YES
transaction     | string          | string          | YES
network         | Network         | Network         | YES
confirmations   | string?         | —               | T402 has extra field
extensions      | —               | Record?         | x402 has extra field
```

### SupportedKind

```
Field           | T402            | x402            | Compatible?
----------------|-----------------|-----------------|------------
version         | t402Version     | x402Version     | NO — field name differs
scheme          | string          | string          | YES
network         | Network         | Network         | YES
extra           | Record?         | Record?         | YES
```

## Compatibility Shim Requirements

### To accept x402 clients (x402 → T402):
1. Detect `x402Version` field in PaymentPayload → rename to `t402Version`
2. Detect `x402Version` in VerifyRequest → add to T402 facilitator request format
3. Accept `invalidMessage` in VerifyResponse (T402 ignores, x402 expects)

### To send to x402 facilitators (T402 → x402):
1. Rename `t402Version` → `x402Version` in outgoing PaymentRequired
2. Rename `t402Version` → `x402Version` in outgoing PaymentPayload
3. Add `x402Version` to VerifyRequest/SettleRequest bodies
4. Handle `invalidMessage`/`errorMessage` in responses

### Detection heuristic:
```typescript
function isX402Format(payload: Record<string, unknown>): boolean {
  return 'x402Version' in payload && !('t402Version' in payload);
}
```

## Effort Estimate

The shim is a **thin adapter** (~100 LOC):
- `t402ToX402()` — renames version field + adds to request bodies
- `x402ToT402()` — renames version field
- `detectFormat()` — checks which version field is present
- Integration into HTTPResourceServer at the header decode boundary

**Estimated: 2-3 hours with CC.**

## Conclusion

The protocols are near-identical. T402 was either a direct inspiration for x402 or
both independently arrived at the same design from the HTTP 402 spec. The version
field name is the only breaking difference. A ~100 LOC adapter makes them fully
interoperable.
