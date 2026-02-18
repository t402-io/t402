# Extension: Bazaar (Resource Discovery)

## Summary

The Bazaar extension enables facilitators to automatically catalog and index t402-enabled resources by following the server's provided discovery instructions. Servers declare the shape of their HTTP endpoints (input parameters, body format, output schema) so that facilitators can build a searchable marketplace of monetized APIs and services.

## Extension Key

```
bazaar
```

## Data Format

### Server Declaration

The server includes the Bazaar extension in the `extensions` field of the `PaymentRequired` response. The extension describes how to interact with the protected endpoint.

There are two variants based on the HTTP method:

#### QueryDiscoveryExtension (GET, HEAD, DELETE)

For endpoints that accept parameters via query string.

**Info Object:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| input | object | Yes | Input specification |
| input.type | string | Yes | Always `"http"` |
| input.method | string | Yes | HTTP method: `"GET"`, `"HEAD"`, or `"DELETE"` |
| input.queryParams | object | No | Expected query parameters with example values |
| input.headers | object | No | Expected custom headers |
| output | object | No | Output specification |
| output.type | string | No | Response type (e.g., `"json"`) |
| output.format | string | No | Response format description |
| output.example | any | No | Example response body |

**Example:**

```json
{
  "extensions": {
    "bazaar": {
      "info": {
        "input": {
          "type": "http",
          "method": "GET",
          "queryParams": {
            "query": "bitcoin price",
            "limit": 10
          }
        },
        "output": {
          "type": "json",
          "example": {
            "results": [{ "price": "42000.00", "currency": "USD" }]
          }
        }
      },
      "schema": {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {
          "input": {
            "type": "object",
            "properties": {
              "type": { "type": "string", "const": "http" },
              "method": { "type": "string", "enum": ["GET", "HEAD", "DELETE"] },
              "queryParams": {
                "type": "object",
                "properties": {
                  "query": { "type": "string" },
                  "limit": { "type": "number" }
                },
                "required": ["query"]
              }
            },
            "required": ["type"]
          }
        },
        "required": ["input"]
      }
    }
  }
}
```

#### BodyDiscoveryExtension (POST, PUT, PATCH)

For endpoints that accept a request body.

**Info Object:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| input | object | Yes | Input specification |
| input.type | string | Yes | Always `"http"` |
| input.method | string | Yes | HTTP method: `"POST"`, `"PUT"`, or `"PATCH"` |
| input.bodyType | string | Yes | Content type: `"json"`, `"form-data"`, or `"text"` |
| input.body | object | Yes | Expected body fields with example values |
| input.queryParams | object | No | Additional query parameters |
| input.headers | object | No | Expected custom headers |
| output | object | No | Output specification (same as query variant) |

**Example:**

```json
{
  "extensions": {
    "bazaar": {
      "info": {
        "input": {
          "type": "http",
          "method": "POST",
          "bodyType": "json",
          "body": {
            "prompt": "Translate hello to French",
            "model": "gpt-4"
          }
        },
        "output": {
          "type": "json",
          "example": {
            "translation": "Bonjour",
            "confidence": 0.99
          }
        }
      },
      "schema": {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {
          "input": {
            "type": "object",
            "properties": {
              "type": { "type": "string", "const": "http" },
              "method": { "type": "string", "enum": ["POST", "PUT", "PATCH"] },
              "bodyType": { "type": "string", "enum": ["json", "form-data", "text"] },
              "body": {
                "type": "object",
                "properties": {
                  "prompt": { "type": "string" },
                  "model": { "type": "string" }
                },
                "required": ["prompt"]
              }
            },
            "required": ["type", "bodyType", "body"]
          }
        },
        "required": ["input"]
      }
    }
  }
}
```

### Server-Side Enrichment

The `bazaarResourceServerExtension` automatically enriches the extension declaration with the actual HTTP method from the request context. This means servers do not need to manually set the `method` field; it is injected at runtime.

### Client Payload

The client echoes the `bazaar` extension from the `PaymentRequired` response back in the `PaymentPayload.extensions` field. No additional client-side data is required.

## Validation Rules

- The `info` object must conform to the `schema` provided alongside it.
- The `input.type` must always be `"http"`.
- For body methods, `input.bodyType` and `input.body` are required.
- The `schema` must be a valid JSON Schema (draft 2020-12).
- Validation uses AJV in non-strict mode with all errors reported.

## V1 Compatibility

In protocol v1, discovery information was stored in the `outputSchema` field of `PaymentRequirements` rather than in the `extensions` field. The Bazaar facilitator functions automatically handle v1 format as a fallback:

- `extractDiscoveryInfo()` checks v2 extensions first, then falls back to v1 `outputSchema`
- `extractDiscoveryInfoV1()` directly extracts from v1 format
- V1 data is automatically transformed to v2 `DiscoveryInfo` format

## Security Considerations

- The `schema` field should be validated before trusting the `info` data.
- Discovery info should not include sensitive data (credentials, private endpoints).
- Facilitators should rate-limit discovery crawling to prevent abuse.
- The `output.example` field is informational only and should not be treated as a guarantee of response format.

## SDK Implementations

| SDK | Package | Import Path |
|-----|---------|-------------|
| TypeScript | @t402/extensions | `@t402/extensions/bazaar` |
| Go | extensions | `github.com/t402-io/t402/sdks/go/extensions` |

### TypeScript Server Usage

```typescript
import { declareDiscoveryExtension, BAZAAR } from '@t402/extensions/bazaar';

// Declare a GET endpoint with query params
const extension = declareDiscoveryExtension({
  input: { query: "example" },
  inputSchema: {
    properties: { query: { type: "string" } },
    required: ["query"]
  },
  output: {
    example: { results: [] }
  }
});

// Include in PaymentRequired response
const paymentRequired = {
  t402Version: 2,
  resource: { url: "https://api.example.com/search" },
  accepts: [ /* ... */ ],
  extensions: extension  // { bazaar: { info: {...}, schema: {...} } }
};
```

### TypeScript Facilitator Usage

```typescript
import { extractDiscoveryInfo } from '@t402/extensions/bazaar';

const info = extractDiscoveryInfo(paymentPayload, paymentRequirements);
if (info) {
  console.log("Resource:", info.resourceUrl);
  console.log("Method:", info.method);
  console.log("Discovery:", info.discoveryInfo);
}
```
