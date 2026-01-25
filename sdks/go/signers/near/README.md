# NEAR Signer for Go SDK

This package provides a NEAR signer implementation for the t402 Go SDK, enabling NEP-141 fungible token transfers on the NEAR blockchain.

## Features

- **Ed25519 Signing**: Native NEAR Ed25519 transaction signing
- **NEP-141 Support**: Builds and sends ft_transfer transactions
- **Network Support**: Works with mainnet and testnet
- **Borsh Serialization**: Full transaction serialization support

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

    "github.com/t402-io/t402/sdks/go/signers/near"
)

func main() {
    // Create signer from hex-encoded 32-byte seed
    signer, err := near.NewClientSignerFromSeed(
        "0x1234567890abcdef...", // 32-byte seed
        &near.Config{
            AccountID: "alice.near",
            Endpoint:  "mainnet", // or "testnet"
        },
    )
    if err != nil {
        log.Fatal(err)
    }

    // Get account ID
    accountID := signer.AccountID()
    log.Printf("Account ID: %s", accountID)

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

    "github.com/t402-io/t402/sdks/go/signers/near"
)

func main() {
    // Create signer from NEAR-format private key (ed25519:base58...)
    signer, err := near.NewClientSignerFromPrivateKey(
        "ed25519:3D4YudUahN1nawWogh94BDwSEkd...",
        &near.Config{
            AccountID: "alice.near",
            Endpoint:  "mainnet",
        },
    )
    if err != nil {
        log.Fatal(err)
    }

    log.Printf("Account: %s", signer.AccountID())
}
```

### Send ft_transfer

```go
package main

import (
    "context"
    "log"

    "github.com/t402-io/t402/sdks/go/signers/near"
)

func main() {
    signer, _ := near.NewClientSignerFromSeed("0x...", &near.Config{
        AccountID: "alice.near",
        Endpoint:  "mainnet",
    })

    ctx := context.Background()

    // Send NEP-141 ft_transfer
    txHash, err := signer.SignAndSendTransaction(
        ctx,
        "usdt.tether-token.near", // Token contract
        "ft_transfer",            // Method name
        map[string]interface{}{
            "receiver_id": "bob.near",
            "amount":      "1000000", // 1 USDT (6 decimals)
        },
        near.DefaultFtTransferGas,
        near.FtTransferDeposit,
    )
    if err != nil {
        log.Fatal(err)
    }

    log.Printf("Transaction hash: %s", txHash)
}
```

## API Reference

### Types

#### ClientSigner

```go
type ClientSigner struct {
    // contains filtered or unexported fields
}

// AccountID returns the signer's NEAR account ID
func (s *ClientSigner) AccountID() string

// PublicKeyBase58 returns the public key in NEAR's base58 format
func (s *ClientSigner) PublicKeyBase58() string

// SignAndSendTransaction signs and sends a function call transaction
func (s *ClientSigner) SignAndSendTransaction(
    ctx context.Context,
    receiverID string,
    methodName string,
    args map[string]interface{},
    gas uint64,
    deposit string,
) (string, error)
```

#### Config

```go
type Config struct {
    // AccountID is the NEAR account ID (e.g., "alice.near")
    AccountID string

    // Endpoint is "mainnet", "testnet", or a custom URL
    Endpoint string
}
```

### Functions

#### NewClientSignerFromSeed

Creates a signer from a hex-encoded 32-byte Ed25519 seed.

#### NewClientSignerFromPrivateKey

Creates a signer from a base58-encoded NEAR private key.

#### IsValidAccountID

Validates a NEAR account ID format.

### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `DefaultFtTransferGas` | `30_000_000_000_000` | Default gas (30 TGas) |
| `FtTransferDeposit` | `"1"` | Required deposit (1 yoctoNEAR) |
| `DefaultTimeout` | `300` | Default validity (5 minutes) |

## Network Configuration

### Mainnet (default)

```go
config := &near.Config{
    AccountID: "alice.near",
    Endpoint:  "mainnet",
}
```

RPC: `https://rpc.mainnet.near.org`

### Testnet

```go
config := &near.Config{
    AccountID: "alice.testnet",
    Endpoint:  "testnet",
}
```

RPC: `https://rpc.testnet.near.org`

## Token Addresses

### USDT on NEAR (NEP-141)

| Network | Contract ID |
|---------|-------------|
| Mainnet | `usdt.tether-token.near` |
| Testnet | `usdt.fakes.testnet` |

## Account ID Format

NEAR account IDs:
- 2-64 characters
- Lowercase alphanumeric, underscores, hyphens
- Dot-separated for subaccounts (e.g., `sub.alice.near`)
- Must not start/end with special characters

Examples:
- `alice.near`
- `bob.testnet`
- `contract.alice.near`

## Security Notes

- **Never hardcode private keys** - Use environment variables or secure key management
- **Validate account IDs** - Always validate account IDs before transactions
- **Check balances** - Ensure sufficient token and gas balances
- **Handle errors** - Network calls may fail; implement retries

## License

Apache License 2.0
