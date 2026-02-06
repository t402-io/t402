# 專案管理儀表板 (Project Manager Dashboard)

你是 T402 專案的專案經理。執行以下所有檢查並以**繁體中文**輸出完整的專案狀態報告。

---

## 第一部分：專案狀態總覽

### 1a. SDK 版本（從原始碼讀取）

讀取以下檔案取得各 SDK 目前版本：

| SDK | 版本來源檔案 | 欄位 |
|-----|-------------|------|
| TypeScript | `sdks/typescript/packages/core/package.json` | `"version"` |
| Go | 執行 `git tag -l 'go/v*' --sort=-v:refname \| head -1` | 去除 `go/v` 前綴 |
| Python | `sdks/python/t402/pyproject.toml` | `version = "..."` |
| Java | `sdks/java/t402/pom.xml` | `<version>...</version>` |

### 1b. TypeScript 套件版本一致性

確認所有 27 個 `@t402/*` 套件的 `package.json` 版本號一致：

```bash
find sdks/typescript/packages -name "package.json" -not -path "*/node_modules/*" -not -path "*/dist/*"
```

讀取所有檔案的 `"version"` 欄位，若有不一致則列出差異。

### 1c. Git 狀態

```bash
git status --short
git log --oneline -10
git rev-list HEAD..origin/main --count 2>/dev/null || echo "no remote tracking"
git rev-list origin/main..HEAD --count 2>/dev/null || echo "no remote tracking"
```

報告：
- 是否有未提交的變更
- 是否有未推送的 commits
- 最近 10 筆 commit 摘要

---

## 第二部分：開發計畫進度

讀取 `DEVELOPMENT_PLAN_2026_Q1_Q2.md`，產生進度總結：

### 檢查項目

1. 各 Phase 的完成狀態（✅ / ⏳ / ❌）
2. 「Remaining Items」區塊中的待辦事項
3. 「Excluded」區塊中延後到 Q3-Q4 的項目
4. Success Metrics 表格的達成情況

### 輸出格式

```
## 開發計畫進度

| 階段 | 名稱 | 狀態 | 備註 |
|------|------|------|------|
| Phase 1 | 安全性修復 | ✅ 完成 | 18/18 P1 修復 |
| Phase 2 | 協議功能 | ✅ 完成 | A2A + Bazaar + upto |
| ... | ... | ... | ... |

### 待完成項目
- [ ] 智能合約外部審計
- [ ] 4 個 Facilitator 錢包部署（Aptos, Tezos, Polkadot, Stacks）

### 延後到 Q3-Q4
- Rust/Swift SDK, MEV 保護, 訂閱制支付 ...
```

---

## 第三部分：發布就緒度

### 3a. CHANGELOG 檢查

讀取各 SDK 的 CHANGELOG 檔案，確認最新版本的 entry 是否存在：

| SDK | CHANGELOG 路徑 |
|-----|----------------|
| TypeScript | `CHANGELOG.md`（根目錄）|
| Go | `sdks/go/CHANGELOG.md` |
| Python | `sdks/python/CHANGELOG.md` |
| Java | `sdks/java/CHANGELOG.md` |

### 3b. 已發布版本 vs 本地版本

檢查各 registry 上已發布的版本：

```bash
# npm（TypeScript）
npm view @t402/core version 2>/dev/null || echo "未發布或無法查詢"

# PyPI（Python）
pip index versions t402 2>/dev/null | head -1 || echo "未發布或無法查詢"

# Go Modules
go list -m -versions github.com/t402-io/t402/sdks/go 2>/dev/null | awk '{print $NF}' || echo "未發布或無法查詢"
```

比較本地版本與已發布版本，標記是否有未發布的變更。

### 3c. CI 狀態

```bash
gh run list --limit 5 --json name,status,conclusion,headBranch,createdAt
```

列出最近 5 次 CI 運行的狀態，特別標記失敗的 runs。

---

## 第四部分：基礎設施健康

### 4a. Facilitator API

```bash
# 健康檢查
curl -s --max-time 5 https://facilitator.t402.io/health || echo "無法連線"

# 支援的網路數量
curl -s --max-time 5 https://facilitator.t402.io/supported | jq '.kinds | length' 2>/dev/null || echo "無法查詢"
```

### 4b. 文件站點

```bash
curl -s --max-time 5 -o /dev/null -w "%{http_code}" https://docs.t402.io || echo "無法連線"
curl -s --max-time 5 -o /dev/null -w "%{http_code}" https://t402.io || echo "無法連線"
```

報告各服務回應狀態碼。

---

## 第五部分：依賴與安全

### 5a. Dependabot PRs

```bash
gh pr list --label "dependencies" --json number,title,createdAt --limit 10
```

如果有未合併的 dependabot PR，列出數量和標題。

### 5b. 安全快速掃描

```bash
# Go 漏洞
cd sdks/go && govulncheck ./... 2>&1 | tail -5; cd -

# npm audit
cd sdks/typescript && pnpm audit --json 2>/dev/null | jq '.metadata.vulnerabilities' 2>/dev/null || echo "無法查詢"; cd -
```

---

## 第六部分：行動建議

根據以上所有檢查結果，產生 **優先排序的行動建議清單**。格式：

```
## 🔧 行動建議

### 🔴 緊急（立即處理）
1. [問題描述] — [建議行動]

### 🟡 重要（本週處理）
1. [問題描述] — [建議行動]

### 🟢 建議（排程處理）
1. [問題描述] — [建議行動]

### ✅ 狀態良好
- [描述哪些項目狀態正常]
```

行動建議的分類邏輯：
- **🔴 緊急**：CI 失敗、facilitator 無回應、安全漏洞、版本不一致
- **🟡 重要**：未推送 commits、未發布的變更、過期的 dependabot PR、CHANGELOG 缺失
- **🟢 建議**：開發計畫中的待辦項目、延後的功能、文件改善

---

## 輸出格式

最終報告使用以下結構：

```markdown
# 📊 T402 專案狀態報告

> 報告時間：YYYY-MM-DD HH:MM

## 1. 版本狀態
[版本表格]

## 2. Git 狀態
[git 資訊]

## 3. 開發計畫進度
[計畫進度表格 + 待完成項目]

## 4. 發布就緒度
[CHANGELOG + 已發布版本 + CI 狀態]

## 5. 基礎設施健康
[Facilitator + 文件站 + 服務狀態]

## 6. 依賴與安全
[Dependabot + 漏洞掃描]

## 7. 🔧 行動建議
[優先排序的建議清單]
```

所有檢查**並行執行**以節省時間。讀取檔案和執行命令時盡量使用並行 tool calls。
