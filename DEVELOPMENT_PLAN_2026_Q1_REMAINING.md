# T402 Remaining Development Plan — 2026 Q1 Remaining

> Generated: 2026-02-09 | Updated: 2026-02-09 | Status: Weeks 1-9 Complete, Week 10 In Progress

## Overview

This plan covers all incomplete items identified through deep project analysis.
Items are grouped by priority and include estimated effort.

---

## P0 — Critical (Blocking Production)

### P0-1: Smart Contract External Audit
- **Status**: ⏳ Blocked (requires vendor engagement)
- **Effort**: 1-4 weeks (external)
- **Cost**: $5K-$50K
- **Details**: `T402UptoRouter.sol` internal audit complete (0 Critical, 2 Medium). External audit required before mainnet deployment.
- **Action**: Engage Trail of Bits / OpenZeppelin / Consensys Diligence
- **Blocks**: Upto scheme production deployment, contract address population in specs

### P0-2: Facilitator Test Coverage 30% → 70%
- **Status**: ✅ Complete — 77.4% achieved (Week 9), CI threshold raised 55% → 75%
- **Effort**: Complete
- **Details**: All repository code covered via go-sqlmock. Target exceeded by 7.4%.
- **Tasks**:
  - [x] Add `ton_signer_test.go` — 43 tests (Week 2)
  - [x] Expand `cosmos_signer_test.go` — +9 tests (Week 2)
  - [x] Expand `stacks_signer_test.go` — +5 tests (Week 2)
  - [x] Expand `errors/` tests — 42.9% → 100% (Week 7)
  - [x] Add `idempotency/nonce_test.go` — 33 tests, nonce.go 100% (Week 7)
  - [x] Expand `intent/router` tests — 41% → 48.9%, all router functions 100% (Week 7)
  - [x] Expand `streaming/service` tests — 47% → 48.2%, pause/resume/model tests (Week 7)
  - [x] Add `cache/` tests — 65.1% → 100% (ValidateCacheKey, SanitizeKey, SetNX, Eval, etc.)
  - [x] Add `idempotency/store` CheckAndCreate tests — 38.1% → 86.7% + redis.Nil bug fix
  - [x] Add `tracing/middleware` tests — 45% → 88.5% (22 tests)
  - [x] Add `server/handlers` helper tests + admin handler tests — 58.4% → 63%
  - [x] Raise CI threshold to 55% (from 30%)
  - [x] Add sqlmock DB tests for persistence repository — 71 tests, 77.6% (Week 9)
  - [x] Add sqlmock DB tests for intent repository — 80+ tests, 79.8% (Week 9)
  - [x] Add sqlmock DB tests for streaming repository — 78 tests, 79.7% (Week 9)
  - [x] Raise CI threshold to 75% (from 55%)

---

## P1 — High Priority (Functionality & Correctness)

### P1-1: Fix SDK Placeholders
- **Status**: ✅ Complete (Week 3)
- **Effort**: 2-3 days
- **Tasks**:
  - [x] TS: Implemented real QR encoder (Reed-Solomon EC, GF(256), versions 1-6)
  - [x] TS: EVM upto client — documented permitNonce via extra field
  - [x] Python: EVM upto client — reads nonce from extra["permitNonce"]
  - [x] Python: TON BOC cell building — documented with pytoniq_core example
  - [x] Python: WDK direct payment — documented as intentionally unsupported
  - [x] Java: MCP tools — confirmed working as designed (demo mode)

### P1-2: Missing Exact-Direct Chain Specifications
- **Status**: ✅ Complete (Week 1)
- **Effort**: 1-2 days
- **Tasks**:
  - [x] Write `specs/schemes/exact-direct/scheme_exact_direct_aptos.md`
  - [x] Write `specs/schemes/exact-direct/scheme_exact_direct_tezos.md`
  - [x] Write `specs/schemes/exact-direct/scheme_exact_direct_polkadot.md`
  - [x] Write `specs/schemes/exact-direct/scheme_exact_direct_stacks.md`
  - [x] Write `specs/schemes/exact-direct/scheme_exact_direct_cosmos.md`

### P1-3: Documentation Site Updates
- **Status**: ✅ Complete (Week 1)
- **Effort**: 1 day
- **Tasks**:
  - [x] Create `/reference/cosmos.mdx` — full SDK examples
  - [x] Add Cosmos to `reference/_meta.ts` navigation
  - [x] Update `facilitator-api.mdx` — changed to "Verification only (exact-direct)"
  - [x] Update security audit table with realistic timeline/status

### P1-4: CLI Command Tests
- **Status**: ✅ Complete (Week 1)
- **Effort**: 1 day
- **Tasks**:
  - [x] Write `pay.test.ts` for `@t402/cli` — 15 tests
  - [x] Write `request.test.ts` for `@t402/cli` — 15 tests
  - [x] Write `wallet.test.ts` for `@t402/cli` — 15 tests

### P1-5: Fix Go SDK Test Gaps
- **Status**: ✅ Complete (verified Week 8)
- **Effort**: 1 day
- **Tasks**:
  - [x] Expand cosmos client tests — +8 tests (Week 2)
  - [x] TON client tests — verified 99+ tests, 0 skipped in mechanisms (skips in signers/ are network-dependent, by design)
  - [x] Multisig test coverage — verified 14 test functions with 30+ cases covering all components

### P1-6: Fix Version Inconsistencies
- **Status**: 🔄 Week 10
- **Effort**: 10 minutes
- **Tasks**:
  - [ ] TS: Update root `package.json` version 2.3.1 → 2.4.0
  - [ ] TS: Update root `README.md` version reference 2.3.1 → 2.4.0
  - [ ] Go: Update `sdks/go/README.md` version 1.8.1 → 1.9.0

### P1-7: Go SDK SVM Upto Missing Tests
- **Status**: 🔄 Week 10
- **Effort**: 1 day
- **Details**: SVM upto scheme has complete implementation (client/server/facilitator) but zero test files. Only upto scheme without tests.
- **Tasks**:
  - [ ] Write `sdks/go/mechanisms/svm/upto/client/scheme_test.go`
  - [ ] Write `sdks/go/mechanisms/svm/upto/server/scheme_test.go`
  - [ ] Write `sdks/go/mechanisms/svm/upto/facilitator/scheme_test.go`

### P1-8: Java Spring WebFlux Missing Test
- **Status**: 🔄 Week 10
- **Effort**: 2 hours
- **Details**: `PaymentWebFilter.java` is fully implemented but has no test file. Only HTTP framework without test coverage.
- **Tasks**:
  - [ ] Write `sdks/java/src/test/java/io/t402/spring/reactive/PaymentWebFilterTest.java`

---

## P2 — Medium Priority (Quality & Infrastructure)

### P2-1: Infrastructure
- **Effort**: 2-3 weeks
- **Tasks**:
  - [ ] Multi-region K8s deployment (US-East, EU-West, AP-Southeast)
  - [ ] Hot wallet rotation mechanism design + implementation
  - [ ] Paywall bundle optimization (2.7MB → <500KB)
  - [ ] CDN delivery for browser builds

### P2-2: Development Tooling
- **Status**: ✅ Already Complete (verified Week 4)
- **Effort**: 0 (already existed)
- **Tasks**:
  - [x] `tsconfig.base.json` — exists
  - [x] `eslint.config.js` — exists
  - [x] `CODEOWNERS` — exists
  - [x] `vitest.config.ts` — exists per package
  - [x] viem — already peer dependency in evm packages

### P2-3: Java/Go Test Expansion
- **Status**: ✅ Complete (Week 5-8)
- **Effort**: 2-3 days
- **Tasks**:
  - [x] Go: TON upto tests — 64 tests (types, client, server, facilitator)
  - [x] Go: TRON upto tests — 68 tests (types, client, server, facilitator)
  - [x] Go: NEAR upto tests — 91 tests (types, client, server, facilitator)
  - [x] Java: Tezos expanded 31→56 tests (+25, Constants/Factory/Payload edge cases)
  - [x] Java: Polkadot expanded 35→59 tests (+24, Constants/Factory/snake_case keys)
  - [x] Java full suite: 1292→1341 tests, 0 failures
  - [x] Java: Micronaut (15 tests) + Quarkus (16 tests) — verified comprehensive (Week 8)
  - [x] Go: Multisig already has 14 test functions with full coverage (Week 8)

### P2-4: Fix Example Placeholders
- **Status**: ✅ Complete (Week 4) — added missing READMEs
- **Effort**: 1 day
- **Tasks**:
  - [x] `examples/typescript/clients/tron/README.md` — created with TronWeb production patterns
  - [x] `examples/typescript/servers/tron/README.md` — created with middleware setup guide
  - [x] `examples/typescript/clients/bridge/README.md` — created with bridge API docs
  - [x] `examples/go/clients/bridge/README.md` — created with Go bridge API docs
  - Note: Placeholder signers are intentional — examples show interface pattern without heavy deps

### P2-5: Spec Gaps
- **Status**: 🔄 Week 10
- **Effort**: 30 minutes
- **Tasks**:
  - [ ] Mark `specs/schemes/upto/scheme_upto_evm.md` as non-DRAFT (TS implementation exists)
  - [ ] Note: `specs/schemes/exact/scheme_exact_sui.md` remains DRAFT (no SDK implementation, deferred to Q3)
  - [ ] Note: `specs/schemes/exact-direct/scheme_exact_direct_stacks.md` token address TBD (awaiting mainnet stablecoin)

---

## P3 — Future (Q3-Q4 2026)

### P3-1: New SDKs
- [ ] Rust SDK (Wasm-compatible, tokio async, EVM/SVM/TON/TRON)
- [ ] Swift SDK (iOS/macOS native, SwiftUI, WalletConnect)

### P3-2: Advanced Features
- [ ] MEV protection mechanisms
- [ ] Atomic cross-chain swaps
- [ ] Subscription payments
- [ ] Webhooks / event notification system
- [ ] Admin Dashboard UI
- [ ] KYC/AML compliance module

### P3-3: New Chain Support
- [ ] Sui (spec exists as DRAFT)
- [ ] Plasma, Monad, Stable, HyperEVM, MegaETH, Corn

### P3-4: External Dependencies
- [ ] USAT integration (pending Tether official launch)

### P3-5: Advanced Packages (6 "Coming Soon")
- [ ] `@t402/zk-payments` — Zero-knowledge payments
- [ ] `@t402/intent-payments` — Intent-based payments
- [ ] `@t402/smart-router` — Multi-chain routing
- [ ] `@t402/streaming-payments` — Payment channels
- [ ] `@t402/a2a-negotiation` — Agent-to-agent negotiation
- [ ] `@t402/agent-policy` — AI agent spending policies

---

## Execution Order

```
Week 1: ✅ P1-2 (specs) + P1-3 (docs) + P1-4 (CLI tests)
Week 2: ✅ P0-2 partial (TON/Cosmos/Stacks signer tests) + P1-5 partial (Go cosmos client)
Week 3: ✅ P1-1 (SDK placeholders — QR encoder, permit nonce, TON BOC docs, WDK docs)
Week 4: ✅ P2-2 (already complete) + P2-4 (4 missing READMEs)
Week 5-6: ✅ P2-3 (Go upto 223 tests + Java Tezos/Polkadot +49 tests)
Week 7: ✅ P0-2 (facilitator 50.1% → 57.2%, CI threshold 30% → 55%, bug fix in CheckAndCreate)
Week 8: ✅ P1-5 (Go TON + multisig verified complete) + P2-3 (Java Micronaut/Quarkus verified complete)
Week 9: ✅ P0-2 (facilitator 57.2% → 77.4%, CI threshold 55% → 75%, sqlmock DB tests for all 3 repos)
Week 10: 🔄 P1-6 (version fixes) + P1-7 (SVM upto tests) + P1-8 (WebFlux test) + P2-5 (spec updates)
Week 11+: P2-1 (infrastructure) — requires ops planning
```

---

## Coverage Summary (Week 9)

| Package | Week 7 | Week 9 | Method |
|---------|--------|--------|--------|
| errors | 100% | 100% | Constructor + error code tests |
| cache | 100% | 100% | ValidateCacheKey, SanitizeKey, SetNX, Eval, ScriptLoad |
| idempotency | 86.7% | 86.7% | Nonce tests + CheckAndCreate + redis.Nil bug fix |
| tracing | 88.5% | 88.5% | Middleware, TraceVerifyHandler, TraceSettleHandler |
| server | 63.0% | 63.0% | Helper functions + admin handler tests |
| persistence | ~30% | 77.6% | +71 sqlmock tests (settlement + audit repos + handlers) |
| intent | 48.9% | 79.8% | +80 sqlmock tests (all 12 repo methods + adapter) |
| streaming | 48.2% | 79.7% | +78 sqlmock tests (all 18 repo methods + adapter) |
| auth | 85.1% | 85.1% | — |
| config | 100% | 100% | — |
| discovery | 59.5% | 59.5% | — |
| health | 87.2% | 87.2% | — |
| metrics | 100% | 100% | — |
| ratelimit | 68.1% | 68.1% | — |
| rpc | 83.5% | 83.5% | — |
| **Total** | **57.2%** | **77.4%** | **+229 sqlmock tests across 3 repos** |

---

## Success Metrics

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Facilitator test coverage | 77.4% | 70% | ✅ Exceeded — CI threshold raised to 75% |
| Exact-direct chain specs | 6/6 | 6/6 | ✅ Complete |
| CLI test coverage | 5/5 commands | 5/5 | ✅ Complete |
| SDK placeholders resolved | 6/6 | 6/6 | ✅ Complete |
| Documentation gaps fixed | 4/4 | 4/4 | ✅ Complete |
| Version consistency | 2/4 SDKs | 4/4 | 🔄 Week 10 |
| SVM upto test coverage | 0 tests | ~90 tests | 🔄 Week 10 |
| Java HTTP framework tests | 4/5 | 5/5 | 🔄 Week 10 |
