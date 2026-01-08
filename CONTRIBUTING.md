# Contributing

t402 welcomes contributions of schemes, middleware, new chain support, and more. We aim to make t402 as secure and trusted as possible. Merging contributions is at the discretion of the t402 Foundation team, based on the risk of the contribution and the quality of implementation.

## Contents

- [Repository Structure](#repository-structure)
- [Language-Specific Guides](#language-specific-guides)
- [Contributing Workflow](#contributing-workflow)
- [Commit Signing](#commit-signing)
- [Getting Help](#getting-help)

## Repository Structure

The t402 repository contains implementations in multiple languages plus protocol specifications.

```
t402/
├── typescript/          # TypeScript SDK (pnpm monorepo)
├── python/              # Python SDK
├── go/                  # Go SDK
├── java/                # Java SDK
├── specs/               # Protocol specifications
└── examples/            # Example implementations
    ├── typescript/
    ├── python/
    └── go/
```

## Language-Specific Guides

For setup instructions, development workflow, and contribution patterns for each SDK:

- [TypeScript Development Guide](typescript/CONTRIBUTING.md)
- [Python Development Guide](python/CONTRIBUTING.md)
- [Go Development Guide](go/CONTRIBUTING.md)
- [Specifications Guide](specs/CONTRIBUTING.md)

## Contributing Workflow

### 1. Find or Create an Issue

Check existing issues before starting work. For larger features, open a discussion first.

### 2. Fork and Clone

Fork the repository and clone your fork locally.

### 3. Create a Branch

```bash
git checkout -b feature/your-feature-name
```

### 4. Make Changes

- Follow the language-specific development guide
- Write tests for new functionality
- Update documentation as needed

### 5. Test

Run tests for the packages you modified:

```bash
# TypeScript
cd typescript && pnpm test

# Python
cd python/t402 && uv run pytest

# Go
cd go && make test
```

### 6. Submit PR

- Fill out the PR template completely
- Link related issues
- Ensure CI passes

## Commit Signing

All commits must be [signed](https://docs.github.com/en/authentication/managing-commit-signature-verification/signing-commits). Configure commit signing before submitting:

```bash
git config --global commit.gpgsign true
```

## Paywall Changes

The paywall is a browser UI component that exists across TypeScript, Go, and Python. If you modify paywall source files in TypeScript:

```bash
cd typescript && pnpm --filter @t402/paywall build:paywall
```

This generates template files in:
- `typescript/packages/http/paywall/src/evm/gen/template.ts`
- `typescript/packages/http/paywall/src/svm/gen/template.ts`
- `go/http/evm_paywall_template.go`
- `go/http/svm_paywall_template.go`
- `python/t402/src/t402/evm_paywall_template.py`
- `python/t402/src/t402/svm_paywall_template.py`

Commit the generated files with your PR.

## New Schemes

Schemes dictate how funds are moved from client to server. New schemes require thorough review by the t402 Foundation team.

Recommended approach:

1. Propose a scheme by opening a PR with a spec in `specs/schemes/`
2. Discuss the architecture and purpose in that PR
3. Once the spec is merged, proceed to implementation

See [specs/CONTRIBUTING.md](specs/CONTRIBUTING.md) for spec writing guidelines.

## New Chains

t402 aims to be chain-agnostic. New chain implementations are welcome.

Because different chains have different best practices, a scheme may have a different mechanism on a new chain than it does on EVM. If the scheme mechanism varies from the reference implementation, the t402 Foundation will re-audit the scheme for that chain before accepting.

### Required Interfaces

Each language SDK defines interfaces that chain mechanisms must implement:

**TypeScript** (`@t402/core`):
- `SchemeNetworkClient` - Signs payment payloads
- `SchemeNetworkServer` - Validates payment requirements  
- `SchemeNetworkFacilitator` - Verifies and settles payments

**Go** (`github.com/coinbase/t402/go`):
- `ClientScheme` - Signs payment payloads
- `ServerScheme` - Validates payment requirements
- `FacilitatorScheme` - Verifies and settles payments

**Python** (`t402`):
- Implement signing in `src/t402/your_chain.py`
- Integrate with the base client in `src/t402/clients/base.py`

See the language-specific guides for detailed implementation patterns.

## Middleware and HTTP Integrations

HTTP middleware packages should:

- Follow best practices for the target framework
- Include tests
- Follow t402 client/server patterns from existing middleware

## Examples

Examples for each SDK live in `examples/`:

```
examples/
├── typescript/    # TypeScript examples
├── python/        # Python examples
└── go/            # Go examples
```

When adding a new example, follow the patterns in the language-specific guide.

## Getting Help

- Search existing issues
- Open a new issue with questions
- Check the language-specific guides for common patterns
