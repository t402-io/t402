# TRON t402 Go Client Example

This example demonstrates how to use the t402 Go client with TRON TRC20 USDT payments.

## Prerequisites

- Go 1.21+
- TRON wallet with TRC20 USDT balance
- A t402-enabled server accepting TRON payments

## Environment Variables

Create a `.env` file:

```bash
# Required
TRON_ADDRESS=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
TRON_PRIVATE_KEY=your_private_key_hex

# Optional
SERVER_URL=http://localhost:4021/weather
```

## Running

```bash
go run main.go
```

## How it Works

1. The client makes an HTTP request to a protected endpoint
2. If a 402 Payment Required response is received, it:
   - Parses the payment requirements
   - Selects a TRON payment option
   - Signs a TRC20 transfer transaction
   - Retries the request with the payment signature
3. On successful payment, receives the protected resource

## Implementation Notes

The `ExampleTronSigner` in this example returns placeholder values. In production:

1. Use a TRON SDK (like go-tron-sdk) for actual transaction signing
2. Query TronGrid API for current block info
3. Build proper TriggerSmartContract transactions for TRC20 transfers
4. Sign transactions with the actual private key

## Networks Supported

- `tron:mainnet` - TRON Mainnet
- `tron:nile` - Nile Testnet
- `tron:shasta` - Shasta Testnet
