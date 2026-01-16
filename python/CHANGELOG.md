# Changelog - Python SDK

All notable changes to the T402 Python SDK will be documented in this file.

## [Unreleased]

### Added
- **SVM (Solana) Support**: Complete Solana blockchain integration
  - `validate_svm_address()` for Solana address validation
  - `prepare_svm_payment_header()` for payment header preparation
  - `get_svm_network_config()` for network configuration
  - `get_svm_usdc_address()` to get USDC mint address
  - `normalize_svm_network()` for V1 to V2 network identifier conversion
  - `validate_svm_transaction()` for transaction validation
  - Support for Mainnet, Devnet, and Testnet (CAIP-2 format)
  - USDC token mint addresses for all networks
  - Optional `solana` and `solders` dependencies via `pip install t402[svm]`

## [1.5.3] - 2026-01-16

### Fixed
- Resolved all ruff linting errors
- Removed unused imports and variables
- Fixed f-string without placeholders warnings

### Changed
- CI workflow now uses twine directly for PyPI publishing

## [1.5.0] - 2026-01-16

### Added
- **TON Support**: Full TON blockchain integration
  - `validate_ton_address()` for address validation
  - `prepare_ton_payment_header()` for payment signing
  - `get_ton_network_config()` for network configuration
  - Support for TON Mainnet and Testnet

- **TRON Support**: Full TRON blockchain integration
  - `validate_tron_address()` for address validation
  - `prepare_tron_payment_header()` for payment signing
  - `get_tron_network_config()` for network configuration
  - Support for Mainnet, Nile, and Shasta testnets

- **ERC-4337 Account Abstraction**
  - `create_bundler_client()` - Pimlico, Alchemy, generic bundlers
  - `create_paymaster()` - Pimlico, Biconomy, Stackup paymasters
  - `create_smart_account()` - Safe smart account support
  - `SafeSmartAccount` for gasless payments

- **USDT0 Cross-Chain Bridge**
  - `create_usdt0_bridge()` for LayerZero bridging
  - `create_cross_chain_payment_router()` for routing
  - `LayerZeroScanClient` for transaction tracking
  - `get_bridgeable_chains()` to list supported chains

- **WDK Integration** (Tether Wallet Development Kit)
  - `WDKSigner` for wallet management
  - `generate_seed_phrase()` and `validate_seed_phrase()`
  - Multi-chain balance aggregation
  - Payment signing with typed data support

### Changed
- Updated README with comprehensive documentation
- Improved type hints throughout codebase

## [1.4.0] - 2026-01-01

### Added
- FastAPI middleware for payment protection
- Flask middleware for payment protection
- httpx async client adapter
- requests sync client adapter
- Facilitator client implementation

## [1.0.0] - 2025-01-01

### Added
- Initial release
- EVM support with EIP-3009
- Core types and utilities

[Unreleased]: https://github.com/t402-io/t402/compare/python/v1.5.3...HEAD
[1.5.3]: https://github.com/t402-io/t402/compare/python/v1.5.0...python/v1.5.3
[1.5.0]: https://github.com/t402-io/t402/compare/python/v1.4.0...python/v1.5.0
[1.4.0]: https://github.com/t402-io/t402/compare/python/v1.0.0...python/v1.4.0
[1.0.0]: https://github.com/t402-io/t402/releases/tag/python/v1.0.0
