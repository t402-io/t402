# T402 SDK Development Plan

## Executive Summary

### Current State Overview

| SDK | Version | Registry Status | Core Features | CLI | Tests | Docs |
|-----|---------|-----------------|---------------|-----|-------|------|
| **TypeScript** | v2.0.0 | npm: 21 packages ✅ | Complete (reference impl) | @t402/cli | 669 files | ✅ |
| **Python** | v1.5.3 | PyPI: t402 ✅ | Complete (EVM, TON, TRON, ERC-4337, WDK) | Built-in | 13 files | ✅ |
| **Go** | v1.3.1 | Go Modules ✅ | Complete (EVM, TON, TRON, SVM) | cmd/t402 | 33 files | ✅ |
| **Java** | 1.0.0-SNAPSHOT | **Not published** ❌ | Complete (EVM, SVM, TON, TRON, ERC-4337, WDK, Bridge) | T402Cli | 35+ files | ⚠️ |

---

## 1. Gap Analysis: Feature Matrix

| Feature | TypeScript | Python | Go | Java |
|---------|------------|--------|-----|------|
| Core Client | ✅ | ✅ | ✅ | ✅ |
| Core Server | ✅ | ✅ | ✅ | ✅ |
| Facilitator | ✅ | ✅ | ✅ | ✅ |
| EVM Mechanism | ✅ | ✅ | ✅ | ✅ |
| SVM Mechanism | ✅ | ⚠️ Partial | ✅ | ✅ |
| TON Mechanism | ✅ | ✅ | ✅ | ✅ |
| TRON Mechanism | ✅ | ✅ | ✅ | ✅ |
| ERC-4337 | ✅ | ✅ | ✅ | ✅ |
| USDT0 Bridge | ✅ | ⚠️ Partial | ✅ | ✅ |
| WDK Integration | ✅ | ✅ | ✅ | ✅ |
| MCP Server | ✅ | ✅ | ✅ | ❌ |
| CLI Tool | ✅ | ✅ | ✅ | ✅ |
| Framework Integration | Express/Hono/Next/Fastify | FastAPI/Flask | Gin | ⚠️ Spring Boot |

---

## 2. Development Tasks by SDK

### 2.1 Java SDK (Priority: HIGH - Publishing)

**Current Status:**
- ✅ Package renamed to `io.t402`
- ✅ All blockchain mechanisms implemented
- ❌ Not published to Maven Central (needs secrets configuration)
- ⚠️ Spring Boot integration partial

**Tasks:**

| # | Task | Files | Priority | Status |
|---|------|-------|----------|--------|
| 1 | Rename package to `io.t402` | `java/src/main/java/io/t402/**` | Critical | ✅ Done |
| 2 | Update pom.xml groupId | `java/pom.xml` | Critical | ✅ Done |
| 3 | Implement EVM signer with Web3j | `java/.../crypto/EvmSigner.java` | Critical | ✅ Done |
| 4 | Implement SVM signer | `java/.../crypto/SvmSigner.java` | Critical | ✅ Done |
| 5 | Add TON mechanism | `java/.../crypto/TonSigner.java` | Medium | ✅ Done |
| 6 | Add TRON mechanism | `java/.../crypto/TronSigner.java` | Medium | ✅ Done |
| 7 | Add ERC-4337 support | `java/.../erc4337/` | High | ✅ Done |
| 8 | Add USDT0 Bridge | `java/.../bridge/` | Medium | ✅ Done |
| 9 | Add WDK integration | `java/.../wdk/` | Medium | ✅ Done |
| 10 | Add CLI tool | `java/.../cli/T402Cli.java` | Low | ✅ Done |
| 11 | Add Spring Boot starter | `java/.../spring/T402AutoConfiguration.java` | High | ⏳ Pending |
| 12 | Add Maven Central workflow | `.github/workflows/java_release.yml` | High | ⏳ Pending |
| 13 | Configure Maven secrets | GitHub Secrets | Critical | ⏳ Pending |
| 14 | Publish v1.0.0 | Maven Central | Critical | ⏳ Pending |

### 2.2 Python SDK (Priority: Low)

| # | Task | Files | Priority | Status |
|---|------|-------|----------|--------|
| 1 | Complete SVM mechanism | `python/t402/src/t402/svm.py` | High | ✅ Done |
| 2 | Implement MCP server | `python/t402/src/t402/mcp/` | Medium | ✅ Done |
| 3 | Complete USDT0 Bridge tests | `python/t402/tests/test_bridge.py` | Medium | ✅ Done |
| 4 | Add pytest-cov to CI | `.github/workflows/python_release.yml` | High | ⏳ Pending |

### 2.3 Go SDK (Priority: Low)

| # | Task | Files | Priority | Status |
|---|------|-------|----------|--------|
| 1 | Add WDK package | `go/wdk/` | Medium | ✅ Done |
| 2 | Add MCP server | `go/mcp/` | Medium | ✅ Done |
| 3 | Add MCP CLI | `go/cmd/t402-mcp/` | Medium | ✅ Done |
| 4 | Improve test coverage | `go/*_test.go` | High | ✅ Done |

### 2.4 TypeScript SDK (Priority: Low)

Already complete. Minor improvements:
- Add WDK integration tests
- Add MCP server tests
- Generate TypeDoc API docs

---

## 3. CI/CD Updates

### Current Workflows

| Workflow | Status |
|----------|--------|
| `npm_release.yml` | ✅ Complete |
| `python_release.yml` | ✅ Complete |
| `go_release.yml` | ✅ Complete |
| `java_release.yml` | ❌ Missing |

### Required: Java Release Workflow

```yaml
# .github/workflows/java_release.yml
name: Java Release

on:
  push:
    tags:
      - "java/v*"

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-java@v5
        with:
          java-version: '17'
          distribution: 'temurin'
          server-id: ossrh
          server-username: MAVEN_USERNAME
          server-password: MAVEN_PASSWORD
          gpg-private-key: ${{ secrets.GPG_PRIVATE_KEY }}
      - name: Publish to Maven Central
        run: mvn deploy -P release
        working-directory: ./java
```

---

## 4. Documentation Updates

### docs.t402.io Status

| Page | Status |
|------|--------|
| `/sdks/typescript/` | ✅ Complete (10 pages) |
| `/sdks/python.mdx` | ✅ Complete |
| `/sdks/go.mdx` | ✅ Complete |
| `/sdks/java.mdx` | ❌ Missing |

### Required Documentation

1. **Create Java SDK docs** (`docs/pages/sdks/java.mdx`)
2. **Update `_meta.ts`** to include Java in navigation
3. **Update main README** with Java installation instructions

---

## 5. Release Plan

### Immediate (Blocking)

| SDK | Current | Target | Action | Status |
|-----|---------|--------|--------|--------|
| Java | 1.0.0-SNAPSHOT | 1.0.0 | Configure secrets + publish | ⏳ Needs Maven Central secrets |

### Short-term (Next Release)

| SDK | Current | Target | Action | Status |
|-----|---------|--------|--------|--------|
| Python | 1.5.3 | 1.6.0 | Release with SVM, MCP | ✅ Ready to release |
| Go | 1.3.1 | 1.4.0 | Release with WDK, MCP | ✅ Ready to release |

---

## 6. Implementation Order

### Phase 1: Java SDK Completion (Critical Path) - ✅ 90% Complete

1. ✅ **Refactor package structure** - Renamed to `io.t402`
2. ✅ **Add Web3j dependency** - For EVM signing
3. ✅ **Implement EvmSigner** - EIP-3009 authorization signing
4. ✅ **Implement all signers** - SVM, TON, TRON
5. ✅ **Add ERC-4337 support** - Bundler, Paymaster clients
6. ✅ **Add USDT0 Bridge** - LayerZero integration
7. ✅ **Add WDK integration** - Wallet Development Kit
8. ✅ **Add CLI tool** - T402Cli.java
9. ⏳ **Add Spring Boot integration** - Auto-configuration
10. ⏳ **Create release workflow** - Maven Central publishing
11. ⏳ **Add documentation** - `docs/pages/sdks/java.mdx`
12. ⏳ **Publish v1.0.0** - Tag and release

### Phase 2: Python/Go Enhancements - ✅ Complete

1. ✅ Python: Complete SVM mechanism
2. ✅ Python: Add MCP server
3. ✅ Go: Add WDK package
4. ✅ Go: Add MCP server
5. ✅ Go: Add MCP CLI

### Phase 3: Documentation & Testing - 🔄 In Progress

1. ✅ Update all READMEs with latest versions
2. ✅ Update feature matrices in docs
3. ⏳ Improve test coverage across all SDKs
4. ⏳ Generate API documentation

---

## 7. README Updates Required

### Root README.md

- Update Java version from "Coming Soon" to v1.0.0
- Add Java to SDK Feature Matrix
- Add Java installation instructions

### python/t402/README.md

- Update version badges
- Add SVM documentation (when complete)
- Add MCP server documentation (when complete)

### go/README.md

- Update version badges
- Add WDK documentation (when complete)

### java/README.md

- Complete rewrite for io.t402 namespace
- Add Spring Boot integration docs
- Add usage examples

---

## 8. Key Files Reference

### TypeScript SDK
- `typescript/packages/core/src/` - Core implementation
- `typescript/packages/cli/` - CLI tool
- `.github/workflows/npm_release.yml` - Release workflow

### Python SDK
- `python/t402/pyproject.toml` - Project config (v1.5.3)
- `python/t402/src/t402/__init__.py` - Main module
- `.github/workflows/python_release.yml` - Release workflow

### Go SDK
- `go/go.mod` - Module definition (v1.3.1)
- `go/interfaces.go` - Core interfaces
- `.github/workflows/go_release.yml` - Release workflow

### Java SDK
- `java/pom.xml` - Maven config
- `java/src/main/java/io/t402/` - Main code (renamed from com.coinbase.t402)
- `java/src/main/java/io/t402/crypto/` - All signers (EVM, SVM, TON, TRON)
- `java/src/main/java/io/t402/erc4337/` - ERC-4337 support
- `java/src/main/java/io/t402/bridge/` - USDT0 Bridge
- `java/src/main/java/io/t402/wdk/` - WDK integration
- `java/src/main/java/io/t402/cli/` - CLI tool
- `.github/workflows/java.yml` - Test workflow
- `.github/workflows/java_release.yml` - Release workflow (needs secrets)

### Documentation
- `docs/pages/sdks/` - SDK documentation
- `docs/pages/_meta.ts` - Navigation config
- `.github/workflows/docs.yml` - Docs deployment
