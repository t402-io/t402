# t402 Specification

This folder contains the complete documentation of the t402 payment protocol, organized by version and component type.

## Overview

The t402 standard separates three key concepts:

- **Transport**: How data is exchanged between parties (HTTP, MCP, A2A)
- **Scheme**: The logical way money moves (exact, upto, etc.)
- **Network**: The blockchain where value is exchanged (EVM, Solana, TON, TRON)

## Protocol Versions

| Version | Status | Description |
|---------|--------|-------------|
| [v2](./t402-specification-v2.md) | **Current** | Enhanced protocol with ResourceInfo, multi-scheme support |
| [v1](./t402-specification-v1.md) | Legacy | Original specification |

## Transports

### v2 Transports (Current)

| Transport | Description |
|-----------|-------------|
| [HTTP](./transports-v2/http.md) | Primary transport for web services |
| [MCP](./transports-v2/mcp.md) | Model Context Protocol for AI agents |
| [A2A](./transports-v2/a2a.md) | Agent-to-Agent protocol |

### v1 Transports (Legacy)

| Transport | Description |
|-----------|-------------|
| [HTTP](./transports-v1/http.md) | Original HTTP transport |
| [MCP](./transports-v1/mcp.md) | Original MCP transport |
| [A2A](./transports-v1/a2a.md) | Original A2A transport |

## Payment Schemes

### Exact Scheme

The `exact` scheme transfers a specific amount for each request.

| Implementation | Description |
|----------------|-------------|
| [Overview](./schemes/exact/scheme_exact.md) | Scheme specification |
| [EVM](./schemes/exact/scheme_exact_evm.md) | Ethereum/EVM chains (EIP-3009) |
| [SVM](./schemes/exact/scheme_exact_svm.md) | Solana (SPL tokens) |
| [SUI](./schemes/exact/scheme_exact_sui.md) | Sui blockchain |

## Templates

For contributors adding new schemes or transports:

| Template | Purpose |
|----------|---------|
| [scheme_template.md](./scheme_template.md) | Template for new payment schemes |
| [scheme_impl_template.md](./scheme_impl_template.md) | Template for scheme implementations |
| [transport_template.md](./transport_template.md) | Template for new transports |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on adding new specifications.

## Quick Links

- [Main Documentation](https://docs.t402.io)
- [SDK Documentation](https://docs.t402.io/sdks)
- [GitHub Repository](https://github.com/t402-io/t402)
