# T402 USDT/USDT0 全區塊鏈支持開發計劃

> 目標：將 T402 的 USDT0 覆蓋率從 32% 提升到 100%
>
> 創建日期：2026-01-22
> 最後更新：2026-01-22

---

## 實施進度

### 已完成 (2026-01-22)

- [x] 修正現有配置問題 (Unichain 地址, Berachain Chain ID)
- [x] 更新 TypeScript token registry (19 個 USDT0 網絡)
- [x] 更新 TypeScript evmChains.ts (新增自定義鏈定義)
- [x] 更新 Go EVM constants (所有網絡配置)
- [x] 更新 Go Facilitator config (新增 RPC 端點)
- [x] 更新 Go Facilitator main.go (網絡註冊)
- [x] 更新 Python SDK (chains.py, networks.py)

### 待完成

- [ ] 構建並測試所有 SDK
- [ ] 驗證 EIP-3009 支持
- [ ] 部署到測試環境
- [ ] 生產環境部署

---

## 執行摘要

基於深度分析，T402 已支持所有 19 個 USDT0 網絡：

| 階段 | 網絡數量 | 狀態 |
|------|----------|------|
| 原有支持 | 6 個 | ✅ 完成 |
| Phase 1 高優先級 | 7 個 | ✅ 完成 |
| Phase 2 中優先級 | 6 個 | ✅ 完成 |
| **總計** | **19 個** | **100%** |

---

## 所有 USDT0 網絡配置

### 核心網絡 (原有 + 修正)

| 網絡 | Chain ID | USDT0 地址 | 狀態 |
|------|----------|-----------|------|
| Ethereum | 1 | `0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee` | ✅ |
| Arbitrum | 42161 | `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9` | ✅ |
| Ink | 57073 | `0x0200C29006150606B650577BBE7B6248F58470c1` | ✅ |
| Berachain | 80094 | `0x779Ded0c9e1022225f8E0630b35a9b54bE713736` | ✅ 已修正 |
| Unichain | 130 | `0x9151434b16b9763660705744891fA906F660EcC5` | ✅ 已修正 |

### Phase 1: 高優先級網絡

| 網絡 | Chain ID | USDT0 地址 | 狀態 |
|------|----------|-----------|------|
| Polygon | 137 | `0xc2132D05D31c914a87C6611C10748AEb04B58e8F` | ✅ 新增 |
| Optimism | 10 | `0x01bFF41798a0BcF287b996046Ca68b395DbC1071` | ✅ 新增 |
| Mantle | 5000 | `0x779Ded0c9e1022225f8E0630b35a9b54bE713736` | ✅ 新增 |
| Plasma | 9745 | `0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb` | ✅ 新增 |
| Sei | 1329 | `0x9151434b16b9763660705744891fA906F660EcC5` | ✅ 新增 |
| Conflux | 1030 | `0xaf37E8B6C9ED7f6318979f56Fc287d76c30847ff` | ✅ 新增 |
| Monad | 143 | `0xe7cd86e13AC4309349F30B3435a9d337750fC82D` | ✅ 新增 |

### Phase 2: 中優先級網絡

| 網絡 | Chain ID | USDT0 地址 | 狀態 |
|------|----------|-----------|------|
| Flare | 14 | `0xe7cd86e13AC4309349F30B3435a9d337750fC82D` | ✅ 新增 |
| Rootstock | 30 | `0x779dED0C9e1022225F8e0630b35A9B54Be713736` | ✅ 新增 |
| XLayer | 196 | `0x779Ded0c9e1022225f8E0630b35a9b54bE713736` | ✅ 新增 |
| Stable | 988 | `0x779Ded0c9e1022225f8E0630b35a9b54bE713736` | ✅ 新增 |
| HyperEVM | 999 | `0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb` | ✅ 新增 |
| MegaETH | 4326 | `0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb` | ✅ 新增 |
| Corn | 21000000 | `0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb` | ✅ 新增 |

---

## 修改的文件

### TypeScript SDK
- `typescript/packages/mechanisms/evm/src/tokens.ts` - USDT0 地址和 TOKEN_REGISTRY
- `typescript/packages/http/paywall/src/evmChains.ts` - 自定義鏈定義

### Go SDK
- `go/mechanisms/evm/constants.go` - NetworkConfigs 和 Chain IDs
- `services/facilitator/internal/config/config.go` - RPC 端點配置
- `services/facilitator/cmd/facilitator/main.go` - 網絡註冊

### Python SDK
- `python/t402/src/t402/chains.py` - NETWORK_TO_ID 和 KNOWN_TOKENS
- `python/t402/src/t402/networks.py` - EVMNetworks 和 EVM_NETWORK_TO_CHAIN_ID

---

## 驗證命令

```bash
# Go 構建測試
cd go && go build ./...

# TypeScript 構建測試
cd typescript && pnpm build

# Python 類型檢查
cd python/t402 && uv run mypy src/t402/

# 驗證 Facilitator 支持的網絡數量
curl -s https://facilitator.t402.io/supported | jq '.kinds | length'
```

---

## 預期成果

| 指標 | 變更前 | 變更後 |
|------|--------|--------|
| USDT0 網絡覆蓋 | 6/19 (32%) | 19/19 (100%) |
| 總 EVM 網絡數 | 7 | 20+ |
| T402 vs x402 | 10 vs 5 | 25+ vs 5 |

---

## 下一步

1. **構建測試**: 執行所有 SDK 的構建和測試
2. **EIP-3009 驗證**: 確認每個網絡的 USDT0 合約支持 EIP-3009
3. **測試環境部署**: 在測試環境驗證所有新網絡
4. **生產部署**: 更新生產環境的 Facilitator 服務
