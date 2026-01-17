# Changelog - TypeScript SDK

All notable changes to the T402 TypeScript SDK will be documented in this file.

## [Unreleased]

### Added
- **Up-To Scheme Types** (`@t402/core`, `@t402/evm`) - Usage-based billing scheme
  - `UptoPaymentRequirements` - Payment requirements with `maxAmount` for usage-based billing
  - `UptoExtra` - Extra fields for billing units and EIP-712 domain parameters
  - `UptoSettlement` - Settlement data with usage details
  - `UptoUsageDetails` - Usage tracking metrics (unitsConsumed, unitPrice, unitType)
  - `UptoSettlementResponse` - Settlement transaction response
  - `UptoValidationResult` - Payment validation result
  - `isUptoPaymentRequirements()` - Type guard for upto requirements
  - `isValidUnit()` - Validate billing unit types
  - EVM types: `PermitSignature`, `PermitAuthorization`, `UptoEIP2612Payload`
  - EIP-712 type definitions: `PERMIT_TYPES`, `PERMIT_DOMAIN_TYPES`
  - Helper functions: `createPermitDomain()`, `createPermitMessage()`

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

[Unreleased]: https://github.com/t402-io/t402/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/t402-io/t402/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/t402-io/t402/releases/tag/v1.0.0
