# Releasing T402 Packages

This document describes how to release T402 packages across different platforms.

## Prerequisites

### Required Secrets

Configure these secrets in your GitHub repository settings:

| Secret | Description | Required For |
|--------|-------------|--------------|
| `NPM_TOKEN` | npm automation token with publish access | TypeScript packages |
| `PYPI_API_TOKEN` | PyPI API token (or use Trusted Publisher) | Python package |

### Setting Up NPM Token

1. Go to [npmjs.com](https://www.npmjs.com/) → Account Settings → Access Tokens
2. Generate a new **Granular Access Token**:
   - Token name: `github-actions`
   - Expiration: Choose appropriate duration
   - Packages: Select `@t402/*` scope
   - Permissions: **Read and write**
3. Add the token as `NPM_TOKEN` secret in GitHub repository settings

### Setting Up PyPI (Trusted Publisher - Recommended)

1. Go to [pypi.org](https://pypi.org/) → Your projects → t402 → Publishing
2. Add a new trusted publisher:
   - Owner: `t402-io`
   - Repository: `t402`
   - Workflow: `python_release.yml`
   - Environment: `pypi`

---

## TypeScript Packages (@t402/*)

### All Packages (21 total)

| Package | Path | Description |
|---------|------|-------------|
| `@t402/core` | `packages/core` | Core types and abstractions |
| `@t402/extensions` | `packages/extensions` | Bazaar, Sign-In-With-X |
| `@t402/evm` | `packages/mechanisms/evm` | EVM mechanisms |
| `@t402/svm` | `packages/mechanisms/svm` | Solana mechanisms |
| `@t402/ton` | `packages/mechanisms/ton` | TON mechanisms |
| `@t402/tron` | `packages/mechanisms/tron` | TRON mechanisms |
| `@t402/express` | `packages/http/express` | Express middleware |
| `@t402/hono` | `packages/http/hono` | Hono middleware |
| `@t402/fastify` | `packages/http/fastify` | Fastify middleware |
| `@t402/next` | `packages/http/next` | Next.js integration |
| `@t402/fetch` | `packages/http/fetch` | Fetch wrapper |
| `@t402/axios` | `packages/http/axios` | Axios interceptor |
| `@t402/paywall` | `packages/http/paywall` | Payment wall UI |
| `@t402/react` | `packages/http/react` | React components |
| `@t402/vue` | `packages/http/vue` | Vue components |
| `@t402/wdk` | `packages/wdk` | Tether WDK integration |
| `@t402/wdk-gasless` | `packages/wdk-gasless` | ERC-4337 gasless |
| `@t402/wdk-bridge` | `packages/wdk-bridge` | Cross-chain bridge |
| `@t402/wdk-multisig` | `packages/wdk-multisig` | Safe multi-sig |
| `@t402/mcp` | `packages/mcp` | AI agent MCP server |
| `@t402/cli` | `packages/cli` | CLI tools |

### Using Changesets (Recommended)

We use [Changesets](https://github.com/changesets/changesets) for version management:

```bash
cd typescript

# 1. Create a changeset when making changes
pnpm changeset

# 2. Select packages that changed
# 3. Choose semver bump (patch/minor/major)
# 4. Write a summary of changes

# The changeset file will be committed with your PR
```

**Automated Release:**

When PRs with changesets are merged to main:
1. A "Version Packages" PR is automatically created
2. Merging that PR triggers npm publish for all changed packages

**Package Groups:**
- **Fixed** (version together): `@t402/core`, `@t402/evm`, `@t402/svm`, `@t402/ton`, `@t402/tron`
- **Linked** (version together when any changes): `@t402/wdk`, `@t402/wdk-*`

### Manual Release (Tag-based)

1. Update version in the package's `package.json`
2. Commit changes: `git commit -m "chore: bump @t402/xxx to x.y.z"`
3. Create and push a tag:
   ```bash
   git tag v2.1.0
   git push origin v2.1.0
   ```
4. GitHub Actions will automatically publish all packages

### Manual Release (Workflow Dispatch)

1. Go to Actions → NPM Release → Run workflow
2. Select package to publish (or "all")
3. Optionally enable dry run to preview

### Release Order

Packages are published in dependency order automatically:

1. `@t402/core` - No dependencies
2. `@t402/evm`, `@t402/svm`, `@t402/ton`, `@t402/tron` - Depend on core
3. `@t402/extensions`, `@t402/wdk` - Depend on core, mechanisms
4. `@t402/express`, `@t402/hono`, etc. - Depend on core
5. `@t402/wdk-gasless`, `@t402/wdk-bridge` - Depend on wdk, evm
6. `@t402/mcp`, `@t402/cli` - Top-level tools

---

## Go SDK

### Automatic Release

1. Update version in code if needed
2. Create and push a tag with `go/` prefix:
   ```bash
   git tag go/v2.1.0
   git push origin go/v2.1.0
   ```
3. GitHub Actions will:
   - Run tests across Go 1.22, 1.23, 1.24
   - Run linting
   - Create GitHub Release

### Manual Installation

Users can install specific versions:

```bash
go get github.com/t402-io/t402/go@v2.1.0
```

### CLI Tool

```bash
go install github.com/t402-io/t402/go/cmd/t402@v2.1.0
```

---

## Python SDK

### Automatic Release

1. Update version in `python/t402/pyproject.toml`
2. Commit changes
3. Create and push a tag with `python/` prefix:
   ```bash
   git tag python/v1.5.0
   git push origin python/v1.5.0
   ```
4. GitHub Actions will:
   - Run tests across Python 3.10, 3.11, 3.12
   - Build wheel and sdist
   - Publish to PyPI
   - Create GitHub Release

### Manual Release

Use workflow dispatch for testing:

1. Go to Actions → Python Release → Run workflow
2. Enable dry run to test without publishing

---

## Java SDK

### Automatic Release (Coming Soon)

1. Update version in `java/t402/pom.xml`
2. Create and push a tag with `java/` prefix:
   ```bash
   git tag java/v1.0.0
   git push origin java/v1.0.0
   ```

### Maven Central

Java packages will be published to Maven Central when the Java SDK is production-ready.

---

## Release Checklist

Before releasing:

- [ ] All tests pass locally
- [ ] CHANGELOG.md updated (or changesets created)
- [ ] Version bumped in appropriate files
- [ ] No uncommitted changes
- [ ] Main branch is up to date

### Creating a Coordinated Release

```bash
# 1. Ensure you're on main and up to date
git checkout main
git pull origin main

# 2. Run tests for all SDKs
cd typescript && pnpm test
cd ../go && go test ./...
cd ../python/t402 && uv run pytest

# 3. For TypeScript, use changesets
cd typescript
pnpm changeset
# Follow prompts to create changeset

# 4. Commit and push
git add -A
git commit -m "chore: prepare release"
git push origin main

# 5. For Go/Python, create tags
git tag go/v2.1.0
git tag python/v1.5.0
git push origin --tags
```

---

## CI/CD Workflows

| Workflow | Trigger | Description |
|----------|---------|-------------|
| `npm_release.yml` | `v*` tags, manual | Publishes all 21 TypeScript packages to npm |
| `changeset_release.yml` | Push to main | Creates version PRs, publishes on merge |
| `go_release.yml` | `go/v*` tags, PRs | Tests Go and creates releases |
| `python_release.yml` | `python/v*` tags, PRs | Publishes Python package to PyPI |
| `unit_tests.yml` | PRs, push to main | Runs tests for all SDKs |
| `integration_tests.yml` | PRs, push to main, daily | Runs cross-chain integration tests |
| `check_lint.yml` | PRs | Lints TypeScript code |
| `check_format.yml` | PRs | Checks code formatting |

---

## Troubleshooting

### npm publish fails with EOTP

The npm token requires OTP. Create a new **Granular Access Token** which bypasses 2FA for automation.

### npm publish fails with 403

- Check if the version already exists
- Verify npm token has publish permissions for `@t402/*` scope
- Ensure token hasn't expired

### PyPI publish fails

- Check Trusted Publisher configuration matches workflow file
- Verify environment name is `pypi`
- Check if version already exists on PyPI

### Go module not updating

Go modules are cached by the proxy. Wait 5-10 minutes or use:

```bash
GOPROXY=direct go get github.com/t402-io/t402/go@v2.1.0
```

### Changeset PR not created

- Ensure `.changeset/config.json` is properly configured
- Check that changeset files exist in the PR
- Verify GitHub token has write permissions

---

## Version Conventions

| SDK | Format | Example |
|-----|--------|---------|
| TypeScript | `vX.Y.Z` | `v2.1.0` |
| Go | `go/vX.Y.Z` | `go/v2.1.0` |
| Python | `python/vX.Y.Z` | `python/v1.5.0` |
| Java | `java/vX.Y.Z` | `java/v1.0.0` |

Semantic versioning:
- **MAJOR**: Breaking changes
- **MINOR**: New features, backwards compatible
- **PATCH**: Bug fixes, backwards compatible
