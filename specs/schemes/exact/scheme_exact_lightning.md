# Exact Payment Scheme for Lightning Network (`exact`)

This document specifies the `exact` payment scheme for the t402 protocol on the Lightning Network.

This scheme facilitates instant Bitcoin payments using BOLT11 invoices and preimage verification.

## Scheme Name

`exact`

## Protocol Flow

The protocol flow for `exact` on Lightning is unique because Lightning payments are atomic (settle-on-pay):

1.  **Client** makes a request to a **Resource Server**.
2.  **Resource Server** responds with a payment required signal containing `PaymentRequired` with a BOLT11 invoice in `extra.bolt11Invoice`.
3.  **Client** pays the BOLT11 invoice using its Lightning node.
4.  **Client** receives the payment preimage upon successful payment.
5.  **Client** sends a new request to the resource server with the `PaymentPayload` containing the preimage, payment hash, and invoice.
6.  **Resource Server** receives the request and forwards the `PaymentPayload` and `PaymentRequirements` to a **Facilitator Server's** `/verify` endpoint.
7.  **Facilitator** verifies that `SHA-256(preimage) === paymentHash`.
8.  **Facilitator** optionally looks up the payment on the Lightning node.
9.  **Facilitator** returns a `VerifyResponse` to the **Resource Server**.
10. **Resource Server**, upon successful verification, forwards the payload to the facilitator's `/settle` endpoint.
11. **Facilitator Server** confirms the payment (Lightning is already settled). Returns `SettlementResponse`.
12. **Resource Server** grants the **Client** access to the resource in its response.

## `PaymentRequirements` for `exact`

Example `PaymentRequirements` for Lightning:

```json
{
  "scheme": "exact",
  "network": "lightning:mainnet",
  "amount": "100000",
  "asset": "BTC",
  "payTo": "02abc123...",
  "maxTimeoutSeconds": 600,
  "extra": {
    "bolt11Invoice": "lnbc1u1pj...",
    "paymentHash": "abc123..."
  }
}
```

- `network`: `lightning:mainnet` or `lightning:testnet`
- `asset`: Always `"BTC"` for Lightning payments
- `payTo`: The recipient Lightning node's public key
- `amount`: The amount in satoshis
- `extra.bolt11Invoice`: BOLT11 invoice to be paid by the client
- `extra.paymentHash`: SHA-256 hash of the preimage for verification

## PaymentPayload `payload` Field

The `payload` field of the `PaymentPayload` contains:

```json
{
  "paymentHash": "abc123def456...",
  "preimage": "789abc012def...",
  "bolt11Invoice": "lnbc1u1pj..."
}
```

Field descriptions:

- `paymentHash`: Hex-encoded SHA-256 payment hash (32 bytes)
- `preimage`: Hex-encoded payment preimage (32 bytes) - proof of payment
- `bolt11Invoice`: The BOLT11 invoice that was paid

Full `PaymentPayload` object:

```json
{
  "t402Version": 2,
  "resource": {
    "url": "https://api.example.com/premium-data",
    "description": "Access to premium market data",
    "mimeType": "application/json"
  },
  "accepted": {
    "scheme": "exact",
    "network": "lightning:mainnet",
    "amount": "100000",
    "asset": "BTC",
    "payTo": "02abc123...",
    "maxTimeoutSeconds": 600,
    "extra": {
      "bolt11Invoice": "lnbc1u1pj...",
      "paymentHash": "abc123..."
    }
  },
  "payload": {
    "paymentHash": "abc123def456...",
    "preimage": "789abc012def...",
    "bolt11Invoice": "lnbc1u1pj..."
  }
}
```

## `SettlementResponse`

The `SettlementResponse` for the exact scheme on Lightning:

```json
{
  "success": true,
  "transaction": "abc123def456...",
  "network": "lightning:mainnet"
}
```

- `transaction`: The payment hash (serves as the transaction identifier on Lightning)

## Facilitator Verification Rules (MUST)

A facilitator verifying an `exact`-scheme Lightning payment MUST enforce all of the following checks:

1. **Preimage verification**
   - `SHA-256(preimage)` MUST equal `paymentHash`.
   - The preimage MUST be exactly 32 bytes (64 hex characters).
   - The payment hash MUST be exactly 32 bytes (64 hex characters).

2. **Invoice validation**
   - The `bolt11Invoice` MUST be a valid BOLT11 format.
   - The invoice MUST start with `lnbc` (mainnet) or `lntb` (testnet).

3. **Payment lookup (RECOMMENDED)**
   - The facilitator SHOULD verify the payment on its Lightning node.
   - The payment SHOULD be in `settled` state.
   - The payment amount SHOULD match the requirements.

4. **Network matching**
   - The payload network MUST match the requirements network.
   - The invoice prefix MUST match the network (lnbc for mainnet, lntb for testnet).

## Network Identifiers

| Network | CAIP-2 Identifier |
|---------|-------------------|
| Lightning Mainnet | `lightning:mainnet` |
| Lightning Testnet | `lightning:testnet` |

## Supported Assets

| Asset | Symbol | Unit |
|-------|--------|------|
| Bitcoin | BTC | Satoshis |

## Appendix

### Lightning Payment Atomicity

Lightning Network payments are atomic: either the payment completes fully, or it doesn't happen at all. This is enforced by the HTLC (Hash Time-Locked Contract) mechanism:

1. **Sender** creates an HTLC locked with a payment hash
2. **Payment routes** through intermediary nodes
3. **Receiver** reveals the preimage to claim the payment
4. **Preimage propagates** back to the sender as proof of payment

This means that:
- The preimage is sufficient proof that the payment was completed
- Settlement is implicit (happened when the invoice was paid)
- The facilitator's `settle()` is a confirmation, not an action

### BOLT11 Invoice Format

BOLT11 invoices encode:
- **Network prefix**: `lnbc` (mainnet), `lntb` (testnet), `lnbcrt` (regtest)
- **Amount**: Optional, can be zero for "any amount" invoices
- **Payment hash**: 256-bit hash of the preimage
- **Expiry**: Invoice validity period
- **Description**: Human-readable payment description
- **Node public key**: Recipient's node identity

### Preimage Verification

The core verification is:
```
SHA-256(preimage) === paymentHash
```

Where:
- `preimage` is 32 bytes (64 hex characters)
- `paymentHash` is 32 bytes (64 hex characters)
- Both are hex-encoded without `0x` prefix
