# T402 SDK Development Plan

## Executive Summary

### Current State Overview

| SDK | Version | Registry Status | Core Features | CLI | Tests | Docs |
|-----|---------|-----------------|---------------|-----|-------|------|
| **TypeScript** | v2.0.0 | npm: 21 packages ✅ | Complete (reference impl) | @t402/cli | 669 files | ✅ |
| **Python** | v1.6.1 | PyPI: t402 ✅ | Complete (EVM, TON, TRON, SVM, ERC-4337, WDK) | Built-in | 13 files | ✅ |
| **Go** | v1.4.0 | Go Modules ✅ | Complete (EVM, TON, TRON, SVM) | cmd/t402 | 33 files | ✅ |
| **Java** | 1.0.0 | Maven Central ✅ | Complete (EVM, SVM, TON, TRON, ERC-4337, WDK, Bridge) | T402Cli | 35+ files | ✅ |

---

## 1. Gap Analysis: Feature Matrix

| Feature | TypeScript | Python | Go | Java |
|---------|------------|--------|-----|------|
| Core Client | ✅ | ✅ | ✅ | ✅ |
| Core Server | ✅ | ✅ | ✅ | ✅ |
| Facilitator | ✅ | ✅ | ✅ | ✅ |
| EVM Mechanism | ✅ | ✅ | ✅ | ✅ |
| SVM Mechanism | ✅ | ✅ | ✅ | ✅ |
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

### 2.1 Java SDK (Priority: LOW - Published)

**Current Status:**
- ✅ Package renamed to `io.t402`
- ✅ All blockchain mechanisms implemented
- ✅ Published to Maven Central v1.0.0
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
| 12 | Add Maven Central workflow | `.github/workflows/java_release.yml` | High | ✅ Done |
| 13 | Configure Maven secrets | GitHub Secrets | Critical | ✅ Done |
| 14 | Publish v1.0.0 | Maven Central | Critical | ✅ Done |

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

### Completed Releases

| SDK | Version | Action | Status |
|-----|---------|--------|--------|
| Java | 1.0.0 | Published to Maven Central | ✅ Released |
| Python | 1.6.1 | Released with SVM, MCP | ✅ Released |
| Go | 1.4.0 | Released with WDK, MCP | ✅ Released |

### Next Release

| SDK | Current | Target | Action | Status |
|-----|---------|--------|--------|--------|
| Java | 1.0.0 | 1.1.0 | Add Spring Boot starter | ⏳ Pending |

---

## 6. Implementation Order

### Phase 1: Java SDK Completion (Critical Path) - ✅ Complete

1. ✅ **Refactor package structure** - Renamed to `io.t402`
2. ✅ **Add Web3j dependency** - For EVM signing
3. ✅ **Implement EvmSigner** - EIP-3009 authorization signing
4. ✅ **Implement all signers** - SVM, TON, TRON
5. ✅ **Add ERC-4337 support** - Bundler, Paymaster clients
6. ✅ **Add USDT0 Bridge** - LayerZero integration
7. ✅ **Add WDK integration** - Wallet Development Kit
8. ✅ **Add CLI tool** - T402Cli.java
9. ⏳ **Add Spring Boot integration** - Auto-configuration
10. ✅ **Create release workflow** - Maven Central publishing
11. ⏳ **Add documentation** - `docs/pages/sdks/java.mdx`
12. ✅ **Publish v1.0.0** - Tag and release

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

## 8. WDK / USDT0 功能完整性計劃

### 8.1 功能差異矩陣

| 功能 | TypeScript | Python | Go | Java |
|------|------------|--------|-----|------|
| **USDT 支援** |
| EVM USDT | ✅ | ✅ | ✅ | ✅ |
| TRON USDT | ✅ | ✅ | ✅ | ✅ |
| TON USDT | ✅ | ✅ | ✅ | ✅ |
| Solana USDC | ✅ | ✅ | ✅ | ❌ |
| **USDT0 Bridge** |
| 跨鏈報價 | ✅ | ✅ | ✅ | ✅ |
| 跨鏈執行 | ✅ | ✅ | ✅ | ✅ |
| LayerZero 追蹤 | ✅ | ✅ | ⚠️ 基礎 | ✅ |
| Router 選路 | ✅ | ✅ | ❌ | ❌ |
| **WDK 整合** |
| 基礎 Signer | ✅ | ✅ | ✅ | ✅ |
| 鏈配置 | ✅ | ✅ | ✅ | ✅ |
| 餘額查詢 | ✅ | ✅ | ✅ | ⚠️ |
| **WDK Gasless (ERC-4337)** |
| Safe Smart Account | ✅ | ✅ | ✅ | ❌ |
| Pimlico Bundler | ✅ | ✅ | ✅ | ❌ |
| Alchemy Bundler | ✅ | ✅ | ✅ | ❌ |
| Paymaster 贊助 | ✅ | ✅ | ✅ | ❌ |
| **WDK Bridge** |
| 專用套件 | ✅ `@t402/wdk-bridge` | ❌ | ❌ | ❌ |
| **WDK Multisig** |
| Safe 多簽 | ✅ `@t402/wdk-multisig` | ❌ | ⚠️ 基礎 | ❌ |
| 簽名收集 | ✅ | ❌ | ❌ | ❌ |
| **硬體錢包** |
| Ledger | ✅ | ❌ | ❌ | ❌ |
| Trezor | ✅ | ❌ | ❌ | ❌ |

### 8.2 USDT0 支援的鏈

| 鏈 | 狀態 | 備註 |
|----|------|------|
| Ethereum | ✅ | |
| Arbitrum | ✅ | |
| Ink | ✅ | |
| Berachain | ✅ | |
| Unichain | ✅ | |
| Base | ❌ | 無 USDT0 合約 |
| Polygon | ❌ | 無 USDT0 合約 |
| Optimism | ❌ | 無 USDT0 合約 |

### 8.3 待補齊任務

#### Python SDK

| # | Task | Priority | Status |
|---|------|----------|--------|
| 1 | 完善 SVM 機制（SPL Token 完整支援）| High | ✅ Done |
| 2 | 添加 WDK Multisig 套件 | Medium | ⏳ Pending |
| 3 | 添加 WDK Bridge 專用套件 | Medium | ⏳ Pending |
| 4 | 添加硬體錢包支援（Ledger/Trezor）| Low | ⏳ Pending |

#### Go SDK

| # | Task | Priority | Status |
|---|------|----------|--------|
| 1 | 添加 Bridge Router 智能選路 | Medium | ⏳ Pending |
| 2 | 完善 WDK Multisig（完整多簽工作流）| Medium | ⏳ Pending |
| 3 | 添加 LayerZero 完整追蹤 | Low | ⏳ Pending |
| 4 | 添加硬體錢包支援（Ledger/Trezor）| Low | ⏳ Pending |

#### Java SDK

| # | Task | Priority | Status |
|---|------|----------|--------|
| 1 | 實現 ERC-4337 完整整合（Safe Account）| High | ⏳ Pending |
| 2 | 添加 MCP Server | Medium | ⏳ Pending |
| 3 | 添加 WDK Multisig | Medium | ⏳ Pending |
| 4 | 添加 SVM 機制（Solana）| Medium | ⏳ Pending |
| 5 | 添加硬體錢包支援 | Low | ⏳ Pending |

### 8.4 優先順序建議

**P0 - Critical（阻塞發布）**
- [x] Java SDK 發布到 Maven Central ✅ v1.0.0 已發布

**P1 - High（下個版本）**
- [x] Python SVM 完整實現 ✅ v1.6.1 已發布
- [ ] Java ERC-4337 Safe Account 整合

**P2 - Medium（未來版本）**
- [ ] Go/Python WDK Multisig
- [ ] Go Bridge Router
- [ ] Java MCP Server

**P3 - Low（長期計劃）**
- [ ] 所有 SDK 硬體錢包支援
- [ ] 統一 WDK Bridge 套件命名

---

## 9. Key Files Reference

### TypeScript SDK
- `typescript/packages/core/src/` - Core implementation
- `typescript/packages/cli/` - CLI tool
- `.github/workflows/npm_release.yml` - Release workflow

### Python SDK
- `python/t402/pyproject.toml` - Project config (v1.6.1)
- `python/t402/src/t402/__init__.py` - Main module
- `.github/workflows/python_release.yml` - Release workflow

### Go SDK
- `go/go.mod` - Module definition (v1.4.0)
- `go/interfaces.go` - Core interfaces
- `.github/workflows/go_release.yml` - Release workflow

### Java SDK
- `java/pom.xml` - Maven config (v1.0.0)
- `java/src/main/java/io/t402/` - Main code
- `java/src/main/java/io/t402/crypto/` - All signers (EVM, SVM, TON, TRON)
- `java/src/main/java/io/t402/erc4337/` - ERC-4337 support
- `java/src/main/java/io/t402/bridge/` - USDT0 Bridge
- `java/src/main/java/io/t402/wdk/` - WDK integration
- `java/src/main/java/io/t402/cli/` - CLI tool
- `.github/workflows/java.yml` - Test workflow
- `.github/workflows/java_release.yml` - Release workflow ✅

### Documentation
- `docs/pages/sdks/` - SDK documentation
- `docs/pages/_meta.ts` - Navigation config
- `.github/workflows/docs.yml` - Docs deployment
