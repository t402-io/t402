# T402 Facilitator 深度安全與架構審查報告 v4.0

**版本**: 4.0
**日期**: 2026-01-27
**審查範圍**: Facilitator 服務完整程式碼庫
**狀態**: 已完成 P0 修復，待處理 P1/P2

---

## 執行摘要

本報告針對 T402 Facilitator 服務進行全面深度安全審查，涵蓋：
- 資金流向邏輯
- 私鑰管理
- 併發/競態條件
- API 完整性
- 狀態機設計

### 問題統計

| 優先級 | 數量 | 狀態 |
|--------|------|------|
| **P0 阻擋上線** | 12 | ✅ 已全部修復 |
| **P1 高優先** | 18 | 🔴 待修復 |
| **P2 中優先** | 14 | 🟡 下版本修復 |
| **總計** | **44** | |

---

## 第一部分：P0 阻擋上線問題（已修復）

### P0-1: SQL 注入 - ORDER BY 子句 ✅

| 項目 | 內容 |
|------|------|
| **確認狀態** | ✅ 已修復 |
| **問題描述** | `OrderBy` 參數直接插入 SQL 查詢，無白名單驗證 |
| **程式碼證據** | `internal/streaming/repository.go:356-365` |
| **商業風險** | 資料庫完全洩漏、資料竄改、服務癱瘓 |
| **修復方案** | 添加 `allowedOrderByColumns` 白名單驗證 |

### P0-2: CIDR 驗證邏輯錯誤 ✅

| 項目 | 內容 |
|------|------|
| **確認狀態** | ✅ 已修復 |
| **問題描述** | 使用字串前綴匹配代替正確的 CIDR 解析，`192.168.100.1` 會錯誤匹配 `192.168.1.0/24` |
| **程式碼證據** | `internal/server/middleware.go:288-305` |
| **商業風險** | IP 限流繞過、未授權存取、DDoS 攻擊 |
| **修復方案** | 使用 `net.ParseCIDR` 進行正確的 CIDR 驗證 |

### P0-3: Stream PauseStream 競態條件 ✅

| 項目 | 內容 |
|------|------|
| **確認狀態** | ✅ 已修復 |
| **問題描述** | 狀態檢查和更新之間無資料庫鎖 |
| **程式碼證據** | `internal/streaming/service.go:504-531` |
| **商業風險** | 狀態不一致、資金錯誤結算 |
| **修復方案** | 使用事務 + FOR UPDATE 鎖 |

### P0-4: Stream ResumeStream 競態條件 ✅

| 項目 | 內容 |
|------|------|
| **確認狀態** | ✅ 已修復 |
| **問題描述** | 同 P0-3 |
| **程式碼證據** | `internal/streaming/service.go:533-565` |
| **商業風險** | 狀態不一致、資金錯誤結算 |
| **修復方案** | 使用事務 + FOR UPDATE 鎖 |

### P0-5: Stream UpdateStream 競態條件 ✅

| 項目 | 內容 |
|------|------|
| **確認狀態** | ✅ 已修復 |
| **問題描述** | UpdateStream 操作未使用事務鎖，序列號非原子計算 |
| **程式碼證據** | `internal/streaming/service.go:206-311` |
| **商業風險** | 序列號衝突、重複支付、資金損失 |
| **修復方案** | 使用事務 + FOR UPDATE 鎖 + GetLatestUpdateInTx |

### P0-6: Intent SelectRoute 競態條件 ✅

| 項目 | 內容 |
|------|------|
| **確認狀態** | ✅ 已修復 |
| **問題描述** | 選擇路由時無資料庫鎖，可能導致路由選擇衝突 |
| **程式碼證據** | `internal/intent/service.go:183-256` |
| **商業風險** | 路由衝突、支付失敗、用戶體驗差 |
| **修復方案** | 使用事務 + FOR UPDATE 鎖 |

### P0-7: Intent CancelIntent 競態條件 ✅

| 項目 | 內容 |
|------|------|
| **確認狀態** | ✅ 已修復 |
| **問題描述** | 取消 Intent 時無鎖，可能與執行同時進行 |
| **程式碼證據** | `internal/intent/service.go:416-440` |
| **商業風險** | 已取消 Intent 被執行、資金損失 |
| **修復方案** | 使用事務 + FOR UPDATE 鎖 |

### P0-8: Auto-Settlement 雙重結算風險 ✅

| 項目 | 內容 |
|------|------|
| **確認狀態** | ✅ 已修復 |
| **問題描述** | 自動結算背景工作器無分散式鎖，可能導致雙重結算 |
| **程式碼證據** | `internal/streaming/service.go:731-782` |
| **商業風險** | 雙重支付、資金損失、財務損失 |
| **修復方案** | 每流單獨處理 + FOR UPDATE 鎖 + 樂觀更新 + 失敗回滾 |

### P0-9: TRON Signer 私鑰未清除 ✅

| 項目 | 內容 |
|------|------|
| **確認狀態** | ✅ 已修復 |
| **問題描述** | `privateKeyBytes` 解碼後從未清零 |
| **程式碼證據** | `cmd/facilitator/tron_signer.go:37-45` |
| **商業風險** | 私鑰洩漏、資金被盜 |
| **修復方案** | 添加 defer 清零 privateKeyBytes |

### P0-10: Solana Signer 私鑰未清除 ✅

| 項目 | 內容 |
|------|------|
| **確認狀態** | ✅ 已修復 |
| **問題描述** | seed 和 privateKeyBytes 從未清零 |
| **程式碼證據** | `cmd/facilitator/solana_signer.go:33-50` |
| **商業風險** | 私鑰洩漏、資金被盜 |
| **修復方案** | 添加 defer 清零 privateKeyBytes 和 ed25519PrivateKey |

### P0-11: Sequence Number 競態條件 ✅

| 項目 | 內容 |
|------|------|
| **確認狀態** | ✅ 已修復 |
| **問題描述** | Stream 更新的序列號計算非原子性 |
| **程式碼證據** | `internal/streaming/service.go:272-274` |
| **商業風險** | 序列號衝突、支付重放 |
| **修復方案** | 在 UpdateStream 事務中使用 GetLatestUpdateInTx |

### P0-12: big.Int SetString 返回值未檢查 ✅

| 項目 | 內容 |
|------|------|
| **確認狀態** | ✅ 已修復 |
| **問題描述** | SetString 返回值被忽略，無效金額會被設為 0 |
| **程式碼證據** | `internal/streaming/service.go` (多處) |
| **商業風險** | 零金額結算、資金損失 |
| **修復方案** | 所有 SetString 調用都檢查返回值 |

---

## 第二部分：P1 高優先問題（待修復）

### P1-1: processExpiredStreams 競態條件 🔴

| 項目 | 內容 |
|------|------|
| **確認狀態** | 🔴 待修復 |
| **問題描述** | 過期檢查工作器使用非事務性 `UpdateStatus()`，無 FOR UPDATE 鎖 |
| **程式碼證據** | `internal/streaming/service.go:686-712` |
| **商業風險** | 用戶 CloseStream 與 expiry worker 競態，狀態不一致 |
| **建議修改** | 將 UpdateStatus 改為事務性操作，使用 FOR UPDATE 鎖 |

```go
// 問題程式碼
func (s *Service) processExpiredStreams() {
    streams, err := s.repo.GetExpiredStreams(ctx)  // 無鎖
    for _, stream := range streams {
        s.repo.UpdateStatus(ctx, stream.ID, StreamStatusExpired)  // 無事務
    }
}

// 建議修復
func (s *Service) processExpiredStreams() {
    streams, err := s.repo.GetExpiredStreams(ctx)
    for _, stream := range streams {
        tx, _ := s.repo.BeginTx(ctx)
        defer tx.Rollback()
        s, _ := s.repo.GetByIDForUpdate(ctx, tx, stream.ID)
        if s.Status == StreamStatusExpired { continue }
        s.Status = StreamStatusExpired
        s.repo.UpdateInTx(ctx, tx, s)
        tx.Commit()
    }
}
```

---

### P1-2: processExpiredIntents 競態條件 🔴

| 項目 | 內容 |
|------|------|
| **確認狀態** | 🔴 待修復 |
| **問題描述** | 同 P1-1，Intent 過期檢查無事務保護 |
| **程式碼證據** | `internal/intent/service.go:510-528` |
| **商業風險** | 已過期 Intent 可能被選路或執行 |
| **建議修改** | 使用事務 + FOR UPDATE 鎖 |

---

### P1-3: EVM 私鑰 Zeroize 不完整 🔴

| 項目 | 內容 |
|------|------|
| **確認狀態** | 🔴 待修復 |
| **問題描述** | `Zeroize()` 方法只設置 D.SetInt64(0)，未清除完整 256 位元私鑰；且從未被調用 |
| **程式碼證據** | `cmd/facilitator/main.go:592-600` |
| **商業風險** | 私鑰在記憶體中持續存在，可被 memory dump 攻擊提取 |
| **建議修改** | |

```go
// 問題程式碼
func (s *facilitatorEvmSigner) Zeroize() {
    if s.privateKey != nil {
        if s.privateKey.D != nil {
            s.privateKey.D.SetInt64(0)  // 不完整清除
        }
        s.privateKey = nil
    }
}

// 建議修復
func (s *facilitatorEvmSigner) Zeroize() {
    if s.privateKey != nil && s.privateKey.D != nil {
        // 完整清除 big.Int 底層位元組
        dBytes := s.privateKey.D.Bytes()
        for i := range dBytes {
            dBytes[i] = 0
        }
        s.privateKey.D.SetBytes(dBytes)
        s.privateKey = nil
    }
}

// 並在 shutdown hook 中調用
```

---

### P1-4: Solana 私鑰永久存儲在記憶體 🔴

| 項目 | 內容 |
|------|------|
| **確認狀態** | 🔴 待修復 |
| **問題描述** | 64 位元組私鑰存儲在 struct 中，無 Zeroize 方法 |
| **程式碼證據** | `cmd/facilitator/solana_signer.go:18, 69` |
| **商業風險** | 私鑰長期暴露在記憶體中 |
| **建議修改** | 添加 Zeroize 方法並在 shutdown 時調用 |

---

### P1-5: Config 結構暴露私鑰字串 🔴

| 項目 | 內容 |
|------|------|
| **確認狀態** | 🔴 待修復 |
| **問題描述** | Config struct 包含私鑰/助記詞作為 string 欄位，可能被序列化或記錄 |
| **程式碼證據** | `internal/config/config.go:38, 69, 76, 80` |
| **商業風險** | 私鑰可能出現在日誌、錯誤訊息、JSON 序列化中 |
| **建議修改** | |

```go
// 問題結構
type Config struct {
    EvmPrivateKey  string  // 危險
    TonMnemonic    string  // 危險
    TronPrivateKey string  // 危險
    SvmPrivateKey  string  // 危險
}

// 建議修復：使用 SecureString 包裝
type SecureString struct {
    value []byte  // 使用 []byte 以便清零
}

func (s *SecureString) Get() string {
    return string(s.value)
}

func (s *SecureString) Zeroize() {
    for i := range s.value {
        s.value[i] = 0
    }
}

// MarshalJSON 返回 "[REDACTED]"
func (s SecureString) MarshalJSON() ([]byte, error) {
    return []byte(`"[REDACTED]"`), nil
}
```

---

### P1-6: 測試檔案暴露私鑰模式 🔴

| 項目 | 內容 |
|------|------|
| **確認狀態** | 🔴 待修復 |
| **問題描述** | 測試檔案在錯誤訊息中包含私鑰值 |
| **程式碼證據** | `internal/config/config_test.go:103, 141-142` |
| **商業風險** | CI 日誌可能暴露私鑰格式 |
| **建議修改** | 使用隨機生成的測試金鑰，錯誤訊息中不包含實際值 |

---

### P1-7: 缺少安全標頭 🔴

| 項目 | 內容 |
|------|------|
| **確認狀態** | 🔴 待修復 |
| **問題描述** | 缺少關鍵 HTTP 安全標頭：X-Frame-Options, X-Content-Type-Options, HSTS, CSP |
| **程式碼證據** | `internal/server/middleware.go` (CORS 處理區域) |
| **商業風險** | XSS、點擊劫持、MIME 類型混淆攻擊 |
| **建議修改** | |

```go
// 添加安全標頭中介軟體
func SecurityHeaders() gin.HandlerFunc {
    return func(c *gin.Context) {
        c.Header("X-Frame-Options", "DENY")
        c.Header("X-Content-Type-Options", "nosniff")
        c.Header("X-XSS-Protection", "1; mode=block")
        c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
        if isProduction() {
            c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        }
        c.Next()
    }
}
```

---

### P1-8: API Key 查詢參數認證風險 🔴

| 項目 | 內容 |
|------|------|
| **確認狀態** | 🔴 待修復 |
| **問題描述** | 允許通過 URL 查詢參數傳遞 API Key（雖然預設禁用） |
| **程式碼證據** | `internal/auth/middleware.go:71-82` |
| **商業風險** | API Key 可能出現在日誌、瀏覽器歷史、HTTP Referer |
| **建議修改** | 完全移除查詢參數認證功能 |

---

### P1-9: Idempotency Key 無格式驗證 🔴

| 項目 | 內容 |
|------|------|
| **確認狀態** | 🔴 待修復 |
| **問題描述** | Idempotency-Key 標頭無長度或格式驗證 |
| **程式碼證據** | `internal/server/handlers.go:99` |
| **商業風險** | Redis 記憶體溢出、快取污染 |
| **建議修改** | |

```go
// 建議驗證
func validateIdempotencyKey(key string) error {
    if len(key) > 64 {
        return errors.New("idempotency key too long (max 64 chars)")
    }
    if !regexp.MustCompile(`^[a-zA-Z0-9_-]+$`).MatchString(key) {
        return errors.New("invalid idempotency key format")
    }
    return nil
}
```

---

### P1-10: CloseStream 兩階段事務風險 🔴

| 項目 | 內容 |
|------|------|
| **確認狀態** | 🔴 待修復 |
| **問題描述** | CloseStream 使用兩個事務，結算在事務外執行，若失敗可能導致狀態不一致 |
| **程式碼證據** | `internal/streaming/service.go:397-466` |
| **商業風險** | 流卡在 "closing" 狀態，無法恢復 |
| **建議修改** | 添加狀態恢復機制或使用 saga 模式 |

---

### P1-11: ExecuteIntent 三階段事務風險 🔴

| 項目 | 內容 |
|------|------|
| **確認狀態** | 🔴 待修復 |
| **問題描述** | ExecuteIntent 使用三個事務，支付在事務間執行 |
| **程式碼證據** | `internal/intent/service.go:260-385` |
| **商業風險** | Intent 卡在 "executing" 狀態，支付狀態未知 |
| **建議修改** | 添加恢復機制，記錄中間狀態以便手動解決 |

---

### P1-12: ExecuteIntent 前置條件模糊 🔴

| 項目 | 內容 |
|------|------|
| **確認狀態** | 🔴 待修復 |
| **問題描述** | ExecuteIntent 同時接受 "routed" 和 "pending" 狀態 |
| **程式碼證據** | `internal/intent/service.go:276` |
| **商業風險** | 協議流程模糊，可能跳過路由選擇步驟 |
| **建議修改** | 明確要求 "routed" 狀態，或分離為兩個不同的 API |

---

### P1-13: RefreshRoutes 非原子操作 🔴

| 項目 | 內容 |
|------|------|
| **確認狀態** | 🔴 待修復 |
| **問題描述** | RefreshRoutes 在事務外讀取和更新 |
| **程式碼證據** | `internal/intent/service.go:457-491` |
| **商業風險** | 狀態變更競態，路由可能與當前狀態不一致 |
| **建議修改** | 使用事務 + FOR UPDATE 鎖 |

---

### P1-14: Cosmos UsedTxHash 清理後可重放 🔴

| 項目 | 內容 |
|------|------|
| **確認狀態** | 🔴 待修復 |
| **問題描述** | 已使用的交易雜湊在 1 小時後從記憶體中清除，可能被重放 |
| **程式碼證據** | `sdks/go/mechanisms/cosmos/exact-direct/facilitator/scheme.go:251-279` |
| **商業風險** | 交易重放攻擊 |
| **建議修改** | 使用持久化存儲（Redis/DB）並設置更長的 TTL |

---

### P1-15: Idempotency TTL 過期後可重複結算 🔴

| 項目 | 內容 |
|------|------|
| **確認狀態** | 🔴 待修復 |
| **問題描述** | 冪等性 Key 在 24 小時後過期，客戶端重試可能導致重複結算 |
| **程式碼證據** | `internal/idempotency/store.go:43-52` |
| **商業風險** | 24 小時後的重試可能導致雙重支付 |
| **建議修改** | 增加 TTL 或使用永久存儲關鍵結算記錄 |

---

### P1-16: Streaming/Intent 處理程序輸入驗證不足 🔴

| 項目 | 內容 |
|------|------|
| **確認狀態** | 🔴 待修復 |
| **問題描述** | OpenStream, UpdateStream, CreateIntent 等使用通用 JSON 綁定，無欄位大小限制 |
| **程式碼證據** | `internal/streaming/handlers.go:46-52`, `internal/intent/handlers.go:47-53` |
| **商業風險** | DoS 攻擊（大型無效 JSON 負載） |
| **建議修改** | 添加明確的欄位大小和格式驗證 |

---

### P1-17: Rate Limiter 記憶體洩漏 🔴

| 項目 | 內容 |
|------|------|
| **確認狀態** | 🔴 待修復 |
| **問題描述** | `updateLimits` map 只增不減，長期運行會導致記憶體增長 |
| **程式碼證據** | `internal/streaming/service.go:74-76, 630-667` |
| **商業風險** | 服務長期運行後記憶體耗盡 |
| **建議修改** | 添加定期清理或使用 TTL 快取 |

---

### P1-18: 缺少 Per-API-Key 限流 🔴

| 項目 | 內容 |
|------|------|
| **確認狀態** | 🔴 待修復 |
| **問題描述** | API Key 有 RateLimit 欄位但從未使用，限流只按 IP |
| **程式碼證據** | `internal/auth/apikey.go:30`, `internal/server/middleware.go:199-250` |
| **商業風險** | 無法限制單一 API Key 的使用量 |
| **建議修改** | 在限流中介軟體中檢查並應用 API Key 限流 |

---

## 第三部分：P2 中優先問題（下版本修復）

### P2-1: TON clearString 不可靠 🟡

| 項目 | 內容 |
|------|------|
| **確認狀態** | 🟡 下版本 |
| **問題描述** | Go 字串不可變，unsafe 指標清零可能不徹底 |
| **程式碼證據** | `cmd/facilitator/ton_signer.go:160-169` |
| **商業風險** | 助記詞可能在 GC 複製後殘留 |
| **建議修改** | 從一開始就使用 []byte 而非 string |

---

### P2-2: 環境變數未清除 🟡

| 項目 | 內容 |
|------|------|
| **確認狀態** | 🟡 下版本 |
| **問題描述** | 從環境變數讀取私鑰後未清除 |
| **程式碼證據** | `internal/config/config.go:126-239` |
| **商業風險** | 私鑰在環境中持續可見 |
| **建議修改** | 讀取後 `os.Unsetenv()` 敏感環境變數 |

---

### P2-3: 無私鑰輪換機制 🟡

| 項目 | 內容 |
|------|------|
| **確認狀態** | 🟡 下版本 |
| **問題描述** | 服務啟動後無法更換私鑰，需完整重啟 |
| **程式碼證據** | `cmd/facilitator/main.go:137-524` |
| **商業風險** | 金鑰洩漏後無法快速輪換 |
| **建議修改** | 添加熱重載機制或 SIGHUP 信號處理 |

---

### P2-4: TRON 確認時序問題 🟡

| 項目 | 內容 |
|------|------|
| **確認狀態** | 🟡 下版本 |
| **問題描述** | Solidity 節點延遲可能導致確認假陰性 |
| **程式碼證據** | `cmd/facilitator/tron_signer.go:301-349` |
| **商業風險** | 交易可能在 mempool 但未被識別 |
| **建議修改** | 增加重試邏輯或查詢多個節點 |

---

### P2-5: 開發環境 CORS 萬用字元 🟡

| 項目 | 內容 |
|------|------|
| **確認狀態** | 🟡 下版本 |
| **問題描述** | 開發環境預設使用 CORS `*` |
| **程式碼證據** | `internal/config/config.go:131-137` |
| **商業風險** | 可能意外部署萬用字元 CORS |
| **建議修改** | 所有環境都要求明確配置 |

---

### P2-6: Request ID 回退可預測 🟡

| 項目 | 內容 |
|------|------|
| **確認狀態** | 🟡 下版本 |
| **問題描述** | crypto/rand 失敗時回退到時間戳 |
| **程式碼證據** | `internal/server/middleware.go:65-67` |
| **商業風險** | 可預測的 request ID |
| **建議修改** | crypto/rand 失敗時 panic 而非回退 |

---

### P2-7: API Key 驗證無限流 🟡

| 項目 | 內容 |
|------|------|
| **確認狀態** | 🟡 下版本 |
| **問題描述** | 無效 API Key 驗證嘗試無限流 |
| **程式碼證據** | `internal/auth/middleware.go:107` |
| **商業風險** | API Key 暴力破解 |
| **建議修改** | 添加失敗認證嘗試限流 |

---

### P2-8: Streaming 錯誤訊息洩漏 🟡

| 項目 | 內容 |
|------|------|
| **確認狀態** | 🟡 下版本 |
| **問題描述** | 錯誤回應包含原始 error.Error() |
| **程式碼證據** | `internal/streaming/handlers.go:49, 71, 130` |
| **商業風險** | 可能洩漏內部實作細節 |
| **建議修改** | 消毒錯誤訊息 |

---

### P2-9: 配置超時值未驗證 🟡

| 項目 | 內容 |
|------|------|
| **確認狀態** | 🟡 下版本 |
| **問題描述** | HTTP 超時可配置但無邊界驗證 |
| **程式碼證據** | `internal/config/config.go:247-251` |
| **商業風險** | 超時設為 0 可能導致請求永不超時 |
| **建議修改** | 驗證 timeout > 0 && timeout <= 300 |

---

### P2-10: API Key 使用追蹤競態 🟡

| 項目 | 內容 |
|------|------|
| **確認狀態** | 🟡 下版本 |
| **問題描述** | UsageCount 和 LastUsedAt 更新不完全原子 |
| **程式碼證據** | `internal/auth/apikey.go:225-237` |
| **商業風險** | 統計數據不準確 |
| **建議修改** | 使用完整事務或分離追蹤 |

---

### P2-11: 缺少終端狀態驗證 🟡

| 項目 | 內容 |
|------|------|
| **確認狀態** | 🟡 下版本 |
| **問題描述** | 無狀態機驗證器防止非法狀態轉換 |
| **程式碼證據** | `internal/streaming/service.go`, `internal/intent/service.go` |
| **商業風險** | 可能從終端狀態（completed, cancelled）進行非法轉換 |
| **建議修改** | 添加狀態機驗證器 |

---

### P2-12: OpenStream 跳過 pending 狀態 🟡

| 項目 | 內容 |
|------|------|
| **確認狀態** | 🟡 下版本 |
| **問題描述** | 流直接建立為 active，跳過存款驗證 |
| **程式碼證據** | `internal/streaming/models.go:173` |
| **商業風險** | 無存款的流可以開始 |
| **建議修改** | 實作 pending → active 狀態轉換 |

---

### P2-13: 缺少卡住狀態監控 🟡

| 項目 | 內容 |
|------|------|
| **確認狀態** | 🟡 下版本 |
| **問題描述** | 無監控或告警針對卡在 "closing" 或 "executing" 狀態的項目 |
| **程式碼證據** | N/A |
| **商業風險** | 異常狀態未被發現 |
| **建議修改** | 添加 Prometheus 指標追蹤中間狀態 |

---

### P2-14: 缺少背景工作器指數退避 🟡

| 項目 | 內容 |
|------|------|
| **確認狀態** | 🟡 下版本 |
| **問題描述** | expiryWorker 和 autoSettleWorker 失敗後無指數退避 |
| **程式碼證據** | `internal/streaming/service.go:669-683` |
| **商業風險** | 錯誤時可能產生大量無效請求 |
| **建議修改** | 添加錯誤退避機制 |

---

## 第四部分：修改清單總覽

### 已完成修復（P0）

| 編號 | 問題 | 檔案 | 狀態 |
|------|------|------|------|
| P0-1 | SQL 注入 - ORDER BY | `streaming/repository.go` | ✅ |
| P0-2 | CIDR 驗證錯誤 | `server/middleware.go` | ✅ |
| P0-3 | PauseStream 競態 | `streaming/service.go` | ✅ |
| P0-4 | ResumeStream 競態 | `streaming/service.go` | ✅ |
| P0-5 | UpdateStream 競態 | `streaming/service.go` | ✅ |
| P0-6 | SelectRoute 競態 | `intent/service.go` | ✅ |
| P0-7 | CancelIntent 競態 | `intent/service.go` | ✅ |
| P0-8 | Auto-Settlement 雙重結算 | `streaming/service.go` | ✅ |
| P0-9 | TRON 私鑰未清除 | `tron_signer.go` | ✅ |
| P0-10 | Solana 私鑰未清除 | `solana_signer.go` | ✅ |
| P0-11 | Sequence Number 競態 | `streaming/service.go` | ✅ |
| P0-12 | SetString 未檢查 | `streaming/service.go` | ✅ |

### 待修復（P1）

| 編號 | 問題 | 檔案 | 影響 |
|------|------|------|------|
| P1-1 | processExpiredStreams 競態 | `streaming/service.go:686-712` | 狀態不一致 |
| P1-2 | processExpiredIntents 競態 | `intent/service.go:510-528` | 過期 Intent 被執行 |
| P1-3 | EVM Zeroize 不完整 | `main.go:592-600` | 私鑰洩漏 |
| P1-4 | Solana 私鑰永久存儲 | `solana_signer.go:18, 69` | 私鑰洩漏 |
| P1-5 | Config 暴露私鑰 | `config/config.go:38, 69, 76, 80` | 私鑰洩漏 |
| P1-6 | 測試暴露私鑰模式 | `config/config_test.go:103, 141-142` | CI 洩漏 |
| P1-7 | 缺少安全標頭 | `server/middleware.go` | XSS/點擊劫持 |
| P1-8 | Query 參數 API Key | `auth/middleware.go:71-82` | Key 洩漏 |
| P1-9 | Idempotency Key 無驗證 | `server/handlers.go:99` | DoS |
| P1-10 | CloseStream 兩階段風險 | `streaming/service.go:397-466` | 狀態卡住 |
| P1-11 | ExecuteIntent 三階段風險 | `intent/service.go:260-385` | 狀態卡住 |
| P1-12 | ExecuteIntent 前置條件模糊 | `intent/service.go:276` | 協議模糊 |
| P1-13 | RefreshRoutes 非原子 | `intent/service.go:457-491` | 競態條件 |
| P1-14 | Cosmos UsedTxHash 重放 | `cosmos/.../scheme.go:251-279` | 交易重放 |
| P1-15 | Idempotency TTL 過期重複結算 | `idempotency/store.go:43-52` | 雙重支付 |
| P1-16 | Handler 輸入驗證不足 | `handlers.go` (多處) | DoS |
| P1-17 | Rate Limiter 記憶體洩漏 | `streaming/service.go:74-76` | 記憶體耗盡 |
| P1-18 | 缺少 Per-API-Key 限流 | `server/middleware.go` | 無法限制 |

### 下版本修復（P2）

| 編號 | 問題 | 檔案 | 影響 |
|------|------|------|------|
| P2-1 | TON clearString 不可靠 | `ton_signer.go:160-169` | 助記詞殘留 |
| P2-2 | 環境變數未清除 | `config/config.go:126-239` | 私鑰可見 |
| P2-3 | 無私鑰輪換機制 | `main.go:137-524` | 無法輪換 |
| P2-4 | TRON 確認時序問題 | `tron_signer.go:301-349` | 假陰性 |
| P2-5 | 開發 CORS 萬用字元 | `config/config.go:131-137` | 意外暴露 |
| P2-6 | Request ID 回退可預測 | `middleware.go:65-67` | 可預測 |
| P2-7 | API Key 驗證無限流 | `auth/middleware.go:107` | 暴力破解 |
| P2-8 | Streaming 錯誤訊息洩漏 | `handlers.go` (多處) | 資訊洩漏 |
| P2-9 | 配置超時未驗證 | `config/config.go:247-251` | 永不超時 |
| P2-10 | API Key 追蹤競態 | `apikey.go:225-237` | 統計不準 |
| P2-11 | 缺少終端狀態驗證 | service.go (多處) | 非法轉換 |
| P2-12 | OpenStream 跳過 pending | `models.go:173` | 無存款開始 |
| P2-13 | 缺少卡住狀態監控 | N/A | 異常未發現 |
| P2-14 | 缺少背景工作器退避 | `service.go:669-683` | 大量無效請求 |

---

## 第五部分：資金流向安全評估

### 資金流向模式

| 機制 | 流向 | Facilitator 角色 | 可逆性 |
|------|------|------------------|--------|
| EVM | Payer → Payee | 簽名 + 廣播 | 不可逆 |
| TON | Payer → Payee | 廣播簽名訊息 | 不可逆 |
| TRON | Payer → Payee | 廣播簽名交易 | 不可逆 |
| Solana | Payer → Payee | 添加 fee payer 簽名 | 不可逆 |
| NEAR/Aptos/Tezos/Polkadot/Stacks | Payer → Payee | 僅驗證 | 不可逆 |
| Cosmos | Payer → Facilitator → Payee | 驗證 + 追蹤 | 不可逆 |

### 安全特性

- ✅ **無託管模式**：Facilitator 不持有資金
- ✅ **直接支付**：資金直接從付款人到收款人
- ✅ **鏈上最終性**：所有交易一旦確認即不可逆
- ✅ **冪等性保護**：防止重複結算
- ⚠️ **Cosmos 交易追蹤**：僅記憶體存儲，1 小時後可重放

---

## 第六部分：結論與建議

### 立即行動（P1 前 5 項）

1. **processExpiredStreams/Intents 競態修復** - 高風險
2. **EVM/Solana 私鑰完整清除** - 高風險
3. **Config 私鑰保護** - 高風險
4. **添加 HTTP 安全標頭** - 合規要求
5. **Idempotency Key 格式驗證** - DoS 防護

### 架構改進建議

1. **狀態機驗證器**：添加集中式狀態轉換驗證
2. **Saga 模式**：改進長事務的補償機制
3. **分散式鎖**：對背景工作器使用 Redis 分散式鎖
4. **監控告警**：添加中間狀態持續時間告警
5. **私鑰管理**：考慮使用 HSM 或 KMS

### 測試覆蓋建議

1. 競態條件測試（使用 `-race` flag）
2. 狀態轉換邊界測試
3. 錯誤恢復測試
4. 負載測試（大量並發請求）

---

**報告生成時間**: 2026-01-27
**審查人**: Claude Code Security Agent
**下次審查**: 建議 P1 修復後進行追蹤審查
