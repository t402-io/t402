# Stellar Mechanism for T402 Go SDK

Stellar blockchain support for the T402 payment protocol using Soroban smart contracts (SEP-41 token interface).

## Networks

| Network | CAIP-2 ID | Default Token |
|---------|-----------|---------------|
| Pubnet  | `stellar:pubnet` | USDC (7 decimals) |
| Testnet | `stellar:testnet` | USDC (7 decimals) |

## Schemes

- **exact** — Soroban token transfer for a specific amount

## Package Structure

```
stellar/
├── constants.go              # Network IDs, token addresses, timing constants
├── types.go                  # Payload, signer interfaces, config types
├── utils.go                  # Address validation, amount parsing, helpers
├── exact/
│   ├── client/scheme.go      # Client: build and sign Soroban transfers
│   ├── server/scheme.go      # Server: create payment requirements
│   └── facilitator/scheme.go # Facilitator: verify and settle payments
```

## Usage

### Client

```go
import "github.com/t402-io/t402/sdks/go/mechanisms/stellar/exact/client"

signer := yourStellarSigner{} // implements stellar.ClientStellarSigner
scheme := client.NewExactStellarScheme(signer)
```

### Server

```go
import "github.com/t402-io/t402/sdks/go/mechanisms/stellar/exact/server"

scheme := server.NewExactStellarScheme()
```

### Facilitator

```go
import "github.com/t402-io/t402/sdks/go/mechanisms/stellar/exact/facilitator"

signer := yourFacilitatorSigner{} // implements stellar.FacilitatorStellarSigner
scheme := facilitator.NewExactStellarScheme(signer)
```

## Key Concepts

- **G-accounts**: Stellar public keys (Ed25519), start with `G`
- **C-accounts**: Soroban contract addresses, start with `C`
- **Ledger expiration**: `maxLedger = currentLedger + ceil(timeoutSeconds / 5)`
- **Network passphrases**: Used for transaction signing context
- **Token decimals**: Stellar USDC uses 7 decimals (vs 6 on most EVM chains)
