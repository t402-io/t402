# Extension: Offer and Receipt

**Extension Key:** `offer-receipt`
**Status:** Stable
**Version:** 1

## Overview

The Offer and Receipt extension provides cryptographic commitments for both sides of a t402 payment:

- **Offers**: Server signs a commitment to specific payment terms, binding itself to honor the resource access if those terms are met.
- **Receipts**: Server signs a confirmation after successful settlement, providing the client with cryptographic proof of payment and service delivery.

## Motivation

Without this extension, the 402 response is an unsigned declaration — the server can change terms between the client's payment and resource delivery. Offers create a binding commitment. Receipts provide proof for dispute resolution.

## Extension Data

### In `PaymentRequired` (402 Response)

```json
{
  "extensions": {
    "offer-receipt": {
      "info": {
        "offers": [
          {
            "format": "eip712",
            "payload": {
              "version": 1,
              "resourceUrl": "https://api.example.com/data",
              "scheme": "exact",
              "network": "eip155:42161",
              "asset": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
              "payTo": "0x1234...5678",
              "amount": "1000000",
              "validUntil": 1711929600
            },
            "signature": "0xabc...def",
            "acceptIndex": 0
          }
        ]
      }
    }
  }
}
```

### In Settlement Response

```json
{
  "extensions": {
    "offer-receipt": {
      "info": {
        "receipt": {
          "format": "eip712",
          "payload": {
            "version": 1,
            "network": "eip155:42161",
            "resourceUrl": "https://api.example.com/data",
            "payer": "0xabcd...1234",
            "issuedAt": 1711929500,
            "transaction": "0xtxhash..."
          },
          "signature": "0x123...789"
        }
      }
    }
  }
}
```

## Types

### OfferPayload

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | integer | yes | Extension version (currently `1`) |
| `resourceUrl` | string | yes | URL of the resource being offered |
| `scheme` | string | yes | Payment scheme (e.g., `exact`, `upto`) |
| `network` | string | yes | CAIP-2 network ID (e.g., `eip155:42161`) |
| `asset` | string | yes | Token contract address |
| `payTo` | string | yes | Recipient address for payment |
| `amount` | string | yes | Amount in smallest unit |
| `validUntil` | integer | no | Unix timestamp; `0` or omitted = no expiry |

### ReceiptPayload

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | integer | yes | Extension version (currently `1`) |
| `network` | string | yes | CAIP-2 network ID |
| `resourceUrl` | string | yes | URL of the resource accessed |
| `payer` | string | yes | Payer address |
| `issuedAt` | integer | yes | Unix timestamp (seconds) of receipt issuance |
| `transaction` | string | no | On-chain transaction hash |

### SignedOffer

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `format` | string | yes | `"eip712"` or `"jws"` |
| `payload` | OfferPayload | yes* | Present for `eip712` format |
| `signature` | string | yes | Hex-encoded signature |
| `acceptIndex` | integer | no | Index into the `accepts` array this offer corresponds to |

### SignedReceipt

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `format` | string | yes | `"eip712"` or `"jws"` |
| `payload` | ReceiptPayload | yes* | Present for `eip712` format |
| `signature` | string | yes | Hex-encoded signature |

## Signature Formats

### EIP-712

Offers and receipts are signed using EIP-712 typed data with domain:

```
EIP712Domain {
  name: "T402OfferReceipt",
  version: "1"
}
```

Primary types:

```
Offer {
  uint256 version,
  string resourceUrl,
  string scheme,
  string network,
  string asset,
  address payTo,
  uint256 amount,
  uint256 validUntil
}

Receipt {
  uint256 version,
  string network,
  string resourceUrl,
  address payer,
  uint256 issuedAt,
  string transaction
}
```

### JWS (Future)

JSON Web Signature format for non-EVM contexts. Reserved for future specification.

## Flow

```
Client                    Server                    Facilitator
  |                         |                          |
  |--- GET /resource ------>|                          |
  |                         |                          |
  |<-- 402 + offers[] ------|                          |
  |    (signed commitment)  |                          |
  |                         |                          |
  |--- payment + offer ---->|                          |
  |                         |--- verify + settle ----->|
  |                         |<---- tx hash ------------|
  |                         |                          |
  |<-- 200 + receipt -------|                          |
  |    (signed proof)       |                          |
```

## SDK Support

| SDK | Package | Status |
|-----|---------|--------|
| Go | `sdks/go/extensions/offerreceipt/` | Implemented |
| TypeScript | `@t402/extensions` (`offer-receipt/`) | Implemented |
| Python | — | Not yet |
| Java | — | Not yet |

## Security Considerations

- Offers SHOULD include `validUntil` to prevent stale commitments
- Receipts MUST include `issuedAt` for temporal ordering
- Clients SHOULD verify offer signatures before paying
- The `acceptIndex` field binds an offer to a specific payment option in the `accepts` array
