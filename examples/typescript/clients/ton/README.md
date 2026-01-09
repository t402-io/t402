# TON Client Example

This example demonstrates how to use `@t402/fetch` with TON (The Open Network) payments using USDT Jettons.

## Prerequisites

- Node.js 18+
- A TON wallet with testnet USDT (for testnet) or mainnet USDT
- A running t402-enabled server accepting TON payments

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Create a `.env` file:

```env
TON_MNEMONIC="word1 word2 word3 ... word24"
TON_ENDPOINT=https://testnet.toncenter.com/api/v2/jsonRPC
RESOURCE_SERVER_URL=http://localhost:4021
ENDPOINT_PATH=/weather
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TON_MNEMONIC` | 24-word mnemonic for TON wallet | Required |
| `TON_ENDPOINT` | TON RPC endpoint URL | `https://testnet.toncenter.com/api/v2/jsonRPC` |
| `RESOURCE_SERVER_URL` | URL of the resource server | `http://localhost:4021` |
| `ENDPOINT_PATH` | Path to the protected endpoint | `/weather` |

## Run

```bash
pnpm tsx index.ts
```

## How It Works

1. **Wallet Setup**: Creates a WalletContractV4 from the mnemonic
2. **Signer Implementation**: Implements `ClientTonSigner` interface for signing Jetton transfers
3. **Scheme Registration**: Registers the TON exact scheme with the t402 client
4. **Payment Flow**: When accessing a protected endpoint:
   - Client receives 402 Payment Required with TON payment details
   - Creates and signs a Jetton transfer message (BOC)
   - Sends the signed BOC in the payment header
   - Server/facilitator verifies and settles the payment

## Network Support

- **Mainnet**: `ton:mainnet` - Uses `https://toncenter.com/api/v2/jsonRPC`
- **Testnet**: `ton:testnet` - Uses `https://testnet.toncenter.com/api/v2/jsonRPC`

## Token Support

Currently supports USDT Jetton (TEP-74 standard):
- Mainnet: `EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs`
- Testnet: `kQBqSpvo4S87mX9tTc4FX3Sfqf4uSp3Tx-Fz4RBUfTRWBx`
