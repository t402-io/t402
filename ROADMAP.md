# T402 Roadmap

> **The Official Payment Protocol for USDT**

This document outlines the development roadmap for T402, a payment protocol specifically designed for USDT and USDT0, with deep integration with [Tether WDK](https://wallet.tether.io/).

---

## Vision

T402 aims to become the standard payment protocol for USDT/USDT0 across all supported blockchains, enabling:

- **Seamless HTTP payments** with a single header
- **Gasless transactions** via ERC-4337 and paymasters
- **Cross-chain payments** via LayerZero OFT bridging
- **AI agent payments** via MCP (Model Context Protocol)
- **Self-custodial wallets** via Tether WDK integration

---

## Current Status

### Supported Languages
| Language | Package | Version | Status |
|----------|---------|---------|--------|
| TypeScript | `@t402/*` | 2.0.0 | Production |
| Go | `github.com/t402-io/t402/go` | 2.0.0 | Production |
| Python | `t402` | 0.2.x | Production |
| Java | `io.t402:t402` | 0.1.x | Beta |

### Supported Blockchains
| Chain | USDT0 | USDT | Gasless | Status |
|-------|-------|------|---------|--------|
| Ethereum | EIP-3009 | Legacy | ERC-4337 | Production |
| Arbitrum | EIP-3009 | - | ERC-4337 | Production |
| Base | EIP-3009 | - | ERC-4337 | Production |
| Ink | EIP-3009 | - | ERC-4337 | Production |
| Berachain | EIP-3009 | - | ERC-4337 | Beta |
| TON | - | Jetton | - | Beta |
| TRON | - | TRC-20 | - | Planned |
| Solana | - | SPL | - | Production |

### WDK Integration
| Feature | Status |
|---------|--------|
| Basic Signer | Production |
| Multi-chain Wallets | Production |
| Balance Aggregation | Production |
| Balance Caching (TTL) | Production |
| Error Handling | Production |
| Bridge (LayerZero) | Beta |
| Gasless (ERC-4337) | Beta |
| MCP Server | Planned |

---

## Roadmap Phases

### Phase 1: Foundation (Weeks 1-4)

#### Goals
- Complete codebase cleanup
- Enhance WDK core integration
- Publish stable packages

#### Milestones

**Week 1-2: Cleanup & Branding**
- [ ] Set up github.com/t402-io organization
- [ ] Migrate repository
- [x] Configure NPM @t402 publishing
- [ ] Update all remaining metadata
- [x] Configure CI/CD for automated releases

**Week 3-4: WDK Core Enhancement**
- [x] Complete WDK signer with full error handling
- [x] Implement balance caching with TTL
- [x] Add comprehensive test suite (90%+ coverage)
- [x] Write WDK integration documentation
- [x] Publish @t402/wdk v2.0.0

#### Deliverables
- Clean, branded codebase
- @t402/wdk v2.0.0 with full documentation
- Automated release pipeline

---

### Phase 2: Multi-Chain (Weeks 5-12)

#### Goals
- Complete TON support
- Add TRON support
- Production-ready gasless payments
- Complete LayerZero bridge

#### Milestones

**Week 5-6: TON Complete**
- [ ] Complete TON facilitator implementation
- [ ] Add TON testnet support
- [ ] Implement TON transaction tracking
- [ ] Add TON to Go SDK
- [ ] Integration tests
- [ ] Publish @t402/ton v2.0.0

**Week 7-8: TRON Support**
- [ ] Create @t402/tron package
- [ ] Implement TRC-20 USDT transfers
- [ ] Add TRON signer
- [ ] Add TRON to Go SDK
- [ ] Add TRON to Python SDK
- [ ] Publish @t402/tron v1.0.0

**Week 9-10: ERC-4337 Production**
- [ ] Integrate Pimlico bundler
- [ ] Integrate Alchemy AA
- [ ] Add paymaster providers (Biconomy, Stackup)
- [ ] Safe smart account support
- [ ] Production deployment testing
- [ ] Update ERC-4337 documentation

**Week 11-12: LayerZero Bridge**
- [ ] Complete bridge client implementation
- [ ] Implement fee estimation
- [ ] Add message tracking (LayerZero Scan)
- [ ] Cross-chain payment routing
- [ ] Publish @t402/bridge v1.0.0

#### Deliverables
- Full TON support
- Full TRON support
- Production ERC-4337 gasless
- Complete LayerZero bridge
- All chains integrated

---

### Phase 3: Enterprise (Weeks 13-20)

#### Goals
- AI agent integration via MCP
- Advanced WDK features
- Complete documentation
- Production infrastructure

#### Milestones

**Week 13-14: MCP Integration**
- [ ] Create @t402/mcp package
- [ ] Implement MCP server with tools:
  - `t402/getBalance`
  - `t402/getAllBalances`
  - `t402/pay`
  - `t402/payGasless`
  - `t402/bridge`
  - `t402/getBridgeFee`
- [ ] Claude Desktop integration guide
- [ ] AI agent examples
- [ ] Publish @t402/mcp v1.0.0

**Week 15-16: WDK Advanced**
- [ ] Create @t402/wdk-gasless package
  - Smart account creation from WDK signer
  - Gasless USDT0 transfers
  - Batch payments
  - Sponsored transaction detection
- [ ] Create @t402/wdk-bridge package
  - Automatic chain selection
  - Fee-optimized routing
  - Transaction tracking
- [ ] Multi-sig support
- [ ] Hardware wallet support (via WDK)

**Week 17-18: Documentation Site**
- [ ] Set up Nextra project for docs.t402.io
- [ ] Write comprehensive documentation:
  - Getting Started guides
  - Server integration (Express, Next, Hono, FastAPI, Go)
  - Client integration (Fetch, Axios, WDK)
  - Chain-specific guides
  - Advanced features (gasless, bridge, MCP)
  - API reference
- [ ] Deploy to docs.t402.io
- [ ] Set up Algolia search

**Week 19-20: Infrastructure**
- [ ] Deploy facilitator.t402.io
  - Multi-region deployment
  - Redis for nonce tracking
  - Rate limiting
  - API key management
- [ ] Set up monitoring (Grafana, Prometheus)
- [ ] Load testing (10k+ TPS target)
- [ ] Security hardening

#### Deliverables
- @t402/mcp package
- @t402/wdk-gasless package
- @t402/wdk-bridge package
- docs.t402.io live
- facilitator.t402.io production

---

### Phase 4: Launch (Weeks 21-26)

#### Goals
- Security validation
- Open source release
- Tether partnership
- Community building

#### Milestones

**Week 21-22: Security Audit**
- [ ] Protocol security review (Trail of Bits, OpenZeppelin, or similar)
- [ ] Penetration testing
- [ ] Bug bounty program setup
- [ ] Fix all critical/high findings
- [ ] Security documentation

**Week 23-24: Open Source Preparation**
- [ ] Final code review pass
- [ ] Remove any sensitive data
- [ ] License verification (Apache 2.0)
- [ ] CONTRIBUTING.md update
- [ ] Issue templates
- [ ] Discussion templates
- [ ] Community guidelines

**Week 25-26: Tether Partnership & Launch**
- [ ] Prepare technical demo for Tether/WDK team
- [ ] Create partnership proposal:
  - Technical integration plan
  - "Powered by Tether" branding
  - Revenue/fee structure
- [ ] Schedule meetings with Tether team
- [ ] Public repository release
- [ ] Launch announcement
- [ ] Developer documentation publication

#### Deliverables
- Security audit report
- Public open-source repository
- Official Tether partnership (goal)
- Launch announcement

---

## Package Architecture

### NPM Packages (@t402/)

```
@t402/core           - Protocol types, HTTP utilities, base client/server
@t402/evm            - EVM mechanism (EIP-3009, USDT0)
@t402/svm            - Solana mechanism
@t402/ton            - TON mechanism (USDT Jetton)
@t402/tron           - TRON mechanism (TRC-20 USDT) [NEW]

@t402/wdk            - Tether WDK integration
@t402/wdk-gasless    - WDK + ERC-4337 [NEW]
@t402/wdk-bridge     - WDK + LayerZero [NEW]
@t402/mcp            - MCP server for AI agents [NEW]

@t402/express        - Express.js middleware
@t402/next           - Next.js integration
@t402/hono           - Hono middleware
@t402/fastify        - Fastify middleware [PLANNED]

@t402/fetch          - Fetch client wrapper
@t402/axios          - Axios interceptor

@t402/paywall        - Universal paywall component
@t402/react          - React components [PLANNED]
@t402/vue            - Vue components [PLANNED]

@t402/extensions     - Protocol extensions (Bazaar, etc.)
@t402/cli            - Command line tools [PLANNED]
```

### Go Module

```
github.com/t402-io/t402/go
├── client.go              - HTTP client
├── server.go              - HTTP server
├── facilitator.go         - Facilitator service
├── mechanisms/
│   ├── evm/               - EVM (Ethereum, Arbitrum, Base, etc.)
│   ├── svm/               - Solana
│   ├── ton/               - TON [IN PROGRESS]
│   └── tron/              - TRON [PLANNED]
├── http/                  - Framework integrations
│   └── gin/               - Gin middleware
└── types/                 - Protocol types
```

### Python Package

```
t402 (pip install t402)
├── core/                  - Protocol types
├── evm/                   - EVM mechanism
├── ton/                   - TON mechanism [PLANNED]
├── tron/                  - TRON mechanism [PLANNED]
├── wdk/                   - WDK adapter [PLANNED]
├── fastapi/               - FastAPI integration
├── flask/                 - Flask integration
└── clients/               - HTTP clients
```

---

## Token Support

### USDT0 (New OFT Token)

| Chain | Address | EIP-3009 |
|-------|---------|----------|
| Ethereum | `0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee` | Yes |
| Arbitrum | `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9` | Yes |
| Base | TBA | Yes |
| Ink | `0x0200C29006150606B650577BBE7B6248F58470c1` | Yes |
| Berachain | `0x779Ded0c9e1022225f8E0630b35a9b54bE713736` | Yes |
| Unichain | `0x588ce4F028D8e7B53B687865d6A67b3A54C75518` | Yes |

### USDT (Legacy)

| Chain | Address | Protocol |
|-------|---------|----------|
| Ethereum | `0xdAC17F958D2ee523a2206206994597C13D831ec7` | ERC-20 |
| TRON | `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` | TRC-20 |
| Polygon | `0xc2132D05D31c914a87C6611C10748AEb04B58e8F` | ERC-20 |
| BNB Chain | `0x55d398326f99059fF775485246999027B3197955` | BEP-20 |

### TON USDT

| Network | Master Address |
|---------|----------------|
| Mainnet | `EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs` |
| Testnet | `kQBqSpvo4S87mX9tTc4FX3Sfqf4uSp3Tx-Fz4RBUfTRWBx` |

---

## Infrastructure

### facilitator.t402.io

Production facilitator service providing:

- **Verify endpoint**: `/verify` - Validate payment signatures
- **Settle endpoint**: `/settle` - Execute on-chain transfers
- **Status endpoint**: `/status` - Check payment status

**Supported Networks**:
- All EVM chains (mainnet + testnets)
- TON (mainnet + testnet)
- TRON (mainnet + testnet)
- Solana (mainnet + devnet)

**Features**:
- Multi-region deployment (US, EU, APAC)
- Hot wallet rotation
- Rate limiting (10,000 req/min per API key)
- Real-time monitoring
- Gas price optimization

### docs.t402.io

Comprehensive documentation site powered by Nextra:

- Getting started guides
- Server integration tutorials
- Client integration tutorials
- Chain-specific documentation
- API reference
- Examples and templates

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Priority Areas

1. **Chain Support**: Adding new blockchain support
2. **Language SDKs**: Improving Go, Python, Java implementations
3. **Documentation**: Tutorials, examples, translations
4. **Testing**: Integration tests, load tests, security tests

---

## Contact

- **Website**: https://t402.io
- **Documentation**: https://docs.t402.io
- **GitHub**: https://github.com/t402-io/t402
- **Twitter**: [@t402_io](https://x.com/t402_io)

---

## License

Apache 2.0 - See [LICENSE](./LICENSE) for details.
