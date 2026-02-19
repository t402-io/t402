# Changelog

All notable changes to the T402 project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.5.0] - 2026-02-18

### Added
- **@t402/btc** - Bitcoin mechanism with on-chain (PSBT) and Lightning (BOLT11) payment schemes
- **@t402/wdk-ton** - TON wallet management wrapping @ton/walletkit
- **@t402/wdk-ton-gasless** - Gasless TON transactions via relay
- **@t402/wdk-tron-gasfree** - Gas-free TRON USDT transfers
- **@t402/wdk-defi** - DeFi pre-payment processor with Swap, Borrow, and BridgeSwap strategies
- **@t402/wdk-protocol** - High-level T402Protocol for automatic balance check + bridge + pay
- **@t402/react-native** - React Native SDK with T402Provider, useT402Payment hook, and PaymentSheet
- **Permit2 EVM Scheme** - Uniswap Permit2 SignatureTransfer for gasless token approvals (`@t402/evm`)
- **Unified MCP Server** - Combined WDK wallet tools + t402 payment tools with smartPay and paymentPlan
- **TON Bridge** - TON↔EVM cross-chain bridging in `@t402/wdk-bridge`
- **Payment Identifier Extension** - Unique payment ID tracking in `@t402/extensions`
- **Sign-In With X (SIWX)** - Cross-chain authentication extension with TON/TRON support
- **WDK Pricing** - `createWdkMoneyParser()` with configurable pricing providers
- **WDK Failover** - Multi-provider RPC failover with health checks
- **WDK Secret Manager** - Encrypted seed phrase storage with `fromEncryptedSeed()`/`encryptSeed()`
- **WDK Indexer** - Facilitator transaction verification integration
- **TON Paywall Wallets** - Dynamic wallet list sync for TON Connect paywall
- **Python WDK Parity** - Gasless, bridge, multisig, and hardware modules for Python SDK
- **Java WDK Parity** - Gasless, bridge, multisig, hardware modules + Spring auto-config for Java SDK
- **Cross-SDK SIWX** - TON/TRON SIWX verification in Go, Python, and Java
- **Cross-SDK Payment ID** - Payment identifier extension in Go, Python, and Java
- **Extension Specs** - `specs/extensions/` with template, bazaar.md, payment-id.md, siwx.md
- **MCP E2E Tests** - End-to-end tests for TS, Go, and Python MCP servers
- **Python E2E Tests** - httpx, requests clients + FastAPI, Flask server integration tests
- **MCP Chatbot Examples** - TypeScript, Python, and Go MCP chatbot examples
- **TON Connect Bridge Research** - Research doc at `specs/research/ton-connect-bridge.md`
- **llms.txt** - LLM-friendly project description files at repo root and docs site
- **Ecosystem Expansion Plan** - Directory, templates, and outreach strategy
- **Telegram Mini App Demo** - Payment demo in `examples/telegram-miniapp/`
- **Mobile TON Reference** - ton-connect/kit-ios and kit-android documentation

### Fixed
- **npm audit** - Resolved 10 of 12 vulnerabilities via pnpm overrides (minimatch, validator, secp256k1, markdown-it, qs, ajv)
- **CI tonconnect-bridge-sdk** - Override to npm 0.2.4 to avoid GitHub Releases JWT expiry
- **Paywall ESLint** - Expanded gen/** ignore pattern for all chain template directories
- **Python lint** - Added 6 missing network helpers to `__all__`, fixed unused imports

### SDK Versions
- TypeScript: v2.5.0 (36 packages)
- Go: v1.10.0
- Python: v1.10.1 (unchanged)
- Java: v1.10.0

## [2.4.1] - 2026-02-09

### Fixed
- **Python Flask V2 Headers** - Flask middleware now supports V2 protocol (`PAYMENT-SIGNATURE`, `PAYMENT-REQUIRED`, `PAYMENT-RESPONSE`) with V1 fallback
- **Java EVM Network Coverage** - All 22 USDT0 + 5 legacy USDT networks (BNB, Avalanche, Fantom, Celo, Kaia)
- **Facilitator RPC Prefixes** - Added 7 missing `EVMNetworkPrefixes` entries for dynamic RPC configuration

### SDK Versions
- TypeScript: v2.4.0 (unchanged)
- Go: v1.9.0 (unchanged)
- Python: v1.10.1
- Java: v1.10.0

## [2.4.0] - 2026-02-06

### Added
- **Up-To Scheme Types** - Usage-based billing across all SDKs (TypeScript, Go, Python, Java)
- **@t402/cosmos** - Cosmos/Noble chain support with exact-direct scheme for native USDC
- **@t402/a2a** - A2A transport types and helpers for agent-to-agent payments
- **Standardized Error Codes** - T402 error code constants across all 4 SDKs
- **Test Coverage** - Paywall (+55), React (+31), Vue (+31), mechanism tests for 5 chains, SVM integration tests

### Fixed
- `@t402/mcp` version aligned to 2.3.1 (was 2.0.0-beta.1)
- Facilitator CI/CD go.sum missing entries
- Unified testnet USDT jetton address across all SDKs
- Corrected Unichain USDT0 address

### Documentation
- Cosmos README, v2.2→v2.3 migration guide, network comparison matrix
- Comprehensive .md audit across 70+ files
- Package count updated: 27→29

### SDK Versions
- TypeScript: v2.4.0 (29 packages)
- Go: v1.9.0
- Python: v1.10.0
- Java: v1.9.0

## [2.3.1] - 2026-01-25

### Added
- **WDK Deep Integration** - Enhanced Tether WDK support with factory methods, swap integration, adapter fixes
- **Safe Multi-Sig** - Multi-signature wallet support for Go and Python SDKs
- **10 Blockchain Families** - Full coverage: EVM, Solana, TON, TRON, NEAR, Aptos, Tezos, Polkadot, Stacks
- **Advanced Packages** (beta) - Agent Policy, A2A Negotiation, Intent Payments, Smart Router, Streaming Payments, ZK Payments

### Fixed
- WDK gasless OOM (infinite recursion in `isDeployed()`)
- TON adapter Cell construction (uses `@ton/core` dynamic import)
- Mock `parsePrice` returns integer cent strings
- Docs build fully clean (Nextra 3.x component fixes across 39 MDX files)

### Documentation
- Comprehensive docs site with 96+ pages covering all features
- 6 advanced package pages marked as "Coming Soon"
- Updated SECURITY.md with NEAR, Aptos, Tezos, Polkadot, Stacks security info
- Updated CONTRIBUTING.md with correct paths and all mechanism packages
- All SDK CHANGELOGs updated with missing version entries

### SDK Versions
- TypeScript: v2.3.1 (29 packages)
- Go: v1.8.1
- Python: v1.9.1
- Java: v1.8.1

## [2.1.6] - 2026-01-18

### Java SDK v1.6.0
- **Up-To Scheme Types** (`io.t402.schemes.upto`) - Metered/usage-based billing
  - `UptoPaymentRequirements` - Requirements with max amount cap
  - `UptoPaymentPayload` - Payload with permit signature
  - `UptoSettlementResult` - Settlement with actual amount used
  - `PermitData` - EIP-2612 permit signature data
- **EVM Up-To Support** (`io.t402.schemes.evm.upto`) - EIP-2612 permit integration
- 370 tests passing

## [2.1.5] - 2026-01-18

### TypeScript SDK v2.3.0
- **Up-To Scheme Types** (`@t402/core`) - Metered/usage-based billing
  - `UptoPaymentRequirements` - Requirements with max amount cap
  - `UptoPaymentPayload` - Payload with permit signature
  - `UptoSettlementResult` - Settlement with actual amount used
  - `PermitData` - EIP-2612 permit signature data
- **EVM Up-To Client** (`@t402/evm`) - EIP-2612 permit support
  - `EvmUptoClientScheme` - Client-side permit signing
  - Upto types test suite (11 tests)
- 329 tests passing across all packages

## [2.1.4] - 2026-01-18

### Go SDK v1.7.0
- **Up-To Scheme Types** (`go/schemes/upto`) - Metered/usage-based billing
  - `UptoPaymentRequirements` - Requirements with max amount cap
  - `UptoPaymentPayload` - Payload with permit signature
  - `UptoSettlementResult` - Settlement with actual amount used
  - `PermitData` - EIP-2612 permit signature data
- Full type definitions in `go/types/` for upto scheme integration

## [2.1.3] - 2026-01-18

### Python SDK v1.9.0
- **Up-To Scheme Implementation** (`t402.schemes.upto`) - Metered/usage-based billing
  - `UptoPaymentRequirements` - Requirements with max amount cap
  - `UptoPaymentPayload` - Payload with permit signature
  - `UptoSettlementResult` - Settlement with actual amount used
  - `PermitData` - EIP-2612 permit signature data
- **EVM Up-To Client** (`t402.schemes.evm.upto`) - EIP-2612 permit support
  - `EvmUptoClientScheme` - Client-side permit signing
  - `create_permit_payload()` - Generate permit signatures for allowances
- Comprehensive test suite (603 tests passing)

## [2.1.2] - 2026-01-18

### Java SDK v1.4.0
- **SVM Scheme Implementations** (`io.t402.schemes.svm.exact`) - Full signing and settlement
  - `ClientSvmSigner` - Interface for client-side transaction signing
  - `FacilitatorSvmSigner` - Interface for facilitator RPC operations and settlement
  - `ExactSvmServerScheme` - Price parsing and payment requirements creation
  - `ExactSvmClientScheme` - Payment payload creation with async support
  - `ExactSvmFacilitatorScheme` - Verification and settlement with CompletableFuture
  - `SvmTransactionException` - Transaction failure handling
- Comprehensive test suite (24 new scheme tests, 354 total)

## [2.1.1] - 2026-01-18

### Java SDK v1.3.0
- **SVM Scheme Types** (`io.t402.schemes.svm`) - Full Solana support
  - `SvmConstants` - Network IDs (CAIP-2), USDC token addresses, RPC/WebSocket URLs
  - `SvmAuthorization` - Transfer authorization metadata with builder pattern
  - `ExactSvmPayload` - Payment payload containing base64-encoded signed transaction
  - `SvmUtils` - Address validation, amount parsing/formatting, base58 codec
- Comprehensive test suite (29 new tests, 330 total)

## [2.1.0] - 2026-01-16

### Go SDK v1.5.0
- **SmartBridgeRouter** - Intelligent multi-chain bridge routing
  - Route strategies: `cheapest`, `fastest`, `preferred`
  - Concurrent balance fetching across all configured chains
  - Automatic route selection and bridge execution
- **MultiChainSigner** - Multi-chain signing interface
  - `WdkMultiChainSigner` adapter for WDK Signer integration
  - `WdkBridgeSignerAdapter` for per-chain BridgeSigner operations
- **WDK Signer Enhancements**
  - `GetClient()`, `GetPrivateKeyBytes()`, `GetChainID()` methods

### Python SDK v1.7.1
- **Schemes Module** (`t402.schemes`) - Modular payment scheme implementations
  - EVM, TON, TRON exact payment schemes (client/server)
  - `SchemeRegistry` for registering and discovering schemes
- **Enhanced FastAPI Middleware**
  - Full protocol v2 `PaymentRequirements` support
  - `ResourceInfo` integration for resource metadata
  - `PaymentDependencies` for dependency injection
- **Protocol v2 Types** - ResourceInfo, enhanced PaymentRequirements

### Java SDK v1.1.0
- **Protocol v2 Support** - ResourceInfo, PaymentPayload.Builder, SupportedResponse
- **Spring Boot Enhancements**
  - `@RequirePayment` annotation for method/class-level protection
  - `RouteConfig` for YAML-based route pricing
  - `T402Properties.parseAmount()` with $1.00, 1000000 formats
- **Spring WebFlux** - PaymentWebFilter for reactive applications
- **ERC-4337 Enhancements**
  - SafeAccount with execTransaction, executeUserOp, batchCalls
  - PimlicoBundler and AlchemyBundler integrations
  - UserOperation v0.7 with pack() and getUserOpHash()

## [2.0.0] - 2026-01-16

### Added
- Multi-chain support: EVM, TON, TRON, Solana
- ERC-4337 account abstraction for gasless payments
- USDT0 cross-chain bridging via LayerZero
- Tether WDK (Wallet Development Kit) integration
- MCP server for AI agent payments (@t402/mcp)
- Comprehensive CLI tools for all SDKs

### TypeScript SDK v2.0.0
- 21 packages published under `@t402/*` namespace
- Framework integrations: Express, Next.js, Hono, Fastify
- Client libraries: Fetch, Axios
- UI components: React, Vue, universal Paywall
- WDK packages: gasless, bridge, multisig

### Python SDK v1.6.0
- Full multi-chain support (EVM, TON, TRON, SVM)
- FastAPI and Flask middleware
- httpx and requests client adapters
- ERC-4337 smart account support
- USDT0 bridge integration
- WDK signer implementation
- MCP server for AI agents

### Go SDK v1.4.0
- Core client, server, and facilitator implementations
- EVM, TON, TRON, Solana mechanisms
- Gin middleware for HTTP servers
- CLI tool with verify, settle, encode, decode commands
- WDK package with multi-chain support
- MCP server for AI agents

### Changed
- Protocol version updated to v2
- Unified API design across all SDKs
- Improved error handling and validation

### Fixed
- Go module dependency tidying
- Python linting errors resolved

## [1.0.0] - 2025-01-01

### Added
- Initial release of T402 payment protocol
- EVM support with EIP-3009 authorization
- Basic client and server implementations

[Unreleased]: https://github.com/t402-io/t402/compare/v2.5.0...HEAD
[2.5.0]: https://github.com/t402-io/t402/compare/v2.4.1...v2.5.0
[2.4.1]: https://github.com/t402-io/t402/compare/v2.4.0...v2.4.1
[2.4.0]: https://github.com/t402-io/t402/compare/v2.3.1...v2.4.0
[2.3.1]: https://github.com/t402-io/t402/compare/v2.1.0...v2.3.1
[2.1.0]: https://github.com/t402-io/t402/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/t402-io/t402/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/t402-io/t402/releases/tag/v1.0.0
