# T402 下一階段開發計劃

> **基於 SDK 完整性分析的開發計劃**
>
> 建立日期: 2026-01-26
> 版本: 1.0

---

## 概述

根據對四個 SDK (TypeScript, Go, Python, Java) 的完整性分析，所有核心功能已開發完畢。
本計劃專注於剩餘的優化項目和新功能開發。

---

## 當前狀態總覽

| SDK | 版本 | 區塊鏈機制 | HTTP 整合 | 進階功能 | 狀態 |
|-----|------|-----------|-----------|----------|------|
| TypeScript | 2.3.1 | 10/10 ✅ | 9 種 ✅ | 全部 ✅ | **完整** |
| Go | 1.8.1 | 10/10 ✅ | 1 種 ✅ | 全部 ✅ | **完整** |
| Python | 1.9.1 | 9/9 ✅ | 4 種 ✅ | 全部 ✅ | **完整** |
| Java | 1.8.1 | 9/9 ✅ | 2 種 ✅ | 全部 ✅ | **完整** |

---

## Phase 1: Go SDK Signer 補齊 ✅ 已完成

### 1.1 問題描述

Go SDK 目前只有 EVM 和 SVM 的 Signer Helper，其他 7 個鏈需要用戶自行實作。

### 1.2 需要實作的 Signers

| 鏈 | Signer 類型 | 參考實作 | 狀態 |
|----|-------------|----------|------|
| TON | Ed25519 | TypeScript `@t402/ton` | ✅ 已完成 |
| TRON | ECDSA secp256k1 | TypeScript `@t402/tron` | ✅ 已完成 |
| NEAR | Ed25519 | TypeScript `@t402/near` | ✅ 已完成 |
| Aptos | Ed25519 | TypeScript `@t402/aptos` | ✅ 已完成 |
| Tezos | Ed25519 | TypeScript `@t402/tezos` | ✅ 已完成 |
| Polkadot | Ed25519 | TypeScript `@t402/polkadot` | ✅ 已完成 |
| Stacks | secp256k1 | TypeScript `@t402/stacks` | ✅ 已完成 |

### 1.3 檔案結構 ✅

```
sdks/go/
├── signers/
│   ├── ton/
│   │   ├── client.go ✅
│   │   ├── client_test.go ✅
│   │   └── README.md ✅
│   ├── tron/
│   │   ├── client.go ✅
│   │   ├── client_test.go ✅
│   │   └── README.md ✅
│   ├── near/
│   │   ├── client.go ✅
│   │   ├── client_test.go ✅
│   │   └── README.md ✅
│   ├── aptos/
│   │   ├── client.go ✅
│   │   ├── client_test.go ✅
│   │   └── README.md ✅
│   ├── tezos/
│   │   ├── client.go ✅
│   │   ├── client_test.go ✅
│   │   └── README.md ✅
│   ├── polkadot/
│   │   ├── client.go ✅
│   │   ├── client_test.go ✅
│   │   └── README.md ✅
│   └── stacks/
│       ├── client.go ✅
│       ├── client_test.go ✅
│       └── README.md ✅
```

---

## Phase 2: Demo.t402.io 增強 ✅ 已完成

### 2.1 新增區塊鏈支援 (4 chains) ✅

| Chain | Hook | Provider | 錢包 SDK | 狀態 |
|-------|------|----------|----------|------|
| NEAR | `useNearPayment.ts` | `NearProvider.tsx` | `@near-wallet-selector/core` | ✅ |
| Aptos | `useAptosPayment.ts` | `AptosProvider.tsx` | `@aptos-labs/wallet-adapter-react` | ✅ |
| Tezos | `useTezosPayment.ts` | `TezosProvider.tsx` | `@taquito/beacon-wallet` | ✅ |
| Polkadot | `usePolkadotPayment.ts` | `PolkadotProvider.tsx` | `@polkadot/extension-dapp` | ✅ |

### 2.2 Gasless Payment 真實整合 ✅

- [x] 更新 `.env.local` 配置 Pimlico bundler/paymaster
- [x] 更新 `gasless/route.ts` 使用環境變數
- [x] 更新 `GaslessPayment.tsx` 組件

### 2.3 真實數據整合 ✅

- [x] 建立 `price-service.ts` (CoinGecko API)
- [x] 建立 `content-generator.ts` (動態報告)
- [x] 更新 `market-data/route.ts`
- [x] 更新 `premium-report/route.ts`

---

## Phase 3: Java SDK MCP 工具擴充 ✅ 已完成

### 3.1 問題描述

Java SDK MCP Server 有 12 個工具，TypeScript 有 18+ 個。

### 3.2 需要新增的工具

| 工具 | 描述 | 狀態 |
|------|------|------|
| `t402/getNearBalance` | NEAR 餘額查詢 | ✅ 已完成 |
| `t402/payNear` | NEAR 支付 | ✅ 已完成 |
| `t402/getAptosBalance` | Aptos 餘額查詢 | ✅ 已完成 |
| `t402/payAptos` | Aptos 支付 | ✅ 已完成 |
| `t402/getTezosBalance` | Tezos 餘額查詢 | ✅ 已完成 |
| `t402/payTezos` | Tezos 支付 | ✅ 已完成 |

### 3.3 實作摘要

更新了以下檔案:
- `McpTypes.java` - 新增 SupportedNearNetwork, SupportedAptosNetwork, SupportedTezosNetwork 枚舉和輸入類型
- `McpConstants.java` - 新增網絡常量、RPC URLs、Explorer URLs、地址驗證
- `McpTools.java` - 新增 6 個工具處理器
- `McpServer.java` - 新增 6 個工具定義
- `McpServerTest.java` - 更新測試以驗證 18 個工具

---

## Phase 4: 安全審計 (優先級: 高)

### 4.1 內部審計

- [ ] 完成內部安全審查
- [ ] 修復所有高危/關鍵發現

### 4.2 外部審計

- [ ] 聘請 Trail of Bits 或 OpenZeppelin
- [ ] 處理審計發現

---

## Phase 5: 新 SDK 開發 (優先級: 低)

### 5.1 Rust SDK (Q2-Q3 2026)

- [ ] Core types and interfaces
- [ ] EVM mechanism
- [ ] SVM mechanism
- [ ] TON/TRON mechanisms
- [ ] Wasm builds

### 5.2 Swift SDK (Q3-Q4 2026)

- [ ] Core types and interfaces
- [ ] EVM mechanism
- [ ] SwiftUI components
- [ ] WalletConnect integration

---

## 實作順序

### ✅ 已完成

1. **Phase 2**: Demo.t402.io 增強 (全部完成)
   - ✅ 9 個區塊鏈支援
   - ✅ Gasless Payment 整合
   - ✅ CoinGecko 價格服務

2. **Phase 1**: Go SDK Signers ✅ (全部完成)
   - ✅ TON signer (Ed25519, tonutils-go)
   - ✅ TRON signer (secp256k1, TronGrid API)
   - ✅ NEAR signer (Ed25519, Borsh serialization)
   - ✅ Aptos signer (Ed25519, BCS serialization)
   - ✅ Tezos signer (Ed25519, FA2 transfers)
   - ✅ Polkadot signer (Ed25519, SS58 encoding)
   - ✅ Stacks signer (secp256k1, C32 encoding)

3. **Phase 3**: Java MCP 工具擴充 ✅ (全部完成)
   - ✅ NEAR 工具 (getNearBalance, payNear)
   - ✅ Aptos 工具 (getAptosBalance, payAptos)
   - ✅ Tezos 工具 (getTezosBalance, payTezos)
   - ✅ 總計 18 個工具，通過所有 885 測試

### 中期 (1 個月)

4. **Phase 4.1**: 內部安全審計

### 長期 (Q2-Q4)

5. **Phase 4.2**: 外部安全審計
6. **Phase 5**: Rust/Swift SDK

---

## 驗收標準

### Phase 1 完成標準 ✅
- [x] 所有 7 個 Signer 通過單元測試
- [ ] 與 TypeScript 實作互操作性測試

### Phase 2 完成標準 ✅
- [x] 4 個新鏈在 demo.t402.io 可用 (實際已有 9 個鏈)
- [x] Gasless 支付使用真實 bundler (Pimlico)
- [x] 價格數據即時更新 (CoinGecko)

### Phase 3 完成標準 ✅
- [x] Java MCP 工具數量達到 18+ (已達到 18 個)
- [x] 所有新工具通過測試 (885 測試全部通過)

---

## 相關文檔

- [ROADMAP.md](./ROADMAP.md) - 高層級路線圖
- [DEVELOPMENT_PLAN_2026.md](./DEVELOPMENT_PLAN_2026.md) - 2026 年度計劃
- [DEVELOPMENT_PLAN_MULTISIG.md](./DEVELOPMENT_PLAN_MULTISIG.md) - Multi-sig 開發計劃 (已完成)
