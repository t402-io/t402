# Changelog

All notable changes to T402 will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-01-16

### Highlights

T402 v2.0.0 is a major release that introduces a redesigned protocol, multi-chain support, and a complete SDK ecosystem for building payment-enabled applications with USDT/USDT0.

### Added

#### Multi-Chain Support
- **EVM Chains**: Full support for Ethereum, Arbitrum, Base, Optimism, Ink, Berachain, and Unichain via EIP-3009 `transferWithAuthorization`
- **Solana (SVM)**: Native SPL token transfers with transaction simulation
- **TON**: USDT Jetton support with BOC-based transactions
- **TRON**: TRC-20 USDT with energy-efficient transfers

#### New Packages
- `@t402/core` - Protocol types, HTTP utilities, and shared functionality
- `@t402/evm` - EVM chain mechanisms with EIP-3009, ERC-4337, and USDT0 support
- `@t402/svm` - Solana mechanisms with SPL token transfers
- `@t402/ton` - TON mechanisms with Jetton support
- `@t402/tron` - TRON mechanisms with TRC-20 support
- `@t402/wdk` - Tether Wallet Development Kit integration
- `@t402/wdk-gasless` - ERC-4337 gasless payments with paymaster support
- `@t402/wdk-bridge` - LayerZero USDT0 cross-chain bridging
- `@t402/wdk-multisig` - Safe multi-signature wallet support
- `@t402/mcp` - Model Context Protocol server for AI agent payments
- `@t402/cli` - Command-line tools for testing and development
- `@t402/extensions` - Protocol extensions and utilities

#### HTTP Framework Integrations
- `@t402/express` - Express.js middleware with streaming support
- `@t402/next` - Next.js App Router and Pages Router integration
- `@t402/hono` - Hono middleware with reverse proxy support
- `@t402/fastify` - Fastify plugin with schema validation

#### HTTP Client Libraries
- `@t402/fetch` - Fetch API wrapper with automatic 402 handling
- `@t402/axios` - Axios interceptor for seamless payments

#### UI Components
- `@t402/paywall` - Universal paywall component (framework-agnostic)
- `@t402/react` - React hooks and components
- `@t402/vue` - Vue 3 composables and components

#### Infrastructure
- Production facilitator service at `facilitator.t402.io`
- Prometheus metrics instrumentation
- Grafana dashboards for payment monitoring
- Redis-based rate limiting
- Docker deployment with auto-updates via Watchtower
- GitHub Container Registry publishing
- Trivy security scanning and SBOM generation

### Changed

#### Protocol v2 Specification
- New `PaymentPayload` structure with `accepted` requirements field
- New `PaymentRequirements` with CAIP-2 network identifiers (e.g., `eip155:1`, `solana:devnet`)
- Replaced `maxAmountRequired` with `amount` for clearer semantics
- Added `resource` field for protected content metadata
- Standardized error response format across all mechanisms

#### Package Namespace
- Migrated from `@x402/*` to `@t402/*` namespace
- All packages now published under `@t402` organization on npm
- Consolidated 23 legacy repositories into unified monorepo

#### Breaking Changes
- `PaymentRequirementsV1` deprecated in favor of `PaymentRequirements`
- `PaymentPayloadV1` deprecated in favor of `PaymentPayload`
- Network identifiers changed from simple names (e.g., `base-sepolia`) to CAIP-2 format (e.g., `eip155:84532`)
- Removed `scheme` and `network` from payload root; now in `accepted` object

### Fixed

- Validate payload structure before accessing properties in all scheme handlers
- Handle undefined payload gracefully with proper error messages
- Fix streaming responses in Express middleware
- Fix settlement failure handling in Next.js integration
- Move undeployed smart wallet check to settle instead of verify
- Fix error serialization in payment middleware responses
- Fix resourceUrl when Hono server is behind reverse proxy

### Security

- Added payload structure validation to prevent crashes from malformed requests
- Input validation for all external data before processing
- Signature verification before any on-chain operations
- Balance checks before settlement to prevent failed transactions

### Documentation

- Comprehensive API documentation at docs.t402.io
- Quickstart guides for each framework
- Migration guide from v1.x to v2.x
- Interactive playground at t402.io/playground

---

## Package Versions

| Package | Version |
|---------|---------|
| @t402/core | 2.0.0 |
| @t402/evm | 2.2.0 |
| @t402/svm | 2.0.0 |
| @t402/ton | 2.1.0 |
| @t402/tron | 2.0.0 |
| @t402/wdk | 2.0.1 |
| @t402/wdk-bridge | 1.0.0 |
| @t402/wdk-gasless | 1.0.0 |
| @t402/wdk-multisig | 1.0.0 |
| @t402/mcp | 1.0.0 |
| @t402/cli | 2.0.0 |
| @t402/extensions | 2.0.0 |
| @t402/next | 2.0.0 |
| @t402/express | 2.0.0 |
| @t402/fastify | 2.0.0 |
| @t402/hono | 2.0.0 |
| @t402/fetch | 2.0.0 |
| @t402/axios | 2.0.0 |
| @t402/react | 2.0.0 |
| @t402/vue | 2.0.0 |
| @t402/paywall | 2.0.0 |

---

## Migration from v1.x

### Package Names

```diff
- import { ... } from "@x402/*"
+ import { ... } from "@t402/*"
```

### Network Identifiers

```diff
const requirements = {
  scheme: "exact",
-  network: "base-sepolia",
+  network: "eip155:84532",
  ...
}
```

### Payload Structure

```diff
// v1.x
const payload = {
  t402Version: 1,
  scheme: "exact",
  network: "base-sepolia",
  payload: { ... }
}

// v2.x
const payload = {
  t402Version: 2,
  accepted: {
    scheme: "exact",
    network: "eip155:84532",
    ...
  },
  payload: { ... },
  resource: { url: "...", description: "...", mimeType: "..." }
}
```

### Amount Field

```diff
const requirements = {
-  maxAmountRequired: "1000000",
+  amount: "1000000",
  ...
}
```

---

## Links

- **Website**: https://t402.io
- **Documentation**: https://docs.t402.io
- **GitHub**: https://github.com/t402-io/t402
- **npm**: https://www.npmjs.com/org/t402
