# Changelog

All notable changes to the T402 project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

### Python SDK v1.5.3
- Full multi-chain support (EVM, TON, TRON)
- FastAPI and Flask middleware
- httpx and requests client adapters
- ERC-4337 smart account support
- USDT0 bridge integration
- WDK signer implementation

### Go SDK v1.3.1
- Core client, server, and facilitator implementations
- EVM, TON, TRON, Solana mechanisms
- Gin middleware for HTTP servers
- CLI tool with verify, settle, encode, decode commands
- Comprehensive test coverage

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

[Unreleased]: https://github.com/t402-io/t402/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/t402-io/t402/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/t402-io/t402/releases/tag/v1.0.0
