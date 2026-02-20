# T402 Extensions

Extensions enable modular optional functionality beyond core payment mechanics in the t402 protocol.

## How Extensions Work

Extensions use the `extensions` field present in both `PaymentRequired` (server -> client) and `PaymentPayload` (client -> server) messages.

**Server declares extensions** in the 402 response:

```json
{
  "t402Version": 2,
  "resource": { "url": "https://api.example.com/data" },
  "accepts": [ ... ],
  "extensions": {
    "extensionKey": {
      "info": { /* extension-specific data */ },
      "schema": { /* JSON Schema validating info */ }
    }
  }
}
```

**Client echoes extensions** in the payment payload. The client must include at least the `info` received from the server; it may append additional data but cannot delete or overwrite existing fields.

Each extension follows a standardized structure:

| Field | Type | Description |
|-------|------|-------------|
| `info` | object | Extension-specific data provided by the server |
| `schema` | object | JSON Schema defining the expected structure of `info` |

## Extension Specifications

| Extension | Key | Status | Description |
|-----------|-----|--------|-------------|
| [Bazaar](./bazaar.md) | `bazaar` | Stable | Resource discovery and cataloging |
| [Payment Identifier](./payment-identifier.md) | `paymentId` | Stable | Unique identifiers for correlation and idempotency |
| [Sign-In-With-X](./sign-in-with-x.md) | `siwx` | Stable | CAIP-122 wallet-based identity assertions |

## Proposing a New Extension

1. Copy the [extension template](./extension_template.md) to a new file
2. Fill in all sections including security considerations
3. Implement in at least one SDK
4. Open a pull request with both the spec and implementation

## SDK Support

| Extension | TypeScript | Go | Python | Java |
|-----------|------------|-----|--------|------|
| Bazaar | @t402/extensions | extensions pkg | t402.extensions | extensions module |
| Payment Identifier | @t402/extensions | types pkg | t402.extensions | extensions module |
| Sign-In-With-X | @t402/extensions | extensions/siwx | t402.extensions.siwx | extensions module |
