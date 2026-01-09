# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2026-01-09] - TON Blockchain Support

### Added

#### TypeScript SDK (`@t402/ton` v2.1.0)
- **TON Network Support**: Full support for TON mainnet (`ton:mainnet`) and testnet (`ton:testnet`)
- **USDT Jetton Payments**: TEP-74 compatible Jetton transfers for USDT payments
- **Register Functions**: Convenience functions for easy scheme integration
  - `registerExactTonClientScheme` - Client-side registration with signer
  - `registerExactTonServerScheme` - Resource server registration
  - `registerExactTonFacilitatorScheme` - Facilitator registration
- **Wildcard Network Registration**: Support for `ton:*` pattern matching
- **Sub-path Exports**: Separate entry points for client, server, and facilitator modules
- **Signer Interfaces**: `ClientTonSigner` and `FacilitatorTonSigner` for wallet integration
- **Utility Functions**: Address validation, Jetton amount conversion, BOC message building

#### Python SDK (`t402` v1.1.0)
- **TON Network Support**: Full support for TON mainnet and testnet
- **Network Constants**: `TON_MAINNET`, `TON_TESTNET` identifiers
- **USDT Addresses**: Pre-configured mainnet and testnet USDT Jetton addresses
- **Pydantic Models**: Type-safe `ExactTonPayload` and `ExactTonAuthorization` models
- **Flask Integration**: TON paywall template with wallet connection UI
- **FastAPI Integration**: Middleware support for TON networks
- **Utility Functions**: Address validation, network detection, amount conversion

#### Go SDK (`github.com/awesome-doge/t402/go` v1.1.0)
- **TON Mechanism**: Complete TON payment mechanism implementation
- **Client Scheme**: `ExactTonScheme` for creating TON payment payloads
- **Server Scheme**: Payment verification and requirement enhancement
- **Facilitator Scheme**: Transaction settlement and confirmation
- **Type Definitions**: `ExactTonPayload`, `ExactTonAuthorization`, signer interfaces
- **Network Configuration**: Pre-configured mainnet and testnet settings

#### Documentation
- **README Updates**: Added "Supported Networks" section with EVM, SVM, and TON
- **Quick Start Examples**: Code samples for TypeScript, Python, and Go
- **Examples Directory**: Complete working examples for all SDKs
  - TypeScript client and server examples
  - Go client and server examples
  - Python Flask server example

### Technical Details

#### Network Identifiers (CAIP-2)
- TON Mainnet: `ton:mainnet`
- TON Testnet: `ton:testnet`

#### USDT Jetton Addresses
- Mainnet: `EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs`
- Testnet: `kQBqSpvo4S87mX9tTc4FX3Sfqf4uSp3Tx-Fz4RBUfTRWBx`

#### Payment Flow
1. Client receives 402 Payment Required with TON payment details
2. Client creates Jetton transfer message (BOC format)
3. Client signs the message with their wallet
4. Client sends signed BOC in `PAYMENT-SIGNATURE` header
5. Server/Facilitator verifies the signature and transfer details
6. Facilitator broadcasts the transaction to TON network
7. Server returns the requested resource

---

## [2026-01-09] - Go SDK v1.0.0

### Added
- Initial Go SDK release
- EVM and SVM mechanism support
- HTTP client with automatic payment handling
- Gin middleware for payment-protected endpoints
- HTTPFacilitatorClient for payment verification and settlement

---

## [2026-01-08] - Python SDK v1.0.0

### Added
- Initial Python SDK release
- Flask and FastAPI middleware support
- EVM network support with USDC payments
- Paywall templates for browser-based payments
- Pydantic models for type-safe configurations

---

## [2025-12-15] - TypeScript SDK v2.0.0

### Added
- Protocol v2 support with simplified payment flow
- EVM mechanism with ERC-4337 gasless transactions
- SVM mechanism for Solana payments
- Express and Hono middleware
- Facilitator server implementation
- WDK (Wallet Development Kit) integration

### Changed
- Unified scheme registration API
- Improved error handling and validation
- Streamlined payment payload structure

---

## Release Links

### npm (TypeScript)
- [@t402/core](https://www.npmjs.com/package/@t402/core)
- [@t402/evm](https://www.npmjs.com/package/@t402/evm)
- [@t402/svm](https://www.npmjs.com/package/@t402/svm)
- [@t402/ton](https://www.npmjs.com/package/@t402/ton)

### PyPI (Python)
- [t402](https://pypi.org/project/t402/)

### Go
- [github.com/awesome-doge/t402/go](https://github.com/awesome-doge/t402/tree/main/go)

---

## Migration Guides

### Upgrading to TON Support

#### TypeScript
```typescript
// Add TON to your existing client
import { registerExactTonClientScheme } from "@t402/ton";

registerExactTonClientScheme(client, {
  signer: tonSigner,
  getJettonWalletAddress: async (owner, master) => jettonWalletAddress,
});
```

#### Python
```python
# TON networks are automatically supported
# Just use ton:mainnet or ton:testnet in your routes
from t402.ton import TON_MAINNET

paywall = create_paywall(
    routes={
        "GET /api": {
            "price": "$0.01",
            "network": TON_MAINNET,
            "pay_to": ton_address,
        },
    },
    facilitator_url=facilitator_url,
)
```

#### Go
```go
// Add TON scheme to your client
import tonclient "github.com/awesome-doge/t402/go/mechanisms/ton/exact/client"

tonScheme := tonclient.NewExactTonScheme(signer)
client.Register(t402.Network("ton:mainnet"), tonScheme)
```
