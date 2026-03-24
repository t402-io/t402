# Extension: OpenAPI x-t402

## Summary

The `x-t402` OpenAPI extension allows any API with an OpenAPI specification to declare T402 payment requirements directly in the API spec. This enables automated code generation of T402-aware clients and lets enterprises adopt T402 by annotating their existing API descriptions.

## Specification

### Operation-Level Extension

Add `x-t402` to any OpenAPI operation (path + method) to require payment:

```yaml
paths:
  /api/v1/premium-data:
    get:
      summary: Get premium market data
      x-t402:
        price: "1.00"
        currency: USDT
        network: "eip155:42161"
        payTo: "0x209693Bc6afc0C5328bA36FaF03C514EF312287C"
        scheme: exact
        facilitator: "https://facilitator.t402.io"
      responses:
        "200":
          description: Premium data returned after payment
        "402":
          description: Payment required
          headers:
            PAYMENT-REQUIRED:
              description: Base64-encoded payment requirements
              schema:
                type: string
```

### Root-Level Extension (Defaults)

Set defaults at the API root level to avoid repetition:

```yaml
openapi: "3.1.0"
info:
  title: My Premium API
  version: "1.0"
x-t402:
  defaults:
    currency: USDT
    network: "eip155:42161"
    payTo: "0x209693Bc6afc0C5328bA36FaF03C514EF312287C"
    scheme: exact
    facilitator: "https://facilitator.t402.io"
paths:
  /api/v1/data:
    get:
      x-t402:
        price: "1.00"
      # Inherits currency, network, payTo, scheme, facilitator from root
  /api/v1/analysis:
    post:
      x-t402:
        price: "5.00"
        network: "eip155:137"
      # Overrides network, inherits the rest
```

### Field Definitions

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `price` | string | YES | — | Price per request in the specified currency |
| `currency` | string | NO | `"USDT"` | Payment currency |
| `network` | string | NO | `"eip155:42161"` | CAIP-2 network identifier |
| `payTo` | string | YES* | — | Wallet address receiving payments (*can inherit from root) |
| `scheme` | string | NO | `"exact"` | T402 payment scheme |
| `facilitator` | string | NO | `"https://facilitator.t402.io"` | Facilitator URL |
| `maxTimeoutSeconds` | number | NO | `120` | Payment signature timeout |
| `networks` | string[] | NO | — | Multiple accepted networks (overrides `network`) |

### Multi-Network Support

To accept payment on multiple chains for the same endpoint:

```yaml
x-t402:
  price: "1.00"
  networks:
    - "eip155:42161"  # Arbitrum
    - "eip155:137"    # Polygon
    - "eip155:56"     # BSC
  payTo: "0x..."
```

The server will include all networks in the `accepts` array of the 402 response.

## Code Generation

### TypeScript Client Generation

Given an OpenAPI spec with `x-t402` annotations, a code generator produces typed T402 client calls:

```typescript
// Generated from OpenAPI spec
import { t402Fetch } from "@t402/fetch";

export class PremiumDataClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Get premium market data
   * @t402 price: 1.00 USDT on eip155:42161
   */
  async getPremiumData(): Promise<PremiumDataResponse> {
    return t402Fetch(`${this.baseUrl}/api/v1/premium-data`, {
      // T402 payment config auto-injected from x-t402 annotation
      t402: {
        price: "1.00",
        network: "eip155:42161",
        payTo: "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
      },
    });
  }
}
```

### CLI Tool

```bash
npx @t402/openapi-gen ./openapi.yaml --output ./src/generated/
```

Generates:
- Typed client with T402 payment handling built-in
- Type definitions for all request/response schemas
- T402 configuration extracted from `x-t402` annotations

## Validation

OpenAPI validators should accept `x-t402` as a valid extension (OpenAPI allows `x-` prefixed extensions). A T402-specific validator can additionally check:

1. `price` is a valid positive decimal string
2. `network` is a valid CAIP-2 identifier
3. `payTo` is a valid address for the specified network
4. `facilitator` is a valid HTTPS URL
5. Operations with `x-t402` include a `402` response definition

## Relationship to T402 Middleware

The `x-t402` extension is the **specification-time** complement to `@t402/quick`'s **runtime** middleware:

- `x-t402` in OpenAPI = "this API requires payment" (documented in spec)
- `@t402/quick` middleware = "this API requires payment" (enforced at runtime)

Both produce the same behavior. `x-t402` is for API-first teams who design specs before code. `@t402/quick` is for code-first developers who add payment after the fact.
