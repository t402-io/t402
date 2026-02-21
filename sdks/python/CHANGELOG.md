# Changelog - Python SDK

All notable changes to the T402 Python SDK will be documented in this file.

## [Unreleased]

### Added
- **`list_supported()`** - New method on `FacilitatorClient` to query supported networks
- **Idempotency-Key support** - Added optional `idempotency_key` parameter to `settle()`

### Fixed
- **Discovery API path** - Fixed discovery endpoint paths from `/discovery/` to `/v1/discovery/`

## [1.11.0] - 2026-02-20

### Added
- **Chain Registry** - Non-EVM chain entries (TON, TRON, Solana) in `chains.py`
- **Flask `__init__.py`** - Proper `__all__` exports and module docstring

### Improved
- Add comprehensive docstrings with Args/Returns to `FacilitatorClient` methods
- Add type annotations (return types) across all middleware modules (FastAPI, Flask, Django, Starlette)
- Improve client base class and httpx/requests client docstrings

## [1.10.1] - 2026-02-09

### Fixed
- **Flask V2 Protocol Headers** - Flask middleware now supports V2 protocol (`PAYMENT-SIGNATURE`, `PAYMENT-REQUIRED`, `PAYMENT-RESPONSE`) with V1 fallback, matching FastAPI/Django/Starlette behavior

## [1.10.0] - 2026-02-06

### Added
- **Up-To Scheme Types** (`t402.schemes.upto`, `t402.schemes.evm.upto`) - Usage-based billing scheme
  - Core types (`t402.schemes.upto`):
    - `UptoPaymentRequirements` - Payment requirements with `maxAmount` for usage-based billing
    - `UptoExtra` - Extra fields for billing units and EIP-712 domain parameters
    - `UptoSettlement` - Settlement data with usage details
    - `UptoUsageDetails` - Usage tracking metrics
    - `UptoSettlementResponse` - Settlement transaction response
    - `UptoValidationResult` - Payment validation result
    - `is_upto_payment_requirements()` - Type guard for upto requirements
    - `is_valid_unit()` - Validate billing unit types
    - `create_payment_requirements()` - Factory function
    - `create_settlement()` - Factory function
  - EVM types (`t402.schemes.evm.upto`):
    - `PermitSignature` - EIP-2612 signature (v, r, s)
    - `PermitAuthorization` - Permit authorization parameters
    - `UptoEIP2612Payload` - Complete EIP-2612 permit payload
    - `UptoCompactPayload` - Compact signature format
    - `UptoEvmExtra` - EVM-specific extra fields
    - `UptoEvmClientScheme` - Client implementation
    - `is_eip2612_payload()` - Type guard for EIP-2612 payloads
    - `create_permit_domain()` - Create EIP-712 domain
    - `create_permit_message()` - Create EIP-712 message
    - EIP-712 type definitions: `PERMIT_TYPES`, `PERMIT_DOMAIN_TYPES`
- **Up-To Scheme for SVM, TON, TRON, NEAR** - Usage-based billing for non-EVM chains
- **Cosmos/Noble Chain Support** (`t402.schemes.cosmos`) - Native USDC via exact-direct scheme
- **Django Middleware** (`t402.http.django`) - Payment middleware for Django applications
- **Starlette Middleware** (`t402.http.starlette`) - Payment middleware for Starlette/ASGI
- **MCP Real Implementations** - 6 real tools (getBalance, getAllBalances, pay, payGasless, getBridgeFee, bridge)
- **A2A Transport** - Agent-to-Agent message types and helpers
- **Bazaar Discovery Client** - API discovery client for resource marketplace
- **Standardized Error Codes** - T402 error code constants

### Fixed
- P0/P1 security fixes across facilitator and SDKs
- Unified testnet USDT jetton address across all SDKs
- Corrected Unichain USDT0 address
- SettleResponse: Optional defaults `""` not `None`

## [1.9.1] - 2026-01-25

### Added
- **Safe Multi-Sig SDK** - Multi-signature wallet support for Python

### Fixed
- Ruff linting errors resolved for release

## [1.9.0] - 2026-01-18

### Added
- **NEAR, Aptos, Tezos, Polkadot Mechanisms** - Full multi-chain coverage
  - TON and TRON facilitator implementations
  - NEAR, Aptos, Tezos, Polkadot exact-direct schemes
- **SVM Scheme** - Solana exact payment scheme and comprehensive server tests
- **EVM Exact-Legacy Facilitator** - Support for legacy USDT tokens
- **Stacks Mechanism** - Stacks (Bitcoin L2) support

### Fixed
- Synced `__version__` with `pyproject.toml`

## [1.8.0] - 2026-01-17

### Added
- **EVM Up-To Scheme** - Usage-based billing for EVM chains
- **Missing Mechanism Implementations** - Expanded chain coverage across Go, Java, and Python

### Changed
- SDKs reorganized into `sdks/` directory structure

### Fixed
- CodeQL security alerts resolved

## [1.7.1] - 2026-01-16

### Fixed
- Fixed ruff linting errors (unused imports and variables)

## [1.7.0] - 2026-01-16

### Added
- **Schemes Module** (`t402.schemes`) - Modular payment scheme implementations
  - `t402.schemes.evm.exact` - EVM exact payment scheme (client/server)
  - `t402.schemes.ton.exact` - TON exact payment scheme (client/server)
  - `t402.schemes.tron.exact` - TRON exact payment scheme (client/server)
  - `SchemeRegistry` for registering and discovering schemes
  - `ClientScheme` and `ServerScheme` interfaces

- **Enhanced FastAPI Middleware**
  - Full protocol v2 `PaymentRequirements` support
  - `ResourceInfo` integration for resource metadata
  - Enhanced route configuration with dynamic pricing
  - `PaymentDependencies` for dependency injection
  - Improved async support for payment verification/settlement

- **Protocol v2 Types**
  - `ResourceInfo` class for v2 resources (url, description, mimeType)
  - Enhanced `PaymentRequirements` with v2 fields
  - Backward compatibility with v1 format

### Changed
- Improved type annotations throughout
- Enhanced encoding/decoding for v2 payloads

## [1.6.0] - 2026-01-16

### Added
- **MCP Server** (`t402.mcp`) - Model Context Protocol server for AI agents
  - `T402McpServer` class for handling MCP requests
  - `t402/getBalance` - Get token balances for a wallet on specific network
  - `t402/getAllBalances` - Get balances across all supported networks
  - `t402/pay` - Execute stablecoin payments (USDC, USDT, USDT0)
  - `t402/payGasless` - ERC-4337 gasless payments (no gas fees)
  - `t402/getBridgeFee` - Get LayerZero bridge fee quotes
  - `t402/bridge` - Bridge USDT0 between chains via LayerZero
  - Demo mode for testing without real transactions
  - Support for 9 EVM networks
  - `load_config_from_env()` for environment variable configuration
  - `run_server()` CLI entry point

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

[Unreleased]: https://github.com/t402-io/t402/compare/python/v1.10.1...HEAD
[1.10.1]: https://github.com/t402-io/t402/compare/python/v1.10.0...python/v1.10.1
[1.10.0]: https://github.com/t402-io/t402/compare/python/v1.9.1...python/v1.10.0
[1.9.1]: https://github.com/t402-io/t402/compare/python/v1.9.0...python/v1.9.1
[1.9.0]: https://github.com/t402-io/t402/compare/python/v1.8.0...python/v1.9.0
[1.8.0]: https://github.com/t402-io/t402/compare/python/v1.7.1...python/v1.8.0
[1.7.1]: https://github.com/t402-io/t402/compare/python/v1.7.0...python/v1.7.1
[1.7.0]: https://github.com/t402-io/t402/compare/python/v1.6.0...python/v1.7.0
[1.6.0]: https://github.com/t402-io/t402/compare/python/v1.5.3...python/v1.6.0
[1.5.3]: https://github.com/t402-io/t402/compare/python/v1.5.0...python/v1.5.3
[1.5.0]: https://github.com/t402-io/t402/compare/python/v1.4.0...python/v1.5.0
[1.4.0]: https://github.com/t402-io/t402/compare/python/v1.0.0...python/v1.4.0
[1.0.0]: https://github.com/t402-io/t402/releases/tag/python/v1.0.0
