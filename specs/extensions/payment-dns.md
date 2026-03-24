# Extension: Payment DNS

## Summary

Payment DNS enables service discovery for T402-enabled APIs. Any domain can advertise its T402 payment capabilities by hosting a `/.well-known/t402.json` file.

This is the "BGP for payments" — a decentralized, crawlable registry of who accepts T402 payments and on which chains.

## Discovery Protocol

### File Location

```
https://{domain}/.well-known/t402.json
```

The file MUST be served over HTTPS. HTTP requests SHOULD redirect to HTTPS.

### Schema

```json
{
  "version": "1.0",
  "name": "My API Service",
  "description": "Premium data API accepting USDT payments",
  "facilitator": "https://facilitator.t402.io",
  "chains": [
    "eip155:42161",
    "eip155:137",
    "eip155:56"
  ],
  "tokens": ["USDT", "USDT0"],
  "endpoints": [
    {
      "path": "/api/v1/data",
      "price": "1.00",
      "currency": "USDT",
      "description": "Access to premium data feed"
    },
    {
      "path": "/api/v1/analysis",
      "price": "5.00",
      "currency": "USDT",
      "description": "AI-powered data analysis"
    }
  ],
  "contact": "payments@example.com",
  "x402Compatible": true
}
```

### Field Definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | string | YES | Schema version. Currently `"1.0"` |
| `name` | string | YES | Human-readable service name |
| `description` | string | NO | Brief description of what the service offers |
| `facilitator` | string | YES | URL of the facilitator that processes payments for this service |
| `chains` | string[] | YES | CAIP-2 network identifiers for accepted chains |
| `tokens` | string[] | YES | Accepted token names (e.g., `["USDT", "USDT0"]`) |
| `endpoints` | object[] | NO | List of paid endpoints with pricing |
| `endpoints[].path` | string | YES | URL path of the paid endpoint |
| `endpoints[].price` | string | YES | Price in the specified currency |
| `endpoints[].currency` | string | YES | Currency for the price (e.g., "USDT") |
| `endpoints[].description` | string | NO | What the endpoint provides |
| `contact` | string | NO | Contact email for payment issues |
| `x402Compatible` | boolean | NO | Whether this service also accepts x402 format |

### Validation Rules

1. `version` MUST be `"1.0"`
2. `chains` MUST contain at least one valid CAIP-2 identifier
3. `tokens` MUST contain at least one token name
4. `facilitator` MUST be a valid HTTPS URL
5. `endpoints[].price` MUST be a positive decimal number as a string
6. File size MUST NOT exceed 100KB
7. File MUST be valid JSON with `Content-Type: application/json`

## Bazaar Integration

The T402 Bazaar service (`bazaar.t402.io`) crawls `/.well-known/t402.json` files and indexes them for discovery.

### Crawler Behavior

1. Bazaar maintains a list of known domains (seeded from existing T402 users)
2. Crawler visits `/.well-known/t402.json` every 24 hours
3. Valid manifests are indexed; invalid manifests are skipped with a warning
4. Domains with 3 consecutive failures are deprioritized (checked weekly instead)

### Submission API

Domains can self-register with Bazaar:

```
POST https://bazaar.t402.io/api/register
Content-Type: application/json

{
  "domain": "api.example.com"
}
```

Bazaar will immediately crawl the domain's `/.well-known/t402.json`.

### Search API

```
GET https://bazaar.t402.io/api/search?q=data+analysis&chain=eip155:42161
```

Returns a list of T402-enabled services matching the query and chain.

## Security Considerations

### Manifest Integrity

The `/.well-known/t402.json` file is mutable — the domain owner can change it at any time. To provide stronger guarantees:

1. **Future extension:** Add an optional `signature` field containing an ECDSA signature from the merchant's wallet, verifying the manifest contents
2. **Bazaar caching:** Bazaar stores historical snapshots, allowing clients to detect unexpected changes
3. **HTTPS requirement:** Prevents MITM attacks on manifest delivery

### Spoofing

An attacker who compromises DNS or the web server can redirect payments to their own facilitator. Mitigations:
- HTTPS prevents transport-level attacks
- The optional `signature` field (future) prevents content-level attacks
- Clients SHOULD verify the facilitator URL against known facilitators

## Example

```bash
# Check if a domain supports T402 payments
curl https://api.example.com/.well-known/t402.json

# Register with Bazaar for discovery
curl -X POST https://bazaar.t402.io/api/register \
  -H "Content-Type: application/json" \
  -d '{"domain": "api.example.com"}'
```

## Relationship to x402

x402 uses a similar discovery mechanism. T402's Payment DNS is designed to be compatible — a service can advertise both T402 and x402 support in the same manifest by setting `x402Compatible: true`.
