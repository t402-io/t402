# T402 Migration Guide

> Complete guide for migrating t402 to t402

---

## Overview

This document outlines the complete migration process from t402 to t402, including:
- Repository migration
- Global renaming
- Package restructuring
- CI/CD reconfiguration

---

## Migration Scope

### Files to Modify

| Category | Count | Complexity |
|----------|-------|------------|
| package.json files | 89 | Medium |
| Files containing "t402" | 697 | High |
| Files containing "@t402" | 133 | Medium |
| npm package names | ~20 | High (republish) |
| Go module path | 1 | Medium |
| Python package name | 1 | Medium |
| Java package name | 1 | Medium |

### Renaming Map

```
Old Name                      →    New Name
───────────────────────────────────────────────────────
t402                          →    t402
X402                          →    T402
@t402/core                    →    @t402/core
@t402/evm                     →    @t402/evm
@t402/svm                     →    @t402/svm
@t402/express                 →    @t402/express
@t402/fetch                   →    @t402/fetch
@t402/axios                   →    @t402/axios
@t402/hono                    →    @t402/hono
@t402/next                    →    @t402/next
@t402/paywall                 →    @t402/paywall
@t402/extensions              →    @t402/extensions
t402-express                  →    t402-express (legacy)
t402-fetch                    →    t402-fetch (legacy)
github.com/coinbase/t402      →    github.com/awesome-doge/t402
pip install t402              →    pip install t402
com.coinbase.t402             →    io.t402.sdk
```

### Items to Preserve

- HTTP 402 status code references (protocol standard)
- EIP-3009 specifications
- Core protocol logic

---

## Step-by-Step Migration

### Step 1: Repository Setup

```bash
# 1. Create new private repository
gh repo create awesome-doge/t402 --private

# 2. Clone original t402
git clone https://github.com/coinbase/t402.git t402-migration
cd t402-migration

# 3. Remove original remote
git remote remove origin

# 4. Add new remote
git remote add origin git@github.com:awesome-doge/t402.git

# 5. Push to new repository
git push -u origin main
```

### Step 2: Global Text Replacement

Run the migration script (see scripts/migrate.sh):

```bash
# Automated replacement
./t402-reserve/scripts/migrate.sh
```

Manual verification checklist:
- [ ] All package.json names updated
- [ ] All import statements updated
- [ ] All documentation updated
- [ ] All test files updated
- [ ] All example files updated

### Step 3: Package Structure Updates

#### TypeScript Packages

```
typescript/packages/
├── core/                 # @t402/core
├── mechanisms/
│   ├── evm/              # @t402/evm
│   └── svm/              # @t402/svm
├── http/
│   ├── express/          # @t402/express
│   ├── hono/             # @t402/hono
│   ├── next/             # @t402/next
│   ├── fetch/            # @t402/fetch
│   ├── axios/            # @t402/axios
│   └── paywall/          # @t402/paywall
├── extensions/           # @t402/extensions
├── wdk/                  # @t402/wdk (NEW)
└── legacy/               # Legacy compatibility
```

#### New Package: @t402/wdk

```json
{
  "name": "@t402/wdk",
  "version": "1.0.0",
  "description": "T402 Tether WDK Integration",
  "dependencies": {
    "@tetherto/wdk": "^1.0.0",
    "@tetherto/wdk-wallet-evm": "^1.0.0",
    "@tetherto/wdk-wallet-btc": "^1.0.0",
    "@tetherto/wdk-protocol-bridge-usdt0-evm": "^1.0.0"
  }
}
```

### Step 4: Go Module Migration

```go
// go.mod
module github.com/awesome-doge/t402/go

// Update all imports
// Old: github.com/coinbase/t402/go
// New: github.com/awesome-doge/t402/go
```

### Step 5: Python Package Migration

```toml
# pyproject.toml
[project]
name = "t402"
version = "1.0.0"
description = "T402 Payment Protocol - Tether First"
```

### Step 6: Java Package Migration

```xml
<!-- pom.xml -->
<groupId>io.t402</groupId>
<artifactId>t402-sdk</artifactId>
<version>1.0.0</version>
```

### Step 7: CI/CD Updates

Update all GitHub Actions workflows:
- Rename workflow files
- Update npm package names
- Update registry configurations

### Step 8: Documentation Updates

- [ ] README.md - Complete rewrite
- [ ] CONTRIBUTING.md - Update guidelines
- [ ] All specs/*.md - Update references
- [ ] Website content - New branding

---

## Verification Checklist

### Build Verification
- [ ] `pnpm install` succeeds
- [ ] `pnpm build` succeeds
- [ ] `pnpm test` passes
- [ ] Go tests pass
- [ ] Python tests pass
- [ ] Java tests pass

### Integration Verification
- [ ] Example apps work
- [ ] E2E tests pass
- [ ] Documentation links work

---

## Rollback Plan

If migration fails:
1. Do not push to production
2. Keep original t402 fork as backup
3. Document issues encountered
4. Iterate on migration scripts

---

## Post-Migration Tasks

1. Set up new npm organization (@t402)
2. Configure PyPI package (t402)
3. Update Go module proxy
4. Set up documentation site
5. Configure security scanning
