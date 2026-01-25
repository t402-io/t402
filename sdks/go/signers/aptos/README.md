# Aptos Signer for Go SDK

This package provides an Aptos signer implementation for the t402 Go SDK, enabling Fungible Asset (FA) transfers on the Aptos blockchain.

## Features

- **Ed25519 Signing**: Native Aptos Ed25519 transaction signing
- **FA Transfers**: Builds and submits `primary_fungible_store::transfer` transactions
- **Network Support**: Works with mainnet, testnet, and devnet
- **BCS Serialization**: Full transaction serialization support

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

    "github.com/t402-io/t402/sdks/go/signers/aptos"
)

func main() {
    // Create signer from hex-encoded 32-byte seed
    signer, err := aptos.NewClientSignerFromSeed(
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
    pubKey := signer.PublicKeyHex()
    log.Printf("Public key: %s", pubKey)
}
```

### Create from Private Key

```go
package main

import (
    "log"

    "github.com/t402-io/t402/sdks/go/signers/aptos"
)

func main() {
    // Create signer from hex-encoded private key
    signer, err := aptos.NewClientSignerFromPrivateKey(
        "0x1234567890abcdef...", // 32 or 64-byte key
        nil,
    )
    if err != nil {
        log.Fatal(err)
    }

    log.Printf("Address: %s", signer.Address())
}
```

### Send FA Transfer

```go
package main

import (
    "context"
    "log"

    t402 "github.com/t402-io/t402/sdks/go"
    aptosmech "github.com/t402-io/t402/sdks/go/mechanisms/aptos"
    "github.com/t402-io/t402/sdks/go/signers/aptos"
)

func main() {
    signer, _ := aptos.NewClientSignerFromSeed("0x...", nil)

    ctx := context.Background()

    // Build FA transfer payload
    payload := aptosmech.TransactionPayload{
        Type:          "entry_function_payload",
        Function:      aptosmech.FATransferFunction,
        TypeArguments: []string{},
        Arguments: []interface{}{
            aptosmech.USDTMainnet.MetadataAddress, // FA metadata
            "0xRECIPIENT_ADDRESS",                  // recipient
            "1000000",                              // amount (6 decimals)
        },
    }

    // Sign and submit
    txHash, err := signer.SignAndSubmitTransaction(
        ctx,
        payload,
        t402.Network(aptosmech.AptosMainnetCAIP2),
    )
    if err != nil {
        log.Fatal(err)
    }

    log.Printf("Transaction hash: %s", txHash)
}
```

### Use with t402 Client

```go
package main

import (
    "log"

    t402 "github.com/t402-io/t402/sdks/go"
    aptosmech "github.com/t402-io/t402/sdks/go/mechanisms/aptos/exact-direct/client"
    "github.com/t402-io/t402/sdks/go/signers/aptos"
)

func main() {
    // Create signer
    signer, err := aptos.NewClientSignerFromSeed("0x...", nil)
    if err != nil {
        log.Fatal(err)
    }

    // Create t402 client with Aptos mechanism
    client := t402.NewT402Client().
        Register("aptos:*", aptosmech.NewExactDirectAptosScheme(signer))

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

// Address returns the signer's Aptos address
func (s *ClientSigner) Address() string

// PublicKeyHex returns the public key as hex string
func (s *ClientSigner) PublicKeyHex() string

// SignAndSubmitTransaction signs and submits a transaction
func (s *ClientSigner) SignAndSubmitTransaction(
    ctx context.Context,
    payload aptos.TransactionPayload,
    network t402.Network,
) (string, error)
```

#### Config

```go
type Config struct {
    // GasLimit is the maximum gas units (optional)
    GasLimit uint64

    // GasPrice is the gas unit price in Octas (optional)
    GasPrice uint64
}
```

### Functions

#### NewClientSignerFromSeed

Creates a signer from a hex-encoded 32-byte Ed25519 seed.

#### NewClientSignerFromPrivateKey

Creates a signer from a hex-encoded Ed25519 private key.

### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `DefaultGasLimit` | `200000` | Default max gas |
| `DefaultGasPrice` | `100` | Default gas price (Octas) |
| `DefaultExpirationSecs` | `300` | Default validity (5 minutes) |

## Network Configuration

### Mainnet

```go
network := t402.Network(aptosmech.AptosMainnetCAIP2)
```

RPC: `https://fullnode.mainnet.aptoslabs.com/v1`

### Testnet

```go
network := t402.Network(aptosmech.AptosTestnetCAIP2)
```

RPC: `https://fullnode.testnet.aptoslabs.com/v1`

### Devnet

```go
network := t402.Network(aptosmech.AptosDevnetCAIP2)
```

RPC: `https://fullnode.devnet.aptoslabs.com/v1`

## Token Addresses

### USDT on Aptos (Fungible Asset)

| Network | Metadata Address |
|---------|------------------|
| Mainnet | `0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb` |

### USDC on Aptos (Fungible Asset)

| Network | Metadata Address |
|---------|------------------|
| Mainnet | `0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b` |

## Address Format

Aptos addresses:
- 32 bytes (64 hex characters)
- Always prefixed with `0x`
- Derived from SHA3-256(public_key || 0x00)

Example: `0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef`

## Transaction Format

Aptos uses BCS (Binary Canonical Serialization) for transactions:
- Sender address (32 bytes)
- Sequence number (u64)
- Payload (entry function with module, function, type args, args)
- Max gas amount (u64)
- Gas unit price (u64)
- Expiration timestamp (u64)
- Chain ID (u8)

## Security Notes

- **Never hardcode private keys** - Use environment variables or secure key management
- **Validate addresses** - Always validate recipient addresses before transfers
- **Set appropriate gas limits** - Insufficient gas will cause transaction failure
- **Handle API errors** - Network calls may fail; implement retries

## License

Apache License 2.0
