# T402 Roadmap

> **The Official Payment Protocol for USDT**

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
| Go Modules | github.com/t402-io/t402/go | ✅ Published |
| Maven Central | https://central.sonatype.com/artifact/io.t402/t402 | ✅ Published |

---

## Package Versions

### TypeScript (@t402/*)

| Package | Version | Description |
|---------|---------|-------------|
| @t402/core | 2.0.0 | Protocol types, HTTP utilities |
| @t402/evm | 2.2.0 | EVM chains (EIP-3009, USDT0) |
| @t402/svm | 2.0.0 | Solana (SPL tokens) |
| @t402/ton | 2.1.0 | TON (USDT Jetton) |
| @t402/tron | 2.0.0 | TRON (TRC-20 USDT) |
| @t402/wdk | 2.0.1 | Tether WDK integration |
| @t402/wdk-gasless | 1.0.0 | ERC-4337 gasless payments |
| @t402/wdk-bridge | 1.0.0 | LayerZero bridging |
| @t402/wdk-multisig | 1.0.0 | Safe multi-sig wallets |
| @t402/mcp | 1.0.0 | AI agent MCP server |
| @t402/express | 2.0.0 | Express.js middleware |
| @t402/next | 2.0.0 | Next.js integration |
| @t402/hono | 2.0.0 | Hono middleware |
| @t402/fastify | 2.0.0 | Fastify middleware |
| @t402/fetch | 2.0.0 | Fetch client wrapper |
| @t402/axios | 2.0.0 | Axios interceptor |
| @t402/paywall | 2.0.0 | Universal paywall UI |
| @t402/react | 2.0.0 | React components |
| @t402/vue | 2.0.0 | Vue components |
| @t402/cli | 2.0.0 | Command-line tools |
| @t402/extensions | 2.0.0 | Protocol extensions |

### Other SDKs

| SDK | Version | Status |
|-----|---------|--------|
| Go | 1.5.0 | Production |
| Python | 1.7.0 | Production |
| Java | 1.1.0 | Production |

---

## Supported Blockchains

| Chain | Token | Mechanism | Gasless | Status |
|-------|-------|-----------|---------|--------|
| Ethereum | USDT0 | EIP-3009 | ERC-4337 | Production |
| Arbitrum | USDT0 | EIP-3009 | ERC-4337 | Production |
| Base | USDT0 | EIP-3009 | ERC-4337 | Production |
| Optimism | USDT0 | EIP-3009 | ERC-4337 | Production |
| Ink | USDT0 | EIP-3009 | ERC-4337 | Production |
| Berachain | USDT0 | EIP-3009 | ERC-4337 | Beta |
| Unichain | USDT0 | EIP-3009 | ERC-4337 | Production |
| TON | USDT | Jetton | - | Production |
| TRON | USDT | TRC-20 | - | Production |
| Solana | USDT | SPL | - | Production |

---

## Development Timeline

### Phase 1: Foundation Strengthening (Month 1)

> Focus: CI/CD Enhancement and Package Alignment

**Week 1-2: CI/CD Enhancement**
- [ ] Add Go tests to CI pipeline (unit + integration)
- [ ] Add Python tests to CI pipeline with pytest
- [ ] Add code coverage reporting (Codecov)
- [ ] Add dependency vulnerability scanning (Dependabot)
- [ ] Fix NPM release to include all packages

**Week 3-4: TypeScript Package Alignment**
- [ ] Align @t402/tron to v2.0.0
- [ ] Extract common viem dependency to peer dependency
- [ ] Standardize workspace protocol usage
- [ ] Add missing packages to npm release workflow

### Phase 2: Quality & Documentation (Month 2)

> Focus: Test Coverage and Documentation Overhaul

**Week 5-6: Test Coverage Improvement**
- [ ] Add TON integration tests
- [ ] Add TRON integration tests
- [ ] Add WDK package tests
- [ ] Add MCP server tests
- [ ] Achieve 80%+ coverage on core packages

**Week 7-8: Documentation Overhaul**
- [ ] Update README with accurate package list
- [ ] Create quickstart guides for each framework
- [ ] Add API documentation generation (TypeDoc)
- [ ] Create migration guide v1.x to v2.x

### Phase 3: SDK Parity (Month 3)

> Focus: Python and Go SDK Enhancement

**Week 9-10: Python SDK Enhancement**
- [ ] Add missing test coverage
- [ ] Create Python CLI tool
- [ ] Add SVM support documentation
- [ ] Publish to PyPI v1.5.0

**Week 11-12: Go SDK Enhancement**
- [ ] Add WDK-equivalent functionality
- [ ] Create Go CLI tool
- [ ] Improve documentation
- [ ] Release v1.25.0

### Phase 4: Java SDK Completion (Month 4-5) ✅

> Focus: Java SDK Production Release

- [x] Implement EVM mechanism (EIP-3009 signing)
- [x] Add Spring Boot middleware
- [x] Add Maven Central publication workflow
- [x] Create comprehensive documentation
- [x] Release v1.1.0 stable

### Phase 5: Security & Performance (Month 5-6)

> Focus: Security Audit and Optimization

**Security Audit:**
- [ ] Complete internal security review
- [ ] Fix all high/critical findings
- [ ] Engage external auditor (Trail of Bits/OpenZeppelin)
- [ ] Address audit findings

**Performance Optimization:**
- [ ] Add benchmarking suite
- [ ] Optimize bundle sizes for browser packages
- [ ] Implement lazy loading for chain-specific code
- [ ] Add tree-shaking optimization

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

### Phase 7: Infrastructure Scaling (Ongoing)

> Focus: Multi-Region Deployment

- [ ] Deploy to US, EU, APAC regions
- [ ] Implement geographic load balancing
- [ ] Add Redis Cluster for session management
- [ ] Implement hot wallet rotation

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
- [x] EVM chains with EIP-3009/USDT0
- [x] TON with USDT Jetton
- [x] TRON with TRC-20 USDT
- [x] Solana with SPL tokens

### Advanced Features ✅
- [x] ERC-4337 gasless payments
- [x] LayerZero cross-chain bridging
- [x] Safe multi-sig support
- [x] MCP server for AI agents
- [x] Hardware wallet support (Ledger, Trezor)

### Server Frameworks ✅
- [x] Express.js middleware (@t402/express)
- [x] Next.js integration (@t402/next)
- [x] Hono middleware (@t402/hono)
- [x] Fastify middleware (@t402/fastify)
- [x] FastAPI integration (Python)
- [x] Flask integration (Python)
- [x] Gin middleware (Go)

### Client Libraries ✅
- [x] Fetch client wrapper (@t402/fetch)
- [x] Axios interceptor (@t402/axios)
- [x] Universal paywall component (@t402/paywall)
- [x] React components (@t402/react)
- [x] Vue components (@t402/vue)
- [x] CLI tools (@t402/cli)

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

### Documentation & Community ✅
- [x] Documentation site (docs.t402.io)
- [x] Algolia search integration
- [x] Bug bounty program
- [x] Security policy
- [x] Issue/Discussion templates
- [x] Contributing guidelines
- [x] Code of conduct

---

## SDK Feature Matrix

| Feature | TypeScript | Go | Python | Java |
|---------|-----------|-----|--------|------|
| Core Client | ✅ | ✅ | ✅ | ✅ |
| Core Server | ✅ | ✅ | ✅ | ✅ |
| Facilitator | ✅ | ✅ | ✅ | ✅ |
| EVM Mechanism | ✅ | ✅ | ✅ | ✅ |
| SVM Mechanism | ✅ | ✅ | ✅ | ✅ |
| TON Mechanism | ✅ | ✅ | ✅ | ✅ |
| TRON Mechanism | ✅ | ✅ | ✅ | ✅ |
| ERC-4337 | ✅ | ✅ | ✅ | ✅ |
| USDT0 Bridge | ✅ | ✅ | ✅ | ✅ |
| WDK Integration | ✅ | ✅ | ✅ | ✅ |
| MCP Server | ✅ | ✅ | ✅ | ❌ |
| CLI Tool | ✅ | ✅ | ✅ | ✅ |
| HTTP Middleware | ✅ | ✅ | ✅ | ⚠️ |
| React/Vue UI | ✅ | N/A | N/A | N/A |

Legend: ✅ Complete | ⚠️ Partial | ❌ Missing | N/A Not Applicable

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
| TON | `EQ5d11d21276ac6b5efdf179e654ff0c6eee34e0abfa263a` |
| TRON | `TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5` |
| Solana | `8GGtWHRQ1wz5gDKE2KXZLktqzcfV1CBqSbeUZjA7hoWL` |

### Features

- Multi-chain support (EVM, TON, TRON, Solana)
- Redis-based rate limiting
- Prometheus metrics & Grafana dashboards
- API key authentication
- Automatic SSL via Caddy
- Docker deployment with Watchtower
- Trivy vulnerability scanning
- SBOM generation

---

## Token Addresses

### USDT0 (OFT Token)

| Chain | Address |
|-------|---------|
| Ethereum | `0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee` |
| Arbitrum | `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9` |
| Ink | `0x0200C29006150606B650577BBE7B6248F58470c1` |
| Berachain | `0x779Ded0c9e1022225f8E0630b35a9b54bE713736` |
| Unichain | `0x588ce4F028D8e7B53B687865d6A67b3A54C75518` |

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
| Testnet | `kQBqSpvo4S87mX9tTc4FX3Sfqf4uSp3Tx-Fz4RBUfTRWBx` |

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

1. **CI/CD**: Improving test coverage and automation
2. **Language SDKs**: Completing Go, Python, Java implementations
3. **Documentation**: Tutorials, examples, API docs
4. **Testing**: Integration tests, E2E tests, security tests
5. **MCP**: Expanding AI agent capabilities

---

## Related Documents

- [CONTRIBUTING.md](./CONTRIBUTING.md) - Contribution guidelines
- [SECURITY.md](./SECURITY.md) - Security policy
- [BUG_BOUNTY.md](./BUG_BOUNTY.md) - Bug bounty program

---

## Contact

- **Website**: https://t402.io
- **Documentation**: https://docs.t402.io
- **GitHub**: https://github.com/t402-io/t402
- **Twitter**: [@t402_io](https://x.com/t402_io)

---

## License

Apache 2.0 - See [LICENSE](./LICENSE) for details.
