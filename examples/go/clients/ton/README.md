# TON Client Example (Go)

This example demonstrates how to use the t402 Go client with TON (The Open Network) payments using USDT Jettons.

## Prerequisites

- Go 1.21+
- A TON wallet with testnet USDT (for testnet) or mainnet USDT
- A running t402-enabled server accepting TON payments

## Setup

1. Create a `.env` file:

```env
TON_ADDRESS=EQC...your-ton-address
TON_PRIVATE_KEY=your-private-key-hex
SERVER_URL=http://localhost:4021/weather
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TON_ADDRESS` | Your TON wallet address | Required |
| `TON_PRIVATE_KEY` | Private key for signing (hex encoded) | For signing |
| `SERVER_URL` | URL of the resource server | `http://localhost:4021/weather` |

## Run

```bash
go run main.go
```

## How It Works

1. **Signer Implementation**: Implements `ClientTonSigner` interface for signing Jetton transfers
2. **Scheme Registration**: Registers the TON exact scheme with the t402 client
3. **Payment Flow**:
   - Client makes request to protected endpoint
   - Receives 402 Payment Required with TON payment details
   - Creates and signs a Jetton transfer message (BOC)
   - Sends the signed BOC in the PAYMENT-SIGNATURE header
   - Server/facilitator verifies and settles the payment

## ClientTonSigner Interface

The `ClientTonSigner` interface requires three methods:

```go
type ClientTonSigner interface {
    // Address returns the signer's TON address (friendly format)
    Address() string

    // GetSeqno returns the current wallet sequence number
    GetSeqno(ctx context.Context) (int64, error)

    // SignMessage signs a Jetton transfer message and returns the BOC
    SignMessage(ctx context.Context, params SignMessageParams) (string, error)
}
```

## Production Implementation

For production use, implement `SignMessage` using a TON SDK:

```go
func (s *TonSigner) SignMessage(ctx context.Context, params ton.SignMessageParams) (string, error) {
    // 1. Build Jetton transfer body
    body := buildJettonTransferBody(
        queryId,
        jettonAmount,
        destination,
        responseDestination,
        forwardTonAmount,
        forwardPayload,
    )

    // 2. Create internal message to Jetton wallet
    internalMsg := createInternalMessage(jettonWalletAddress, params.Value, body)

    // 3. Create and sign external message
    externalMsg := wallet.CreateTransfer(seqno, secretKey, internalMsg)

    // 4. Serialize to BOC
    return base64.StdEncoding.EncodeToString(externalMsg.ToBoc()), nil
}
```

## Network Support

- **Mainnet**: `ton:mainnet`
- **Testnet**: `ton:testnet`

## Token Support

Currently supports USDT Jetton (TEP-74 standard):
- Mainnet: `EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs`
- Testnet: `kQBqSpvo4S87mX9tTc4FX3Sfqf4uSp3Tx-Fz4RBUfTRWBx`
