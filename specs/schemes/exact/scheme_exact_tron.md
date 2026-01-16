# Exact Payment Scheme for TRON (`exact`)

This document specifies the `exact` payment scheme for the t402 protocol on TRON.

This scheme facilitates payments of a specific amount of a TRC20 token (typically USDT) on the TRON blockchain.

## Scheme Name

`exact`

## Protocol Flow

The protocol flow for `exact` on TRON is facilitator-driven:

1.  **Client** makes a request to a **Resource Server**.
2.  **Resource Server** responds with a payment required signal containing `PaymentRequired`.
3.  **Client** constructs and signs a TRC20 transfer transaction.
4.  **Client** sends a new request to the resource server with the `PaymentPayload` containing the signed transaction and authorization metadata.
5.  **Resource Server** receives the request and forwards the `PaymentPayload` and `PaymentRequirements` to a **Facilitator Server's** `/verify` endpoint.
6.  **Facilitator** decodes and verifies the signed transaction.
7.  **Facilitator** checks that the transaction parameters match the payment requirements.
8.  **Facilitator** returns a `VerifyResponse` to the **Resource Server**.
9.  **Resource Server**, upon successful verification, forwards the payload to the facilitator's `/settle` endpoint.
10. **Facilitator Server** broadcasts the signed transaction to the TRON network.
11. Upon successful on-chain settlement, the **Facilitator Server** responds with a `SettlementResponse` to the **Resource Server**.
12. **Resource Server** grants the **Client** access to the resource in its response.

## `PaymentRequirements` for `exact`

Example `PaymentRequirements` for TRON:

```json
{
  "scheme": "exact",
  "network": "tron:mainnet",
  "amount": "1000000",
  "asset": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  "payTo": "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5",
  "maxTimeoutSeconds": 60,
  "extra": {}
}
```

- `network`: CAIP-2 identifier for TRON (`tron:mainnet` or `tron:shasta` for testnet)
- `asset`: The TRC20 contract address (e.g., USDT on TRON mainnet)
- `payTo`: The recipient's TRON address (T-prefix base58check format)
- `amount`: The amount in smallest units (for USDT with 6 decimals, `1000000` = 1 USDT)

## PaymentPayload `payload` Field

The `payload` field of the `PaymentPayload` contains:

```json
{
  "signedTransaction": "0a85010a0207902208...",
  "authorization": {
    "from": "TJRyWwFs9wTFGZg3JbrVriFbNfCug5tDeC",
    "to": "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5",
    "contractAddress": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    "amount": "1000000",
    "expiration": 1740672154000,
    "refBlockBytes": "0790",
    "refBlockHash": "a1b2c3d4e5f67890",
    "timestamp": 1740672094000
  }
}
```

Field descriptions:

- `signedTransaction`: Hex-encoded signed TRON transaction
- `authorization.from`: Sender's TRON address (T-prefix base58check)
- `authorization.to`: Recipient's TRON address
- `authorization.contractAddress`: TRC20 contract address
- `authorization.amount`: Transfer amount in smallest units
- `authorization.expiration`: Transaction expiration timestamp (milliseconds)
- `authorization.refBlockBytes`: Reference block bytes (hex string)
- `authorization.refBlockHash`: Reference block hash (hex string)
- `authorization.timestamp`: Transaction timestamp (milliseconds)

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
    "network": "tron:mainnet",
    "amount": "1000000",
    "asset": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    "payTo": "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5",
    "maxTimeoutSeconds": 60,
    "extra": {}
  },
  "payload": {
    "signedTransaction": "0a85010a0207902208...",
    "authorization": {
      "from": "TJRyWwFs9wTFGZg3JbrVriFbNfCug5tDeC",
      "to": "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5",
      "contractAddress": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
      "amount": "1000000",
      "expiration": 1740672154000,
      "refBlockBytes": "0790",
      "refBlockHash": "a1b2c3d4e5f67890",
      "timestamp": 1740672094000
    }
  }
}
```

## `SettlementResponse`

The `SettlementResponse` for the exact scheme on TRON:

```json
{
  "success": true,
  "transaction": "abc123def456...",
  "network": "tron:mainnet"
}
```

- `transaction`: The transaction ID (txId) of the broadcasted transaction

## Facilitator Verification Rules (MUST)

A facilitator verifying an `exact`-scheme TRON payment MUST enforce all of the following checks:

1. **Signature validity**
   - The signed transaction MUST have a valid signature from the `authorization.from` address.
   - Recover the signer address from the transaction and verify it matches `from`.

2. **Transaction structure**
   - The transaction MUST be a TriggerSmartContract call to the specified TRC20 contract.
   - The contract method MUST be `transfer(address,uint256)`.

3. **Transfer parameters**
   - The `authorization.to` address MUST match `PaymentRequirements.payTo`.
   - The `authorization.contractAddress` MUST match `PaymentRequirements.asset`.
   - The `authorization.amount` MUST equal `PaymentRequirements.amount` exactly.

4. **Time validity**
   - The transaction `expiration` MUST be in the future.
   - The `timestamp` MUST be reasonable (not too far in the past).

5. **Balance verification**
   - The `from` address MUST have sufficient TRC20 balance to cover the transfer.

6. **Account activation**
   - The `from` address MUST be an activated TRON account.

7. **Reference block validity**
   - The `refBlockBytes` and `refBlockHash` SHOULD correspond to a recent valid block.

## Network Identifiers

| Network | CAIP-2 Identifier |
|---------|-------------------|
| TRON Mainnet | `tron:mainnet` |
| TRON Shasta (Testnet) | `tron:shasta` |

## Supported Assets

| Asset | Contract Address | Decimals |
|-------|------------------|----------|
| USDT | `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` | 6 |

## Appendix

### TRON Address Format

TRON addresses use a T-prefix base58check encoding format. Example: `TJRyWwFs9wTFGZg3JbrVriFbNfCug5tDeC`

### TRC20 Transfer

TRC20 tokens on TRON follow a similar interface to ERC20 on Ethereum. The `transfer(address,uint256)` function is used to transfer tokens from the caller to a recipient.

### Transaction Fees

TRON uses a bandwidth and energy system for transaction fees:
- **Bandwidth**: Used for all transactions (can be staked for free bandwidth)
- **Energy**: Used for smart contract execution (can be staked for free energy)

The facilitator broadcasts the pre-signed transaction, but the original signer (payer) pays the network fees from their bandwidth/energy or TRX balance.
