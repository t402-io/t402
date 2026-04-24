# t402 Specification

This folder contains the complete documentation of the t402 payment protocol, organized by version and component type.

## Overview

The t402 standard separates three key concepts:

- **Transport**: How data is exchanged between parties (HTTP, MCP, A2A)
- **Scheme**: The logical way money moves (exact, upto, permit2, permit2-proxy, etc.)
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

### v1 Transports (Removed)

> v1 transport specifications have been removed. See [Migration Guide](https://docs.t402.io/advanced/migration-v1-to-v2) for upgrading legacy v1 clients to v2.

## Payment Schemes

### Exact Scheme

The `exact` scheme transfers a specific amount for each request.

| Implementation | Description |
|----------------|-------------|
| [Overview](./schemes/exact/scheme_exact.md) | Scheme specification |
| [EVM](./schemes/exact/scheme_exact_evm.md) | Ethereum/EVM chains (EIP-3009) |
| [SVM](./schemes/exact/scheme_exact_svm.md) | Solana (SPL tokens) |
| [TON](./schemes/exact/scheme_exact_ton.md) | TON blockchain (Jettons) |
| [TRON](./schemes/exact/scheme_exact_tron.md) | TRON blockchain (TRC20) |
| [BTC](./schemes/exact/scheme_exact_btc.md) | Bitcoin (PSBT) |
| [Lightning](./schemes/exact/scheme_exact_lightning.md) | Lightning Network (BOLT11) |
| [SUI](./schemes/exact/scheme_exact_sui.md) | Sui blockchain **(DRAFT)** |

Additional chains implemented in SDKs (exact-direct variant — on-chain transfer as proof):
NEAR (NEP-141), Aptos (Fungible Asset), Tezos (FA2), Polkadot (Assets Pallet), Stacks (SIP-010), Cosmos/Noble (MsgSend, all SDKs).

### Up-To Scheme (Draft)

The `upto` scheme authorizes transfer of **up to** a maximum amount, enabling usage-based billing.

| Implementation | Description |
|----------------|-------------|
| [Overview](./schemes/upto/scheme_upto.md) | Scheme specification **(DRAFT)** |
| [EVM](./schemes/upto/scheme_upto_evm.md) | Ethereum/EVM chains (EIP-2612) **(DRAFT)** |

### Permit2 Scheme

The `permit2` scheme enables token transfers using Uniswap's Permit2 contract, supporting any ERC-20 token.

| Implementation | Description |
|----------------|-------------|
| [Overview](./schemes/permit2/scheme_permit2.md) | Scheme specification |
| [EVM](./schemes/permit2/scheme_permit2_evm.md) | Ethereum/EVM chains (Permit2 SignatureTransfer) |

### Permit2 Proxy Scheme

The `permit2-proxy` scheme extends `permit2` with witness-based facilitator binding via a proxy contract. Provides frontrun protection, destination locking, and optional gasless EIP-2612 flows. Interoperable with the x402 protocol.

| Implementation | Description |
|----------------|-------------|
| [Overview](./schemes/permit2-proxy/scheme_permit2_proxy.md) | Scheme specification |
| [EVM](./schemes/permit2-proxy/scheme_permit2_proxy_evm.md) | Ethereum/EVM chains (Permit2 + Witness proxy) |

## Extensions

Extensions enable modular optional functionality beyond core payment mechanics.

| Extension | Key | Description |
|-----------|-----|-------------|
| [Bazaar](./extensions/bazaar.md) | `bazaar` | Resource discovery and cataloging |
| [Payment Identifier](./extensions/payment-identifier.md) | `paymentId` | Unique identifiers for correlation and idempotency |
| [Sign-In-With-X](./extensions/sign-in-with-x.md) | `siwx` | CAIP-122 wallet-based identity assertions |
| [ERC-8004](./extensions/erc8004-integration.md) | `erc8004` | Trustless AI agent identity and reputation |
| [EIP-2612 Gas Sponsor](./extensions/eip2612-gas-sponsoring.md) | `eip2612GasSponsor` | Gas sponsoring via EIP-2612 permits |
| [ERC-20 Approval Gas](./extensions/erc20-approval-gas-sponsoring.md) | `erc20ApprovalGas` | Gas sponsoring via ERC-20 approvals |

See [extensions/README.md](./extensions/README.md) for the full extension guide and proposal template.

## Research

| Topic | Description |
|-------|-------------|
| [TON Connect Bridge](./research/ton-connect-bridge.md) | Analysis of TON Connect bridge protocol for t402 integration |
| [Mobile TON Reference](./research/mobile-ton-reference.md) | Reference implementation for mobile TON integration |

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
