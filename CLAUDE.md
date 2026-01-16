# T402 Project Context

## Overview

T402 is an open-source HTTP-native payment protocol for USDT/USDT0 stablecoins. It enables web services to require cryptocurrency payments without intermediaries.

## Project Structure

```
t402/
├── typescript/          # TypeScript SDK (21 npm packages @t402/*)
├── python/              # Python SDK (PyPI: t402)
├── go/                  # Go SDK (github.com/t402-io/t402/go)
├── java/                # Java SDK (Maven: io.t402:t402)
├── services/facilitator/  # Facilitator service (Go)
├── docs/                # Documentation site (Nextra)
├── specs/               # Protocol specifications
├── .github/workflows/   # CI/CD pipelines
├── ROADMAP.md           # Long-term roadmap
└── SECURITY.md          # Security policy
```

## Key URLs

| Service | URL |
|---------|-----|
| Facilitator API | https://facilitator.t402.io |
| Documentation | https://docs.t402.io |
| Website | https://t402.io |
| Grafana | https://grafana.facilitator.t402.io |

## SDK Versions

| SDK | Version | Registry |
|-----|---------|----------|
| TypeScript | 2.0.0 | npm (@t402/*) |
| Python | 1.7.1 | PyPI |
| Go | 1.5.0 | Go Modules |
| Java | 1.1.0 | Maven Central |

## Release Tags

- TypeScript: `v*` (e.g., `v2.1.0`)
- Python: `python/v*` (e.g., `python/v1.7.1`)
- Go: `go/v*` (e.g., `go/v1.5.0`)
- Java: `java/v*` (e.g., `java/v1.1.0`)

## Facilitator Wallets

| Chain | Address |
|-------|---------|
| EVM (all) | `0xC88f67e776f16DcFBf42e6bDda1B82604448899B` |
| Solana | `8GGtWHRQ1wz5gDKE2KXZLktqzcfV1CBqSbeUZjA7hoWL` |
| TRON | `TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5` |

## Skills

- `/pm` - Project Manager skill for release management, monitoring, and progress tracking

## Common Tasks

### Check Service Status
```bash
curl -s https://facilitator.t402.io/health | jq '.'
curl -s https://facilitator.t402.io/supported | jq '.kinds | length'
```

### Release SDK
```bash
# TypeScript
git tag v2.1.0 && git push origin v2.1.0

# Python
git tag python/v1.7.1 && git push origin python/v1.7.1

# Go
git tag go/v1.5.0 && git push origin go/v1.5.0

# Java
git tag java/v1.1.0 && git push origin java/v1.1.0
```

### Check Wallet Balances
```bash
# Use /pm wallet command
```

## Development Guidelines

1. All SDK changes should include tests
2. Use conventional commits (feat, fix, chore, docs)
3. Update CHANGELOG.md for user-facing changes
4. Run tests before pushing: `pnpm test` (TS), `pytest` (Python), `go test` (Go), `mvn test` (Java)
