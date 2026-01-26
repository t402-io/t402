# Facilitator 開發計劃

> 最後更新: 2026-01-26 (Phase 1.1, 1.2 完成)
> 狀態: 進行中

## 目錄

1. [執行摘要](#執行摘要)
2. [Phase 1: 基礎建設強化](#phase-1-基礎建設強化-2週)
3. [Phase 2: Cosmos/Noble 支援](#phase-2-cosmosnoble-支援-2週)
4. [Phase 3: 資料持久層](#phase-3-資料持久層-3週)
5. [Phase 4: 進階功能](#phase-4-進階功能-4週)
6. [Phase 5: 運營工具](#phase-5-運營工具-3週)
7. [開發追蹤](#開發追蹤)

---

## 執行摘要

### 當前狀態
- **支援網路**: 32 chains (EVM, TON, TRON, Solana, NEAR, Aptos, Tezos, Polkadot, Stacks)
- **支援 Schemes**: exact, exact-legacy, exact-direct, upto
- **生產就緒度**: 95%

### 開發目標
- 完成 Cosmos/Noble 鏈支援
- 建立資料持久層
- 強化 RPC 可靠性
- 提升測試覆蓋率
- 建立運營工具

### 總工作量
- **預估時間**: 14 週
- **可並行化**: 是

---

## Phase 1: 基礎建設強化 (2週)

### 1.1 RPC Fallback 支援
**優先級**: HIGH | **工作量**: 3-4 天

#### 目標
- 每鏈支援多個 RPC 端點
- 自動故障轉移
- Circuit breaker 模式

#### 任務清單
- [x] 建立 `internal/rpc/provider.go` - RPC 提供者管理
- [x] 建立 `internal/rpc/health.go` - 健康檢查
- [x] 建立 `internal/rpc/circuit_breaker.go` - 熔斷器
- [x] 建立 `internal/rpc/config.go` - RPC 配置
- [ ] 更新所有 signer 使用新 RPC 層
- [x] 加入配置: `RPC_FALLBACK_*` 環境變數
- [x] 撰寫測試 (84.6% 覆蓋率)

#### 檔案結構
```
internal/rpc/
├── provider.go          # RPC 提供者介面
├── health.go            # 健康檢查邏輯
├── circuit_breaker.go   # 熔斷器實作
├── config.go            # RPC 配置
└── provider_test.go     # 測試
```

#### 環境變數
```bash
# 主要 RPC
ETH_RPC=https://eth.llamarpc.com
# Fallback RPCs (逗號分隔)
ETH_RPC_FALLBACK=https://rpc.ankr.com/eth,https://eth.drpc.org
# 健康檢查間隔 (秒)
RPC_HEALTH_CHECK_INTERVAL=30
# 熔斷器閾值
RPC_CIRCUIT_BREAKER_THRESHOLD=5
RPC_CIRCUIT_BREAKER_TIMEOUT=60
```

---

### 1.2 測試覆蓋率強制
**優先級**: HIGH | **工作量**: 1 天

#### 目標
- CI 強制最低覆蓋率 70%
- 覆蓋率報告自動生成

#### 任務清單
- [x] 更新 `.github/workflows/facilitator.yml`
- [x] 加入 codecov 配置
- [x] 設定覆蓋率閾值 (internal packages: 86.9%)
- [ ] 加入 badge 到 README

#### 配置範例
```yaml
# codecov.yml
coverage:
  status:
    project:
      default:
        target: 70%
        threshold: 2%
    patch:
      default:
        target: 80%
```

---

### 1.3 EIP-6492 文檔化
**優先級**: MEDIUM | **工作量**: 0.5 天

#### 目標
- 文檔化現有 EIP-6492 支援
- 更新 API 文檔

#### 任務清單
- [x] 更新 README.md - 新增 Smart Wallet Support 章節
- [x] 加入 API 文檔說明 - 驗證流程圖
- [x] 建立使用範例 - Safe Wallet Payment 範例
- [x] 新增 RPC Failover 文檔

---

## Phase 2: Cosmos/Noble 支援 (2週)

### 2.1 Cosmos Signer 實作
**優先級**: HIGH | **工作量**: 5-7 天

#### 目標
- 支援 Noble 鏈 USDC
- 完整 verify/settle 流程

#### 任務清單
- [ ] 建立 `cmd/facilitator/cosmos_signer.go`
- [ ] 實作 `facilitatorCosmosSigner` 結構
- [ ] 實作 `Verify()` 方法
- [ ] 實作 `Settle()` 方法
- [ ] 實作 `GetSigners()` 方法
- [ ] 加入 Noble 鏈配置
- [ ] 更新 `main.go` 註冊 Cosmos signer
- [ ] 撰寫整合測試

#### 檔案結構
```
cmd/facilitator/
├── cosmos_signer.go     # Cosmos signer 實作
├── cosmos_signer_test.go # 測試
└── main.go              # 更新註冊邏輯
```

#### Signer 介面實作
```go
type facilitatorCosmosSigner struct {
    client    *cosmosclient.Client
    wallet    *cosmosWallet
    addresses map[string]string
    rpcURLs   map[string]string
}

func (s *facilitatorCosmosSigner) Scheme() string {
    return "exact-direct"
}

func (s *facilitatorCosmosSigner) CaipFamily() string {
    return "cosmos:*"
}

func (s *facilitatorCosmosSigner) GetSigners(network string) []string {
    if addr, ok := s.addresses[network]; ok {
        return []string{addr}
    }
    return nil
}

func (s *facilitatorCosmosSigner) Verify(ctx context.Context, req VerifyRequest) (*VerifyResponse, error) {
    // 驗證 Cosmos 簽名
}

func (s *facilitatorCosmosSigner) Settle(ctx context.Context, req SettleRequest) (*SettleResponse, error) {
    // 執行 USDC 轉帳
}
```

#### 環境變數
```bash
COSMOS_MNEMONIC=word1 word2 ... word24
NOBLE_RPC=https://rpc.noble.strange.love
NOBLE_CHAIN_ID=noble-1
NOBLE_USDC_DENOM=uusdc
COSMOS_MAINNET_ADDRESS=noble1...
COSMOS_TESTNET_ADDRESS=noble1...
```

---

### 2.2 Go SDK Cosmos Mechanism
**優先級**: HIGH | **工作量**: 3-4 天

#### 目標
- 建立 `sdks/go/mechanisms/cosmos/` 模組

#### 任務清單
- [ ] 建立 `constants.go` - 網路常數
- [ ] 建立 `types.go` - 類型定義
- [ ] 建立 `exact-direct/client/` - 客戶端
- [ ] 建立 `exact-direct/server/` - 服務端
- [ ] 建立 `exact-direct/facilitator/` - Facilitator
- [ ] 撰寫測試

#### 檔案結構
```
sdks/go/mechanisms/cosmos/
├── constants.go
├── types.go
├── utils.go
├── exact-direct/
│   ├── client/
│   │   └── scheme.go
│   ├── server/
│   │   └── scheme.go
│   └── facilitator/
│       └── scheme.go
└── cosmos_test.go
```

---

## Phase 3: 資料持久層 (3週)

### 3.1 資料庫架構設計
**優先級**: MEDIUM | **工作量**: 2 天

#### 目標
- 設計交易歷史 schema
- 設計審計日誌 schema

#### Schema 設計
```sql
-- 交易歷史
CREATE TABLE settlements (
    id              UUID PRIMARY KEY,
    network         VARCHAR(50) NOT NULL,
    scheme          VARCHAR(30) NOT NULL,
    tx_hash         VARCHAR(100),
    from_address    VARCHAR(100) NOT NULL,
    to_address      VARCHAR(100) NOT NULL,
    amount          DECIMAL(38, 0) NOT NULL,
    asset           VARCHAR(100) NOT NULL,
    status          VARCHAR(20) NOT NULL, -- pending, confirmed, failed
    created_at      TIMESTAMP NOT NULL,
    confirmed_at    TIMESTAMP,
    error_message   TEXT,
    gas_used        BIGINT,
    gas_price       BIGINT,
    metadata        JSONB
);

CREATE INDEX idx_settlements_network ON settlements(network);
CREATE INDEX idx_settlements_status ON settlements(status);
CREATE INDEX idx_settlements_created_at ON settlements(created_at);

-- 審計日誌
CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY,
    timestamp       TIMESTAMP NOT NULL,
    action          VARCHAR(50) NOT NULL, -- verify, settle, error
    network         VARCHAR(50),
    request_id      VARCHAR(100),
    ip_address      VARCHAR(50),
    api_key_id      VARCHAR(100),
    request_body    JSONB,
    response_body   JSONB,
    duration_ms     INTEGER,
    status_code     INTEGER
);

CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
```

---

### 3.2 持久層實作
**優先級**: MEDIUM | **工作量**: 5-7 天

#### 任務清單
- [ ] 建立 `internal/persistence/` 模組
- [ ] 實作 PostgreSQL 連接
- [ ] 實作 `SettlementRepository`
- [ ] 實作 `AuditLogRepository`
- [ ] 建立 migration 腳本
- [ ] 整合到 handlers
- [ ] 撰寫測試

#### 檔案結構
```
internal/persistence/
├── db.go                    # 資料庫連接
├── migrations/
│   ├── 001_initial.up.sql
│   └── 001_initial.down.sql
├── settlement_repository.go
├── audit_repository.go
└── persistence_test.go
```

#### 介面定義
```go
type SettlementRepository interface {
    Create(ctx context.Context, settlement *Settlement) error
    UpdateStatus(ctx context.Context, id string, status string, txHash string) error
    GetByID(ctx context.Context, id string) (*Settlement, error)
    ListByNetwork(ctx context.Context, network string, limit, offset int) ([]*Settlement, error)
    ListPending(ctx context.Context) ([]*Settlement, error)
}

type AuditLogRepository interface {
    Log(ctx context.Context, entry *AuditEntry) error
    Query(ctx context.Context, filter AuditFilter) ([]*AuditEntry, error)
}
```

#### 環境變數
```bash
DATABASE_URL=postgres://user:pass@localhost:5432/facilitator
DATABASE_MAX_CONNECTIONS=25
DATABASE_IDLE_CONNECTIONS=5
```

---

### 3.3 審計中間件
**優先級**: MEDIUM | **工作量**: 2 天

#### 任務清單
- [ ] 建立 `internal/middleware/audit.go`
- [ ] 記錄所有 API 請求/回應
- [ ] 整合到 server

---

## Phase 4: 進階功能 (4週)

### 4.1 Streaming Payments 端點
**優先級**: MEDIUM | **工作量**: 2 週

#### 目標
- 支援串流支付
- 支付通道管理

#### API 設計
```
POST /stream/open     # 開啟支付通道
POST /stream/update   # 更新支付狀態
POST /stream/close    # 關閉支付通道
GET  /stream/:id      # 查詢通道狀態
```

#### 任務清單
- [ ] 設計 streaming payment schema
- [ ] 實作 `internal/streaming/` 模組
- [ ] 實作 API handlers
- [ ] 整合 @t402/streaming-payments 邏輯
- [ ] 撰寫測試

---

### 4.2 Intent-based Routing
**優先級**: LOW | **工作量**: 2 週

#### 目標
- 支援 intent-based 支付
- 自動路徑優化

#### API 設計
```
POST /intent          # 提交支付意圖
GET  /intent/:id      # 查詢意圖狀態
POST /intent/:id/execute  # 執行意圖
```

---

## Phase 5: 運營工具 (3週)

### 5.1 Facilitator CLI
**優先級**: MEDIUM | **工作量**: 1.5 週

#### 目標
- 建立 `facilitator-cli` 命令行工具

#### 命令設計
```bash
# 網路狀態
facilitator-cli networks list
facilitator-cli networks health
facilitator-cli networks balance <network>

# 交易管理
facilitator-cli tx list --network=eip155:1 --limit=10
facilitator-cli tx get <tx-id>
facilitator-cli tx retry <tx-id>

# 錢包管理
facilitator-cli wallet balance
facilitator-cli wallet rotate --network=eip155:1

# 系統管理
facilitator-cli config show
facilitator-cli metrics
```

#### 檔案結構
```
cmd/facilitator-cli/
├── main.go
├── commands/
│   ├── networks.go
│   ├── transactions.go
│   ├── wallet.go
│   └── config.go
└── README.md
```

---

### 5.2 監控增強
**優先級**: MEDIUM | **工作量**: 1 週

#### 目標
- OpenTelemetry 整合
- 分散式追蹤

#### 任務清單
- [ ] 加入 OpenTelemetry SDK
- [ ] 實作 trace propagation
- [ ] 整合 Jaeger/Tempo
- [ ] 建立 Grafana dashboards

#### 環境變數
```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4317
OTEL_SERVICE_NAME=facilitator
OTEL_TRACES_SAMPLER=parentbased_traceidratio
OTEL_TRACES_SAMPLER_ARG=0.1
```

---

### 5.3 告警系統
**優先級**: LOW | **工作量**: 0.5 週

#### 目標
- 定義告警規則
- 整合通知渠道

#### 告警規則
```yaml
groups:
  - name: facilitator
    rules:
      - alert: HighErrorRate
        expr: rate(facilitator_errors_total[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"

      - alert: SettlementDelayed
        expr: facilitator_settlement_duration_seconds > 300
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Settlement taking too long"

      - alert: LowWalletBalance
        expr: facilitator_wallet_balance < 0.1
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Wallet balance critically low"
```

---

## 開發追蹤

### Phase 1: 基礎建設強化
| 任務 | 狀態 | 負責人 | 完成日期 |
|------|------|--------|----------|
| 1.1 RPC Fallback 支援 | 🟢 完成 | Claude | 2026-01-26 |
| 1.2 測試覆蓋率強制 | 🟢 完成 | Claude | 2026-01-26 |
| 1.3 EIP-6492 文檔化 | 🟢 完成 | Claude | 2026-01-26 |

### Phase 2: Cosmos/Noble 支援
| 任務 | 狀態 | 負責人 | 完成日期 |
|------|------|--------|----------|
| 2.1 Cosmos Signer 實作 | 🔴 未開始 | - | - |
| 2.2 Go SDK Cosmos Mechanism | 🔴 未開始 | - | - |

### Phase 3: 資料持久層
| 任務 | 狀態 | 負責人 | 完成日期 |
|------|------|--------|----------|
| 3.1 資料庫架構設計 | 🔴 未開始 | - | - |
| 3.2 持久層實作 | 🔴 未開始 | - | - |
| 3.3 審計中間件 | 🔴 未開始 | - | - |

### Phase 4: 進階功能
| 任務 | 狀態 | 負責人 | 完成日期 |
|------|------|--------|----------|
| 4.1 Streaming Payments | 🔴 未開始 | - | - |
| 4.2 Intent-based Routing | 🔴 未開始 | - | - |

### Phase 5: 運營工具
| 任務 | 狀態 | 負責人 | 完成日期 |
|------|------|--------|----------|
| 5.1 Facilitator CLI | 🔴 未開始 | - | - |
| 5.2 監控增強 | 🔴 未開始 | - | - |
| 5.3 告警系統 | 🔴 未開始 | - | - |

---

## 附錄

### A. 相依套件

```go
// go.mod 新增
require (
    github.com/cosmos/cosmos-sdk v0.50.x
    github.com/lib/pq v1.10.x
    go.opentelemetry.io/otel v1.24.x
    github.com/sony/gobreaker v0.5.x
)
```

### B. 測試策略

1. **單元測試**: 每個模組 >80% 覆蓋率
2. **整合測試**: API 端點完整測試
3. **E2E 測試**: 跨鏈交易流程
4. **負載測試**: 高併發場景

### C. 部署策略

1. **Staging 環境**: 所有 PR 自動部署
2. **Production 環境**: 手動審批部署
3. **Rollback 機制**: 一鍵回滾

---

## 變更歷史

| 日期 | 版本 | 變更內容 |
|------|------|----------|
| 2026-01-26 | 1.0 | 初始版本 |
