# T402 Development Plan

> Generated: 2026-01-17
> Last Updated: 2026-01-17
> Target Completion: 100% Production Ready

## Overview

Based on comprehensive project analysis, T402 is **88% complete**. This plan addresses the remaining 12% to achieve production-grade v2.0 release.

---

## Phase 1: Critical Issues (P0) - Week 1 ✅ COMPLETE

### 1.1 Security Audit Preparation ✅
- [x] Document all cryptographic operations (`docs/pages/security/cryptographic-operations.mdx`)
- [x] Create threat model documentation (`docs/pages/security/threat-model.mdx`)
- [x] Prepare audit scope document (`docs/pages/security/audit-scope.mdx`)
- [ ] Contact security firms (Trail of Bits, OpenZeppelin)

### 1.2 Sui Implementation Status ✅
- [x] Mark `scheme_exact_sui.md` as DRAFT in specs/README.md
- [x] Add DRAFT notice to Sui spec document
- [x] Update SDK feature matrices to show Sui as not yet available

---

## Phase 2: High Priority (P1) - Week 2-3

### 2.1 Python SDK Gasless Support ✅ ALREADY EXISTS
**Status**: Complete - Full ERC-4337 support already implemented

Existing files:
- [x] `python/t402/src/t402/erc4337/__init__.py`
- [x] `python/t402/src/t402/erc4337/bundlers.py` (Generic, Pimlico, Alchemy)
- [x] `python/t402/src/t402/erc4337/paymasters.py` (Pimlico, Biconomy, Stackup)
- [x] `python/t402/src/t402/erc4337/accounts.py` (SafeSmartAccount)
- [x] `python/t402/src/t402/erc4337/types.py`

### 2.2 Java SDK Solana Support ✅
**Status**: Complete - Full SVM scheme implementation with Ed25519 signing

Implemented:
- [x] `java/src/main/java/io/t402/crypto/SvmSigner.java` (real Ed25519 with BouncyCastle)
- [x] `java/src/main/java/io/t402/schemes/svm/SvmConstants.java` (network IDs, token addresses, RPC URLs)
- [x] `java/src/main/java/io/t402/schemes/svm/SvmAuthorization.java` (transfer authorization metadata)
- [x] `java/src/main/java/io/t402/schemes/svm/ExactSvmPayload.java` (payment payload with signed transaction)
- [x] `java/src/main/java/io/t402/schemes/svm/SvmUtils.java` (address validation, amount parsing, base58 codec)
- [x] `java/src/main/java/io/t402/schemes/svm/ClientSvmSigner.java` (client signer interface)
- [x] `java/src/main/java/io/t402/schemes/svm/FacilitatorSvmSigner.java` (facilitator signer interface with RPC ops)
- [x] `java/src/main/java/io/t402/schemes/svm/exact/ExactSvmClientScheme.java` (client payment creation)
- [x] `java/src/main/java/io/t402/schemes/svm/exact/ExactSvmFacilitatorScheme.java` (verify/settle with security checks)
- [x] `java/src/main/java/io/t402/schemes/svm/exact/ExactSvmServerScheme.java` (server-side price parsing)
- [x] Comprehensive test suite (71 tests)

### 2.3 E2E Test Suite ✅ ALREADY EXISTS
**Status**: Comprehensive E2E suite exists at `/e2e/`

Features:
- [x] Interactive test runner with coverage-based minimization
- [x] Multi-language support (TypeScript, Go, Python)
- [x] Multi-framework support (Express, Hono, Next.js, Gin, Flask, FastAPI)
- [x] EVM and SVM protocol testing
- [x] Bazaar extension testing

### 2.4 Standardized Error Codes ✅
- [x] `services/facilitator/internal/errors/codes.go`
- [x] `specs/t402-specification-v2.md` (Section 13: Error Codes)
- [x] Error constructors for common cases

---

## Phase 3: Medium Priority (P2) - Week 4-5

### 3.1 Deprecate v1 Transport Specs ✅
- [x] Add deprecation notice to `specs/README.md`
- [x] Migration guide exists at `docs/pages/advanced/migration-v1-to-v2.mdx`

### 3.2 Up-To Scheme Implementation 🟡 PARTIAL
**Goal**: Implement metered/usage-based billing scheme

Specifications created:
- [x] `specs/schemes/upto/scheme_upto.md` - Main specification
- [x] `specs/schemes/upto/scheme_upto_evm.md` - EVM implementation (EIP-2612)

Documentation:
- [x] `docs/pages/schemes/index.mdx` - Schemes overview (exact vs upto comparison)
- [x] `docs/pages/schemes/upto.mdx` - Detailed upto scheme documentation

SDK implementation:
- [x] TypeScript: `@t402/core` types and `@t402/evm` upto client
- [x] Go: `go/types/` upto types (full implementation)
- [x] Python: `t402.schemes.upto` and `t402.schemes.evm.upto` modules
- [x] Java: `io.t402.schemes.upto` and `io.t402.schemes.evm.upto` packages
- [ ] Router contract deployment (TBD)

### 3.3 Multi-Region Facilitator
**Goal**: Deploy facilitator to multiple regions

Infrastructure:
- [ ] US-East (current) - Virginia
- [ ] EU-West - Frankfurt
- [ ] APAC - Singapore

Configuration:
- [ ] Terraform/Pulumi IaC
- [ ] Global load balancer
- [ ] Regional database replicas
- [ ] Shared Redis cluster

### 3.4 Extract viem Peer Dependency ✅
**Goal**: Make viem optional in TypeScript packages

- [x] Create `@t402/evm-core` with no viem dependency
- [x] Keep `@t402/evm` as convenience package with viem
- [x] Update documentation

**Implementation**:
- `@t402/evm-core` provides all types, constants, and utilities without viem dependency
- `@t402/evm` re-exports everything from evm-core and adds viem-dependent implementations
- Consumers can use `@t402/evm-core` for type-only imports (smaller bundle size)

---

## Phase 4: Documentation & Polish (P3) - Week 6

### 4.1 Troubleshooting Guide ✅
- [x] `docs/pages/advanced/troubleshooting.mdx` created
- [x] Payment verification failures (T402-1xxx codes)
- [x] Settlement failures (T402-3xxx codes)
- [x] Network connectivity issues (T402-4xxx codes)
- [x] Debug logging configuration (TypeScript, Python, Go)
- [x] Common integration issues (CORS, middleware order)
- [x] Gasless payment issues (ERC-4337 AA errors)

### 4.2 Performance Tuning Guide ✅
- [x] `docs/pages/advanced/performance.mdx` created
- [x] Connection pooling (TypeScript, Python, Go, Java)
- [x] Batch settlements and parallel verification
- [x] Caching strategies (requirements, balances, nonces)
- [x] Rate limiting configuration
- [x] Monitoring and metrics
- [x] Hardware recommendations

### 4.3 Video Tutorials
- [ ] Quick start (5 min)
- [ ] Server integration (10 min)
- [ ] Gasless payments (10 min)
- [ ] MCP AI agent setup (10 min)

---

## Phase 5: Future SDKs (P3) - Week 7+

### 5.1 Rust SDK
```
rust/
├── Cargo.toml
├── t402-core/
├── t402-client/
├── t402-server/
└── t402-wasm/
```

### 5.2 Swift SDK
```
swift/
├── Package.swift
├── Sources/T402/
└── Tests/T402Tests/
```

---

## Milestones

| Milestone | Target Date | Status |
|-----------|-------------|--------|
| P0 Complete | Week 1 | ✅ Complete |
| P1 Complete | Week 3 | ✅ Complete |
| P2 Complete | Week 5 | 🟡 75% (Up-To SDK + docs complete, router pending) |
| P3 Complete | Week 6 | 🟡 67% (Video tutorials pending) |
| Security Audit Start | Week 4 | Pending |
| Security Audit Complete | Week 8 | Pending |
| v2.0 Production Release | Week 9 | Pending |

---

## Success Criteria

1. **Security**: External audit completed with no critical findings
2. **SDK Parity**: All 4 SDKs support EVM, SVM, TON, TRON, Gasless
3. **Testing**: E2E tests pass for all payment flows
4. **Documentation**: 100% API coverage, troubleshooting guide
5. **Infrastructure**: <100ms latency globally (multi-region)

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Security audit delays | High | Start process early, have backup firms |
| Breaking changes in dependencies | Medium | Pin versions, automated updates |
| Chain RPC instability | Medium | Multiple RPC providers, fallbacks |
| Team availability | Medium | Document everything, async workflows |

---

## Resource Requirements

- **Security Audit**: $50,000 - $150,000
- **Infrastructure**: ~$2,000/month (multi-region)
- **Development**: 1-2 engineers, 6-8 weeks

---

## Tracking

Progress tracked in:
- GitHub Issues: https://github.com/t402-io/t402/issues
- GitHub Projects: https://github.com/orgs/t402-io/projects

---

## Progress Summary

| Phase | Items | Completed | Percentage |
|-------|-------|-----------|------------|
| P0 | 2 | 2 | 100% |
| P1 | 4 | 4 | 100% |
| P2 | 4 | 3 | 75% |
| P3 | 3 | 2 | 67% |
| **Total** | **13** | **11** | **85%** |

### Remaining Items
1. Up-To Scheme - Router contract deployment (P2) - SDK types + docs complete
2. Multi-Region Facilitator - Infrastructure (P2)
3. Video Tutorials - Educational content (P3)
4. Contact security firms - Outreach (P0)

### Recently Completed
- Java SVM SolanaJ reference implementation: `SolanajClientSigner` and `SolanajFacilitatorSigner` with RPC support
- Java SVM test suite now at 87 tests (71 scheme + 16 solanaj signer tests)
- Java SVM full implementation: `io.t402.schemes.svm.exact` package with complete client/facilitator/server schemes
- Java SVM scheme types: `io.t402.schemes.svm` package (constants, authorization, payload, utilities)
- viem Peer Dependency extraction: `@t402/evm-core` package created
- Security Audit Preparation documentation (cryptographic operations, threat model, audit scope)
- Up-To Scheme SDK types: TypeScript, Go, Python, Java (all 4 SDKs)
- Up-To Scheme documentation: schemes overview and detailed upto guide
- PaymentPayload.resource optionality fix (TypeScript, Python)

*Last updated: 2026-01-18*
