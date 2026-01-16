# TON Server Example

This example demonstrates how to create an Express server with t402 payment protection using TON USDT Jettons.

## Prerequisites

- Node.js 18+
- A TON wallet address to receive payments
- Access to a t402 facilitator that supports TON

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Create a `.env` file:

```env
TON_ADDRESS=EQC...your-ton-address
TON_NETWORK=ton:testnet
FACILITATOR_URL=https://facilitator.t402.io
PORT=4021
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TON_ADDRESS` | Your TON wallet address to receive payments | Required |
| `TON_NETWORK` | TON network identifier | `ton:testnet` |
| `FACILITATOR_URL` | URL of the t402 facilitator | Required |
| `PORT` | Server port | `4021` |

## Run

```bash
pnpm tsx index.ts
```

## Endpoints

| Endpoint | Price | Description |
|----------|-------|-------------|
| `GET /weather` | $0.001 USDT | Weather data |
| `GET /premium` | $0.01 USDT | Premium content |
| `GET /health` | Free | Health check |

## Testing

1. Start the server
2. Make a request without payment:

```bash
curl http://localhost:4021/weather
```

You'll receive a 402 response with payment requirements including:
- `network`: `ton:testnet` or `ton:mainnet`
- `asset`: USDT Jetton master address
- `payTo`: Your TON address
- `price`: Required amount

3. Use a t402 client with TON support to make the paid request

## Network Configuration

### Testnet

```env
TON_NETWORK=ton:testnet
```

Uses testnet USDT Jetton at `kQBqSpvo4S87mX9tTc4FX3Sfqf4uSp3Tx-Fz4RBUfTRWBx`

### Mainnet

```env
TON_NETWORK=ton:mainnet
```

Uses mainnet USDT Jetton at `EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs`

## Multi-Network Support

To accept payments on multiple networks (EVM + TON):

```typescript
app.use(
  paymentMiddleware(
    {
      "GET /weather": {
        accepts: [
          { scheme: "exact", price: "$0.001", network: "eip155:8453", payTo: evmAddress },
          { scheme: "exact", price: "$0.001", network: "ton:mainnet", payTo: tonAddress },
        ],
        description: "Weather data",
      },
    },
    new t402ResourceServer(facilitatorClient)
      .register("eip155:8453", new ExactEvmScheme())
      .register("ton:mainnet", new ExactTonScheme()),
  ),
);
```
