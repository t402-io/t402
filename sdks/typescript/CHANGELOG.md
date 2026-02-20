# Changelog - TypeScript SDK

All notable changes to the T402 TypeScript SDK will be documented in this file.

## [Unreleased]

### Added
- **T402PaymentError** - Structured error class with cause, phase, and retryable fields in `@t402/core`
- **WDK Test Harness** - Mock factories at `@t402/wdk/testing` for unit testing
- **Unified Chain Registry** - All chain families in single registry
- **Pluggable Logger** - Configurable logger interface for WDK
- **Multi-Chain Address Validation** - EVM, TON, TRON, Solana, Bitcoin, Cosmos
- **Solana Versioned Transactions** - Priority fees and Token-2022 in `@t402/svm`
- **TRON Energy Estimation** - Dynamic fee limits for TRON transactions
- **TON Jetton Transfer Verification** - Enhanced verification in `@t402/ton`
- **dispose() Pattern** - `Symbol.dispose` for WDK resource cleanup
- **Multi-Provider RPC Failover** - Health checks across providers
- **Network Resilience** - Retry logic for transient failures
- **Multi-Instance WDK** - Concurrent WDK instance support
- **Seed Phrase Key Rotation** - Secure key rotation
- **Payment Idempotency Manager** - Payment deduplication
- **Encrypted Backup/Recovery** - Encrypted seed phrase backup
- **Compliance Manager** - Provider pattern for compliance checks
- **Webhook Manager** - HMAC-SHA256 signed webhook delivery
- **WDK Permit2 / Upto Examples** - New example projects

## [2.5.0] - 2026-02-18

### Added
- **`@t402/wdk-protocol`** - New package: T402 payment protocol for WDK wallet apps
  - `T402Protocol.create(wdk, config)` - Async factory from WDK instance
  - `T402Protocol.fetch(url)` - Auto-detect and pay HTTP 402 responses
  - `T402Protocol.signPayment(requirements)` - Sign payment using WDK signer
  - `T402Protocol.submitPayment(url, payload)` - Submit signed payment
  - `extractPaymentRequired(response)` - Parse 402 headers (V2 + V1 fallback)
  - Chain detection utilities: `detectChainFamily()`, `isEvmNetwork()`, `EVM_CHAIN_MAP`
  - 27 tests
- **`@t402/mcp` WDK tools** - 5 new MCP tools for AI agents with WDK wallets
  - `wdk/getWallet` - Get wallet address and configured chains
  - `wdk/getBalances` - Multi-chain token balances (USDT0, USDC, native)
  - `wdk/transfer` - Send stablecoins via WDK signer
  - `wdk/swap` - Swap tokens via WDK Velora protocol
  - `t402/autoPay` - Smart payment orchestrator: fetch URL, auto-pay 402, return content
  - Tools conditionally registered when `T402_WDK_SEED_PHRASE` set or `T402_DEMO_MODE=true`
  - All tools support demo mode for testing without real transactions
  - 32 new tests (MCP total: 100)
- Added `@t402/wdk-protocol` to npm release CI matrix (30 packages total)

## [2.3.1] - 2026-01-25

### Added
- **NEAR, Aptos, Tezos, Polkadot, Stacks Mechanisms** - Full multi-chain coverage
  - `@t402/near` - NEAR Protocol NEP-141 token support
  - `@t402/aptos` - Aptos Fungible Asset support
  - `@t402/tezos` - Tezos FA2 (TZIP-12) support
  - `@t402/polkadot` - Polkadot Asset Hub support
  - `@t402/stacks` - Stacks (Bitcoin L2) support
- **WDK Deep Integration** - Enhanced Tether WDK support
  - `T402WDK.create()` static factory method
  - `T402WDK.fromWDK()` quick setup from existing WDK instance
  - `getAllSigners()` for multi-chain signer discovery
  - Swap integration via Velora protocol (`canSwap()`, `getSwapQuote()`, `swapAndPay()`)
  - Updated version compatibility for WDK beta.5 and wallet-evm 2.0.0-rc.1
- **TON Adapter Fix** - Uses `@ton/core` dynamic import for proper Cell construction
- **SVM/TRON Adapter Hardening** - Input validation for edge cases
- 69 new tests across WDK packages

### Fixed
- Fixed `as const` arrays needing `as readonly string[]` cast for `.includes()` checks

## [2.3.0] - 2026-01-18

### Added
- **EVM-Core Package** - `@t402/evm-core` for shared EVM utilities
- **Extensions Enhancement** - Stellar SEP-10 and Solana Ed25519 signing for SIWx
- **Shared TypeScript Config** - `tsconfig.base.json` extended across all packages

## [2.2.0] - 2026-01-17

### Added
- **EVM Exact-Legacy Scheme** - Support for legacy USDT (non-EIP-3009 tokens)
- **SVM Exact Scheme** - Solana exact payment scheme improvements

## [2.1.0] - 2026-01-16

### Changed
- SDKs reorganized into `sdks/` directory structure
- Security fixes from CodeQL analysis

## [2.0.0] - 2026-01-16

### Added

#### Core Packages
- `@t402/core` v2.0.0 - Protocol types and HTTP utilities
- `@t402/extensions` v2.0.0 - Bazaar API discovery, Sign-In-With-X

#### Blockchain Mechanisms
- `@t402/evm` v2.2.0 - EVM chains with EIP-3009 authorization
- `@t402/svm` v2.0.0 - Solana with SPL token support
- `@t402/ton` v2.1.0 - TON with USDT Jetton support
- `@t402/tron` v2.0.0 - TRON with TRC-20 USDT support

#### HTTP Server Frameworks
- `@t402/express` v2.0.0 - Express.js middleware
- `@t402/next` v2.0.0 - Next.js App Router integration
- `@t402/hono` v2.0.0 - Hono middleware
- `@t402/fastify` v2.0.0 - Fastify plugin

#### HTTP Client Libraries
- `@t402/fetch` v2.0.0 - Fetch API wrapper with auto-retry
- `@t402/axios` v2.0.0 - Axios interceptor

#### UI Components
- `@t402/paywall` v2.0.0 - Universal paywall component
- `@t402/react` v2.0.0 - React hooks and components
- `@t402/vue` v2.0.0 - Vue 3 composables and components

#### WDK Integration (Tether Wallet Development Kit)
- `@t402/wdk` v2.0.1 - Core WDK integration
- `@t402/wdk-gasless` v1.0.0 - ERC-4337 gasless payments
- `@t402/wdk-bridge` v1.0.0 - LayerZero USDT0 bridging
- `@t402/wdk-multisig` v1.0.0 - Safe multi-signature wallets

#### Tools
- `@t402/mcp` v1.0.0 - MCP server for AI agent payments
- `@t402/cli` v2.0.0 - Command-line development tools

### Changed
- All packages now use ESM by default with CJS fallback
- Unified error handling across all packages
- Improved TypeScript strict mode compliance
- Protocol version bumped to v2

### Package Groups
- **Fixed versioning**: core, evm, svm, ton, tron (version together)
- **Linked versioning**: wdk, wdk-gasless, wdk-bridge, wdk-multisig

## [1.0.0] - 2025-01-01

### Added
- Initial release under `x402` namespace
- Basic EVM support
- Express middleware

[Unreleased]: https://github.com/t402-io/t402/compare/v2.5.0...HEAD
[2.5.0]: https://github.com/t402-io/t402/compare/v2.3.1...v2.5.0
[2.3.1]: https://github.com/t402-io/t402/compare/v2.3.0...v2.3.1
[2.3.0]: https://github.com/t402-io/t402/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/t402-io/t402/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/t402-io/t402/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/t402-io/t402/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/t402-io/t402/releases/tag/v1.0.0
