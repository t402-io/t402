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

Some extensions (notably `openapi-x-t402` and `payment-dns`) extend t402 at the discovery / specification layer rather than per-message; they are listed in the table below with their applicable surface.

## Extension Specifications

| Extension | Key | Status | Description |
|-----------|-----|--------|-------------|
| [AP2 Integration](./ap2-integration.md) | `ap2` | Stable | Google Agent Payments Protocol mandates wrapped around t402 (A2A transport) |
| [Bazaar](./bazaar.md) | `bazaar` | Stable | Resource discovery and cataloging |
| [Dispute](./dispute.md) | `dispute` | Draft | Cryptographic envelopes for post-settlement dispute and resolution (t402-leading) |
| [EIP-2612 Gas Sponsoring](./eip2612-gas-sponsoring.md) | `eip2612GasSponsoring` | Stable | Gasless ERC-20 payments via EIP-2612 permit + facilitator forwarding |
| [ERC-20 Approval Gas Sponsoring](./erc20-approval-gas-sponsoring.md) | `erc20ApprovalGasSponsoring` | Stable | Gasless ERC-20 payments for non-permit tokens via signed approve + facilitator funding |
| [ERC-8004 Integration](./erc8004-integration.md) | `erc8004` | Stable | On-chain agent identity, reputation, and validation registries |
| [Offer and Receipt](./offer-and-receipt.md) | `offer-receipt` | Stable | Cryptographic commitments — server-signed offers and post-settlement receipts (EIP-712 + JWS) |
| [OpenAPI x-t402](./openapi-x-t402.md) | `x-t402` (OpenAPI key) | Stable | Spec-time annotation declaring t402 payment requirements in OpenAPI documents |
| [Payment DNS](./payment-dns.md) | `.well-known/t402.json` (discovery) | Stable | Domain-level service discovery for t402-enabled APIs |
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
| AP2 Integration | @t402/extensions/ap2 | — | — | — |
| Bazaar | @t402/extensions | extensions pkg | t402.extensions | extensions module |
| Dispute | @t402/extensions/dispute (planned) | extensions pkg (planned) | t402.extensions.dispute (planned) | extensions module (planned) |
| EIP-2612 Gas Sponsoring | @t402/extensions | extensions pkg | t402.extensions | extensions module |
| ERC-20 Approval Gas Sponsoring | @t402/extensions | extensions pkg | t402.extensions | extensions module |
| ERC-8004 Integration | @t402/erc8004 | — | — | — |
| Offer and Receipt | @t402/extensions/offer-receipt | — | — | — |
| OpenAPI x-t402 | spec-time (no SDK needed) | spec-time | spec-time | spec-time |
| Payment DNS | discovery (no SDK needed) | discovery | discovery | discovery |
| Payment Identifier | @t402/extensions | types pkg | t402.extensions | extensions module |
| Sign-In-With-X | @t402/extensions | extensions/siwx | t402.extensions.siwx | extensions module |
