# T402 Development Plan - 2026 Q1-Q2

> Generated: 2026-02-06
> Scope: Core platform improvements, security, infrastructure (excludes Rust/Swift SDKs)
> Total Estimated Effort: ~50-60 developer weeks

---

## Overview

This plan focuses on:
1. Security hardening and audit completion
2. Protocol feature completeness (A2A, Bazaar, upto schemes)
3. Cross-SDK feature parity
4. Test coverage improvements
5. Infrastructure and operations

---

## Phase 1: Security & Critical Fixes (Weeks 1-4)

### 1.1 Security Audit Completion
**Priority:** P0 | **Effort:** 2 weeks | **Owner:** TBD

- [ ] Complete internal security review
- [ ] Document all findings with severity ratings
- [ ] Create remediation plan for high/critical issues
- [ ] Engage external auditor (Trail of Bits or OpenZeppelin)

### 1.2 P1 Security Issues (18 issues)
**Priority:** P0 | **Effort:** 3 weeks | **Owner:** TBD

| Issue | Description | Risk | Effort |
|-------|-------------|------|--------|
| P1-1 | Insufficient nonce tracking in exact-direct | Signature replay | 2d |
| P1-2 | Missing amount validation in settlement | Overpayment | 1d |
| P1-3 | No idempotency check deduplication | Double settlement | 2d |
| P1-4 | Cache poisoning in rpc/provider.go | Stale RPC state | 1d |
| P1-5 | GetSigners returns nil for unknown network | Bypass verification | 1d |
| P1-6 | Missing settlement timeout | Hanging settlements | 2d |
| P1-7 | No per-user rate limit tracking | DDoS | 2d |
| P1-8 | Stream update doesn't validate network match | Cross-chain exploit | 1d |
| P1-9 | Intent route scoring doesn't penalize failed paths | Route quality | 1d |
| P1-10 | No signature expiration validation | Replay window | 1d |
| P1-11 | Missing CreateStream amount validation | Zero-amount streams | 1d |
| P1-12 | Insufficient CIDR whitelist logging | Compliance gap | 0.5d |
| P1-13 | No transaction finality check | Unconfirmed tx | 2d |
| P1-14 | Missing settlement batch size limits | Memory exhaustion | 1d |
| P1-15 | Insufficient permission checks on stats | Unauthorized access | 1d |
| P1-16 | Auto-settlement worker has no pause mechanism | Incident handling | 1d |
| P1-17 | Missing RPC endpoint rotation | Load imbalance | 1d |
| P1-18 | No distributed lock timeout for streaming | Deadlock risk | 2d |

### 1.3 Smart Contract Audit
**Priority:** P0 | **Effort:** External | **Owner:** TBD

- [ ] Prepare audit scope document
- [ ] Gather all contract source code and tests
- [ ] Schedule audit with external firm
- [ ] Address audit findings
- [ ] Deploy to mainnet after approval

**Blocked Networks (pending audit):**
- Ethereum Mainnet: T402UptoRouter
- Base Mainnet: T402UptoRouter
- Arbitrum One: T402UptoRouter

### 1.4 Deploy Missing Facilitator Wallets
**Priority:** P0 | **Effort:** 1 week | **Owner:** TBD

| Network | CAIP-2 | Status | Action |
|---------|--------|--------|--------|
| Aptos | `aptos:1` | Missing | Deploy + fund wallet |
| Tezos | `tezos:NetXdQprcVkpaWU` | Missing | Deploy + fund wallet |
| Polkadot Asset Hub | `polkadot:68d56f15f85d3136970ec16946040bc1` | Missing | Deploy + fund wallet |
| Stacks | `stacks:1` | Missing | Deploy + fund wallet |

---

## Phase 2: Protocol Feature Completion (Weeks 5-10)

### 2.1 A2A Transport Implementation
**Priority:** P1 | **Effort:** 3 weeks | **Owner:** TBD

Implement Agent-to-Agent transport protocol per `/specs/transports-v2/a2a.md`:

**Week 5-6: Core Implementation**
- [ ] Define A2A message types in @t402/core
- [ ] Implement task-based state management
- [ ] Add metadata fields: `t402.payment.status`, `t402.payment.required`, `t402.payment.payload`, `t402.payment.receipts`
- [ ] Implement extension declaration system

**Week 7: SDK Integration**
- [ ] TypeScript: @t402/a2a package
- [ ] Go: mechanisms/a2a module
- [ ] Python: a2a module
- [ ] Java: a2a package

**Deliverables:**
- A2A transport in all 4 SDKs
- Integration tests
- Documentation

### 2.2 Bazaar Discovery API
**Priority:** P1 | **Effort:** 2 weeks | **Owner:** TBD

Implement resource discovery per spec section 8:

**Facilitator Endpoints:**
- [ ] `GET /discovery/resources` - List discoverable resources
- [ ] `GET /discovery/resources/:id` - Get resource details
- [ ] `POST /discovery/register` - Register new resource

**Features:**
- [ ] Resource filtering by type, network, price range
- [ ] Pagination support
- [ ] Resource metadata and accepts array
- [ ] Last updated timestamps

**SDK Support:**
- [ ] TypeScript: Extend @t402/extensions bazaar module
- [ ] Go/Python/Java: Add discovery client

### 2.3 Upto Scheme for Non-EVM Chains
**Priority:** P1 | **Effort:** 3 weeks | **Owner:** TBD

Extend upto scheme beyond EVM:

| Chain | Effort | Notes |
|-------|--------|-------|
| Solana (SVM) | 1 week | SPL token with max amount |
| TON | 1 week | Jetton with max amount |
| TRON | 0.5 week | TRC-20 with max amount |
| NEAR | 0.5 week | NEP-141 with max amount |

**Per Chain:**
- [ ] Client scheme implementation
- [ ] Server scheme implementation
- [ ] Facilitator scheme implementation
- [ ] Unit tests
- [ ] Integration tests

### 2.4 Standardized Error Codes
**Priority:** P2 | **Effort:** 1 week | **Owner:** TBD

Implement T402-CXXX error code system per spec section 13:

```
T402-1xxx: Client Errors (12 codes)
T402-2xxx: Server Errors (6 codes)
T402-3xxx: Facilitator Errors (8 codes)
T402-4xxx: Chain Errors (7 codes)
T402-5xxx: Bridge Errors (5 codes)
```

- [ ] Define error code constants in all SDKs
- [ ] Map existing errors to standardized codes
- [ ] Update error response format: `{code, message, details, retry}`
- [ ] Update documentation

---

## Phase 3: Cross-SDK Feature Parity (Weeks 11-16)

### 3.1 Hardware Wallet Support for Go SDK
**Priority:** P1 | **Effort:** 2 weeks | **Owner:** TBD

Port TypeScript hardware wallet implementation to Go:

- [ ] Ledger support via USB HID
- [ ] Trezor support
- [ ] Unit tests with mocked devices
- [ ] Documentation

**Files to reference:**
- `sdks/typescript/packages/wdk/src/hardware/ledger.ts`
- `sdks/typescript/packages/wdk/src/hardware/trezor.ts`

### 3.2 Cosmos Support for TypeScript/Python/Java
**Priority:** P1 | **Effort:** 2 weeks | **Owner:** TBD

Port Go Cosmos implementation to other SDKs:

| SDK | Effort | Package |
|-----|--------|---------|
| TypeScript | 1 week | @t402/cosmos |
| Python | 0.5 week | t402.schemes.cosmos |
| Java | 0.5 week | io.t402.schemes.cosmos |

**Features:**
- [ ] Noble USDC support
- [ ] exact-direct scheme
- [ ] Client/Server/Facilitator interfaces

### 3.3 MCP Server Enhancement
**Priority:** P2 | **Effort:** 2 weeks | **Owner:** TBD

Bring Go/Python/Java MCP to TypeScript parity (17 files):

**Go MCP (currently 1 file):**
- [ ] Add tool providers: balance, payment, bridge, stream
- [ ] Add demo mode
- [ ] Add configuration options
- [ ] Tests (target: 60% coverage)

**Python MCP (currently 5 files):**
- [ ] Add missing tools
- [ ] Add streaming support
- [ ] Tests

**Java MCP (currently 5 files):**
- [ ] Add missing tools
- [ ] Add streaming support
- [ ] Tests

### 3.4 HTTP Framework Coverage
**Priority:** P2 | **Effort:** 2 weeks | **Owner:** TBD

| SDK | Current | Add |
|-----|---------|-----|
| Go | Gin only | Echo, Chi, Fiber |
| Java | Spring only | Quarkus, Micronaut |
| Python | FastAPI, Flask | Starlette, Django |

---

## Phase 4: Test Coverage (Weeks 17-20)

### 4.1 UI Package Tests
**Priority:** P2 | **Effort:** 2 weeks | **Owner:** TBD

| Package | Current | Target | Tests to Add |
|---------|---------|--------|--------------|
| @t402/paywall | 4 tests (3.4%) | 40 tests (30%) | 36 |
| @t402/react | 4 tests (19%) | 15 tests (70%) | 11 |
| @t402/vue | 3 tests (16%) | 12 tests (60%) | 9 |

**@t402/paywall tests needed:**
- [ ] EVM paywall component tests
- [ ] SVM paywall component tests
- [ ] TON paywall component tests
- [ ] TRON paywall component tests
- [ ] Builder pattern tests
- [ ] Network handler tests
- [ ] Error state tests
- [ ] Loading state tests

**@t402/react tests needed:**
- [ ] usePaymentRequired hook tests
- [ ] usePaymentStatus hook tests
- [ ] useAsyncPayment hook tests
- [ ] Provider context tests
- [ ] Component integration tests

**@t402/vue tests needed:**
- [ ] Composable tests
- [ ] Component behavior tests
- [ ] Reactivity pattern tests

### 4.2 Mechanism Package Tests
**Priority:** P2 | **Effort:** 1.5 weeks | **Owner:** TBD

| Package | Current | Target |
|---------|---------|--------|
| @t402/near | 5 files | 10 files |
| @t402/aptos | 5 files | 10 files |
| @t402/tezos | 7 files | 12 files |
| @t402/polkadot | 6 files | 11 files |
| @t402/stacks | 5 files | 10 files |
| @t402/svm | 8 placeholder | 8 implemented |

**Per mechanism:**
- [ ] Client integration tests
- [ ] Facilitator integration tests
- [ ] End-to-end payment flow tests
- [ ] Edge case handling tests

### 4.3 SVM Integration Tests
**Priority:** P2 | **Effort:** 0.5 week | **Owner:** TBD

Implement 8 placeholder tests in `@t402/svm`:
- [ ] should create a valid payment payload with ExactSvmScheme
- [ ] should verify a valid payment with ExactSvmScheme
- [ ] should reject invalid signatures
- [ ] should reject insufficient amounts
- [ ] should reject wrong recipients
- [ ] should reject expired transactions
- [ ] should settle valid payments
- [ ] should handle compute budget instructions

---

## Phase 5: Infrastructure & Operations (Weeks 21-24)

### 5.1 Facilitator Webhook System
**Priority:** P1 | **Effort:** 2.5 weeks | **Owner:** TBD

- [ ] Event model design (payment.verified, payment.settled, payment.failed, stream.*, intent.*)
- [ ] Webhook registration endpoints (`POST /webhooks`, `GET /webhooks`, `DELETE /webhooks/:id`)
- [ ] Delivery with exponential backoff retry
- [ ] Event filtering by type and network
- [ ] Webhook signature verification (HMAC-SHA256)
- [ ] Delivery status tracking
- [ ] Tests

### 5.2 Kubernetes Multi-Region Deployment
**Priority:** P1 | **Effort:** 1 week | **Owner:** TBD

K8s configs ready at `/services/facilitator/k8s/`, need deployment:

- [ ] Deploy to US-East region
- [ ] Deploy to EU-West region
- [ ] Deploy to AP-Southeast region
- [ ] Configure geographic load balancing
- [ ] Verify cross-region failover
- [ ] Document runbook

### 5.3 Hot Wallet Rotation Automation
**Priority:** P2 | **Effort:** 1 week | **Owner:** TBD

- [ ] Design rotation process and key management
- [ ] Implement key generation and secure storage
- [ ] Implement balance migration script
- [ ] Add rotation API endpoints (admin only)
- [ ] Document operational procedures
- [ ] Test rotation in staging

### 5.4 TypeScript Monorepo Tooling
**Priority:** P2 | **Effort:** 0.5 week | **Owner:** TBD

- [ ] Create `tsconfig.base.json` at monorepo root
- [ ] Create `.eslintrc` root config
- [ ] Add `CODEOWNERS` file
- [ ] Create `vitest.workspace.ts` for unified test config
- [ ] Set up changesets for release management

### 5.5 Performance Optimization
**Priority:** P2 | **Effort:** 1.5 weeks | **Owner:** TBD

| Item | Current | Target | Action |
|------|---------|--------|--------|
| Paywall bundle | 2.7 MB | <500 KB | Lazy loading, tree shaking |
| Paywall lazy loading | None | Per mechanism | Dynamic imports |
| CDN delivery | None | Global | Set up CDN for browser builds |
| Verification latency | <500ms | <200ms | Profile and optimize |

---

## Phase 6: Documentation & Polish (Weeks 25-26)

### 6.1 Migration Guide v2.2 → v2.3
**Priority:** P2 | **Effort:** 0.5 week | **Owner:** TBD

- [ ] Breaking changes summary
- [ ] API changes
- [ ] New features guide
- [ ] Code examples

### 6.2 Mechanism README Updates
**Priority:** P2 | **Effort:** 0.5 week | **Owner:** TBD

Update READMEs for:
- [ ] @t402/near
- [ ] @t402/aptos
- [ ] @t402/tezos
- [ ] @t402/polkadot
- [ ] @t402/stacks
- [ ] @t402/cosmos (new)

### 6.3 Network Support Matrix
**Priority:** P3 | **Effort:** 0.5 week | **Owner:** TBD

- [ ] Create interactive network support matrix on docs site
- [ ] Show scheme support per network
- [ ] Show SDK support per network
- [ ] Show testnet/mainnet status

---

## Timeline Summary

```
Week 1-4:   Phase 1 - Security & Critical Fixes
Week 5-10:  Phase 2 - Protocol Feature Completion
Week 11-16: Phase 3 - Cross-SDK Feature Parity
Week 17-20: Phase 4 - Test Coverage
Week 21-24: Phase 5 - Infrastructure & Operations
Week 25-26: Phase 6 - Documentation & Polish
```

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| P1 Security Issues | 18 open | 0 open |
| Test Coverage (UI packages) | 3-19% | 30-70% |
| SDK Feature Parity | 72-95% | 90%+ |
| Facilitator Wallet Coverage | 30/34 networks | 34/34 networks |
| A2A Transport | 0% | 100% |
| Bazaar API | 0% | 100% |
| Production Readiness | 85% | 95% |

---

## Dependencies & Blockers

| Item | Blocked By | Impact |
|------|------------|--------|
| Mainnet contract deployment | External audit completion | Cannot use upto scheme on mainnet |
| Multi-region deployment | K8s cluster provisioning | Cannot achieve geographic redundancy |
| USAT integration | Tether announcement | Future feature, not blocking |

---

## Team Allocation (Suggested)

| Role | Focus Area | Weeks |
|------|------------|-------|
| Security Engineer | Phase 1 (Security) | 4 |
| Backend Engineer 1 | Phase 2 (A2A, Bazaar) | 6 |
| Backend Engineer 2 | Phase 2 (upto schemes) | 4 |
| SDK Engineer 1 | Phase 3 (Hardware, Cosmos) | 4 |
| SDK Engineer 2 | Phase 3 (MCP, HTTP) | 4 |
| Frontend Engineer | Phase 4 (UI tests) | 3 |
| DevOps Engineer | Phase 5 (Infra) | 4 |
| Technical Writer | Phase 6 (Docs) | 2 |

**Total: ~31 person-weeks across 26 calendar weeks**

---

## Review Checkpoints

| Week | Checkpoint | Deliverables |
|------|------------|--------------|
| 4 | Security Review Complete | All P1 issues fixed, audit scheduled |
| 10 | Protocol Features Done | A2A, Bazaar, upto non-EVM working |
| 16 | SDK Parity Achieved | All SDKs at 90%+ parity |
| 20 | Test Coverage Met | UI packages at target coverage |
| 24 | Infrastructure Ready | Multi-region deployed, webhooks live |
| 26 | Q1-Q2 Complete | All items done, docs updated |

---

## Excluded from This Plan

The following items are deferred to Q3-Q4 2026:

- Rust SDK development
- Swift SDK development
- MEV protection mechanisms
- Atomic cross-chain swaps
- Subscription payments
- Advanced workflow engine
- Bitcoin L2 exploration
- New chain support (Plasma, Monad, Stable, HyperEVM, MegaETH)
- Admin Dashboard UI
- Compliance features (KYC/AML)
