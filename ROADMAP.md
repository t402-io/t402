# T402 Roadmap

> **The Official Payment Protocol for USDT**
>
> *Last Updated: 2026-02-10*

This document outlines the development status and roadmap for T402, a payment protocol specifically designed for USDT and USDT0, with deep integration with [Tether WDK](https://wallet.tether.io/).

---

## Vision

T402 aims to become the standard payment protocol for USDT/USDT0 across all supported blockchains, enabling:

- **Seamless HTTP payments** with a single header
- **Gasless transactions** via ERC-4337 and paymasters
- **Cross-chain payments** via LayerZero OFT bridging
- **AI agent payments** via MCP (Model Context Protocol)
- **Self-custodial wallets** via Tether WDK integration

---

## Deployed Resources

### Live Services

| Service | URL | Status |
|---------|-----|--------|
| Main Website | https://t402.io | ✅ Live |
| Ecosystem Directory | https://t402.io/ecosystem | ✅ Live |
| Facilitator API | https://facilitator.t402.io | ✅ Live |
| Documentation | https://docs.t402.io | ✅ Live |
| Grafana Monitoring | https://grafana.facilitator.t402.io | ✅ Live |
| Container Registry | https://github.com/t402-io/t402/pkgs/container/facilitator | ✅ Live |

### Package Registries

| Registry | URL | Status |
|----------|-----|--------|
| NPM | https://www.npmjs.com/org/t402 | ✅ Published |
| PyPI | https://pypi.org/project/t402/ | ✅ Published |
| Go Modules | github.com/t402-io/t402/sdks/go | ✅ Published |
| Maven Central | https://central.sonatype.com/artifact/io.t402/t402 | ✅ Published |

---

## Package Versions

### TypeScript (@t402/*)

| Package | Version | Description |
|---------|---------|-------------|
| @t402/core | 2.4.0 | Protocol types, HTTP utilities |
| @t402/evm | 2.4.0 | EVM chains (EIP-3009, USDT0, upto scheme) |
| @t402/evm-core | 2.4.0 | Shared EVM utilities |
| @t402/svm | 2.4.0 | Solana (SPL tokens) |
| @t402/ton | 2.4.0 | TON (USDT Jetton) |
| @t402/tron | 2.4.0 | TRON (TRC-20 USDT) |
| @t402/near | 2.4.0 | NEAR (NEP-141) |
| @t402/aptos | 2.4.0 | Aptos (Fungible Asset) |
| @t402/tezos | 2.4.0 | Tezos (FA2) |
| @t402/polkadot | 2.4.0 | Polkadot Asset Hub |
| @t402/stacks | 2.4.0 | Stacks (Bitcoin L2) |
| @t402/wdk | 2.4.0 | Tether WDK integration |
| @t402/wdk-gasless | 2.4.0 | ERC-4337 gasless payments |
| @t402/wdk-bridge | 2.4.0 | LayerZero bridging |
| @t402/wdk-multisig | 2.4.0 | Safe multi-sig wallets |
| @t402/mcp | 2.4.0 | AI agent MCP server |
| @t402/express | 2.4.0 | Express.js middleware |
| @t402/next | 2.4.0 | Next.js integration |
| @t402/hono | 2.4.0 | Hono middleware |
| @t402/fastify | 2.4.0 | Fastify middleware |
| @t402/fetch | 2.4.0 | Fetch client wrapper |
| @t402/axios | 2.4.0 | Axios interceptor |
| @t402/paywall | 2.4.0 | Universal paywall UI |
| @t402/react | 2.4.0 | React components |
| @t402/vue | 2.4.0 | Vue components |
| @t402/cli | 2.4.0 | Command-line tools |
| @t402/extensions | 2.4.0 | Protocol extensions (SIWx, bazaar) |

#### Advanced Packages (Beta)

| Package | Version | Description |
|---------|---------|-------------|
| @t402/agent-policy | 1.0.0-beta.2 | AI agent spending policies |
| @t402/a2a-negotiation | 1.0.0-beta.2 | Agent-to-agent negotiation |
| @t402/intent-payments | 1.0.0-beta.2 | Intent-based payment system |
| @t402/smart-router | 1.0.0-beta.2 | Multi-chain routing engine |
| @t402/streaming-payments | 1.0.0-beta.2 | Payment channels & streaming |
| @t402/zk-payments | 1.0.0-beta.2 | Zero-knowledge proofs |

### Other SDKs

| SDK | Version | Status |
|-----|---------|--------|
| Go | 1.9.0 | Production |
| Python | 1.10.1 | Production |
| Java | 1.10.0 | Production |

---

## Supported Blockchains (33 Networks)

### USDT0 (LayerZero OFT) - 19 Networks

| Chain | Mechanism | Gasless | Status |
|-------|-----------|---------|--------|
| Ethereum | EIP-3009 | ERC-4337 | Production |
| Arbitrum | EIP-3009 | ERC-4337 | Production |
| Optimism | EIP-3009 | ERC-4337 | Production |
| Polygon | EIP-3009 | ERC-4337 | Production |
| Ink | EIP-3009 | ERC-4337 | Production |
| Berachain | EIP-3009 | ERC-4337 | Production |
| Unichain | EIP-3009 | ERC-4337 | Production |
| Mantle | EIP-3009 | ERC-4337 | Production |
| Plasma | EIP-3009 | ERC-4337 | Production |
| Sei | EIP-3009 | ERC-4337 | Production |
| Conflux | EIP-3009 | ERC-4337 | Production |
| Monad | EIP-3009 | ERC-4337 | Production |
| Flare | EIP-3009 | ERC-4337 | Production |
| Rootstock | EIP-3009 | ERC-4337 | Production |
| XLayer | EIP-3009 | ERC-4337 | Production |
| Stable | EIP-3009 | ERC-4337 | Production |
| HyperEVM | EIP-3009 | ERC-4337 | Production |
| MegaETH | EIP-3009 | ERC-4337 | Production |
| Corn | EIP-3009 | ERC-4337 | Production |

### Legacy EVM USDT - 5 Networks

| Chain | Mechanism | Status |
|-------|-----------|--------|
| BNB Chain | approve+transferFrom | Production |
| Avalanche | approve+transferFrom | Production |
| Celo | approve+transferFrom | Production |
| Kaia | approve+transferFrom | Production |
| Fantom | approve+transferFrom | Production |

### Native USDT - 3 Networks

| Chain | Token Standard | Status |
|-------|---------------|--------|
| TON | Jetton | Production |
| TRON | TRC-20 | Production |
| Solana | SPL | Production |

### Non-EVM USDT - 6 Networks

| Chain | Token Standard | Status |
|-------|---------------|--------|
| NEAR | NEP-141 | Production |
| Aptos | Fungible Asset | Production |
| Tezos | FA2 | Production |
| Polkadot | Asset Hub | Production |
| Stacks | SIP-010 | Production |
| Cosmos (Noble) | Bank MsgSend | Production |

---

## Development Timeline

### Phase 1: Foundation Strengthening (Month 1) ✅

> Focus: CI/CD Enhancement and Package Alignment

**Week 1-2: CI/CD Enhancement** ✅
- [x] Add Go tests to CI pipeline (unit + integration)
- [x] Add Python tests to CI pipeline with pytest
- [x] Add code coverage reporting (Codecov) - TypeScript, Go, Python, Java
- [x] Add dependency vulnerability scanning (Dependabot)
- [x] Fix NPM release to include all packages (27 packages)

**Week 3-4: TypeScript Package Alignment** ✅
- [x] Align @t402/tron to v2.0.0
- [x] Extract common viem dependency to peer dependency
- [x] Standardize workspace protocol usage
- [x] Add missing packages to npm release workflow

### Phase 2: Quality & Documentation (Month 2) ✅

> Focus: Test Coverage and Documentation Overhaul

**Week 5-6: Test Coverage Improvement** ✅
- [x] Add TON integration tests (622 lines, 134 tests)
- [x] Add TRON integration tests (815 lines, 127 tests)
- [x] Add WDK package tests (wdk, wdk-gasless, wdk-bridge, wdk-multisig)
- [x] Add MCP server tests (68 tests with constants coverage)
- [x] Add coverage config to all packages (v8 provider)

**Week 7-8: Documentation Overhaul** ✅
- [x] Update README with accurate package list
- [x] Create quickstart guides for each framework
- [x] Expand SDK documentation (Go, Python, TypeScript)
- [x] Add deployment and best practices guides
- [x] Add API documentation generation (TypeDoc + GitHub Pages)
- [x] Create migration guide v1.x to v2.x

### Phase 3: SDK Parity (Month 3) ✅

> Focus: Python and Go SDK Enhancement

**Week 9-10: Python SDK Enhancement** ✅
- [x] Add missing test coverage (565 tests passing)
- [x] Create Python CLI tool (`t402 verify/settle/supported/encode/decode/info`)
- [x] Add SVM support (solana>=0.35.0, full Solana/SPL support)
- [x] Published PyPI v1.9.0

**Week 11-12: Go SDK Enhancement** ✅
- [x] Add WDK-equivalent functionality (BIP-39, HD wallet, multi-chain)
- [x] Create Go CLI tool (`cmd/t402/` with full feature set)
- [x] Create MCP server (`cmd/t402-mcp/` for AI agents)
- [x] SmartBridgeRouter for multi-chain bridging
- [x] Released v1.8.0 with advanced bridge routing

### Phase 4: Java SDK Completion (Month 4-5) ✅

> Focus: Java SDK Production Release

- [x] Implement EVM mechanism (EIP-3009 signing)
- [x] Add Spring Boot middleware
- [x] Add Maven Central publication workflow
- [x] Create comprehensive documentation
- [x] Release v1.7.0 stable
- [x] Complete TON payment scheme (TonSchemes, ExactTonServerScheme, ExactTonFacilitatorScheme)
- [x] Complete TRON payment scheme (TronSchemes, ExactTronServerScheme, ExactTronFacilitatorScheme)
- [x] MCP server with 12 tools (6 EVM + 2 SVM + 2 TON + 2 TRON)
- [x] Release v1.8.0 with full multi-chain support

### Phase 5: Security & Performance (Month 5-6)

> Focus: Security Audit and Optimization

**Security Tooling:** ✅
- [x] CodeQL SAST scanning (TypeScript, Go, Python, Java)
- [x] Trivy vulnerability scanning (PRs and main branch)
- [x] govulncheck for Go dependencies
- [x] SBOM generation for container images

**Security Audit:**
- [x] Complete internal security review (18 P1 issues found and fixed)
- [x] Fix all high/critical findings
- [ ] **Engage external auditor — P0 BLOCKER** (vendor not yet engaged)
- [ ] Address audit findings

**Performance Optimization:** ✅
- [x] Add benchmarking suite (vitest bench for core, evm)
- [x] Optimize bundle sizes for browser packages (analyzed, separate entry points)
- [x] Implement lazy loading for chain-specific code (paywall evm/svm splits)
- [x] Add tree-shaking optimization (enabled in tsup configs)

### Phase 6: New SDKs (Month 7-12)

> Focus: Rust and Swift SDK Development

**Rust SDK (Month 7-9):**
- [ ] Wasm-compatible for browser and Node.js
- [ ] Async runtime support (tokio)
- [ ] Full mechanism support (EVM, SVM, TON, TRON)

**Swift SDK (Month 10-12):**
- [ ] iOS/macOS native support
- [ ] SwiftUI components
- [ ] WalletConnect integration

### Phase 7: Infrastructure Scaling ✅

> Focus: Multi-Region Deployment

- [x] Kubernetes manifests with Kustomize (base + staging + production overlays)
- [x] Multi-region support (US-East, EU-West, AP-Southeast configs)
- [x] Horizontal Pod Autoscaler (3-20 replicas)
- [x] Pod Disruption Budget for high availability
- [x] Network policies for security isolation
- [x] ServiceMonitor for Prometheus Operator
- [x] CI/CD workflow for K8s deployments
- [x] Disaster recovery plan documentation (RTO: 15min, RPO: 5min)
- [x] Infrastructure documentation
- [ ] Hot wallet rotation (requires operational process)

### Phase 8: Advanced Features (Month 7-18)

> Focus: Next-Generation Payment Capabilities

#### P0: Core Features (Month 7-9) ✅

Internal packages implemented (575 tests passing):

- [x] Agent Payment Authorization - `@t402-internal/agent-policy` (280 tests)
- [x] A2A Negotiation Protocol - `@t402-internal/a2a-negotiation` (95 tests)
- [x] Smart Cross-chain Routing - `@t402-internal/smart-router` (27 tests)

#### P1: Enhanced Features (Month 10-15) - In Progress

- [x] Privacy-preserving payments - `@t402-internal/zk-payments` (79 tests)
- [ ] MEV protection mechanisms
- [ ] Atomic cross-chain swaps
- [x] Compliance engine - `@t402-internal/zk-payments` (compliance proofs)
- [x] Intent-based payments - `@t402-internal/intent-payments` (57 tests)

#### P2: Research (Month 16-18) - In Progress

- [ ] Advanced workflow engine
- [ ] Subscription payments
- [ ] Bitcoin L2 exploration
- [x] Payment channels - `@t402-internal/streaming-payments` (37 tests)

#### Advanced Packages ✅

These features are implemented as advanced packages ready for public release:

| Package | Description | Tests |
|---------|-------------|-------|
| `@t402/agent-policy` | AI agent spending policies and authorization | 280 |
| `@t402/a2a-negotiation` | Agent-to-agent negotiation and discovery | 95 |
| `@t402/intent-payments` | Intent-based payment system | 57 |
| `@t402/smart-router` | Multi-chain routing and optimization | 27 |
| `@t402/streaming-payments` | Per-second billing and payment channels | 37 |
| `@t402/zk-payments` | Zero-knowledge proofs for privacy | 79 |
| `@t402/demo-marketplace` | Integration demo (AI Agent Marketplace) | - |

**Status:**
- [x] Renamed from `@t402-internal/*` to `@t402/*`
- [x] Updated to version 1.0.0-beta.2
- [x] MIT license and public publishConfig
- [x] Migration guide created (`docs/internal/MIGRATION.md`)
- [x] Published to npm (2026-01-20)
- [x] CI/CD workflow for automated releases

---

## Completed Milestones

### Foundation ✅
- [x] GitHub organization (t402-io) setup
- [x] Repository migration to t402-io/t402
- [x] NPM @t402 namespace publishing
- [x] PyPI t402 package publishing
- [x] Go module publishing
- [x] CI/CD pipelines (GitHub Actions)
- [x] Automated release workflows (npm, Go, Python)
- [x] Monorepo consolidation (23 repos archived)
- [x] Legacy npm packages deprecated

### Multi-Chain Support ✅
- [x] EVM chains with EIP-3009/USDT0 (19 networks)
- [x] EVM legacy USDT with approve+transferFrom (5 networks)
- [x] TON with USDT Jetton
- [x] TRON with TRC-20 USDT
- [x] Solana with SPL tokens
- [x] NEAR with NEP-141
- [x] Aptos with Fungible Asset
- [x] Tezos with FA2
- [x] Polkadot Asset Hub
- [x] Stacks with SIP-010
- [x] Cosmos (Noble) with native USDC

### Advanced Features ✅
- [x] ERC-4337 gasless payments
- [x] LayerZero cross-chain bridging
- [x] Safe multi-sig support
- [x] MCP server for AI agents
- [x] Hardware wallet support (Ledger, Trezor)

### Advanced Packages (Phase 8) ✅
- [x] Agent policy engine (@t402/agent-policy)
- [x] A2A negotiation protocol (@t402/a2a-negotiation)
- [x] Intent-based payments (@t402/intent-payments)
- [x] Smart cross-chain routing (@t402/smart-router)
- [x] Streaming payments (@t402/streaming-payments)
- [x] Zero-knowledge proofs (@t402/zk-payments)
- [x] Integration demo (@t402/demo-marketplace)
- [x] Migration to public namespace (1.0.0-beta.2)

### Server Frameworks ✅
- [x] Express.js middleware (@t402/express)
- [x] Next.js integration (@t402/next)
- [x] Hono middleware (@t402/hono)
- [x] Fastify middleware (@t402/fastify)
- [x] Gin middleware (Go)
- [x] Echo middleware (Go)
- [x] Chi middleware (Go)
- [x] Fiber middleware (Go)
- [x] FastAPI integration (Python)
- [x] Flask integration (Python)
- [x] Django middleware (Python)
- [x] Starlette middleware (Python)
- [x] Spring interceptor (Java)
- [x] Servlet filter (Java)
- [x] WebFlux filter (Java)
- [x] Micronaut filter (Java)
- [x] Quarkus filter (Java)

### Client Libraries ✅
- [x] Fetch client wrapper (@t402/fetch)
- [x] Axios interceptor (@t402/axios)
- [x] Universal paywall component (@t402/paywall)
- [x] React components (@t402/react)
- [x] Vue components (@t402/vue)
- [x] CLI tools (@t402/cli)

### SDK Enhancements (2026-01) ✅
- [x] Upto scheme server/facilitator (TypeScript EVM) - usage-based billing
- [x] TON payment scheme (Java SDK) - Ed25519 signatures
- [x] TRON payment scheme (Java SDK) - ECDSA secp256k1
- [x] Sign-In-With-X extension (CAIP-122) - wallet authentication with EIP-191/712/1271/6492 support
- [x] Java v1.8.0 - Complete TON/TRON schemes with MCP tools (12 total)
- [x] TON paywall (@t402/paywall) - TonConnect wallet integration
- [x] TRON paywall (@t402/paywall) - TronLink wallet integration
- [x] Multi-network selector (@t402/paywall) - User chooses payment network
- [x] Dark mode support (@t402/paywall) - Light/dark/auto themes
- [x] Accessibility improvements (@t402/paywall) - ARIA labels, keyboard nav
- [x] Payment progress indicator (@t402/paywall) - Visual step tracker (Connect→Sign→Submit→Confirm)
- [x] Mobile optimization (@t402/paywall) - WalletConnect deep linking, mobile detection
- [x] QR code payment flow (@t402/paywall) - Scan-to-pay with payment URI generation
- [x] Stacks paywall (@t402/paywall) - Leather/Xverse wallet integration, sUSDC support
- [x] Cosmos/Noble paywall (@t402/paywall) - Keplr/Leap wallet integration
- [x] NEAR paywall (@t402/paywall) - MyNearWallet/Meteor wallet integration
- [x] USDT0 full coverage - All 19 LayerZero OFT networks (100%)
- [x] TransactionStatus component - Block explorer links for all chains
- [x] Bundle size optimization - Code splitting, production builds

### Infrastructure ✅
- [x] Facilitator service (Go)
- [x] Docker containerization
- [x] Redis rate limiting
- [x] Prometheus metrics
- [x] Grafana dashboards
- [x] Watchtower auto-deployment
- [x] Caddy reverse proxy with SSL
- [x] GitHub Container Registry publishing
- [x] Trivy security scanning
- [x] SBOM generation
- [x] Kubernetes manifests (Kustomize)
- [x] Multi-region deployment configs
- [x] Horizontal Pod Autoscaler
- [x] Disaster recovery plan

### Three-Site Redesign (2026-02-10) ✅
- [x] t402.io — Full visual overhaul (hero, features, SDK grid, ecosystem, CTA)
- [x] docs.t402.io — Nextra theme overhaul (branded navbar, sidebar, code blocks, footer)
- [x] demo.t402.io — Card system, alternating sections, developer quick start

### Q1-Q2 2026 Development Plan ✅
- [x] All 18 P1 security issues fixed
- [x] Facilitator: 44 networks, 64 kinds live (77.4% test coverage)
- [x] Full SDK parity: 10 mechanisms × 4 SDKs, 18 HTTP frameworks
- [x] MCP 6/6 tools across all 4 SDKs
- [x] 7,100+ tests across all SDKs, zero failures
- [x] Full documentation audit (34 files, +720/-177 lines)
- [x] Dependabot backlog cleared (15 PRs merged)
- [x] Project-wide audit (70+ files, 6 commits)

### Documentation & Community ✅
- [x] Documentation site (docs.t402.io) — 100 pages
- [x] Algolia search integration
- [x] Bug bounty program
- [x] Security policy
- [x] Issue/Discussion templates
- [x] Contributing guidelines
- [x] Code of conduct

---

## SDK Feature Matrix

See the [SDK Feature Matrix in README.md](README.md#sdk-feature-matrix) for the current status of all SDK features.

---

## Facilitator Service

Production facilitator service for payment verification and settlement.

**Live at**: https://facilitator.t402.io

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/verify` | POST | Validate payment signatures |
| `/settle` | POST | Execute on-chain transfers |
| `/supported` | GET | List supported networks and schemes |
| `/health` | GET | Liveness probe |
| `/ready` | GET | Readiness probe |
| `/metrics` | GET | Prometheus metrics |

### Facilitator Addresses

| Chain | Address |
|-------|---------|
| EVM | `0xC88f67e776f16DcFBf42e6bDda1B82604448899B` |
| TON | `EQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkEUe` |
| TRON | `TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5` |
| Solana | `8GGtWHRQ1wz5gDKE2KXZLktqzcfV1CBqSbeUZjA7hoWL` |

### Features

- Multi-chain support (EVM, Solana, TON, TRON, NEAR, Aptos, Tezos, Polkadot, Stacks, Cosmos)
- Redis-based rate limiting
- Prometheus metrics & Grafana dashboards
- API key authentication
- Automatic SSL via Caddy
- Docker deployment with Watchtower
- Trivy vulnerability scanning
- SBOM generation

---

## Token Addresses

### USDT0 (OFT Token) - 19 Networks

| Chain | Address |
|-------|---------|
| Ethereum | `0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee` |
| Arbitrum | `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9` |
| Optimism | `0x01bFF41798a0BcF287b996046Ca68b395DbC1071` |
| Polygon | `0xc2132D05D31c914a87C6611C10748AEb04B58e8F` |
| Ink | `0x0200C29006150606B650577BBE7B6248F58470c1` |
| Berachain | `0x779Ded0c9e1022225f8E0630b35a9b54bE713736` |
| Unichain | `0x9151434b16b9763660705744891fA906F660EcC5` |
| Mantle | `0x779Ded0c9e1022225f8E0630b35a9b54bE713736` |
| Plasma | `0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb` |
| Sei | `0x9151434b16b9763660705744891fA906F660EcC5` |
| Conflux | `0xaf37E8B6C9ED7f6318979f56Fc287d76c30847ff` |
| Monad | `0xe7cd86e13AC4309349F30B3435a9d337750fC82D` |
| Flare | `0xe7cd86e13AC4309349F30B3435a9d337750fC82D` |
| Rootstock | `0x779dED0C9e1022225F8e0630b35A9B54Be713736` |
| XLayer | `0x779Ded0c9e1022225f8E0630b35a9b54bE713736` |
| Stable | `0x779Ded0c9e1022225f8E0630b35a9b54bE713736` |
| HyperEVM | `0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb` |
| MegaETH | `0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb` |
| Corn | `0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb` |

### USDT (Legacy)

| Chain | Address |
|-------|---------|
| Ethereum | `0xdAC17F958D2ee523a2206206994597C13D831ec7` |
| TRON | `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` |
| Polygon | `0xc2132D05D31c914a87C6611C10748AEb04B58e8F` |
| BNB Chain | `0x55d398326f99059fF775485246999027B3197955` |

### TON USDT

| Network | Address |
|---------|---------|
| Mainnet | `EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs` |
| Testnet | `kQD0GKBM8ZbryVk2aESmzfU6b9b_8era_IkvBSELujFZPsyy` |

### TRON USDT (TRC-20)

| Network | Address |
|---------|---------|
| Mainnet | `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` |
| Nile Testnet | `TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf` |
| Shasta Testnet | `TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs` |

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Priority Areas

1. **External Security Audit**: Smart contract audit (P0 blocker)
2. **Rust SDK**: Wasm-compatible SDK for browser and Node.js
3. **Swift SDK**: iOS/macOS native support
4. **Infrastructure**: Multi-region K8s deployment activation
5. **New Chains**: Sui and other USDT0 expansion networks

---

## Related Documents

- [CONTRIBUTING.md](./CONTRIBUTING.md) - Contribution guidelines
- [SECURITY.md](./SECURITY.md) - Security policy

---

## Contact

- **Website**: https://t402.io
- **Documentation**: https://docs.t402.io
- **GitHub**: https://github.com/t402-io/t402
- **Telegram**: [@t402_io](https://t.me/t402_io)

---

## License

Apache 2.0 - See [LICENSE](./LICENSE) for details.
