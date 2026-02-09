# TRON Express Server Example

Express.js server demonstrating how to protect API endpoints with TRON TRC20 USDT payments using the `@t402/express` middleware.

## Prerequisites

- Node.js 18+
- A TRON wallet address for receiving payments
- A facilitator service that supports TRON (e.g., `https://facilitator.t402.io`)

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Create a `.env` file:

```env
TRON_ADDRESS=TR7NHqje...     # Your TRON receiving address
FACILITATOR_URL=https://facilitator.t402.io
TRON_NETWORK=tron:nile       # or tron:mainnet
PORT=4021
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TRON_ADDRESS` | TRON wallet address to receive payments | Required |
| `FACILITATOR_URL` | Facilitator endpoint URL | Required |
| `TRON_NETWORK` | TRON network identifier | `tron:nile` |
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

## How It Works

1. The server uses `@t402/express` middleware to intercept requests to protected routes
2. When a client requests a protected route without payment, the server responds with `402 Payment Required` and TRON payment details
3. The client signs a TRC20 USDT transfer and resubmits with the `PAYMENT-SIGNATURE` header
4. The server verifies the payment via the facilitator and serves the resource

```typescript
import { paymentMiddleware, t402ResourceServer } from "@t402/express";
import { ExactTronScheme } from "@t402/tron/exact/server";
import { HTTPFacilitatorClient } from "@t402/core/server";

app.use(
  paymentMiddleware(
    {
      "GET /weather": {
        accepts: [{ scheme: "exact", price: "$0.001", network: "tron:nile", payTo: tronAddress }],
        description: "Weather data",
        mimeType: "application/json",
      },
    },
    new t402ResourceServer(facilitatorClient).register(network, new ExactTronScheme()),
  ),
);
```

## Testing

Use the TRON client example to test this server:

```bash
cd ../../clients/tron
# Ensure .env is configured
pnpm tsx index.ts
```

## Network Support

- `tron:mainnet` - TRON Mainnet
- `tron:nile` - Nile Testnet
- `tron:shasta` - Shasta Testnet
