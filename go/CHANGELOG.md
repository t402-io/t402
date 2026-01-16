# Changelog - Go SDK

All notable changes to the T402 Go SDK will be documented in this file.

## [Unreleased]

## [1.5.0] - 2026-01-16

### Added
- **SmartBridgeRouter** (`mechanisms/evm/bridge/`) - Intelligent multi-chain bridge routing
  - `SmartBridgeRouter` interface for automatic route selection across chains
  - Route strategies: `cheapest`, `fastest`, `preferred`
  - `GetBalances()` - Concurrent balance fetching across all configured chains
  - `GetRoutes()` - Evaluate all possible routes to a destination chain
  - `SelectBestRoute()` - Strategy-based route selection
  - `AutoBridge()` - Automatic route selection and bridge execution
  - Chain-specific estimated bridge times (L1↔L2 aware)

- **MultiChainSigner** (`mechanisms/evm/bridge/`) - Multi-chain signing interface
  - `MultiChainSigner` interface for cross-chain wallet operations
  - `WdkMultiChainSigner` adapter for WDK Signer integration
  - `WdkBridgeSignerAdapter` for per-chain BridgeSigner operations
  - `SimpleBridgeSigner` for testing

- **WDK Signer Enhancements** (`wdk/`)
  - `GetClient()` - Get ethclient for a chain (now public)
  - `GetPrivateKeyBytes()` - Get private key bytes for signing
  - `GetChainID()` - Get chain ID for a chain name

## [1.4.0] - 2026-01-16

### Added
- **MCP Server** (`mcp/`, `cmd/t402-mcp/`) - Model Context Protocol server for AI agents
  - `t402/getBalance` - Get token balances for a wallet on specific network
  - `t402/getAllBalances` - Get balances across all supported networks
  - `t402/pay` - Execute stablecoin payments (USDC, USDT, USDT0)
  - `t402/payGasless` - ERC-4337 gasless payments (no gas fees)
  - `t402/getBridgeFee` - Get LayerZero bridge fee quotes
  - `t402/bridge` - Bridge USDT0 between chains via LayerZero
  - Demo mode for testing without real transactions
  - Support for 9 EVM networks
  - Environment variable configuration

- **WDK Package** (`wdk/`) - Wallet Development Kit integration
  - `Signer` for BIP-39 seed phrase wallet derivation
  - Multi-chain EVM support with HD wallet derivation
  - EIP-712 typed data signing for T402 payments
  - Personal message signing
  - Token balance fetching (native, ERC20, USDT0, USDC)
  - Chain configuration utilities
  - `GenerateSeedPhrase()` and `ValidateSeedPhrase()` helpers
  - `FormatTokenAmount()` for human-readable amounts

## [1.3.1] - 2026-01-16

### Fixed
- Tidied go.mod dependencies
- Moved `golang.org/x/crypto` from indirect to direct dependency

## [1.3.0] - 2026-01-16

### Added
- **CLI Tool** (`cmd/t402/`)
  - `t402 verify <payload>` - Verify payment payloads
  - `t402 settle <payload>` - Settle payments
  - `t402 supported` - List supported networks and schemes
  - `t402 encode <json-file>` - Encode JSON to base64
  - `t402 decode <base64>` - Decode base64 to JSON
  - `t402 info <network>` - Show network information
  - `t402 version` - Show version info
  - Global flags: `--facilitator`, `--output` (json/text)

- **TRON Support** (`mechanisms/tron/`)
  - Full TRON blockchain integration
  - Client, server, and facilitator schemes
  - Support for Mainnet, Nile, and Shasta testnets
  - TRC-20 USDT support
  - Address validation utilities

### Changed
- CLI now supports all four blockchain families (EVM, TON, TRON, SVM)
- Improved network detection in `info` command

## [1.2.0] - 2026-01-01

### Added
- **TON Support** (`mechanisms/ton/`)
  - TON blockchain integration
  - Jetton (USDT) support
  - BOC validation utilities

- **Solana Support** (`mechanisms/svm/`)
  - Solana blockchain integration
  - SPL token support
  - Transaction signing

## [1.1.0] - 2025-06-01

### Added
- Gin middleware (`http/gin/`)
- HTTP client wrapper
- HTTP server implementation

## [1.0.0] - 2025-01-01

### Added
- Initial release
- Core client, server, facilitator interfaces
- EVM mechanism with EIP-3009
- EVM signers
- Bazaar extension for API discovery

[Unreleased]: https://github.com/t402-io/t402/compare/go/v1.5.0...HEAD
[1.5.0]: https://github.com/t402-io/t402/compare/go/v1.4.0...go/v1.5.0
[1.4.0]: https://github.com/t402-io/t402/compare/go/v1.3.1...go/v1.4.0
[1.3.1]: https://github.com/t402-io/t402/compare/go/v1.3.0...go/v1.3.1
[1.3.0]: https://github.com/t402-io/t402/compare/go/v1.2.0...go/v1.3.0
[1.2.0]: https://github.com/t402-io/t402/compare/go/v1.1.0...go/v1.2.0
[1.1.0]: https://github.com/t402-io/t402/compare/go/v1.0.0...go/v1.1.0
[1.0.0]: https://github.com/t402-io/t402/releases/tag/go/v1.0.0
