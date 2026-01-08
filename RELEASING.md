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
   - Owner: `t402-io` (or your org)
   - Repository: `t402`
   - Workflow: `python_release.yml`
   - Environment: `pypi`

---

## TypeScript Packages (@t402/*)

### Automatic Release (Recommended)

1. Update version in the package's `package.json`
2. Commit changes: `git commit -m "chore: bump @t402/xxx to x.y.z"`
3. Create and push a tag:
   ```bash
   git tag v2.1.0
   git push origin v2.1.0
   ```
4. GitHub Actions will automatically:
   - Run tests
   - Build all packages
   - Publish to npm

### Manual Release

Use the workflow dispatch:

1. Go to Actions → NPM Release → Run workflow
2. Select package to publish (or "all")
3. Optionally enable dry run to preview

### Release Order

Packages must be published in dependency order:

1. `@t402/core` - No dependencies
2. `@t402/evm` - Depends on core
3. `@t402/svm` - Depends on core
4. `@t402/ton` - Depends on core
5. `@t402/wdk` - Depends on core, evm
6. `@t402/extensions` - Depends on core
7. `@t402/http` - Depends on core

### Version Bumping

```bash
# In the package directory
cd typescript/packages/core

# Bump patch version (2.0.0 → 2.0.1)
npm version patch --no-git-tag-version

# Bump minor version (2.0.0 → 2.1.0)
npm version minor --no-git-tag-version

# Bump major version (2.0.0 → 3.0.0)
npm version major --no-git-tag-version
```

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

---

## Python SDK

### Automatic Release

1. Update version in `python/t402/pyproject.toml`
2. Commit changes
3. Create and push a tag with `python/` prefix:
   ```bash
   git tag python/v1.1.0
   git push origin python/v1.1.0
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

## Release Checklist

Before releasing:

- [ ] All tests pass locally
- [ ] CHANGELOG.md updated (if exists)
- [ ] Version bumped in appropriate files
- [ ] No uncommitted changes
- [ ] Main branch is up to date

### Creating a Release

```bash
# 1. Ensure you're on main and up to date
git checkout main
git pull origin main

# 2. Run tests
cd typescript && pnpm test
cd ../go && go test ./...
cd ../python/t402 && uv run pytest

# 3. Bump versions (example for TypeScript)
cd typescript/packages/core
npm version minor --no-git-tag-version
cd ../mechanisms/evm
npm version minor --no-git-tag-version
# ... repeat for other packages

# 4. Commit version bumps
git add -A
git commit -m "chore: bump versions for v2.1.0 release"

# 5. Create and push tag
git tag v2.1.0
git push origin main
git push origin v2.1.0
```

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

---

## CI/CD Workflows

| Workflow | Trigger | Description |
|----------|---------|-------------|
| `npm_release.yml` | `v*` tags, manual | Publishes TypeScript packages to npm |
| `go_release.yml` | `go/v*` tags, PRs | Tests Go and creates releases |
| `python_release.yml` | `python/v*` tags, PRs | Publishes Python package to PyPI |
| `unit_tests.yml` | PRs | Runs TypeScript tests |
| `check_lint.yml` | PRs | Lints TypeScript code |
| `check_format.yml` | PRs | Checks code formatting |
