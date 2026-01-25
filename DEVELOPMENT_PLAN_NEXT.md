# T402 下一階段開發計劃

> **基於完整專案分析的開發計劃**
>
> 建立日期: 2026-01-26
> 更新日期: 2026-01-26
> 版本: 2.0

---

## 概述

專案核心功能已完成約 95%。本計劃專注於：
1. 測試覆蓋率提升
2. Java SDK 機制擴充
3. 安全審計準備
4. 基礎設施優化

---

## 當前狀態總覽

| SDK | 版本 | 區塊鏈機制 | 測試覆蓋 | 狀態 |
|-----|------|-----------|----------|------|
| TypeScript | 2.3.1 | 10/10 ✅ | 85%+ | **完整** |
| Go | 1.8.1 | 10/10 ✅ | **45-50%** ⚠️ | 需提升測試 |
| Python | 1.9.1 | 9/9 ✅ | 85%+ | **完整** |
| Java | 1.8.1 | **3/9** ⚠️ | 70% | 缺少機制 |

---

## ✅ 已完成的階段

### Phase 1: Go SDK Signers ✅
- ✅ TON signer (Ed25519, tonutils-go)
- ✅ TRON signer (secp256k1, TronGrid API)
- ✅ NEAR signer (Ed25519, Borsh serialization)
- ✅ Aptos signer (Ed25519, BCS serialization)
- ✅ Tezos signer (Ed25519, FA2 transfers)
- ✅ Polkadot signer (Ed25519, SS58 encoding)
- ✅ Stacks signer (secp256k1, C32 encoding)

### Phase 2: Demo.t402.io 增強 ✅
- ✅ 9 個區塊鏈支援
- ✅ Gasless Payment 整合 (Pimlico)
- ✅ CoinGecko 價格服務

### Phase 3: Java MCP 工具擴充 ✅
- ✅ 18 個 MCP 工具 (NEAR, Aptos, Tezos 已添加)
- ✅ 885 測試全部通過

---

## 🔴 Phase 4: 高優先級 - 測試覆蓋提升

### 4.1 Go SDK 測試覆蓋 (目標: 45% → 70%)

| 組件 | 當前覆蓋 | 目標 | 狀態 |
|------|----------|------|------|
| mechanisms/ton | 86.9% | 70% | ✅ |
| mechanisms/tron | 86.5%* | 70% | ✅ |
| mechanisms/near | 100% | 70% | ✅ |
| mechanisms/aptos | 93.8% | 70% | ✅ |
| mechanisms/tezos | 96.1% | 70% | ✅ |
| mechanisms/polkadot | 96.2% | 70% | ✅ |
| mechanisms/stacks | 100% | 70% | ✅ |
| mechanisms/evm/erc4337 | 69.2% | 70% | ✅ (從 3.4% 提升) |
| http/gin | 83.5% | 80% | ✅ |
| mcp | 47.3% | 60% | 🔄 進行中 |
| signers/* | 已修復 | - | ✅ 修復失敗測試 |

### 4.2 Facilitator 測試覆蓋 (目標: 29% → 70%)

| 組件 | 當前覆蓋 | 目標 | 狀態 |
|------|----------|------|------|
| /verify endpoint | ~30% | 80% | ⬜ |
| /settle endpoint | ~30% | 80% | ⬜ |
| Settlement execution | ~20% | 70% | ⬜ |
| Cross-chain E2E | 0% | 50% | ⬜ |

---

## 🟡 Phase 5: 中優先級 - Java SDK 機制擴充

### 5.1 缺少的機制

| 機制 | Token 標準 | 預估工時 | 狀態 |
|------|-----------|----------|------|
| SVM | SPL Token | 3-4 天 | ⬜ |
| NEAR | NEP-141 | 2-3 天 | ⬜ |
| Aptos | Fungible Asset | 2-3 天 | ⬜ |
| Tezos | FA2 | 2-3 天 | ⬜ |
| Polkadot | Asset Hub | 2-3 天 | ⬜ |
| Stacks | SIP-010 | 2-3 天 | ⬜ |

### 5.2 實作結構

```
sdks/java/src/main/java/io/t402/schemes/
├── svm/           ⬜ 待實作
│   ├── SvmConstants.java
│   ├── SvmSchemes.java
│   ├── ClientSvmSigner.java
│   ├── FacilitatorSvmSigner.java
│   └── ExactPayload.java
├── near/          ✅ 已有基礎 (需擴充)
├── aptos/         ✅ 已有基礎 (需擴充)
├── tezos/         ✅ 已有基礎 (需擴充)
├── polkadot/      ⬜ 待實作
└── stacks/        ⬜ 待實作
```

---

## 🟡 Phase 6: 中優先級 - 基礎設施

### 6.1 TypeScript Monorepo 改進

| 項目 | 狀態 |
|------|------|
| ESLint root config | ⬜ |
| vitest.workspace.ts | ⬜ |
| CODEOWNERS | ⬜ |
| Paywall bundle 優化 (2.7MB → <500KB) | ⬜ |

### 6.2 Facilitator 基礎設施

| 項目 | 狀態 |
|------|------|
| 熱錢包輪換機制 | ⬜ |
| 多區域部署 (US-East, EU-West, AP-Southeast) | ⬜ |
| P95 延遲優化 (<200ms) | ⬜ |

---

## 🟢 Phase 7: 低優先級 - 安全審計

### 7.1 內部審計 (Q1 2026)

- [ ] 範圍定義
- [ ] 風險評估
- [ ] 設計審查
- [ ] 修復高危發現

### 7.2 外部審計 (Q2 2026)

- [ ] 選擇審計公司 (Trail of Bits / OpenZeppelin)
- [ ] 全面代碼審計
- [ ] 密碼學審查
- [ ] 發布安全聲明

---

## 🟢 Phase 8: 低優先級 - 新 SDK 開發

### 8.1 Rust SDK (Q2-Q3 2026)

- [ ] Core types and interfaces
- [ ] EVM mechanism
- [ ] SVM mechanism
- [ ] TON/TRON mechanisms
- [ ] Wasm builds
- [ ] 85% 測試覆蓋

### 8.2 Swift SDK (Q3-Q4 2026)

- [ ] Core types and interfaces
- [ ] EVM mechanism
- [ ] SwiftUI components
- [ ] WalletConnect integration
- [ ] 80% 測試覆蓋

---

## 實作順序

### Week 1-2: Go SDK 測試覆蓋
1. TON/TRON 機制整合測試
2. HTTP Gin 中間件測試
3. MCP Server 測試

### Week 3-4: Facilitator 測試
1. /verify endpoint 測試
2. /settle endpoint 測試
3. 跨鏈結算 E2E 測試

### Week 5-6: Java SDK 機制
1. SVM 機制實作
2. Polkadot 機制實作
3. Stacks 機制實作

### Week 7-8: 基礎設施
1. TypeScript monorepo 改進
2. Facilitator 效能優化

---

## 驗收標準

### Phase 4 完成標準
- [ ] Go SDK 測試覆蓋達到 70%
- [ ] Facilitator 測試覆蓋達到 70%
- [ ] 所有 CI 測試通過

### Phase 5 完成標準
- [ ] Java SDK 支援 9/9 區塊鏈機制
- [ ] 所有新機制通過測試

### Phase 6 完成標準
- [ ] TypeScript monorepo 配置完整
- [ ] Facilitator P95 < 200ms

---

## 相關文檔

- [ROADMAP.md](./ROADMAP.md) - 高層級路線圖
- [DEVELOPMENT_PLAN_2026.md](./DEVELOPMENT_PLAN_2026.md) - 2026 年度計劃
- [CLAUDE.md](./CLAUDE.md) - 專案上下文
