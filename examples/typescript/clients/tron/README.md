# TRON Client Example

This example demonstrates how to use `@t402/fetch` with TRON TRC20 USDT payments.

## Prerequisites

- Node.js 18+
- A TRON wallet with TRC20 USDT balance
- A running t402-enabled server accepting TRON payments

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Create a `.env` file:

```env
TRON_PRIVATE_KEY=abc123...   # 64-char hex string
TRON_ADDRESS=TR7NHqje...     # T-address
TRON_ENDPOINT=https://api.nileex.io
RESOURCE_SERVER_URL=http://localhost:4021
ENDPOINT_PATH=/weather
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TRON_PRIVATE_KEY` | Private key for TRON wallet (hex) | Required |
| `TRON_ADDRESS` | TRON wallet address (T...) | Required |
| `TRON_ENDPOINT` | TRON RPC endpoint URL | `https://api.nileex.io` |
| `RESOURCE_SERVER_URL` | URL of the resource server | `http://localhost:4021` |
| `ENDPOINT_PATH` | Path to the protected endpoint | `/weather` |

## Run

```bash
pnpm tsx index.ts
```

## How It Works

1. **Signer Implementation**: Implements the `ClientTronSigner` interface for signing TRC20 transfer transactions
2. **Scheme Registration**: Registers the TRON exact scheme with the t402 client via `registerExactTronClientScheme`
3. **Fetch Wrapper**: Wraps the native `fetch` API with `wrapFetchWithPayment` for automatic payment handling
4. **Payment Flow**: When accessing a protected endpoint:
   - Client receives 402 Payment Required with TRON payment details
   - Creates and signs a TRC20 transfer transaction
   - Sends the signed transaction in the payment header
   - Server/facilitator verifies and settles the payment

## Implementation Notes

The `tronSigner` in this example returns placeholder values. In production, use [TronWeb](https://tronweb.network/):

```typescript
import TronWeb from "tronweb";

const tronWeb = new TronWeb({
  fullHost: tronEndpoint,
  privateKey: tronPrivateKey,
});

const tronSigner: ClientTronSigner = {
  address: tronWeb.defaultAddress.base58,

  async signTransaction(params) {
    const tx = await tronWeb.transactionBuilder.triggerSmartContract(
      params.contractAddress,
      "transfer(address,uint256)",
      { feeLimit: params.feeLimit },
      [
        { type: "address", value: params.to },
        { type: "uint256", value: params.amount },
      ],
      tronWeb.defaultAddress.base58,
    );
    const signedTx = await tronWeb.trx.sign(tx.transaction);
    return JSON.stringify(signedTx);
  },

  async getBlockInfo() {
    const block = await tronWeb.trx.getCurrentBlock();
    return {
      refBlockBytes: block.block_header.raw_data.number
        .toString(16).slice(-4).padStart(4, "0"),
      refBlockHash: block.blockID.slice(16, 32),
      expiration: Date.now() + 60000,
    };
  },
};
```

## Network Support

- `tron:mainnet` - TRON Mainnet (TronGrid: `https://api.trongrid.io`)
- `tron:nile` - Nile Testnet (`https://api.nileex.io`)
- `tron:shasta` - Shasta Testnet (`https://api.shasta.trongrid.io`)

## Token Support

TRC20 USDT:
- Mainnet: `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`
- Nile Testnet: `TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf`
