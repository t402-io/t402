# USDT0 Cross-Chain Bridge Go Example

This example demonstrates how to bridge USDT0 across EVM chains using LayerZero OFT via the Go SDK's `bridge` package.

## Features

- **Chain Discovery**: List supported bridging chains and endpoint IDs
- **Quote**: Get bridge fees and estimated delivery time
- **Send**: Execute cross-chain USDT0 transfers
- **Track**: Monitor delivery status via LayerZero Scan
- **Cross-Chain Router**: Automatic bridge + payment in one step

## Prerequisites

- Go 1.21+
- Private key with USDT0 balance on the source chain
- Native token (ETH/etc.) for gas fees

## Running

### Demo mode (no wallet required)

```bash
go run main.go
```

### Real transactions

```bash
PRIVATE_KEY=0x... go run main.go
```

Set `demoMode = false` in `main.go` to enable real transactions.

## Supported Chains

| Chain | USDT0 Address |
|-------|---------------|
| Ethereum | `0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee` |
| Arbitrum | `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9` |
| Ink | `0x0200C29006150606B650577BBE7B6248F58470c1` |
| Berachain | `0x779Ded0c9e1022225f8E0630b35a9b54bE713736` |
| Unichain | `0x9151434b16b9763660705744891fA906F660EcC5` |

## Code Overview

### Get Bridge Quote

```go
import "github.com/t402-io/t402/sdks/go/mechanisms/evm/bridge"

bridgeClient, _ := bridge.NewUsdt0Bridge(signer, "arbitrum")

quote, _ := bridgeClient.Quote(ctx, &bridge.BridgeQuoteParams{
    FromChain: "arbitrum",
    ToChain:   "ethereum",
    Amount:    big.NewInt(100_000000), // 100 USDT0
    Recipient: "0x...",
})
```

### Execute Bridge

```go
result, _ := bridgeClient.Send(ctx, &bridge.BridgeExecuteParams{
    BridgeQuoteParams: bridge.BridgeQuoteParams{
        FromChain: "arbitrum",
        ToChain:   "ethereum",
        Amount:    big.NewInt(100_000000),
        Recipient: "0x...",
    },
    SlippageTolerance: 0.5,
})
```

### Track Delivery

```go
scanClient := bridge.NewLayerZeroScanClient()

message, _ := scanClient.WaitForDelivery(ctx, result.MessageGUID, &bridge.WaitForDeliveryOptions{
    OnStatusChange: func(status bridge.LayerZeroMessageStatus) {
        fmt.Println("Status:", status)
    },
})
```

## Resources

- [LayerZero Scan](https://layerzeroscan.com/) - Message tracking
- [USDT0 Documentation](https://usdt0.to/) - OFT token details
- [T402 Bridge Docs](https://docs.t402.io/reference/bridge) - SDK reference
