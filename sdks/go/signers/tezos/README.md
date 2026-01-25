# Tezos Signer for Go SDK

This package provides a Tezos signer implementation for the t402 Go SDK, enabling FA2 token transfers on the Tezos blockchain.

## Features

- **Ed25519 Signing**: Native Tezos Ed25519 (tz1) transaction signing
- **FA2 Support**: Builds and sends FA2 (TZIP-12) transfer operations
- **Network Support**: Works with mainnet and ghostnet
- **Base58Check Encoding**: Full address and operation hash encoding

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

    "github.com/t402-io/t402/sdks/go/signers/tezos"
)

func main() {
    // Create signer from hex-encoded 32-byte seed
    signer, err := tezos.NewClientSignerFromSeed(
        "0x1234567890abcdef...", // 32-byte seed
        nil,
    )
    if err != nil {
        log.Fatal(err)
    }

    // Get address
    address := signer.Address()
    log.Printf("Address: %s", address)

    // Get public key
    pubKey := signer.PublicKeyBase58()
    log.Printf("Public key: %s", pubKey)
}
```

### Create from Private Key

```go
package main

import (
    "log"

    "github.com/t402-io/t402/sdks/go/signers/tezos"
)

func main() {
    // Create signer from Base58Check-encoded private key
    signer, err := tezos.NewClientSignerFromPrivateKey(
        "edsk...", // Base58Check encoded Ed25519 secret key
        nil,
    )
    if err != nil {
        log.Fatal(err)
    }

    log.Printf("Address: %s", signer.Address())
}
```

### Send FA2 Transfer

```go
package main

import (
    "context"
    "log"
    "math/big"

    t402 "github.com/t402-io/t402/sdks/go"
    tezosmech "github.com/t402-io/t402/sdks/go/mechanisms/tezos"
    "github.com/t402-io/t402/sdks/go/signers/tezos"
)

func main() {
    signer, _ := tezos.NewClientSignerFromSeed("0x...", nil)

    ctx := context.Background()

    // Send FA2 transfer
    opHash, err := signer.Transfer(
        ctx,
        tezosmech.USDTMainnet.ContractAddress, // FA2 contract
        tezosmech.USDTMainnet.TokenID,         // Token ID
        "tz1RECIPIENT_ADDRESS",                 // Recipient
        big.NewInt(1000000),                   // Amount (6 decimals)
        t402.Network(tezosmech.TezosMainnetCAIP2),
    )
    if err != nil {
        log.Fatal(err)
    }

    log.Printf("Operation hash: %s", opHash)
}
```

### Use with t402 Client

```go
package main

import (
    "log"

    t402 "github.com/t402-io/t402/sdks/go"
    tezosmech "github.com/t402-io/t402/sdks/go/mechanisms/tezos"
    "github.com/t402-io/t402/sdks/go/signers/tezos"
)

func main() {
    // Create signer
    signer, err := tezos.NewClientSignerFromSeed("0x...", nil)
    if err != nil {
        log.Fatal(err)
    }

    // Create t402 client with Tezos mechanism
    client := t402.NewT402Client().
        Register("tezos:*", tezosmech.NewExactDirectTezosClient(signer))

    // Use client to make payments...
}
```

### Get Balance

```go
package main

import (
    "context"
    "log"

    tezosmech "github.com/t402-io/t402/sdks/go/mechanisms/tezos"
    "github.com/t402-io/t402/sdks/go/signers/tezos"
)

func main() {
    signer, _ := tezos.NewClientSignerFromSeed("0x...", nil)

    ctx := context.Background()
    balance, err := signer.GetBalance(
        ctx,
        tezosmech.USDTMainnet.ContractAddress,
        tezosmech.USDTMainnet.TokenID,
    )
    if err != nil {
        log.Fatal(err)
    }

    log.Printf("Balance: %s", balance)
}
```

## API Reference

### Types

#### ClientSigner

```go
type ClientSigner struct {
    // contains filtered or unexported fields
}

// Address returns the signer's Tezos address (tz1)
func (s *ClientSigner) Address() string

// PublicKeyBase58 returns the public key in Tezos format (edpk)
func (s *ClientSigner) PublicKeyBase58() string

// GetBalance retrieves the FA2 token balance
func (s *ClientSigner) GetBalance(
    ctx context.Context,
    contractAddress string,
    tokenID int,
) (string, error)

// Transfer executes an FA2 transfer operation
func (s *ClientSigner) Transfer(
    ctx context.Context,
    contractAddress string,
    tokenID int,
    to string,
    amount *big.Int,
    network t402.Network,
) (string, error)
```

### Functions

#### NewClientSignerFromSeed

Creates a signer from a hex-encoded 32-byte Ed25519 seed.

#### NewClientSignerFromPrivateKey

Creates a signer from a Base58Check-encoded Tezos private key (edsk).

## Network Configuration

### Mainnet

```go
network := t402.Network(tezosmech.TezosMainnetCAIP2)
```

RPC: `https://mainnet.api.tez.ie`
Indexer: `https://api.tzkt.io`

### Ghostnet (Testnet)

```go
network := t402.Network(tezosmech.TezosGhostnetCAIP2)
```

RPC: `https://ghostnet.tezos.marigold.dev`
Indexer: `https://api.ghostnet.tzkt.io`

## Token Addresses

### USDt on Tezos (FA2)

| Network | Contract Address | Token ID |
|---------|------------------|----------|
| Mainnet | `KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o` | 0 |

## Address Format

Tezos addresses:
- **tz1**: Ed25519 addresses (36 characters)
- **tz2**: secp256k1 addresses (36 characters)
- **tz3**: P-256 addresses (36 characters)
- **KT1**: Contract addresses (36 characters)

Example: `tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb`

## Operation Hash Format

Operation hashes:
- Start with 'o'
- 51 characters total
- Base58Check encoded

Example: `opJX8K...`

## Key Formats

### Private Key (edsk)

Base58Check encoded with prefix `[43, 246, 78, 7]`.

### Public Key (edpk)

Base58Check encoded with prefix `[13, 15, 37, 217]`.

### Signature (edsig)

Base58Check encoded with prefix `[9, 245, 205, 134, 18]`.

## Security Notes

- **Never hardcode private keys** - Use environment variables or secure key management
- **Validate addresses** - Always validate recipient addresses before transfers
- **Handle API errors** - Network calls may fail; implement retries
- **Check balances** - Verify sufficient balance before transfers

## Dependencies

This package requires:
- `golang.org/x/crypto/blake2b` - For Blake2b hashing (Tezos address derivation)

## License

Apache License 2.0
