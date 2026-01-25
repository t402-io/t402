# Stacks Signer for Go SDK

This package provides a Stacks signer implementation for the t402 Go SDK, enabling SIP-010 fungible token transfers on the Stacks blockchain (Bitcoin L2).

## Features

- **secp256k1 Signing**: Native Stacks secp256k1 ECDSA transaction signing
- **SIP-010 Support**: Builds and submits SIP-010 token transfer transactions
- **Network Support**: Works with mainnet and testnet
- **Stacks Address Encoding**: Full Base58Check address encoding/decoding

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
    "math/big"

    "github.com/t402-io/t402/sdks/go/signers/stacks"
)

func main() {
    // Create signer from hex-encoded 32-byte seed
    signer, err := stacks.NewClientSignerFromSeed(
        "0x1234567890abcdef...", // 32-byte seed
        &stacks.Config{
            IsTestnet: false, // Mainnet
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

    "github.com/t402-io/t402/sdks/go/signers/stacks"
)

func main() {
    // Create signer from hex-encoded private key
    signer, err := stacks.NewClientSignerFromPrivateKey(
        "0x1234567890abcdef...", // 32-byte secp256k1 key
        &stacks.Config{
            IsTestnet: false,
        },
    )
    if err != nil {
        log.Fatal(err)
    }

    log.Printf("Address: %s", signer.Address())
}
```

### Send SIP-010 Transfer

```go
package main

import (
    "context"
    "log"
    "math/big"

    stacksmech "github.com/t402-io/t402/sdks/go/mechanisms/stacks"
    "github.com/t402-io/t402/sdks/go/signers/stacks"
)

func main() {
    signer, _ := stacks.NewClientSignerFromSeed("0x...", &stacks.Config{
        IsTestnet: false,
    })

    ctx := context.Background()

    // Send SIP-010 transfer
    txId, err := signer.TransferToken(
        ctx,
        stacksmech.SUSDCMainnet.ContractAddress, // SIP-010 contract
        "SP_RECIPIENT_ADDRESS",                   // Recipient
        big.NewInt(1000000),                     // Amount (6 decimals)
    )
    if err != nil {
        log.Fatal(err)
    }

    log.Printf("Transaction ID: %s", txId)
}
```

### Use with t402 Client

```go
package main

import (
    "log"

    t402 "github.com/t402-io/t402/sdks/go"
    stacksmech "github.com/t402-io/t402/sdks/go/mechanisms/stacks"
    "github.com/t402-io/t402/sdks/go/signers/stacks"
)

func main() {
    // Create signer
    signer, err := stacks.NewClientSignerFromSeed("0x...", &stacks.Config{
        IsTestnet: false,
    })
    if err != nil {
        log.Fatal(err)
    }

    // Create t402 client with Stacks mechanism
    client := t402.NewT402Client().
        Register("stacks:*", stacksmech.NewExactDirectStacksClient(signer))

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

// Address returns the signer's Stacks principal address
func (s *ClientSigner) Address() string

// PublicKeyHex returns the compressed public key as hex
func (s *ClientSigner) PublicKeyHex() string

// TransferToken signs and submits a SIP-010 transfer
func (s *ClientSigner) TransferToken(
    ctx context.Context,
    contractAddress string,
    to string,
    amount *big.Int,
) (string, error)
```

#### Config

```go
type Config struct {
    // IsTestnet determines address prefix (SP for mainnet, ST for testnet)
    IsTestnet bool
}
```

### Functions

#### NewClientSignerFromSeed

Creates a signer from a hex-encoded 32-byte secp256k1 seed.

#### NewClientSignerFromPrivateKey

Creates a signer from a hex-encoded secp256k1 private key.

## Network Configuration

### Mainnet

```go
config := &stacks.Config{
    IsTestnet: false,
}
```

API: `https://api.mainnet.hiro.so`

### Testnet

```go
config := &stacks.Config{
    IsTestnet: true,
}
```

API: `https://api.testnet.hiro.so`

## Token Information

### sUSDC on Stacks (SIP-010)

| Network | Contract Address |
|---------|------------------|
| Mainnet | `SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc` |
| Testnet | `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.token-susdc` |

## Address Format

Stacks addresses (principals):
- **SP**: Mainnet single-sig addresses (version 22)
- **ST**: Testnet single-sig addresses (version 26)
- 34-41 characters total
- Base58Check encoded with version byte

Example: `SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K`

## Contract Principals

Contract principals have the format: `{address}.{contract-name}`

Example: `SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc`

## Transaction Format

Stacks transactions include:
- Version (mainnet/testnet)
- Chain ID
- Authorization (single-sig or multi-sig)
- Anchor mode
- Post-conditions
- Payload (contract call)

## Dependencies

This package requires:
- `github.com/btcsuite/btcd/btcec/v2` - For secp256k1 operations
- `golang.org/x/crypto/ripemd160` - For RIPEMD160 hashing

## Security Notes

- **Never hardcode private keys** - Use environment variables or secure key management
- **Validate addresses** - Always validate recipient addresses before transfers
- **Verify contract IDs** - Ensure you're calling the correct token contract
- **Handle API errors** - Network calls may fail; implement retries

## License

Apache License 2.0
