# Contributing

t402 welcomes contributions of schemes, middleware, new chain support, and more. We aim to make t402 as secure and trusted as possible. Merging contributions is at the discretion of the t402 Foundation team, based on the risk of the contribution and the quality of implementation.

## Contents

- [Code of Conduct](#code-of-conduct)
- [Security](#security)
- [Repository Structure](#repository-structure)
- [Development Setup](#development-setup)
- [SDK Development Guides](#sdk-development-guides)
- [Contributing Workflow](#contributing-workflow)
- [Adding New Features](#adding-new-features)
- [Getting Help](#getting-help)

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you are expected to uphold this code. Please report unacceptable behavior to the maintainers.

## Security

**Do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability, please report it privately:

1. Go to the [Security Advisories](https://github.com/t402-io/t402/security/advisories/new) page
2. Click "Report a vulnerability"
3. Provide detailed information about the vulnerability

We take security seriously and will respond promptly to verified reports. See our [Security Policy](SECURITY.md) for more details.

## Repository Structure

```
t402/
├── typescript/              # TypeScript SDK (pnpm monorepo)
│   ├── packages/
│   │   ├── core/            # @t402/core
│   │   ├── extensions/      # @t402/extensions
│   │   ├── mechanisms/
│   │   │   ├── evm/         # @t402/evm
│   │   │   ├── svm/         # @t402/svm
│   │   │   ├── ton/         # @t402/ton
│   │   │   └── tron/        # @t402/tron
│   │   ├── http/
│   │   │   ├── express/     # @t402/express
│   │   │   ├── hono/        # @t402/hono
│   │   │   ├── fastify/     # @t402/fastify
│   │   │   ├── next/        # @t402/next
│   │   │   ├── fetch/       # @t402/fetch
│   │   │   ├── axios/       # @t402/axios
│   │   │   ├── paywall/     # @t402/paywall
│   │   │   ├── react/       # @t402/react
│   │   │   └── vue/         # @t402/vue
│   │   ├── wdk/             # @t402/wdk
│   │   ├── wdk-gasless/     # @t402/wdk-gasless
│   │   ├── wdk-bridge/      # @t402/wdk-bridge
│   │   ├── wdk-multisig/    # @t402/wdk-multisig
│   │   ├── mcp/             # @t402/mcp
│   │   └── cli/             # @t402/cli
│   └── turbo.json
├── go/                      # Go SDK
│   ├── mechanisms/
│   │   ├── evm/
│   │   ├── svm/
│   │   ├── ton/
│   │   └── tron/
│   ├── http/
│   └── cmd/t402/            # CLI tool
├── python/                  # Python SDK
│   └── t402/
│       └── src/t402/
├── java/                    # Java SDK
│   └── t402/
├── specs/                   # Protocol specifications
└── examples/                # Example implementations
```

## Development Setup

### Prerequisites

- **Node.js** 18+ (for TypeScript)
- **pnpm** 10+ (for TypeScript monorepo)
- **Go** 1.22+ (for Go SDK)
- **Python** 3.10+ with uv (for Python SDK)
- **Java** 21+ with Maven (for Java SDK)

### Quick Setup

```bash
# Clone the repository
git clone https://github.com/t402-io/t402.git
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
mvn install
```

## SDK Development Guides

### TypeScript SDK

The TypeScript SDK uses pnpm workspaces with Turborepo for monorepo management.

```bash
cd typescript

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Build specific package
pnpm --filter @t402/evm build

# Run tests
pnpm test

# Run tests for specific package
pnpm --filter @t402/core test

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Format code
pnpm format
```

**Package Development:**

```bash
# Create a new package
mkdir -p packages/my-package
cd packages/my-package

# Initialize with package.json (use existing packages as template)
```

**Key Files:**
- `packages/*/src/index.ts` - Main entry point
- `packages/*/package.json` - Package configuration
- `tsconfig.base.json` - Shared TypeScript config

### Go SDK

```bash
cd go

# Run tests
go test ./...

# Run tests with coverage
go test -cover ./...

# Run specific package tests
go test ./mechanisms/evm/...

# Run linter
golangci-lint run

# Build CLI
go build -o t402 ./cmd/t402
```

**Key Patterns:**
- Interfaces defined in root `types.go`
- Mechanism implementations in `mechanisms/`
- HTTP middleware in `http/`

### Python SDK

```bash
cd python/t402

# Install with uv
uv sync

# Run tests
uv run pytest

# Run tests with coverage
uv run pytest --cov=t402

# Type checking
uv run mypy src/t402

# Format code
uv run ruff format .

# Lint
uv run ruff check .
```

**Key Files:**
- `src/t402/__init__.py` - Main exports
- `src/t402/types.py` - Type definitions
- `src/t402/cli.py` - CLI implementation
- `pyproject.toml` - Project configuration

### Java SDK

```bash
cd java/t402

# Build
mvn clean install

# Run tests
mvn test

# Run checkstyle
mvn checkstyle:check

# Run SpotBugs
mvn spotbugs:check
```

## Contributing Workflow

### 1. Find or Create an Issue

Check existing issues before starting work. For larger features, open a discussion first.

### 2. Fork and Clone

Fork the repository and clone your fork locally.

### 3. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

### 4. Make Changes

- Follow the language-specific development guide above
- Write tests for new functionality
- Update documentation as needed
- Follow existing code patterns

### 5. Test

Run tests for the packages you modified:

```bash
# TypeScript
cd typescript && pnpm test

# Go
cd go && go test ./...

# Python
cd python/t402 && uv run pytest
```

### 6. Commit

All commits must be [signed](https://docs.github.com/en/authentication/managing-commit-signature-verification/signing-commits):

```bash
git config --global commit.gpgsign true
```

Use conventional commit messages:

```bash
feat(evm): add support for zkSync Era
fix(core): handle null payment requirements
docs(readme): update installation instructions
chore(ci): add integration tests
```

### 7. Submit PR

- Fill out the PR template completely
- Link related issues
- Ensure CI passes

## Adding New Features

### New Chain Support

1. Create mechanism implementation in the appropriate SDK
2. Implement required interfaces:
   - **TypeScript**: `SchemeNetworkClient`, `SchemeNetworkServer`, `SchemeNetworkFacilitator`
   - **Go**: `ClientScheme`, `ServerScheme`, `FacilitatorScheme`
   - **Python**: Implement in `src/t402/your_chain.py`
3. Add tests
4. Update documentation

### New Scheme

1. Propose scheme in `specs/schemes/` with a specification document
2. Discuss architecture in the PR
3. Once spec is approved, implement across SDKs
4. Add comprehensive tests

### New HTTP Framework Integration

1. Follow patterns from existing middleware (express, hono, etc.)
2. Implement request/response handling
3. Add tests
4. Add example usage in `examples/`

### Paywall Changes

If modifying paywall source files in TypeScript:

```bash
cd typescript && pnpm --filter @t402/paywall build:paywall
```

This generates template files for all SDKs. Commit the generated files with your PR.

## Code Standards

### TypeScript
- Use TypeScript strict mode
- Export types explicitly
- Use Zod for runtime validation
- Follow existing patterns for package structure

### Go
- Follow effective Go guidelines
- Use interfaces for abstraction
- Add godoc comments for exported functions
- Use table-driven tests

### Python
- Use type hints throughout
- Follow PEP 8 style guide
- Use Pydantic for data validation
- Add docstrings for public functions

### Java
- Follow Google Java Style Guide
- Use records for immutable data
- Add Javadoc for public APIs
- Use JUnit 5 for tests

## Getting Help

- Search existing issues
- Check the language-specific development guides above
- Open a new issue with questions
- Join community discussions
