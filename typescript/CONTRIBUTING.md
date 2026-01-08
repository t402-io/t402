# TypeScript SDK Contributing Guide

Guide for developing and contributing to the t402 TypeScript SDK.

## Contents

- [Repository Structure](#repository-structure)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Adding Features](#adding-features)
- [Testing](#testing)
- [Code Quality](#code-quality)

## Repository Structure

The TypeScript SDK is a pnpm workspace managed with Turborepo.

```
typescript/
├── packages/
│   ├── core/              # @t402/core - Protocol implementation
│   ├── mechanisms/
│   │   ├── evm/           # @t402/evm - Ethereum/EVM chains
│   │   └── svm/           # @t402/svm - Solana
│   ├── http/
│   │   ├── axios/         # @t402/axios - Axios interceptor
│   │   ├── express/       # @t402/express - Express middleware
│   │   ├── fetch/         # @t402/fetch - Fetch wrapper
│   │   ├── hono/          # @t402/hono - Hono middleware
│   │   ├── next/          # @t402/next - Next.js integration
│   │   └── paywall/       # @t402/paywall - Browser paywall UI
│   ├── extensions/        # @t402/extensions - Bazaar, Sign-in-with-x
│   └── legacy/            # Legacy v1 packages (deprecated)
├── site/                  # t402.org marketing site
├── turbo.json
└── pnpm-workspace.yaml
```

### Package Dependencies

```
@t402/core
    ↑
@t402/evm, @t402/svm
    ↑
@t402/express, @t402/hono, @t402/next, @t402/axios, @t402/fetch
```

The core package provides transport-agnostic primitives. Mechanism packages (`evm`, `svm`) implement chain-specific logic. HTTP packages provide framework integrations.

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 10.7.0

### Installation

```bash
cd typescript
pnpm install
```

### Build

```bash
# Build all packages
pnpm build

# Build a specific package
pnpm --filter @t402/core build
```

## Development Workflow

### Watch Mode

For active development, use watch mode in the package you're working on:

```bash
cd packages/core
pnpm test:watch
```

### Common Commands

From the `typescript/` directory:

| Command | Description |
|---------|-------------|
| `pnpm build` | Build all packages |
| `pnpm test` | Run unit tests |
| `pnpm test:integration` | Run integration tests |
| `pnpm lint` | Lint and fix |
| `pnpm lint:check` | Check linting (CI) |
| `pnpm format` | Format code |
| `pnpm format:check` | Check formatting (CI) |

### Working on a Single Package

```bash
cd packages/mechanisms/evm
pnpm build
pnpm test
pnpm test:watch  # Watch mode
```

## Adding Features

### Adding HTTP Middleware

To add a new HTTP framework integration:

1. Create a new package in `packages/http/`:

```bash
mkdir -p packages/http/your-framework
cd packages/http/your-framework
```

2. Create `package.json`:

```json
{
  "name": "@t402/your-framework",
  "version": "0.1.0",
  "main": "./dist/cjs/index.js",
  "module": "./dist/esm/index.js",
  "types": "./dist/cjs/index.d.ts",
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint . --ext .ts --fix",
    "lint:check": "eslint . --ext .ts",
    "format": "prettier -c .prettierrc --write \"**/*.{ts,js,cjs,json,md}\"",
    "format:check": "prettier -c .prettierrc --check \"**/*.{ts,js,cjs,json,md}\""
  },
  "dependencies": {
    "@t402/core": "workspace:*"
  }
}
```

3. Copy `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, and `eslint.config.js` from an existing HTTP package.

4. Implement the adapter pattern. See `packages/http/express/src/adapter.ts` for reference.

### Adding a New Chain Mechanism

See [New Chains](../CONTRIBUTING.md#new-chains) in the root contributing guide for protocol-level requirements and interface definitions.

To add support for a new blockchain in TypeScript:

1. Create a new package in `packages/mechanisms/`:

```bash
mkdir -p packages/mechanisms/your-chain
```

2. Implement the required interfaces from `@t402/core`:
   - `SchemeNetworkClient` - Signs payment payloads
   - `SchemeNetworkServer` - Validates payment requirements
   - `SchemeNetworkFacilitator` - Verifies and settles payments

3. Export registration helpers:

```typescript
// src/exact/client/register.ts
export function registerExactYourChainScheme(
  client: t402Client,
  config: { signer: YourChainSigner; networks?: Network | Network[] }
) {
  const networks = config.networks ?? 'yourchain:*';
  const scheme = new ExactYourChainScheme(config.signer);
  // ... register with client
}
```

4. Follow the existing `@t402/evm` or `@t402/svm` package structure.

### Adding Extensions

Extensions go in `packages/extensions/`. Each extension should:

1. Have its own subdirectory in `src/`
2. Export from the package's main `index.ts`
3. Include a README documenting usage

## Testing

### Unit Tests

```bash
# All packages
pnpm test

# Single package
pnpm --filter @t402/evm test

# Watch mode
cd packages/mechanisms/evm
pnpm test:watch
```

### Integration Tests

Integration tests require network access and may use testnets:

```bash
pnpm test:integration
```

Or for a specific package:

```bash
pnpm --filter @t402/evm test:integration
```

### Test File Organization

```
packages/core/
├── src/
└── test/
    ├── unit/           # Unit tests
    ├── integrations/   # Integration tests
    └── mocks/          # Shared test utilities
```

## Code Quality

### Linting

ESLint with TypeScript rules:

```bash
# Fix issues
pnpm lint

# Check only (for CI)
pnpm lint:check
```

### Formatting

Prettier handles formatting:

```bash
# Format files
pnpm format

# Check formatting (for CI)
pnpm format:check
```

### TypeScript

- Strict mode enabled
- Export types alongside implementations
- Use Zod for runtime validation of external data

## Paywall Changes

The paywall package (`packages/http/paywall/`) contains browser-rendered UI components. See [Paywall Changes](../CONTRIBUTING.md#paywall-changes) in the root contributing guide for build instructions and generated file locations.

## Examples

Examples live in `examples/typescript/`. When adding a new example:

1. Create a directory under the appropriate category
2. Add a `package.json` with the example's dependencies
3. Add a `README.md` with setup and run instructions
4. The example will be included in the workspace automatically via `pnpm-workspace.yaml`

## Publishing

Package publishing is handled by maintainers. Version bumps follow semver:

- Patch: Bug fixes, no API changes
- Minor: New features, backward compatible
- Major: Breaking changes

## Getting Help

- Open an issue on GitHub
- Join the discussion in existing issues
- Check the [examples](../examples/typescript/) for usage patterns

