# T402 Documentation Update Plan

**Created:** 2026-01-19
**Status:** In Progress

## Executive Summary

This plan addresses documentation updates across the T402 monorepo, including:
- **93+ README.md files** across the project
- **docs.t402.io** documentation site (Nextra)
- **t402.io** marketing website (Next.js)
- **specs/** protocol specifications

---

## 1. Current State Analysis

### 1.1 Version Inconsistencies Found

| Location | Current Version | Should Be |
|----------|-----------------|-----------|
| Root README.md (TypeScript install) | v2.0.0+ | v2.3.0 |
| Root README.md (Python install) | v1.7.1 | v1.9.0 |
| Root README.md (Go install) | v1.5.0 | v1.8.0 |
| Root README.md (Java install) | v1.1.0 | v1.7.0 |
| Root README.md (Latest Releases table) | outdated dates | current dates |
| ROADMAP.md | Go 1.5.0, Python 1.7.1, Java 1.1.0 | outdated |
| docs/pages/getting-started/installation.mdx | mentions Go but outdated version | update |
| docs/pages/sdks/java.mdx | v1.1.0 | v1.7.0 |
| typescript/README.md | v2.0.0 | v2.3.0 |
| go/README.md | v1.5.0 | v1.8.0 |
| python/t402/README.md | no version badge | add v1.9.0 |
| java/README.md | v1.1.0 | v1.7.0 |

### 1.2 Documentation Coverage Assessment

| Area | Status | Priority |
|------|--------|----------|
| Root README | Good but outdated versions | HIGH |
| TypeScript SDK docs | Comprehensive | MEDIUM |
| Python SDK docs | Good | MEDIUM |
| Go SDK docs | Good | MEDIUM |
| Java SDK docs | Excellent (most detailed) | LOW |
| docs.t402.io | Good structure, needs updates | HIGH |
| t402.io marketing site | Well designed | MEDIUM |
| Package-level READMEs | Variable quality | MEDIUM |
| Example READMEs | Minimal stubs | HIGH |
| Specs documentation | Good | LOW |

---

## 2. Prioritized Task List

### Priority 1: Critical Version Updates (Day 1)

- [ ] **Task 1.1:** Update Root README.md with correct versions
- [ ] **Task 1.2:** Update ROADMAP.md with current versions
- [ ] **Task 1.3:** Update SDK READMEs (typescript/, go/, java/)

### Priority 2: Documentation Site Updates (Days 2-3)

- [ ] **Task 2.1:** Update docs.t402.io Installation Page
- [ ] **Task 2.2:** Update docs.t402.io Index Page
- [ ] **Task 2.3:** Update SDK Documentation Pages
- [ ] **Task 2.4:** Add Missing Documentation Pages

### Priority 3: Marketing Site Updates (Days 3-4)

- [ ] **Task 3.1:** Update t402.io Feature Data
- [ ] **Task 3.2:** Update t402.io Chains Data
- [ ] **Task 3.3:** Update Marketing Site README

### Priority 4: Package-Level README Updates (Days 4-5)

- [ ] **Task 4.1:** TypeScript Package READMEs
- [ ] **Task 4.2:** Go Package READMEs

### Priority 5: Example README Updates (Days 5-6)

- [ ] **Task 5.1:** TypeScript Examples
- [ ] **Task 5.2:** Go Examples
- [ ] **Task 5.3:** Python Examples

### Priority 6: Specification Updates (Day 6-7)

- [ ] **Task 6.1:** Update Specs README
- [ ] **Task 6.2:** Verify Scheme Specifications

---

## 3. Detailed Task Breakdown

### Priority 1: Critical Version Updates

#### Task 1.1: Update Root README.md
**File:** `/README.md`

**Changes needed:**
1. Update TypeScript version reference to v2.3.0
2. Update Python version to v1.9.0
3. Update Go version to v1.8.0
4. Update Java version to v1.7.0
5. Update Latest Releases table with current versions and dates

#### Task 1.2: Update ROADMAP.md
**File:** `/ROADMAP.md`

**Changes needed:**
1. Update "Other SDKs" table with correct versions
2. Update Last Updated date
3. Add new milestones for v1.8.0 Go and v1.7.0 Java releases

#### Task 1.3: Update SDK READMEs
**Files:**
- `/typescript/README.md` - Update to v2.3.0
- `/go/README.md` - Update to v1.8.0
- `/java/README.md` - Update to v1.7.0

### Priority 2: Documentation Site Updates

#### Task 2.1: Update Installation Page
**File:** `/docs/pages/getting-started/installation.mdx`

**Changes needed:**
1. Add Java installation section (missing)
2. Update Go version command
3. Update Python requirements (3.10+)
4. Add SVM optional dependencies note

#### Task 2.2: Update Index Page
**File:** `/docs/pages/index.mdx`

**Changes needed:**
1. Update version badge to v2.3.0
2. Add Java to Quick Start tabs
3. Update package version table

#### Task 2.3: Update SDK Documentation Pages
**Files:**
- `/docs/pages/sdks/java.mdx` - Update to v1.7.0
- `/docs/pages/sdks/python.mdx` - Verify v1.9.0 features
- `/docs/pages/sdks/go/index.mdx` - Update to v1.8.0
- `/docs/pages/sdks/typescript/index.mdx` - Update to v2.3.0

#### Task 2.4: Add Missing Documentation Pages
**New files to create:**
1. `/docs/pages/schemes/upto.mdx` - Up-To scheme documentation
2. `/docs/pages/chains/ton.mdx` - TON integration guide
3. `/docs/pages/chains/tron.mdx` - TRON integration guide

### Priority 3: Marketing Site Updates

#### Task 3.1: Update Feature Data
**File:** `/typescript/site/app/features/data.ts`

**Changes needed:**
1. Fix docsUrl links (currently pointing to non-existent `/features/`)
2. Add TON and TRON to supportedChains arrays
3. Update code examples to use latest API patterns

#### Task 3.2: Update Chains Data
**File:** `/typescript/site/app/chains/data.ts`

**Changes needed:**
1. Ensure all supported chains are listed
2. Add TRON if missing
3. Update chain-specific information

### Priority 4: Package-Level README Updates

#### Task 4.1: TypeScript Package READMEs
**Files to update:**
- `/typescript/packages/core/README.md`
- `/typescript/packages/mcp/README.md`
- `/typescript/packages/wdk-gasless/README.md`
- `/typescript/packages/wdk-bridge/README.md`
- `/typescript/packages/wdk-multisig/README.md`
- `/typescript/packages/http/express/README.md`
- `/typescript/packages/http/hono/README.md`
- `/typescript/packages/http/next/README.md`
- `/typescript/packages/mechanisms/ton/README.md`
- `/typescript/packages/mechanisms/tron/README.md`

#### Task 4.2: Go Package READMEs
**Files:**
- `/go/mechanisms/ton/README.md`
- `/go/mechanisms/tron/README.md`

### Priority 5: Example README Updates

#### Task 5.1: TypeScript Examples
- `/examples/typescript/clients/README.md`
- `/examples/typescript/servers/README.md`
- `/examples/typescript/wdk-bridge/README.md`
- `/examples/typescript/wdk-gasless/README.md`
- `/examples/typescript/wdk-multisig/README.md`

#### Task 5.2: Go Examples
- `/examples/go/clients/ton/README.md`
- `/examples/go/clients/tron/README.md`
- `/examples/go/servers/ton/README.md`
- `/examples/go/servers/tron/README.md`

#### Task 5.3: Python Examples
- `/examples/python/erc4337-gasless/README.md`
- `/examples/python/flask-ton/README.md`

---

## 4. Missing Documentation Topics

| Topic | Recommended Location | Priority |
|-------|---------------------|----------|
| Up-To Scheme Tutorial | `/docs/pages/schemes/upto.mdx` | HIGH |
| TON Integration Guide | `/docs/pages/chains/ton.mdx` | HIGH |
| TRON Integration Guide | `/docs/pages/chains/tron.mdx` | HIGH |
| Solana Integration Guide | `/docs/pages/chains/solana.mdx` | MEDIUM |
| Smart Bridge Router | `/docs/pages/advanced/smart-router.mdx` | MEDIUM |
| WDK Integration Deep Dive | `/docs/pages/advanced/wdk-integration.mdx` | MEDIUM |
| Facilitator Deployment Guide | `/docs/pages/advanced/facilitator-deployment.mdx` | HIGH |
| Security Best Practices | `/docs/pages/security/best-practices.mdx` | HIGH |

---

## 5. Dependencies and Sequencing

```
Priority 1 (Critical Version Updates)
    │
    ├── Task 1.1 (Root README) ──┐
    ├── Task 1.2 (ROADMAP) ──────┼── Can be done in parallel
    └── Task 1.3 (SDK READMEs) ──┘
           │
           ▼
Priority 2 (docs.t402.io)
    │
    ├── Task 2.1 (Installation) ───┐
    ├── Task 2.2 (Index) ──────────┼── After Priority 1
    ├── Task 2.3 (SDK pages) ──────┤
    └── Task 2.4 (New pages) ──────┘
           │
           ▼
Priority 3 (t402.io Marketing)
    │
    └── Tasks 3.1-3.3 ── After Priority 2 (docs links must work)
           │
           ▼
Priority 4 (Package READMEs)
    │
    └── Tasks 4.1-4.2 ── Can run in parallel with Priority 3
           │
           ▼
Priority 5 (Example READMEs)
    │
    └── Tasks 5.1-5.3 ── After Priority 4
           │
           ▼
Priority 6 (Specifications)
    │
    └── Tasks 6.1-6.2 ── Final verification
```

---

## 6. Estimated Effort

| Priority | Tasks | Estimated Time |
|----------|-------|----------------|
| P1 | Version Updates | 2-4 hours |
| P2 | docs.t402.io Updates | 4-6 hours |
| P3 | Marketing Site Updates | 2-3 hours |
| P4 | Package READMEs | 4-6 hours |
| P5 | Example READMEs | 3-4 hours |
| P6 | Specification Updates | 1-2 hours |
| **Total** | | **16-25 hours** |

---

## 7. Progress Tracking

### Completed
- [x] Initial analysis and plan creation (2026-01-19)

### In Progress
- [ ] Priority 1: Critical Version Updates

### Pending
- [ ] Priority 2-6

---

## 8. Notes

- The t402.io marketing site is in a git submodule at `typescript/site/`
- Changes to the marketing site need to be committed to the t402-site repo separately
- All version numbers should match CLAUDE.md as source of truth
