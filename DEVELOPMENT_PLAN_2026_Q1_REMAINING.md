# T402 Remaining Development Plan — 2026 Q1 Remaining

> Generated: 2026-02-09 | Updated: 2026-02-09 | Status: Weeks 1-7 Complete

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
- **Status**: ✅ Partial — 57.2% achieved (Week 7), CI threshold raised 30% → 55%
- **Effort**: 3-5 days (remaining: DB integration tests for repos)
- **Details**: Non-DB code fully covered. Remaining gap is repository code requiring PostgreSQL mocking.
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
  - [ ] Add DB integration tests for persistence/streaming/intent repositories (→ 70%)
  - [ ] Add integration tests for RPC providers

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
- **Status**: ✅ Partial (cosmos client expanded, Week 2)
- **Effort**: 1 day
- **Tasks**:
  - [x] Expand cosmos client tests — +8 tests (Week 2)
  - [ ] Fix or properly implement skipped TON client tests
  - [ ] Add multisig test coverage (1 file → 3+)

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
- **Status**: ✅ Partial (Week 5-6)
- **Effort**: 2-3 days
- **Tasks**:
  - [x] Go: TON upto tests — 64 tests (types, client, server, facilitator)
  - [x] Go: TRON upto tests — 68 tests (types, client, server, facilitator)
  - [x] Go: NEAR upto tests — 91 tests (types, client, server, facilitator)
  - [x] Java: Tezos expanded 31→56 tests (+25, Constants/Factory/Payload edge cases)
  - [x] Java: Polkadot expanded 35→59 tests (+24, Constants/Factory/snake_case keys)
  - [x] Java full suite: 1292→1341 tests, 0 failures
  - [ ] Java: Expand Micronaut/Quarkus middleware tests
  - [ ] Go: Add multisig test coverage

### P2-4: Fix Example Placeholders
- **Status**: ✅ Complete (Week 4) — added missing READMEs
- **Effort**: 1 day
- **Tasks**:
  - [x] `examples/typescript/clients/tron/README.md` — created with TronWeb production patterns
  - [x] `examples/typescript/servers/tron/README.md` — created with middleware setup guide
  - [x] `examples/typescript/clients/bridge/README.md` — created with bridge API docs
  - [x] `examples/go/clients/bridge/README.md` — created with Go bridge API docs
  - Note: Placeholder signers are intentional — examples show interface pattern without heavy deps

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
Week 8: P1-5 (Go TON client + multisig tests) ← NEXT
Week 9+: P2-1 (infrastructure) — requires ops planning
```

---

## Coverage Summary (Week 7)

| Package | Before | After | Method |
|---------|--------|-------|--------|
| errors | 42.9% | 100% | Constructor + error code tests |
| cache | 65.1% | 100% | ValidateCacheKey, SanitizeKey, SetNX, Eval, ScriptLoad |
| idempotency | 15.3% | 86.7% | Nonce tests + CheckAndCreate + redis.Nil bug fix |
| tracing | 45.0% | 88.5% | Middleware, TraceVerifyHandler, TraceSettleHandler |
| server | 58.4% | 63.0% | Helper functions + admin handler tests |
| intent | 41.0% | 48.9% | Router functions at 100% |
| streaming | 47.0% | 48.2% | Pause/resume/model tests |
| **Total** | **50.1%** | **57.2%** | |

---

## Success Metrics

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Facilitator test coverage | 57.2% | 70% | CI threshold raised to 55% ✅ |
| Exact-direct chain specs | 6/6 | 6/6 | ✅ Complete |
| CLI test coverage | 5/5 commands | 5/5 | ✅ Complete |
| SDK placeholders resolved | 6/6 | 6/6 | ✅ Complete |
| Documentation gaps fixed | 4/4 | 4/4 | ✅ Complete |
