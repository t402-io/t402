# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2026-01-09] - WDK Gasless Payments

### Added

#### @t402/wdk-gasless (`wdk-gasless/v1.0.0`)

Gasless USDT0 payments using Tether WDK and ERC-4337 Account Abstraction. Enables users to send stablecoin payments without holding ETH for gas fees.

#### Core Features
- **WdkSmartAccount**: Wraps Tether WDK accounts in Safe smart accounts (4337 module v0.3.0)
  - Counterfactual address computation
  - EIP-712 typed data signing via WDK
  - Multi-owner support with configurable threshold
- **WdkGaslessClient**: High-level client for gasless payments
  - `pay()` - Execute single gasless USDT0 transfer
  - `payBatch()` - Execute multiple payments in one UserOperation
  - `canSponsor()` - Check if payment can be gas-sponsored
  - `getBalance()` / `getFormattedBalance()` - Check token balances
  - `getAccountAddress()` / `isAccountDeployed()` - Account status

#### Supported Tokens & Chains
| Chain | Chain ID | USDT0 | USDC |
|-------|----------|-------|------|
| Ethereum | 1 | ✅ | ✅ |
| Arbitrum | 42161 | ✅ | ✅ |
| Base | 8453 | ✅ | ✅ |
| Optimism | 10 | ✅ | ✅ |
| Ink | 57073 | ✅ | - |
| Berachain | 80084 | ✅ | - |
| Unichain | 130 | ✅ | - |

#### Usage Example
```typescript
import { createWdkGaslessClient } from '@t402/wdk-gasless';

const client = await createWdkGaslessClient({
  wdkAccount: myWdkAccount,
  publicClient,
  chainId: 42161,
  bundler: {
    bundlerUrl: 'https://api.pimlico.io/v2/arbitrum/rpc?apikey=...',
    chainId: 42161,
  },
  paymaster: {
    address: '0x...',
    url: 'https://api.pimlico.io/v2/arbitrum/rpc?apikey=...',
    type: 'sponsoring',
  },
});

// Execute gasless payment
const result = await client.pay({
  to: '0x...',
  amount: 1000000n, // 1 USDT0
});

const receipt = await result.wait();
console.log('Confirmed:', receipt.txHash);
```

#### Bundler/Paymaster Support
- Pimlico
- Alchemy
- Stackup
- Biconomy

#### Examples
- `examples/typescript/wdk-gasless/` - Demo with mock WDK account

---

## [2026-01-09] - MCP Integration for AI Agent Payments

### Added

#### @t402/mcp (`mcp/v1.0.0`)

Model Context Protocol (MCP) server enabling AI agents like Claude to make stablecoin payments across multiple blockchain networks.

#### MCP Tools
- **t402/getBalance**: Check wallet balance (native + stablecoins) on a specific network
- **t402/getAllBalances**: Check balances across all supported networks with aggregated totals
- **t402/pay**: Execute stablecoin payments (USDC, USDT, USDT0)
- **t402/payGasless**: Execute gasless payments using ERC-4337 account abstraction
- **t402/getBridgeFee**: Get fee quotes for USDT0 cross-chain bridging
- **t402/bridge**: Bridge USDT0 between chains using LayerZero OFT

#### Features
- **Demo Mode**: Simulate transactions without real execution for testing
- **Multi-Chain Support**: Ethereum, Base, Arbitrum, Optimism, Polygon, Avalanche, Ink, Berachain, Unichain
- **Custom RPC URLs**: Configure custom endpoints per network
- **ERC-4337 Support**: Gasless transactions with bundler/paymaster configuration
- **CLI Entry Point**: `npx @t402/mcp` for Claude Desktop integration

#### Claude Desktop Integration
```json
{
  "mcpServers": {
    "t402": {
      "command": "npx",
      "args": ["@t402/mcp"],
      "env": {
        "T402_DEMO_MODE": "true"
      }
    }
  }
}
```

#### Environment Variables
| Variable | Description |
|----------|-------------|
| `T402_PRIVATE_KEY` | Wallet private key for signing transactions |
| `T402_DEMO_MODE` | Enable simulated transactions |
| `T402_BUNDLER_URL` | ERC-4337 bundler URL |
| `T402_PAYMASTER_URL` | Paymaster URL for sponsored gas |
| `T402_RPC_*` | Custom RPC URLs per network |

#### Examples
- `examples/typescript/mcp/standalone.ts` - Programmatic usage without MCP server

---

## [2026-01-09] - USDT0 Cross-Chain Bridge via LayerZero

### Added

#### USDT0 Bridge (`bridge/v1.0.0`)

Cross-chain USDT0 transfers using LayerZero OFT standard with message tracking via LayerZero Scan API.

#### TypeScript SDK (`@t402/evm`)
- **Usdt0Bridge Client**: Quote and execute cross-chain USDT0 transfers
  - `quote()` - Get bridge quote with fees and estimated time
  - `send()` - Execute bridge transaction with GUID extraction
  - Message GUID extraction from OFTSent event logs
- **LayerZeroScanClient**: Track cross-chain message delivery
  - `getMessage()` - Get message status by GUID
  - `getMessagesByWallet()` - Get messages by wallet address
  - `waitForDelivery()` - Poll until delivered with status callbacks
  - `isDelivered()` - Quick delivery check
- **CrossChainPaymentRouter**: High-level cross-chain payment routing
  - `routePayment()` - Bridge funds to destination chain
  - `estimateFees()` - Get fee estimates
  - `trackMessage()` / `waitForDelivery()` - Delivery tracking

#### Go SDK (`github.com/t402-io/t402/go/mechanisms/evm/bridge`)
- **Usdt0Bridge**: `Quote()`, `Send()`, `GetSupportedDestinations()`
- **LayerZeroScanClient**: `GetMessage()`, `GetMessagesByWallet()`, `WaitForDelivery()`
- **CrossChainPaymentRouter**: `RoutePayment()`, `EstimateFees()`, `TrackMessage()`
- **Types**: `BridgeQuoteParams`, `BridgeResult`, `LayerZeroMessage`, `SendParam`
- **Constants**: Endpoint IDs, OFT addresses, utility functions
- **Unit Tests**: Comprehensive test coverage

#### Python SDK (`t402.bridge`)
- **Usdt0Bridge**: Async client with `quote()` and `send()` methods
- **LayerZeroScanClient**: Async message tracking with httpx
- **CrossChainPaymentRouter**: Async payment routing
- **Types**: Dataclasses for all bridge types
- **Constants**: LayerZero endpoint IDs and USDT0 OFT addresses

#### Examples
- `examples/typescript/clients/bridge/` - TypeScript bridge example
- `examples/go/clients/bridge/` - Go bridge example
- `examples/python/bridge/` - Python bridge example

### Technical Details

#### Supported Chains
| Chain | LayerZero EID | USDT0 OFT Address |
|-------|---------------|-------------------|
| Ethereum | 30101 | `0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee` |
| Arbitrum | 30110 | `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9` |
| Ink | 30291 | `0x0200C29006150606B650577BBE7B6248F58470c1` |
| Berachain | 30362 | `0x779Ded0c9e1022225f8E0630b35a9b54bE713736` |
| Unichain | 30320 | `0x588ce4F028D8e7B53B687865d6A67b3A54C75518` |

#### LayerZero Scan API
- Base URL: `https://scan.layerzero-api.com/v1`
- Message statuses: `INFLIGHT`, `CONFIRMING`, `DELIVERED`, `FAILED`, `BLOCKED`

#### Bridge Flow
1. Create bridge client for source chain
2. Get quote with fees and estimated receive amount
3. Execute bridge (handles approval if needed)
4. Extract message GUID from OFTSent event
5. Track delivery via LayerZero Scan API
6. Receive funds on destination chain

---

## [2026-01-09] - ERC-4337 Account Abstraction Support

### Added

#### ERC-4337 Gasless Transactions (`erc4337/v1.0.0`)

Full ERC-4337 v0.7 Account Abstraction support across all SDKs, enabling gasless transactions with smart accounts and paymaster sponsorship.

#### TypeScript SDK (`@t402/evm`)
- **Bundler Clients**: Generic, Pimlico, and Alchemy bundler integrations
  - `createBundlerClient()` - Factory function with provider auto-detection
  - `PimlicoBundlerClient` - Extended methods: `getUserOperationGasPrice`, `sendCompressedUserOperation`
  - `AlchemyBundlerClient` - Extended methods: `requestGasAndPaymasterAndData`, `simulateUserOperationAssetChanges`
- **Paymaster Integrations**: Gas sponsorship with multiple providers
  - `PimlicoPaymaster` - Sponsorship policies and token quotes
  - `BiconomyPaymaster` - Sponsored and ERC-20 payment modes
  - `StackupPaymaster` - Off-chain sponsorship support
  - `createPaymaster()` - Unified factory function
- **Safe Smart Account**: Safe 4337 module v0.3.0 integration
  - `SafeSmartAccount` - Counterfactual address derivation
  - `encodeExecute()` / `encodeExecuteBatch()` - Transaction encoding
  - `signUserOpHash()` - EIP-712 typed data signing

#### Go SDK (`github.com/t402-io/t402/go/mechanisms/evm/erc4337`)
- **Core Types**: `UserOperation`, `PackedUserOperation`, `GasEstimate`, `UserOperationReceipt`
- **Bundler Clients**: `GenericBundlerClient`, `PimlicoBundlerClient`, `AlchemyBundlerClient`
- **Paymaster Clients**: `PimlicoPaymaster`, `BiconomyPaymaster`, `StackupPaymaster`
- **Safe Account**: `SafeSmartAccount` with full 4337 module support
- **Utilities**: Gas packing/unpacking, network detection, constants

#### Python SDK (`t402.erc4337`)
- **Types**: `UserOperation`, `PackedUserOperation`, `PaymasterData`, `GasEstimate`
- **Bundler Clients**: `GenericBundlerClient`, `PimlicoBundlerClient`, `AlchemyBundlerClient`
- **Paymaster Clients**: `PimlicoPaymaster`, `BiconomyPaymaster`, `StackupPaymaster`, `UnifiedPaymaster`
- **Safe Account**: `SafeSmartAccount` with eth-account signing
- **Factory Functions**: `create_bundler_client()`, `create_paymaster()`, `create_smart_account()`

#### Documentation & Examples
- **TypeScript Example**: `examples/typescript/clients/erc4337/`
- **Go Example**: `examples/go/clients/erc4337/`
- **Python Example**: `examples/python/erc4337-gasless/`

### Technical Details

#### Supported Chains
| Chain | Chain ID | Pimlico | Alchemy |
|-------|----------|---------|---------|
| Ethereum Mainnet | 1 | ✓ | ✓ |
| Ethereum Sepolia | 11155111 | ✓ | ✓ |
| Base | 8453 | ✓ | ✓ |
| Base Sepolia | 84532 | ✓ | ✓ |
| Optimism | 10 | ✓ | ✓ |
| Arbitrum One | 42161 | ✓ | ✓ |
| Polygon | 137 | ✓ | ✓ |

#### EntryPoint Addresses
- v0.7: `0x0000000071727De22E5E9d8BAf0edAc6f37da032`
- v0.6 (legacy): `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789`

#### Safe 4337 Module Addresses (v0.3.0)
- Module: `0xa581c4A4DB7175302464fF3C06380BC3270b4037`
- Module Setup: `0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47`
- Singleton: `0x29fcB43b46531BcA003ddC8FCB67FFE91900C762`
- Proxy Factory: `0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67`

#### Gasless Transaction Flow
1. Create Safe smart account (counterfactual address)
2. Build UserOperation with call data
3. Estimate gas via bundler
4. Request paymaster sponsorship
5. Sign UserOperation hash
6. Submit to bundler
7. Wait for on-chain confirmation

---

## [2026-01-09] - TRON Blockchain Support

### Added

#### TypeScript SDK (`@t402/tron` v1.0.0)
- **TRON Network Support**: Full support for TRON mainnet (`tron:mainnet`), Nile testnet (`tron:nile`), and Shasta testnet (`tron:shasta`)
- **USDT TRC-20 Payments**: TIP-20 compatible token transfers for USDT payments
- **Register Functions**: Convenience functions for easy scheme integration
  - `registerExactTronClientScheme` - Client-side registration with signer
  - `registerExactTronServerScheme` - Resource server registration
  - `registerExactTronFacilitatorScheme` - Facilitator registration
- **Wildcard Network Registration**: Support for `tron:*` pattern matching
- **Sub-path Exports**: Separate entry points for client, server, and facilitator modules
- **Signer Interfaces**: `ClientTronSigner` and `FacilitatorTronSigner` for wallet integration
- **Utility Functions**: Address validation (base58check), amount conversion, transaction building

#### Python SDK (`t402` v1.2.0)
- **TRON Network Support**: Full support for all three TRON networks
- **Network Constants**: `TRON_MAINNET`, `TRON_NILE`, `TRON_SHASTA` identifiers
- **USDT Addresses**: Pre-configured mainnet and testnet USDT TRC-20 addresses
- **Pydantic Models**: Type-safe `TronAuthorization` and `TronPaymentPayload` models
- **Network Detection**: `is_tron_network()` and updated `get_network_type()` functions
- **Price Processing**: Automatic TRON handling in `parse_money()` and `process_price_to_atomic_amount()`
- **Utility Functions**: Address validation, amount parsing/formatting

#### Go SDK (`github.com/t402-io/t402/go` v1.2.0)
- **TRON Mechanism**: Complete TRON payment mechanism implementation
- **Client Scheme**: `ExactTronScheme` for creating TRON payment payloads
- **Server Scheme**: Payment requirement enhancement with TRC-20 metadata
- **Facilitator Scheme**: Transaction verification, settlement, and confirmation
- **Type Definitions**: `ExactTronPayload`, `ExactTronAuthorization`, signer interfaces
- **Network Configuration**: Pre-configured mainnet and testnet settings

#### Documentation & Examples
- **README Updates**: Added TRON to "Supported Networks" section
- **Quick Start Examples**: Updated multi-network code samples for all SDKs
- **Examples Directory**: Complete working examples for all SDKs
  - TypeScript client (`examples/typescript/clients/tron/`)
  - TypeScript server (`examples/typescript/servers/tron/`)
  - Go client (`examples/go/clients/tron/`)
  - Go server (`examples/go/servers/tron/`)
  - Python Flask server (`examples/python/flask-tron/`)

### Technical Details

#### Network Identifiers (CAIP-2)
- TRON Mainnet: `tron:mainnet`
- TRON Nile Testnet: `tron:nile`
- TRON Shasta Testnet: `tron:shasta`

#### USDT TRC-20 Contract Addresses
- Mainnet: `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`
- Nile: `TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf`
- Shasta: `TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs`

#### Address Format
- Base58check encoded
- 34 characters, starts with 'T'
- Regex: `^T[1-9A-HJ-NP-Za-km-z]{33}$`

#### Payment Flow
1. Client receives 402 Payment Required with TRON payment details
2. Client builds TRC-20 transfer transaction (TriggerSmartContract)
3. Client signs the transaction with their wallet
4. Client sends signed transaction JSON in `PAYMENT-SIGNATURE` header
5. Server/Facilitator verifies the signature and transfer details
6. Facilitator broadcasts the transaction to TRON network
7. Server returns the requested resource

---

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

#### Go SDK (`github.com/t402-io/t402/go` v1.1.0)
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
- [@t402/tron](https://www.npmjs.com/package/@t402/tron)

### PyPI (Python)
- [t402](https://pypi.org/project/t402/)

### Go
- [github.com/t402-io/t402/go](https://github.com/t402-io/t402/tree/main/go)

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
import tonclient "github.com/t402-io/t402/go/mechanisms/ton/exact/client"

tonScheme := tonclient.NewExactTonScheme(signer)
client.Register(t402.Network("ton:mainnet"), tonScheme)
```

### Upgrading to TRON Support

#### TypeScript
```typescript
// Install @t402/tron package
// pnpm add @t402/tron

import { registerExactTronClientScheme } from "@t402/tron";

// Add TRON to your existing client
registerExactTronClientScheme(client, {
  signer: tronSigner,
});
```

#### Python
```python
# TRON networks are automatically supported in t402 v1.2.0+
# Just use tron:mainnet, tron:nile, or tron:shasta in your routes
from t402.tron import TRON_MAINNET

paywall = create_paywall(
    routes={
        "GET /api": {
            "price": "$0.01",
            "network": TRON_MAINNET,
            "pay_to": tron_address,
        },
    },
    facilitator_url=facilitator_url,
)
```

#### Go
```go
// Add TRON scheme to your client
import tronclient "github.com/t402-io/t402/go/mechanisms/tron/exact/client"

tronScheme := tronclient.NewExactTronScheme(signer)
client.Register(t402.Network("tron:mainnet"), tronScheme)
```
