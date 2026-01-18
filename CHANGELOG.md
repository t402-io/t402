# Changelog

All notable changes to the T402 project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- TypeScript/Python: `PaymentPayload.resource` now optional per v2 spec (section 5.2.2)
- TypeScript: `ResourceInfo.description` and `mimeType` now optional per v2 spec

### Documentation
- Added TON wallet address to CLAUDE.md
- Updated Java SDK section in RELEASING.md to reflect v1.1.0 release status
- Fixed dead links in docs site (ai-payments.mdx, chains/index.mdx)
- Added TRON and TON exact scheme specifications
- Added CONTRIBUTING.md for Java SDK
- Added CONTRIBUTING.md for Facilitator service
- Added last updated timestamps to ROADMAP.md, SECURITY.md, BUG_BOUNTY.md

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

[Unreleased]: https://github.com/t402-io/t402/compare/v2.1.0...HEAD
[2.1.0]: https://github.com/t402-io/t402/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/t402-io/t402/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/t402-io/t402/releases/tag/v1.0.0
