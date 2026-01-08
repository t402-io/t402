# t402 Facilitator Example

This is an example implementation of an t402 facilitator service that handles payment verification and settlement for the t402 payment protocol. This implementation is for learning purposes and demonstrates how to build a facilitator service.

For production use, we recommend using:

- Testnet: https://t402.org/facilitator
- Production: https://api.cdp.coinbase.com/platform/v2/t402

## Overview

The facilitator provides two main endpoints:

- `/verify`: Verifies t402 payment payloads
- `/settle`: Settles t402 payments by signing and broadcasting transactions
- `/supported`: Returns the payment kinds that are supported by the facilitator

This example demonstrates how to:

1. Set up a basic Express server to handle t402 payment verification and settlement
2. Integrate with the t402 protocol's verification and settlement functions
3. Handle payment payload validation and error cases

## Prerequisites

- Node.js v20+ (install via [nvm](https://github.com/nvm-sh/nvm))
- pnpm v10 (install via [pnpm.io/installation](https://pnpm.io/installation))
- A valid Ethereum private key and/or Solana private key
- Base Sepolia testnet ETH and/or Solana Devnet SOL for transaction fees

## Setup

1. Install and build all packages from the typescript examples root:

```bash
cd ..
pnpm install
pnpm build
cd facilitator
```

2. Create a `.env` file with the following variables:

```env
EVM_PRIVATE_KEY=0xYourPrivateKey
SVM_PRIVATE_KEY=base58EncodedSolanaPrivateKey
```

3. Start the server:

```bash
pnpm dev
```

The server will start on http://localhost:3000

## API Endpoints

### GET /supported

Returns information the payment kinds that the facilitator supports.

Sample Response

```json5
[
  {
    "t402Version": 1,
    "scheme": "exact",
    "network": "base-sepolia"
    "extra": {}
  },
  {
    "t402Version": 1,
    "scheme": "exact",
    "network": "solana-devnet"
    "extra": {
      "feePayer": "SolanaAddress"
    }
  },
]
```

### GET /verify

Returns information about the verify endpoint.

### POST /verify

Verifies an t402 payment payload.

Request body:

```typescript
{
  payload: string; // t402 payment payload
  details: PaymentRequirements; // Payment requirements
}
```

### GET /settle

Returns information about the settle endpoint.

### POST /settle

Settles an t402 payment by signing and broadcasting the transaction.

Request body:

```typescript
{
  payload: string; // t402 payment payload
  details: PaymentRequirements; // Payment requirements
}
```

## Learning Resources

This example is designed to help you understand how t402 facilitators work. For more information about the t402 protocol and its implementation, visit:

- [t402 Protocol Documentation](https://t402.org)
- [Coinbase Developer Platform](https://www.coinbase.com/developer-platform)
