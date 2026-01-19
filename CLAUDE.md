# T402 Project Context

## Overview

T402 is an open-source HTTP-native payment protocol for USDT/USDT0 stablecoins. It enables web services to require cryptocurrency payments without intermediaries using a simple request-response pattern.

### Core Concepts

**Payment Flow:**
1. Client requests a protected resource
2. Server responds with `402 Payment Required` + payment requirements
3. Client signs a payment authorization (off-chain)
4. Client resubmits request with signed payment in header
5. Server verifies signature and settles on-chain via facilitator

**Protocol Components:**
- **Transport**: How data is exchanged (HTTP, MCP, A2A)
- **Scheme**: Payment logic (exact, upto)
- **Network**: Blockchain for settlement (EVM, Solana, TON, TRON)

**Key Types:**
- `PaymentRequirements`: What payment is needed (scheme, network, amount, asset, payTo)
- `PaymentPayload`: Client's signed payment authorization
- `PaymentRequired`: Server's 402 response with requirements
- `VerifyResponse` / `SettleResponse`: Facilitator responses

---

## Project Structure

```
t402/
├── typescript/              # TypeScript SDK (pnpm monorepo)
│   ├── packages/
│   │   ├── core/            # @t402/core - Protocol types, HTTP utilities
│   │   ├── extensions/      # @t402/extensions - Protocol extensions
│   │   ├── mechanisms/
│   │   │   ├── evm/         # @t402/evm - EVM chains (EIP-3009)
│   │   │   ├── evm-core/    # @t402/evm-core - Shared EVM utilities
│   │   │   ├── svm/         # @t402/svm - Solana (SPL tokens)
│   │   │   ├── ton/         # @t402/ton - TON (Jettons)
│   │   │   └── tron/        # @t402/tron - TRON (TRC-20)
│   │   ├── http/
│   │   │   ├── express/     # @t402/express - Express.js middleware
│   │   │   ├── hono/        # @t402/hono - Hono middleware
│   │   │   ├── fastify/     # @t402/fastify - Fastify middleware
│   │   │   ├── next/        # @t402/next - Next.js integration
│   │   │   ├── fetch/       # @t402/fetch - Fetch client wrapper
│   │   │   ├── axios/       # @t402/axios - Axios interceptor
│   │   │   ├── paywall/     # @t402/paywall - Universal paywall UI
│   │   │   ├── react/       # @t402/react - React components
│   │   │   └── vue/         # @t402/vue - Vue components
│   │   ├── wdk/             # @t402/wdk - Tether WDK integration
│   │   ├── wdk-gasless/     # @t402/wdk-gasless - ERC-4337 gasless payments
│   │   ├── wdk-bridge/      # @t402/wdk-bridge - LayerZero bridging
│   │   ├── wdk-multisig/    # @t402/wdk-multisig - Safe multi-sig
│   │   ├── mcp/             # @t402/mcp - AI agent MCP server
│   │   └── cli/             # @t402/cli - Command-line tools
│   ├── site/                # [SUBMODULE] Marketing website
│   ├── turbo.json           # Turborepo configuration
│   └── package.json         # Monorepo root
├── go/                      # Go SDK
│   ├── mechanisms/          # Chain implementations
│   │   ├── evm/
│   │   ├── svm/
│   │   ├── ton/
│   │   └── tron/
│   ├── http/                # HTTP middleware (Gin)
│   ├── cmd/t402/            # CLI tool
│   └── cmd/t402-mcp/        # MCP server
├── python/                  # Python SDK
│   └── t402/
│       └── src/t402/
├── java/                    # Java SDK
│   └── t402/
├── services/facilitator/    # Facilitator service (Go)
├── docs/                    # Documentation site (Nextra)
├── specs/                   # Protocol specifications
│   ├── t402-specification-v2.md  # Current spec
│   ├── schemes/             # Payment scheme specs
│   └── transports-v2/       # Transport specs (HTTP, MCP, A2A)
└── .github/workflows/       # CI/CD pipelines
```

---

## Key URLs

### Public Services

| Service | URL |
|---------|-----|
| Website | https://t402.io |
| Documentation | https://docs.t402.io |
| Whitepaper | https://docs.t402.io/t402-whitepaper.pdf |
| Facilitator API | https://facilitator.t402.io |
| Grafana Dashboard | https://grafana.facilitator.t402.io |

### Facilitator API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Liveness probe |
| `/ready` | GET | Readiness probe |
| `/metrics` | GET | Prometheus metrics |
| `/supported` | GET | Supported networks/schemes/signers |
| `/verify` | POST | Verify payment authorization |
| `/settle` | POST | Execute on-chain settlement |

### Package Registries

| Platform | URL |
|----------|-----|
| GitHub | https://github.com/t402-io/t402 |
| npm | https://www.npmjs.com/org/t402 |
| PyPI | https://pypi.org/project/t402 |
| Go Modules | https://pkg.go.dev/github.com/t402-io/t402/go |
| Maven Central | https://central.sonatype.com/artifact/io.t402/t402 |
| Container Registry | https://github.com/t402-io/t402/pkgs/container/facilitator |

---

## SDK Versions & Releases

| SDK | Version | Registry | Tag Pattern |
|-----|---------|----------|-------------|
| TypeScript | 2.3.0 | npm (@t402/*) | `v*` (e.g., `v2.3.0`) |
| Python | 1.9.0 | PyPI | `python/v*` |
| Go | 1.8.0 | Go Modules | `go/v*` |
| Java | 1.7.0 | Maven Central | `java/v*` |

### Release Commands

```bash
# TypeScript (publishes all 21 packages)
git tag v2.3.1 && git push origin v2.3.1

# Python
git tag python/v1.9.1 && git push origin python/v1.9.1

# Go
git tag go/v1.8.1 && git push origin go/v1.8.1

# Java
git tag java/v1.7.1 && git push origin java/v1.7.1
```

---

## Development Setup

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 18+ | TypeScript SDK |
| pnpm | 10+ | TypeScript monorepo |
| Go | 1.24+ | Go SDK, Facilitator |
| Python | 3.10+ | Python SDK |
| uv | Latest | Python package manager |
| Java | 21+ | Java SDK |
| Maven | 3.9+ | Java build |

### Quick Start

```bash
# Clone with submodules
git clone --recurse-submodules https://github.com/t402-io/t402.git
cd t402

# TypeScript
cd typescript
pnpm install
pnpm build
pnpm test

# Go
cd go
go mod download
go test ./...

# Python
cd python/t402
uv sync
uv run pytest

# Java
cd java/t402
mvn clean install
```

### TypeScript Monorepo Commands

```bash
cd typescript

# Build all packages
pnpm build

# Build specific package
pnpm --filter @t402/evm build

# Run all tests
pnpm test

# Run specific package tests
pnpm --filter @t402/core test

# Type checking
pnpm typecheck

# Linting & formatting
pnpm lint
pnpm format
```

---

## Code Architecture & Patterns

### Interface Pattern (All SDKs)

Each mechanism implements three interfaces:

1. **Client** - Signs payment authorizations
2. **Server** - Enhances payment requirements
3. **Facilitator** - Verifies signatures and settles on-chain

**Go Example:**
```go
// Client signs payments
type SchemeNetworkClient interface {
    Scheme() string
    CreatePaymentPayload(ctx context.Context, requirements PaymentRequirements) (PaymentPayload, error)
}

// Server enhances requirements
type SchemeNetworkServer interface {
    Scheme() string
    ParsePrice(price Price, network Network) (AssetAmount, error)
    EnhancePaymentRequirements(ctx context.Context, ...) (PaymentRequirements, error)
}

// Facilitator verifies and settles
type SchemeNetworkFacilitator interface {
    Scheme() string
    CaipFamily() string  // e.g., "eip155:*"
    GetSigners(network Network) []string
    Verify(ctx context.Context, ...) (*VerifyResponse, error)
    Settle(ctx context.Context, ...) (*SettleResponse, error)
}
```

**TypeScript Example:**
```typescript
// Mechanism packages export client/server/facilitator
import { ExactEVMClient } from '@t402/evm/exact/client';
import { ExactEVMServer } from '@t402/evm/exact/server';
import { ExactEVMFacilitator } from '@t402/evm/exact/facilitator';
```

### Network Identifiers (CAIP-2)

Networks use CAIP-2 format: `namespace:reference`

| Network | Identifier |
|---------|------------|
| Ethereum Mainnet | `eip155:1` |
| Base | `eip155:8453` |
| Arbitrum | `eip155:42161` |
| Optimism | `eip155:10` |
| Solana Mainnet | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` |
| TON Mainnet | `ton:mainnet` |
| TRON Mainnet | `tron:mainnet` |

### Package Export Pattern (TypeScript)

Mechanism packages use granular exports for tree-shaking:

```json
{
  "exports": {
    ".": "./dist/esm/index.mjs",
    "./exact/client": "./dist/esm/exact/client/index.mjs",
    "./exact/server": "./dist/esm/exact/server/index.mjs",
    "./exact/facilitator": "./dist/esm/exact/facilitator/index.mjs",
    "./v1": "./dist/esm/v1/index.mjs"
  }
}
```

### Protocol Versions

- **V2** (Current): CAIP-2 networks, ResourceInfo, extensions support
- **V1** (Legacy): Simple format, still supported by facilitator

V1 and V2 are distinguished by `t402Version` field in payloads.

---

## Environment Variables

### Facilitator Service

```bash
# Server
PORT=8080
ENVIRONMENT=development|production
CORS_ALLOWED_ORIGINS=https://t402.io,https://docs.t402.io

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# Rate Limiting
RATE_LIMIT_REQUESTS=1000
RATE_LIMIT_WINDOW=60

# API Authentication
API_KEYS=key1:name1,key2:name2
API_KEY_REQUIRED=false

# EVM
EVM_PRIVATE_KEY=0x...
ETH_RPC=https://eth.llamarpc.com
ARBITRUM_RPC=https://arb1.arbitrum.io/rpc
BASE_RPC=https://mainnet.base.org

# TON
TON_MNEMONIC=word1 word2 ... word24
TON_RPC=https://toncenter.com/api/v2/jsonRPC
TON_MAINNET_ADDRESS=EQ...
TON_TESTNET_ADDRESS=kQ...

# TRON
TRON_PRIVATE_KEY=
TRON_RPC=https://api.trongrid.io

# Solana
SVM_PRIVATE_KEY=
SOLANA_RPC=https://api.mainnet-beta.solana.com
```

### TypeScript Testing

```bash
# Integration tests
TEST_NETWORK=eip155:84532
TEST_RPC_URL=https://base-sepolia.publicnode.com
TEST_PRIVATE_KEY=0x...
```

---

## CI/CD Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `unit_tests.yml` | PR, Push | Run all SDK tests |
| `integration_tests.yml` | PR, Push | Run integration tests |
| `npm_release.yml` | Tag `v*` | Publish TypeScript packages |
| `python_release.yml` | Tag `python/v*` | Publish to PyPI |
| `go_release.yml` | Tag `go/v*` | Verify Go module |
| `java_release.yml` | Tag `java/v*` | Publish to Maven Central |
| `facilitator.yml` | Push to main | Build & push container |
| `codeql.yml` | PR, Weekly | Security scanning |

### Facilitator Deployment

- **Container**: `ghcr.io/t402-io/facilitator`
- **Auto-deploy**: Watchtower watches for new images
- **Manual**: `./deploy.sh` script on server

---

## Facilitator Wallets

| Chain | Address |
|-------|---------|
| EVM (all) | `0xC88f67e776f16DcFBf42e6bDda1B82604448899B` |
| Solana | `8GGtWHRQ1wz5gDKE2KXZLktqzcfV1CBqSbeUZjA7hoWL` |
| TON | `EQ5d11d21276ac6b5efdf179e654ff0c6eee34e0abfa263a` |
| TRON | `TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5` |

---

## Token Addresses

### USDT0 (LayerZero OFT)

| Chain | Address |
|-------|---------|
| Ethereum | `0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee` |
| Arbitrum | `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9` |
| Ink | `0x0200C29006150606B650577BBE7B6248F58470c1` |
| Berachain | `0x779Ded0c9e1022225f8E0630b35a9b54bE713736` |
| Unichain | `0x588ce4F028D8e7B53B687865d6A67b3A54C75518` |

### TON USDT (Jetton)

| Network | Address |
|---------|---------|
| Mainnet | `EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs` |
| Testnet | `kQBqSpvo4S87mX9tTc4FX3Sfqf4uSp3Tx-Fz4RBUfTRWBx` |

### TRON USDT (TRC-20)

| Network | Address |
|---------|---------|
| Mainnet | `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` |
| Nile Testnet | `TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf` |

---

## Security Guidelines

### Reporting Vulnerabilities

**Do NOT report via public GitHub issues.**

1. GitHub Security Advisories: https://github.com/t402-io/t402/security/advisories/new
2. Email: security@t402.io

### Security Architecture

- **Client**: Private keys never leave client; signs off-chain
- **Server**: Verifies signatures before serving resources
- **Facilitator**: Executes on-chain settlement; rate-limited

### Chain-Specific Security

| Chain | Signature | Replay Protection |
|-------|-----------|-------------------|
| EVM | EIP-712 + EIP-3009 | Random nonce + deadline |
| TON | Ed25519 | query_id |
| TRON | ECDSA secp256k1 | Protobuf nonce |
| Solana | Ed25519 | Blockhash + recent |

### Development Security Checklist

- [ ] Never hardcode private keys
- [ ] Load keys from environment or secret manager
- [ ] Always verify payment before serving resources
- [ ] Validate amount >= expected amount
- [ ] Check payTo matches your address
- [ ] Verify deadline is in the future

---

## Troubleshooting

### Common Issues

**pnpm lockfile mismatch:**
```bash
pnpm install --no-frozen-lockfile
```

**Go module not found:**
```bash
go clean -modcache
go mod download
```

**TypeScript build order:**
```bash
# @t402/core must build first
pnpm --filter @t402/core build
pnpm build
```

**Facilitator not deploying:**
1. Check Watchtower logs: `docker logs watchtower`
2. Verify image pushed: `docker pull ghcr.io/t402-io/facilitator:latest`
3. Manual restart: `docker-compose -f docker-compose.prod.yaml up -d`

### Health Checks

```bash
# Facilitator health
curl -s https://facilitator.t402.io/health | jq '.'

# Supported networks count
curl -s https://facilitator.t402.io/supported | jq '.kinds | length'

# Check specific network
curl -s https://facilitator.t402.io/supported | jq '.kinds[] | select(.network == "eip155:8453")'
```

---

## Skills

- `/pm` - Project Manager skill for release management, monitoring, and progress tracking

---

## Contributing

### Commit Convention

```
feat(evm): add support for zkSync Era
fix(core): handle null payment requirements
docs(readme): update installation instructions
chore(ci): add integration tests
```

### Code Standards

| SDK | Style | Validation |
|-----|-------|------------|
| TypeScript | Prettier + ESLint | Zod schemas |
| Go | gofmt + golangci-lint | Table-driven tests |
| Python | Ruff + Black | Pydantic |
| Java | Google Style | JUnit 5 |

### Testing Requirements

- All SDK changes require tests
- Integration tests for chain mechanisms
- Coverage tracked via Codecov
- Run tests before pushing: `pnpm test` / `go test ./...` / `uv run pytest` / `mvn test`

---

## AI Assistant Guidelines

### File Operations

- Read existing files before making changes
- Prefer editing existing files over creating new ones
- Use `workspace:*` for TypeScript internal dependencies
- Follow existing patterns in the codebase

### Common Tasks

| Task | Command |
|------|---------|
| Run TypeScript tests | `cd typescript && pnpm test` |
| Run Go tests | `cd go && go test ./...` |
| Build all packages | `cd typescript && pnpm build` |
| Check vulnerabilities | `govulncheck ./...` (Go) / `pnpm audit` (TS) |
| Deploy facilitator | Push to main, Watchtower auto-deploys |

### Package Dependency Graph (TypeScript)

```
@t402/core (foundation)
    ↓
@t402/evm-core (shared EVM utilities)
    ↓
@t402/evm, @t402/svm, @t402/ton, @t402/tron (mechanisms)
    ↓
@t402/wdk (wallet integration)
    ↓
@t402/wdk-gasless, @t402/wdk-bridge, @t402/wdk-multisig (advanced features)
    ↓
@t402/express, @t402/hono, etc. (HTTP middleware)
    ↓
@t402/paywall, @t402/react, @t402/vue (UI components)
```

### Key Files to Understand

| File | Purpose |
|------|---------|
| `specs/t402-specification-v2.md` | Protocol specification |
| `go/interfaces.go` | Core Go interfaces |
| `typescript/packages/core/src/types/` | TypeScript type definitions |
| `services/facilitator/internal/` | Facilitator implementation |
| `.github/workflows/` | CI/CD pipelines |

### Submodules

```bash
# Initialize submodules after cloning
git submodule update --init --recursive

# Update submodules to latest
git submodule update --remote
```

| Submodule | Repository | Description |
|-----------|------------|-------------|
| `typescript/site/` | t402-io/t402-site | Marketing website (t402.io) |
