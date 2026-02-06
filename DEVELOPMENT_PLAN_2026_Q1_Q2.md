# T402 Development Plan - 2026 Q1-Q2

> Updated: 2026-02-06
> Scope: Security, protocol features, cross-SDK parity, test coverage, documentation
> Total Effort: ~27 person-weeks across 22 calendar weeks

---

## Overview

This plan covers 5 phases:
1. Security hardening and audit completion
2. Protocol feature completeness (A2A, Bazaar, upto schemes)
3. Cross-SDK feature parity
4. Test coverage improvements
5. Documentation and polish

---

## Phase 1: Security & Critical Fixes (Weeks 1-4) — ✅ Complete

### 1.1 Security Audit Completion
**Priority:** P0 | **Effort:** 2 weeks

- [x] Complete internal security review
- [x] Document all findings with severity ratings
- [x] Create remediation plan for high/critical issues
- [ ] Engage external auditor (Trail of Bits or OpenZeppelin)

### 1.2 P1 Security Issues (18 issues)
**Priority:** P0 | **Effort:** 3 weeks

| Issue | Description | Risk | Status |
|-------|-------------|------|--------|
| P1-1 | Insufficient nonce tracking in exact-direct | Signature replay | ✅ Fixed |
| P1-2 | Missing amount validation in settlement | Overpayment | ✅ Fixed |
| P1-3 | No idempotency check deduplication | Double settlement | ✅ Fixed |
| P1-4 | Cache poisoning in rpc/provider.go | Stale RPC state | ✅ Fixed |
| P1-5 | GetSigners returns nil for unknown network | Bypass verification | ✅ Fixed |
| P1-6 | Missing settlement timeout | Hanging settlements | ✅ Fixed |
| P1-7 | No per-user rate limit tracking | DDoS | ✅ Fixed |
| P1-8 | Stream update doesn't validate network match | Cross-chain exploit | ✅ Fixed |
| P1-9 | Intent route scoring doesn't penalize failed paths | Route quality | ✅ Fixed |
| P1-10 | No signature expiration validation | Replay window | ✅ Fixed |
| P1-11 | Missing CreateStream amount validation | Zero-amount streams | ✅ Fixed |
| P1-12 | Insufficient CIDR whitelist logging | Compliance gap | ✅ Fixed |
| P1-13 | No transaction finality check | Unconfirmed tx | ✅ Fixed |
| P1-14 | Missing settlement batch size limits | Memory exhaustion | ✅ Fixed |
| P1-15 | Insufficient permission checks on stats | Unauthorized access | ✅ Fixed |
| P1-16 | Auto-settlement worker has no pause mechanism | Incident handling | ✅ Fixed |
| P1-17 | Missing RPC endpoint rotation | Load imbalance | ✅ Fixed |
| P1-18 | No distributed lock timeout for streaming | Deadlock risk | ✅ Fixed |

### 1.3 Smart Contract Audit
**Priority:** P0 | **Effort:** External

- [ ] Prepare audit scope document
- [ ] Schedule audit with external firm
- [ ] Address audit findings
- [ ] Deploy to mainnet after approval

**Blocked Networks (pending audit):**
- Ethereum/Base/Arbitrum Mainnet: T402UptoRouter

### 1.4 Deploy Missing Facilitator Wallets
**Priority:** P0 | **Effort:** 1 week

| Network | CAIP-2 | Status |
|---------|--------|--------|
| Aptos | `aptos:1` | Pending deploy |
| Tezos | `tezos:NetXdQprcVkpaWU` | Pending deploy |
| Polkadot Asset Hub | `polkadot:68d56f15f85d3136970ec16946040bc1` | Pending deploy |
| Stacks | `stacks:1` | Pending deploy |

---

## Phase 2: Protocol Feature Completion (Weeks 5-10) — ✅ Complete

### 2.1 A2A Transport Implementation
**Priority:** P1 | **Effort:** 3 weeks | **Status:** ✅ Done

- [x] A2A message types in @t402/core
- [x] Task-based state management
- [x] SDK integration (TypeScript, Go, Python, Java)

### 2.2 Bazaar Discovery API
**Priority:** P1 | **Effort:** 2 weeks | **Status:** ✅ Done

- [x] `GET /v1/discovery/resources` - List resources
- [x] `GET /v1/discovery/resources/:id` - Get details
- [x] `POST /v1/discovery/register` - Register resource
- [x] Resource filtering, pagination, metadata

### 2.3 Upto Scheme for Non-EVM Chains
**Priority:** P1 | **Effort:** 3 weeks | **Status:** ✅ Done

| Chain | Status |
|-------|--------|
| Solana (SVM) | ✅ All 4 SDKs |
| TON | ✅ All 4 SDKs |
| TRON | ✅ All 4 SDKs |
| NEAR | ✅ All 4 SDKs |

### 2.4 Standardized Error Codes
**Priority:** P2 | **Effort:** 1 week | **Status:** ✅ Done

---

## Phase 3: Cross-SDK Feature Parity (Weeks 11-16) — ✅ Complete

### 3.1 Hardware Wallet Support for Go SDK
**Status:** ✅ Done — Types, interfaces, mock implementation, 27 tests

### 3.2 Cosmos Support for TypeScript/Python/Java
**Status:** ✅ Done — Noble USDC, exact-direct scheme, all 3 SDKs

### 3.3 MCP Server Enhancement
**Status:** ✅ Done

| SDK | Tools Implemented | Tests |
|-----|-------------------|-------|
| Go | 6/6 real blockchain tools | ✅ |
| Python | 6/6 real web3.py tools | 47 new tests |
| Java | 6/6 real web3j tools | 74 new tests |

### 3.4 HTTP Framework Coverage
**Status:** ✅ Done

| SDK | Frameworks |
|-----|-----------|
| Go | Gin, Echo, Chi, Fiber |
| Python | FastAPI, Flask, Django, Starlette |
| Java | Servlet, Spring, WebFlux, Micronaut, Quarkus |

---

## Phase 4: Test Coverage (Weeks 17-20) — ✅ Complete

### 4.1 UI Package Tests
**Status:** ✅ Done

| Package | Before | After |
|---------|--------|-------|
| @t402/paywall | ~64 tests | 100 tests (+55) |
| @t402/react | ~87 tests | 118 tests (+31) |
| @t402/vue | ~63 tests | 94 tests (+31) |

### 4.2 Mechanism Package Tests
**Status:** ✅ Done — 10 new test files (client + facilitator for NEAR, Aptos, Tezos, Polkadot, Stacks)

### 4.3 SVM Integration Tests
**Status:** ✅ Done — 9 placeholder tests replaced with real implementations, 138 total

---

## Phase 5: Documentation & Polish (Weeks 21-22) — ✅ Complete

### 5.1 Migration Guide v2.2 → v2.3
**Status:** ✅ Done — `services/docs/pages/advanced/migration-v2.2-to-v2.3.mdx`

### 5.2 Cosmos README
**Status:** ✅ Done — `sdks/typescript/packages/mechanisms/cosmos/README.md`

### 5.3 Network Support Matrix
**Status:** ✅ Done — `services/docs/pages/chains/comparison.mdx`

Covers all 10 mechanisms across 4 SDKs, scheme decision guide, HTTP framework support table.

---

## Timeline Summary

```
Week 1-4:   Phase 1 - Security & Critical Fixes        ✅
Week 5-10:  Phase 2 - Protocol Feature Completion       ✅
Week 11-16: Phase 3 - Cross-SDK Feature Parity          ✅
Week 17-20: Phase 4 - Test Coverage                     ✅
Week 21-22: Phase 5 - Documentation & Polish            ✅
```

---

## Success Metrics

| Metric | Before | After | Target | Status |
|--------|--------|-------|--------|--------|
| P1 Security Issues | 18 open | 0 open | 0 open | ✅ |
| Test Coverage (UI) | 3-19% | 30-70% | 30-70% | ✅ |
| SDK Feature Parity | 72-95% | 95%+ | 90%+ | ✅ |
| Facilitator Wallets | 30/34 | 30/34 | 34/34 | ⏳ Pending deploy |
| A2A Transport | 0% | 100% | 100% | ✅ |
| Bazaar API | 0% | 100% | 100% | ✅ |

---

## Remaining Items (Not in Plan)

These items require external action or are deferred:

| Item | Blocked By | Notes |
|------|------------|-------|
| Smart contract audit | External auditor | Required for mainnet upto router |
| 4 facilitator wallets | Ops team deployment | Aptos, Tezos, Polkadot, Stacks |

---

## Excluded (Deferred to Q3-Q4 2026)

- Rust SDK / Swift SDK
- MEV protection
- Atomic cross-chain swaps
- Subscription payments
- Webhooks / K8s multi-region / Hot wallet rotation
- Admin Dashboard UI
- Compliance features (KYC/AML)
- New chain support (Plasma, Monad, Stable, HyperEVM, MegaETH, Corn)
- Paywall bundle optimization
- CDN delivery for browser builds
