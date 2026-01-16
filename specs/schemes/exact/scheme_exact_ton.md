# Exact Payment Scheme for TON (`exact`)

This document specifies the `exact` payment scheme for the t402 protocol on The Open Network (TON).

This scheme facilitates payments of a specific amount of a Jetton token (typically USDT) on the TON blockchain.

## Scheme Name

`exact`

## Protocol Flow

The protocol flow for `exact` on TON is facilitator-driven:

1.  **Client** makes a request to a **Resource Server**.
2.  **Resource Server** responds with a payment required signal containing `PaymentRequired`.
3.  **Client** constructs and signs a Jetton transfer message.
4.  **Client** serializes the signed message as a BOC (Bag of Cells) and encodes it as Base64.
5.  **Client** sends a new request to the resource server with the `PaymentPayload` containing the signed BOC and authorization metadata.
6.  **Resource Server** receives the request and forwards the `PaymentPayload` and `PaymentRequirements` to a **Facilitator Server's** `/verify` endpoint.
7.  **Facilitator** decodes and verifies the signed BOC message.
8.  **Facilitator** checks that the message parameters match the payment requirements.
9.  **Facilitator** returns a `VerifyResponse` to the **Resource Server**.
10. **Resource Server**, upon successful verification, forwards the payload to the facilitator's `/settle` endpoint.
11. **Facilitator Server** sends the external message to the TON network.
12. Upon successful on-chain settlement, the **Facilitator Server** responds with a `SettlementResponse` to the **Resource Server**.
13. **Resource Server** grants the **Client** access to the resource in its response.

## `PaymentRequirements` for `exact`

Example `PaymentRequirements` for TON:

```json
{
  "scheme": "exact",
  "network": "ton:mainnet",
  "amount": "1000000",
  "asset": "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
  "payTo": "EQ5d11d21276ac6b5efdf179e654ff0c6eee34e0abfa263a",
  "maxTimeoutSeconds": 60,
  "extra": {}
}
```

- `network`: CAIP-2 identifier for TON (`ton:mainnet` or `ton:testnet`)
- `asset`: The Jetton master contract address (e.g., USDT on TON mainnet)
- `payTo`: The recipient's TON address (friendly format, bounceable)
- `amount`: The amount in smallest units (for USDT with 6 decimals, `1000000` = 1 USDT)

## PaymentPayload `payload` Field

The `payload` field of the `PaymentPayload` contains:

```json
{
  "signedBoc": "te6cckEBAQEADgAAGIAAA...",
  "authorization": {
    "from": "EQDrjaLahLkMB-hMCmkzOyBuHJ186Kj78e7vBmR5s0ECz2Qe",
    "to": "EQ5d11d21276ac6b5efdf179e654ff0c6eee34e0abfa263a",
    "jettonMaster": "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
    "jettonAmount": "1000000",
    "tonAmount": "100000000",
    "validUntil": 1740672154,
    "seqno": 42,
    "queryId": "12345678901234567890"
  }
}
```

Field descriptions:

- `signedBoc`: Base64-encoded signed external message (BOC format)
- `authorization.from`: Sender's TON address (friendly format, bounceable)
- `authorization.to`: Recipient's TON address
- `authorization.jettonMaster`: Jetton master contract address
- `authorization.jettonAmount`: Jetton transfer amount in smallest units
- `authorization.tonAmount`: TON amount for gas in nanoTON
- `authorization.validUntil`: Message validity timestamp (Unix seconds)
- `authorization.seqno`: Wallet sequence number for replay protection
- `authorization.queryId`: Unique message ID for tracking

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
    "network": "ton:mainnet",
    "amount": "1000000",
    "asset": "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
    "payTo": "EQ5d11d21276ac6b5efdf179e654ff0c6eee34e0abfa263a",
    "maxTimeoutSeconds": 60,
    "extra": {}
  },
  "payload": {
    "signedBoc": "te6cckEBAQEADgAAGIAAA...",
    "authorization": {
      "from": "EQDrjaLahLkMB-hMCmkzOyBuHJ186Kj78e7vBmR5s0ECz2Qe",
      "to": "EQ5d11d21276ac6b5efdf179e654ff0c6eee34e0abfa263a",
      "jettonMaster": "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
      "jettonAmount": "1000000",
      "tonAmount": "100000000",
      "validUntil": 1740672154,
      "seqno": 42,
      "queryId": "12345678901234567890"
    }
  }
}
```

## `SettlementResponse`

The `SettlementResponse` for the exact scheme on TON:

```json
{
  "success": true,
  "transaction": {
    "lt": "12345678901234567890",
    "hash": "abc123def456..."
  },
  "network": "ton:mainnet"
}
```

- `transaction.lt`: Logical time of the transaction
- `transaction.hash`: Transaction hash

## Facilitator Verification Rules (MUST)

A facilitator verifying an `exact`-scheme TON payment MUST enforce all of the following checks:

1. **BOC validity**
   - The `signedBoc` MUST be a valid TON BOC (Bag of Cells) format.
   - The BOC MUST contain a valid external message structure.

2. **Signature validity**
   - The message MUST have a valid signature from the `authorization.from` wallet.
   - The signature MUST be verifiable against the wallet's public key.

3. **Message structure**
   - The internal message MUST be a Jetton transfer operation.
   - The operation code MUST be `0x0f8a7ea5` (Jetton transfer).

4. **Transfer parameters**
   - The `authorization.to` address MUST match `PaymentRequirements.payTo`.
   - The `authorization.jettonMaster` MUST match `PaymentRequirements.asset`.
   - The `authorization.jettonAmount` MUST equal `PaymentRequirements.amount` exactly.

5. **Time validity**
   - The `validUntil` timestamp MUST be in the future.
   - The message MUST not have expired.

6. **Sequence number**
   - The `seqno` MUST match the current wallet sequence number.
   - This prevents replay attacks.

7. **Balance verification**
   - The `from` address MUST have sufficient Jetton balance to cover the transfer.
   - The wallet MUST have sufficient TON balance for gas.

8. **Wallet deployment**
   - The sender's wallet MUST be deployed on the network.

## Network Identifiers

| Network | CAIP-2 Identifier |
|---------|-------------------|
| TON Mainnet | `ton:mainnet` |
| TON Testnet | `ton:testnet` |

## Supported Assets

| Asset | Jetton Master Address | Decimals |
|-------|----------------------|----------|
| USDT | `EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs` | 6 |

## Appendix

### TON Address Format

TON uses multiple address formats:
- **Raw format**: Workchain and hash, e.g., `0:abc123...`
- **Friendly format**: Base64-encoded with flags, e.g., `EQDrjaLahLkMB-hMCmkzOyBuHJ186Kj78e7vBmR5s0ECz2Qe`
  - Bounceable addresses start with `EQ`
  - Non-bounceable addresses start with `UQ`

For t402, we use the **friendly bounceable format** (`EQ...`).

### Jetton Transfer

Jetton is TON's fungible token standard (similar to ERC20). A Jetton transfer involves:

1. **Sender's Jetton Wallet**: Each owner has a separate Jetton wallet contract for each Jetton type.
2. **Transfer Message**: The sender's Jetton wallet sends an internal message to the recipient's Jetton wallet.
3. **Forward Payload**: Optional data forwarded to the recipient.

The transfer message structure:
- `op`: `0x0f8a7ea5` (transfer)
- `query_id`: Unique message identifier
- `amount`: Jetton amount to transfer
- `destination`: Recipient's address
- `response_destination`: Address for excess TON (usually sender)
- `custom_payload`: Optional custom data
- `forward_ton_amount`: TON to forward with the message
- `forward_payload`: Optional payload for the recipient

### Gas and Fees

TON uses a gas-based fee model:
- **Gas fees**: Paid in TON (nanoTON)
- **Forward fees**: TON forwarded with internal messages
- **Storage fees**: Based on contract storage duration

For Jetton transfers, the sender must include enough TON in the message to cover:
1. Processing by their Jetton wallet
2. Internal message to recipient's Jetton wallet
3. Notification to the recipient (optional)

The `tonAmount` in the authorization should be sufficient to cover all fees (typically 0.05-0.1 TON for simple transfers).
