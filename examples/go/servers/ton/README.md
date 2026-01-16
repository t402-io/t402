# TON Server Example (Go)

This example demonstrates how to create a Gin server with t402 payment protection using TON USDT Jettons.

## Prerequisites

- Go 1.21+
- A TON wallet address to receive payments
- Access to a t402 facilitator that supports TON

## Setup

1. Create a `.env` file:

```env
TON_PAYEE_ADDRESS=EQC...your-ton-address
TON_NETWORK=ton:testnet
FACILITATOR_URL=https://facilitator.t402.io
PORT=4021
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TON_PAYEE_ADDRESS` | Your TON wallet address to receive payments | Required |
| `TON_NETWORK` | TON network identifier | `ton:testnet` |
| `FACILITATOR_URL` | URL of the t402 facilitator | Required |
| `PORT` | Server port | `4021` |

## Run

```bash
go run main.go
```

## Endpoints

| Method | Endpoint | Price | Description |
|--------|----------|-------|-------------|
| GET | `/weather` | $0.001 USDT | Weather data |
| GET | `/premium` | $0.01 USDT | Premium content |
| POST | `/ai/generate` | $0.05 USDT | AI content generation |
| GET | `/health` | Free | Health check |

## Testing

1. Start the server
2. Make a request without payment:

```bash
curl http://localhost:4021/weather
```

You'll receive a 402 response with payment requirements:

```json
{
  "accepts": [{
    "scheme": "exact",
    "network": "ton:testnet",
    "asset": "kQBqSpvo4S87mX9tTc4FX3Sfqf4uSp3Tx-Fz4RBUfTRWBx",
    "amount": "1000",
    "payTo": "EQC..."
  }]
}
```

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

```go
routes := t402http.RoutesConfig{
    "GET /weather": {
        Accepts: t402http.PaymentOptions{
            {Scheme: "exact", Price: "$0.001", Network: "eip155:8453", PayTo: evmAddress},
            {Scheme: "exact", Price: "$0.001", Network: "ton:mainnet", PayTo: tonAddress},
        },
        Description: "Get weather data",
    },
}

r.Use(ginmw.T402Payment(ginmw.Config{
    Routes:      routes,
    Facilitator: facilitatorClient,
    Schemes: []ginmw.SchemeConfig{
        {Network: "eip155:8453", Server: evmserver.NewExactEvmScheme()},
        {Network: "ton:mainnet", Server: tonserver.NewExactTonScheme()},
    },
}))
```

## Payment Flow

1. Client requests protected endpoint without payment
2. Server responds with 402 Payment Required + payment details
3. Client creates and signs Jetton transfer BOC
4. Client sends signed BOC in PAYMENT-SIGNATURE header
5. Server verifies payment via facilitator
6. On success, server returns the requested resource
7. Facilitator broadcasts the Jetton transfer to TON network
