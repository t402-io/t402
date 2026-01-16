# Changelog - Java SDK

All notable changes to the T402 Java SDK will be documented in this file.

## [Unreleased]

## [2.0.0] - 2026-01-16

### Added

#### Multi-Chain Signers
- `SvmSigner` - Solana (SVM) Ed25519 signing with Base58 encoding
- `TonSigner` - TON Ed25519 signing with Base64 encoding
- `TronSigner` - TRON ECDSA secp256k1 signing with Base58Check

#### ERC-4337 Account Abstraction
- `UserOperation` - ERC-4337 v0.7 UserOperation structure
- `BundlerClient` - Bundler JSON-RPC client for UserOperation submission
- `PaymasterClient` - Paymaster integration for gas sponsorship
- `GasEstimate` - Gas estimation types
- `PaymasterData` - Paymaster data encoding/decoding

#### USDT0 Cross-Chain Bridge
- `Usdt0Bridge` - LayerZero OFT bridge client
- `LayerZeroScanClient` - Message tracking via LayerZero Scan API
- `BridgeConstants` - Chain endpoints, USDT0 addresses, utilities
- `BridgeTypes` - Quote, execute, result types
- `BridgeSigner` - Interface for bridge transactions

#### WDK Integration
- `WDKSigner` - BIP-39 seed phrase derivation compatible with Tether WDK
- `WDKChains` - Chain configuration, token addresses
- `WDKTypes` - Configuration, balance, payment types

#### CLI Tool
- `T402Cli` - Command-line interface
- Commands: verify, settle, supported, encode, decode, info, version
- JSON and text output formats
- Configurable facilitator URL

## [1.0.0] - 2026-01-16

### Added

#### Core Features
- `T402HttpClient` - HTTP client with automatic payment header handling
- `FacilitatorClient` / `HttpFacilitatorClient` - Facilitator integration for verification and settlement
- `PaymentFilter` - Jakarta Servlet filter for payment-protected endpoints
- `PaymentPayload` / `PaymentRequirements` - Core payment types

#### EVM Support
- `EvmSigner` - EIP-3009 TransferWithAuthorization signing with Web3j
- EIP-712 typed data signing for USDC, USDT and other compatible tokens
- Support for all EVM chains (Ethereum, Base, Arbitrum, Optimism, Polygon)

#### Spring Boot Integration
- `T402AutoConfiguration` - Auto-configuration for Spring Boot 3.x
- `T402Properties` - Configuration properties (`t402.*`)
- Automatic `PaymentFilter` registration for `/api/*` endpoints

#### Models
- `Authorization` - EIP-3009 authorization structure
- `ExactSchemePayload` - Exact payment scheme payload
- `VerificationResponse` / `SettlementResponse` - Facilitator responses

### Infrastructure
- Maven Central publishing via Sonatype Central Portal
- JaCoCo code coverage (85% instruction, 75% branch targets)
- Checkstyle and SpotBugs static analysis
- GitHub Actions CI/CD workflows

[Unreleased]: https://github.com/t402-io/t402/compare/java/v1.0.0...HEAD
[1.0.0]: https://github.com/t402-io/t402/releases/tag/java/v1.0.0
