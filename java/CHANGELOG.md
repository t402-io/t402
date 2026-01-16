# Changelog - Java SDK

All notable changes to the T402 Java SDK will be documented in this file.

## [Unreleased]

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
