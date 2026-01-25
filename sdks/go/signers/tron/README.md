# TRON Signer for Go SDK

This package provides a TRON signer implementation for the t402 Go SDK, enabling TRC20 token transfers on the TRON blockchain.

## Features

- **ECDSA secp256k1 Signing**: Uses the same curve as Ethereum
- **TRC20 Support**: Builds and signs TRC20 transfer transactions
- **Network Support**: Works with mainnet, nile, and shasta testnets
- **Base58Check Encoding**: Full address encoding/decoding support

## Installation

The package is included in the t402 Go SDK:

```bash
go get github.com/t402-io/t402/sdks/go
```

## Usage

### Create from Private Key

```go
package main

import (
    "log"

    "github.com/t402-io/t402/sdks/go/signers/tron"
)

func main() {
    // Create signer from hex-encoded private key
    signer, err := tron.NewClientSignerFromPrivateKey(
        "0x1234567890abcdef...", // secp256k1 private key
        &tron.Config{
            Endpoint: "mainnet", // or "nile", "shasta"
            FeeLimit: 100_000_000, // 100 TRX in SUN
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

### Use with t402 Client

```go
package main

import (
    "context"
    "log"

    "github.com/t402-io/t402/sdks/go"
    tronmech "github.com/t402-io/t402/sdks/go/mechanisms/tron"
    "github.com/t402-io/t402/sdks/go/signers/tron"
)

func main() {
    // Create signer
    signer, err := tron.NewClientSignerFromPrivateKey("0x...", nil)
    if err != nil {
        log.Fatal(err)
    }

    // Create t402 client with TRON mechanism
    client := t402.NewT402Client().
        Register("tron:*", tronmech.NewExactTronClient(signer))

    // Use client to make payments...
}
```

### Get Block Info

```go
package main

import (
    "context"
    "log"

    "github.com/t402-io/t402/sdks/go/signers/tron"
)

func main() {
    signer, _ := tron.NewClientSignerFromPrivateKey("0x...", nil)

    ctx := context.Background()
    blockInfo, err := signer.GetBlockInfo(ctx)
    if err != nil {
        log.Fatal(err)
    }

    log.Printf("Block: bytes=%s hash=%s expiration=%d",
        blockInfo.RefBlockBytes,
        blockInfo.RefBlockHash,
        blockInfo.Expiration,
    )
}
```

### Address Utilities

```go
package main

import (
    "log"

    "github.com/t402-io/t402/sdks/go/signers/tron"
)

func main() {
    // Validate address
    valid := tron.ValidateTronAddress("T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb")
    log.Printf("Valid: %v", valid)

    // Convert T-address to hex
    hexAddr, _ := tron.AddressToHex("T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb")
    log.Printf("Hex: %s", hexAddr)

    // Convert hex to T-address
    address, _ := tron.HexToAddress("410000000000000000000000000000000000000001")
    log.Printf("Address: %s", address)
}
```

## API Reference

### Types

#### ClientSigner

Implements `t402tron.ClientTronSigner` interface:

```go
type ClientTronSigner interface {
    // Address returns the signer's TRON address (T-prefix base58check)
    Address() string

    // GetBlockInfo returns current block info for transaction building
    GetBlockInfo(ctx context.Context) (*BlockInfo, error)

    // SignTransaction signs a TRC20 transfer transaction
    SignTransaction(ctx context.Context, params SignTransactionParams) (string, error)
}
```

#### Config

```go
type Config struct {
    // Endpoint is "mainnet", "nile", "shasta", or a custom URL
    Endpoint string

    // FeeLimit is the maximum fee in SUN (default: 100 TRX)
    FeeLimit int64
}
```

### Functions

#### NewClientSignerFromPrivateKey

Creates a signer from a hex-encoded secp256k1 private key.

#### PublicKeyToAddress

Derives a TRON address from a secp256k1 public key.

#### AddressToHex / HexToAddress

Convert between T-prefix base58check and hex formats.

#### Base58CheckEncode / Base58CheckDecode

Encode/decode TRON base58check format.

#### ValidateTronAddress

Validates a TRON address format.

### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `TronAddressPrefix` | `0x41` | TRON mainnet address prefix |
| `DefaultFeeLimit` | `100_000_000` | Default fee (100 TRX) |
| `DefaultExpiration` | `300` | Default validity (5 minutes) |

## Network Configuration

### Mainnet (default)

```go
config := &tron.Config{
    Endpoint: "mainnet",
}
```

API: `https://api.trongrid.io`

### Nile Testnet

```go
config := &tron.Config{
    Endpoint: "nile",
}
```

API: `https://nile.trongrid.io`

### Shasta Testnet

```go
config := &tron.Config{
    Endpoint: "shasta",
}
```

API: `https://api.shasta.trongrid.io`

### Custom Endpoint

```go
config := &tron.Config{
    Endpoint: "https://my-tron-node.example.com",
}
```

## Token Addresses

### USDT on TRON (TRC-20)

| Network | Contract Address |
|---------|-----------------|
| Mainnet | `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` |
| Nile | `TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf` |

## Address Format

TRON addresses:
- Start with `T` (mainnet)
- 34 characters long
- Base58check encoded
- First byte is `0x41` (TRON prefix)

Example: `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`

## Security Notes

- **Never hardcode private keys** - Use environment variables or secure key management
- **Validate addresses** - Always validate recipient addresses before transfers
- **Set appropriate fee limits** - TRC20 transfers require energy; insufficient fee will fail
- **Handle API errors** - TRON API may rate-limit or fail; implement retries

## License

Apache License 2.0
