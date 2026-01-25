# Polkadot Signer for Go SDK

This package provides a Polkadot signer implementation for the t402 Go SDK, enabling Asset Hub asset transfers on Polkadot, Kusama, and Westend networks.

## Features

- **Ed25519 Signing**: Native Polkadot Ed25519 transaction signing
- **SS58 Address Encoding**: Full SS58 address encoding/decoding
- **SCALE Encoding**: SCALE codec for extrinsic building
- **Network Support**: Polkadot, Kusama, and Westend Asset Hubs

## Installation

The package is included in the t402 Go SDK:

```bash
go get github.com/t402-io/t402/sdks/go
```

## Usage

### Create from Seed

```go
package main

import (
    "context"
    "log"

    "github.com/t402-io/t402/sdks/go/signers/polkadot"
)

func main() {
    // Create signer from hex-encoded 32-byte seed
    signer, err := polkadot.NewClientSignerFromSeed(
        "0x1234567890abcdef...", // 32-byte seed
        &polkadot.Config{
            SS58Prefix: 0, // Polkadot mainnet
        },
    )
    if err != nil {
        log.Fatal(err)
    }

    // Get address
    address := signer.Address()
    log.Printf("Address: %s", address)

    // Get public key
    pubKey := signer.PublicKeyHex()
    log.Printf("Public key: %s", pubKey)
}
```

### Create from Private Key

```go
package main

import (
    "log"

    "github.com/t402-io/t402/sdks/go/signers/polkadot"
)

func main() {
    // Create signer from hex-encoded private key
    signer, err := polkadot.NewClientSignerFromPrivateKey(
        "0x1234567890abcdef...", // 32 or 64-byte key
        &polkadot.Config{
            SS58Prefix: 0, // Polkadot mainnet
        },
    )
    if err != nil {
        log.Fatal(err)
    }

    log.Printf("Address: %s", signer.Address())
}
```

### Use with t402 Client

```go
package main

import (
    "log"

    t402 "github.com/t402-io/t402/sdks/go"
    polkadotmech "github.com/t402-io/t402/sdks/go/mechanisms/polkadot"
    "github.com/t402-io/t402/sdks/go/signers/polkadot"
)

func main() {
    // Create signer
    signer, err := polkadot.NewClientSignerFromSeed("0x...", &polkadot.Config{
        SS58Prefix: 0,
    })
    if err != nil {
        log.Fatal(err)
    }

    // Create t402 client with Polkadot mechanism
    client := t402.NewT402Client().
        Register("polkadot:*", polkadotmech.NewExactDirectPolkadotClient(signer))

    // Use client to make payments...
}
```

## API Reference

### Types

#### ClientSigner

```go
type ClientSigner struct {
    // contains filtered or unexported fields
}

// Address returns the signer's SS58-encoded address
func (s *ClientSigner) Address() string

// PublicKeyHex returns the public key as hex string
func (s *ClientSigner) PublicKeyHex() string

// SignAndSubmitExtrinsic signs and submits an asset transfer extrinsic
func (s *ClientSigner) SignAndSubmitExtrinsic(
    ctx context.Context,
    call polkadot.ExtrinsicCall,
    network string,
) (*polkadot.ClientExtrinsicResult, error)
```

#### Config

```go
type Config struct {
    // SS58Prefix is the network-specific prefix
    // 0 = Polkadot, 2 = Kusama, 42 = Westend
    SS58Prefix int
}
```

### Functions

#### NewClientSignerFromSeed

Creates a signer from a hex-encoded 32-byte Ed25519 seed.

#### NewClientSignerFromPrivateKey

Creates a signer from a hex-encoded Ed25519 private key.

## Network Configuration

### Polkadot Asset Hub

```go
config := &polkadot.Config{
    SS58Prefix: 0,
}
network := polkadotmech.PolkadotAssetHubCAIP2
```

### Kusama Asset Hub

```go
config := &polkadot.Config{
    SS58Prefix: 2,
}
network := polkadotmech.KusamaAssetHubCAIP2
```

### Westend Asset Hub (Testnet)

```go
config := &polkadot.Config{
    SS58Prefix: 42,
}
network := polkadotmech.WestendAssetHubCAIP2
```

## Token Information

### USDT on Polkadot Asset Hub

| Network | Asset ID | Decimals |
|---------|----------|----------|
| Polkadot Asset Hub | 1984 | 6 |
| Kusama Asset Hub | 1984 | 6 |
| Westend Asset Hub | 1984 | 6 |

## SS58 Address Format

SS58 addresses are Base58-encoded with:
- Network prefix (1 or 2 bytes)
- Public key (32 bytes)
- Checksum (2 bytes)

| Prefix | Network |
|--------|---------|
| 0 | Polkadot |
| 2 | Kusama |
| 42 | Westend (generic) |

Example address: `5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY`

## SCALE Encoding

Polkadot uses SCALE (Simple Concatenated Aggregate Little-Endian) codec for:
- Compact integers (variable-length encoding)
- Extrinsic structure
- Call data

## Dependencies

This package requires:
- `golang.org/x/crypto/blake2b` - For Blake2b hashing (address checksum)

## Limitations

- **Extrinsic Submission**: Direct submission via Subscan API is not supported. Use a WebSocket RPC endpoint for actual transaction submission.
- **Sr25519**: This implementation uses Ed25519. For Sr25519 support, additional libraries are required.

## Security Notes

- **Never hardcode private keys** - Use environment variables or secure key management
- **Validate addresses** - Always validate recipient addresses before transfers
- **Match SS58 prefixes** - Ensure the SS58 prefix matches the target network
- **Handle API errors** - Network calls may fail; implement retries

## License

Apache License 2.0
