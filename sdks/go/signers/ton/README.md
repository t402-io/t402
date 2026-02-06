# TON Signer for Go SDK

This package provides a TON signer implementation for the t402 Go SDK, enabling Jetton (TEP-74) transfers on the TON blockchain.

## Features

- **Ed25519 Signing**: Uses standard Ed25519 cryptography for message signing
- **WalletV4R2 Support**: Implements the standard TON wallet version
- **Jetton Transfers**: Builds and signs TEP-74 compliant Jetton transfer messages
- **Network Support**: Works with both TON mainnet and testnet
- **Mnemonic Support**: Create signers from BIP39 24-word mnemonics

## Installation

The package is included in the t402 Go SDK. Ensure you have the required dependency:

```bash
go get github.com/xssnick/tonutils-go
```

## Usage

### Create from Mnemonic

```go
package main

import (
    "log"

    "github.com/t402-io/t402/sdks/go/signers/ton"
)

func main() {
    // Create signer from 24-word mnemonic
    signer, err := ton.NewClientSignerFromMnemonic(
        "word1 word2 ... word24",
        &ton.Config{
            Endpoint:  "mainnet", // or "testnet"
            Workchain: 0,
        },
    )
    if err != nil {
        log.Fatal(err)
    }

    // Get wallet address
    address := signer.Address()
    log.Printf("Wallet address: %s", address)
}
```

### Create from Private Key

```go
package main

import (
    "log"

    "github.com/t402-io/t402/sdks/go/signers/ton"
)

func main() {
    // Create signer from hex-encoded private key (32 bytes seed)
    signer, err := ton.NewClientSignerFromPrivateKey(
        "0x1234567890abcdef...", // 32 or 64 bytes hex
        &ton.Config{
            Endpoint:  "mainnet",
            Workchain: 0,
        },
    )
    if err != nil {
        log.Fatal(err)
    }

    address := signer.Address()
    log.Printf("Wallet address: %s", address)
}
```

### Use with t402 Client

```go
package main

import (
    "context"
    "log"

    "github.com/t402-io/t402/sdks/go"
    tonmech "github.com/t402-io/t402/sdks/go/mechanisms/ton"
    "github.com/t402-io/t402/sdks/go/signers/ton"
)

func main() {
    // Create signer
    signer, err := ton.NewClientSignerFromMnemonic("word1 word2 ...", nil)
    if err != nil {
        log.Fatal(err)
    }

    // Create t402 client with TON mechanism
    client := t402.NewT402Client().
        Register("ton:*", tonmech.NewExactTonClient(signer))

    // Use client to make payments...
}
```

### Build Jetton Transfer Body

```go
package main

import (
    "log"
    "math/big"

    "github.com/t402-io/t402/sdks/go/signers/ton"
)

func main() {
    // Generate unique query ID
    queryId := ton.GenerateQueryId()

    // Build Jetton transfer body (TEP-74)
    body, err := ton.BuildJettonTransferBody(
        queryId,
        big.NewInt(1000000),   // 1 USDT (6 decimals)
        "EQDest...",           // Recipient address
        "EQResp...",           // Response destination
        1,                      // Forward amount (nanoTON)
    )
    if err != nil {
        log.Fatal(err)
    }

    log.Printf("Transfer body (base64): %s", body)
}
```

## API Reference

### Types

#### ClientSigner

Implements `t402ton.ClientTonSigner` interface:

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

#### Config

```go
type Config struct {
    // Endpoint is "mainnet", "testnet", or a custom config URL
    Endpoint string

    // Workchain (0 for basechain, -1 for masterchain)
    Workchain int8
}
```

### Functions

#### NewClientSignerFromMnemonic

Creates a signer from a 24-word BIP39 mnemonic.

#### NewClientSignerFromPrivateKey

Creates a signer from a hex-encoded Ed25519 private key.

#### BuildJettonTransferBody

Builds a TEP-74 compliant Jetton transfer message body.

#### GenerateQueryId

Generates a unique query ID using timestamp + random component.

### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `JettonTransferOp` | `0x0f8a7ea5` | TEP-74 transfer opcode |
| `DefaultGasAmount` | `100_000_000` | Default gas (0.1 TON) |
| `DefaultForwardAmount` | `1` | Default forward (1 nanoTON) |
| `DefaultTimeout` | `300` | Default validity (5 minutes) |

## TON Address Formats

TON uses several address formats:

- **Friendly (bounceable)**: `EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2`
- **Friendly (non-bounceable)**: `UQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2`
- **Raw**: `0:ed169130705004711739bd611b5876377074fc1184132e635ebe45f49c5f7b8a`

The signer returns addresses in friendly bounceable format by default.

## Network Configuration

### Mainnet (default)

```go
config := &ton.Config{
    Endpoint:  "mainnet",
    Workchain: 0,
}
```

### Testnet

```go
config := &ton.Config{
    Endpoint:  "testnet",
    Workchain: 0,
}
```

### Custom Endpoint

```go
config := &ton.Config{
    Endpoint:  "https://my-ton-node.example.com/global.config.json",
    Workchain: 0,
}
```

## Token Addresses

### USDT on TON

| Network | Jetton Master Address |
|---------|----------------------|
| Mainnet | `EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs` |
| Testnet | `kQD0GKBM8ZbryVk2aESmzfU6b9b_8era_IkvBSELujFZPsyy` |

## Security Notes

- **Never hardcode private keys** - Use environment variables or secure key management
- **Protect mnemonics** - Store securely, never commit to version control
- **Validate addresses** - Always validate recipient addresses before transfers
- **Check seqno** - Verify sequence numbers for replay protection

## License

Apache License 2.0
