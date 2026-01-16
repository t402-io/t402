# TRON t402 Go Server Example

This example demonstrates how to create a Gin server with t402 TRON TRC20 USDT payment protection.

## Prerequisites

- Go 1.21+
- TRON wallet address to receive payments
- Access to a t402 facilitator

## Environment Variables

Create a `.env` file:

```bash
# Required
TRON_PAYEE_ADDRESS=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
FACILITATOR_URL=https://facilitator.t402.io

# Optional
TRON_NETWORK=tron:nile  # or tron:mainnet, tron:shasta
PORT=4021
```

## Running

```bash
go run main.go
```

## Endpoints

| Endpoint | Method | Price | Description |
|----------|--------|-------|-------------|
| `/weather` | GET | $0.001 USDT | Weather data |
| `/premium` | GET | $0.01 USDT | Premium content |
| `/ai/generate` | POST | $0.05 USDT | AI content generation |
| `/health` | GET | Free | Health check |

## How it Works

1. Client makes a request to a protected endpoint
2. Middleware checks for payment signature
3. If no payment, returns 402 Payment Required with TRON payment details
4. Client signs a TRC20 transfer and retries with payment
5. Facilitator verifies payment and broadcasts transaction
6. Server serves the protected resource

## Networks Supported

- `tron:mainnet` - TRON Mainnet (USDT: `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`)
- `tron:nile` - Nile Testnet (USDT: `TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf`)
- `tron:shasta` - Shasta Testnet (USDT: `TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs`)
