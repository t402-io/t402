# t402 Ecosystem

The t402 ecosystem brings together merchants, facilitators, SDK developers, infrastructure providers, and AI agent platforms to enable internet-native payments across 10 blockchain families and 50+ networks.

## What is the t402 Ecosystem?

t402 is an open standard for HTTP-native payments. The ecosystem consists of all organizations, projects, and individuals building on or integrating the t402 protocol. Whether you accept payments, process transactions, build developer tools, or operate AI agents that pay for resources, you are part of the t402 ecosystem.

## Categories

### Facilitators

Facilitators verify and settle payments on-chain. They are the bridge between HTTP commerce and blockchain finality.

- **Hosted Facilitator**: The official [t402 facilitator](https://facilitator.t402.io) supports 50 networks across 10 chain families with 81 payment kinds.
- **Self-Hosted**: Run your own facilitator using the Docker image for full control over settlement.
- **Custom**: Build a facilitator with custom logic (fee structures, settlement strategies, compliance rules).

### Merchants

Merchants accept t402 payments for APIs, content, compute resources, and other digital services.

- **API Providers**: Monetize REST/GraphQL APIs with per-request or usage-based pricing.
- **Content Publishers**: Gate articles, data feeds, and media behind micropayments.
- **Compute Services**: Charge for LLM inference, image generation, or other compute tasks.
- **SaaS Platforms**: Add pay-per-use billing alongside subscriptions.

### SDK Integrations

SDKs enable developers to add t402 support to applications in their language of choice.

| SDK | Version | Packages | Install |
|-----|---------|----------|---------|
| [TypeScript](https://www.npmjs.com/package/@t402/core) | v2.5.0 | 36 @t402/* packages | `pnpm add @t402/core` |
| [Go](https://pkg.go.dev/github.com/t402-io/t402/sdks/go) | v1.10.0 | Single module | `go get github.com/t402-io/t402/sdks/go` |
| [Python](https://pypi.org/project/t402/) | v1.10.1 | Single package | `pip install t402` |
| [Java](https://central.sonatype.com/artifact/io.t402/t402) | v1.10.0 | Single artifact | Maven/Gradle |

### Infrastructure Providers

Infrastructure providers supply the underlying services that make t402 payments reliable and fast.

- **RPC Providers**: Blockchain node access (Alchemy, Infura, QuickNode, etc.)
- **Indexers**: Transaction indexing and query services
- **Bridge Operators**: Cross-chain messaging (LayerZero for USDT0 bridging)
- **Bundler/Paymaster Services**: ERC-4337 infrastructure for gasless payments (Pimlico, Biconomy, Stackup)

### AI Agent Platforms

t402 is purpose-built for AI agent commerce. The MCP server enables any AI agent to discover, negotiate, and execute payments autonomously.

- **MCP Server**: [`@t402/mcp`](https://www.npmjs.com/package/@t402/mcp) with 11 tools for wallet management, payments, bridging, and DeFi.
- **Agent Frameworks**: LangChain, AutoGPT, CrewAI, and any framework supporting MCP.
- **Claude Desktop**: Native integration via MCP configuration.
- **A2A Protocol**: Agent-to-agent payment transport for multi-agent workflows.

## Current Ecosystem Statistics

| Metric | Count |
|--------|-------|
| Supported Networks | 50+ |
| Chain Families | 10 (EVM, SVM, TON, TRON, NEAR, Aptos, Tezos, Polkadot, Stacks, Cosmos) |
| SDK Languages | 4 (TypeScript, Go, Python, Java) |
| TypeScript Packages | 36 |
| HTTP Framework Integrations | 18 (5 TS + 4 Go + 4 Py + 5 Java) |
| MCP Tools | 11 |
| Payment Schemes | 2 (exact, upto) |
| USDT0 Bridge Networks | 19 |

## How to Join the Ecosystem

### 1. Choose Your Role

Identify how you want to participate: merchant, facilitator, SDK developer, infrastructure provider, or AI platform integrator.

### 2. Read the Integration Guide

See [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) for step-by-step instructions for each role.

### 3. Register as a Partner

Open an [Ecosystem Partner Registration](https://github.com/t402-io/t402/issues/new?template=ecosystem-partner.yml) issue to be listed in our partner directory.

### 4. Build and Ship

Use the SDKs, examples, and documentation to build your integration:

- **Documentation**: [docs.t402.io](https://docs.t402.io)
- **Examples**: [`examples/`](https://github.com/t402-io/t402/tree/main/examples) directory
- **Specification**: [`specs/`](https://github.com/t402-io/t402/tree/main/specs) directory

### 5. Get Support

- **GitHub Issues**: [t402-io/t402/issues](https://github.com/t402-io/t402/issues)
- **GitHub Discussions**: [t402-io/t402/discussions](https://github.com/t402-io/t402/discussions)
- **Security**: [Report vulnerabilities privately](https://github.com/t402-io/t402/security/advisories/new)

## Why t402?

| Feature | t402 | Alternatives |
|---------|------|-------------|
| Multi-chain | 10 chain families, 50+ networks | Typically EVM-only |
| AI Agent Payments | Native MCP + A2A support | Manual integration required |
| TON/Telegram | Full TON Jetton support | Not supported |
| Gasless Payments | ERC-4337 with paymaster sponsorship | Varies |
| Cross-chain Bridge | USDT0 via LayerZero (19 networks) | Separate bridge services |
| SDKs | 4 languages, 36 TS packages | 1-2 languages |
| Open Standard | Apache 2.0, no vendor lock-in | Proprietary protocols |

## Links

- [Partner Directory](./PARTNERS.md)
- [Integration Guide](./INTEGRATION_GUIDE.md)
- [Growth Strategy](./GROWTH_STRATEGY.md)
- [Protocol Specification](https://github.com/t402-io/t402/tree/main/specs)
- [Documentation](https://docs.t402.io)
- [Whitepaper](https://t402.io/t402-whitepaper.pdf)
