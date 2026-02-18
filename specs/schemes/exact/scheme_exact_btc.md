# Exact Payment Scheme for Bitcoin (`exact`)

This document specifies the `exact` payment scheme for the t402 protocol on Bitcoin (BIP-122).

This scheme facilitates payments of a specific amount of BTC on the Bitcoin blockchain using PSBTs (Partially Signed Bitcoin Transactions).

## Scheme Name

`exact`

## Protocol Flow

The protocol flow for `exact` on Bitcoin is facilitator-driven:

1.  **Client** makes a request to a **Resource Server**.
2.  **Resource Server** responds with a payment required signal containing `PaymentRequired`.
3.  **Client** constructs and signs a PSBT with an output paying the required amount to the payTo address.
4.  **Client** sends a new request to the resource server with the `PaymentPayload` containing the signed PSBT (base64-encoded).
5.  **Resource Server** receives the request and forwards the `PaymentPayload` and `PaymentRequirements` to a **Facilitator Server's** `/verify` endpoint.
6.  **Facilitator** decodes the PSBT, verifies outputs match requirements, and validates signatures.
7.  **Facilitator** returns a `VerifyResponse` to the **Resource Server**.
8.  **Resource Server**, upon successful verification, forwards the payload to the facilitator's `/settle` endpoint.
9.  **Facilitator Server** finalizes the PSBT and broadcasts the transaction to the Bitcoin network.
10. Upon confirmation, the **Facilitator Server** responds with a `SettlementResponse` to the **Resource Server**.
11. **Resource Server** grants the **Client** access to the resource in its response.

## `PaymentRequirements` for `exact`

Example `PaymentRequirements` for Bitcoin:

```json
{
  "scheme": "exact",
  "network": "bip122:000000000019d6689c085ae165831e93",
  "amount": "100000",
  "asset": "BTC",
  "payTo": "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
  "maxTimeoutSeconds": 3600,
  "extra": {}
}
```

- `network`: CAIP-2 identifier using BIP-122 genesis block hash
- `asset`: Always `"BTC"` for Bitcoin on-chain payments
- `payTo`: The recipient's Bitcoin address (SegWit bech32 preferred)
- `amount`: The amount in satoshis (1 BTC = 100,000,000 satoshis)

## PaymentPayload `payload` Field

The `payload` field of the `PaymentPayload` contains:

```json
{
  "signedPsbt": "cHNidP8BAH0CAAAAAb..."
}
```

Field descriptions:

- `signedPsbt`: Base64-encoded signed PSBT containing the payment transaction

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
    "network": "bip122:000000000019d6689c085ae165831e93",
    "amount": "100000",
    "asset": "BTC",
    "payTo": "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
    "maxTimeoutSeconds": 3600,
    "extra": {}
  },
  "payload": {
    "signedPsbt": "cHNidP8BAH0CAAAAAb..."
  }
}
```

## `SettlementResponse`

The `SettlementResponse` for the exact scheme on Bitcoin:

```json
{
  "success": true,
  "transaction": "a1b2c3d4e5f6...",
  "network": "bip122:000000000019d6689c085ae165831e93"
}
```

- `transaction`: The Bitcoin transaction ID (txid)

## Facilitator Verification Rules (MUST)

A facilitator verifying an `exact`-scheme Bitcoin payment MUST enforce all of the following checks:

1. **PSBT validity**
   - The `signedPsbt` MUST be a valid PSBT format (BIP-174).
   - The PSBT MUST contain at least one signed input.

2. **Signature validity**
   - All inputs MUST have valid signatures.
   - Signatures MUST be verifiable against the input scripts.

3. **Output verification**
   - The PSBT MUST contain an output to the `PaymentRequirements.payTo` address.
   - The output value MUST be greater than or equal to `PaymentRequirements.amount` (in satoshis).

4. **Dust limit**
   - The payment output MUST be above the dust limit (546 satoshis).

5. **Fee validation**
   - The transaction MUST include a reasonable fee (above minimum relay fee of 1000 satoshis).
   - The fee SHOULD NOT be excessively high to protect the payer.

## Network Identifiers

| Network | CAIP-2 Identifier |
|---------|-------------------|
| Bitcoin Mainnet | `bip122:000000000019d6689c085ae165831e93` |
| Bitcoin Testnet | `bip122:000000000933ea01ad0ee984209779ba` |

## Supported Assets

| Asset | Symbol | Decimals (Satoshi precision) |
|-------|--------|------------------------------|
| Bitcoin | BTC | 8 |

## Appendix

### Bitcoin Address Formats

Bitcoin supports multiple address formats:
- **P2WPKH (bech32)**: `bc1q...` (mainnet), `tb1q...` (testnet) - SegWit native, recommended
- **P2PKH (legacy)**: `1...` (mainnet), `m...`/`n...` (testnet)
- **P2SH (wrapped SegWit)**: `3...` (mainnet), `2...` (testnet)
- **P2TR (Taproot)**: `bc1p...` (mainnet), `tb1p...` (testnet)

For t402, **bech32 SegWit addresses** (`bc1q...`) are recommended for lower transaction fees.

### PSBT (BIP-174)

PSBT (Partially Signed Bitcoin Transaction) is a standard format for Bitcoin transactions that:
- Allows separation of transaction construction and signing
- Supports multi-signature workflows
- Can be serialized and transmitted without broadcasting

A PSBT goes through these states:
1. **Created**: Transaction with inputs and outputs defined
2. **Signed**: Inputs signed by the wallet
3. **Finalized**: All signatures collected, ready for broadcast
4. **Broadcast**: Transaction sent to the Bitcoin network

### Units

Bitcoin uses satoshis as the smallest unit:
- 1 BTC = 100,000,000 satoshis
- 1 satoshi = 0.00000001 BTC
- Dust limit: 546 satoshis (minimum viable output)
