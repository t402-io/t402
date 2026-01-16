# T402 Project Manager Skill

> 统一管理 T402 项目的开发进度、发布、监控和运维

## 概述

本 skill 用于管理 T402 项目的完整生命周期，包括：

- **SDK 发布管理**: npm (21 packages), PyPI, Go Modules, Maven Central
- **服务管理**: Facilitator, 文档站点, 主站
- **监控告警**: Grafana, Prometheus, 热钱包余额
- **进度追踪**: GitHub Issues, ROADMAP, 未完成任务

---

## 快速命令

当用户调用 `/pm` 时，显示以下菜单并等待用户选择：

```
T402 Project Manager
====================

1. [status]     - 检查所有服务和 SDK 状态
2. [release]    - 发布 SDK (npm/pypi/go/maven)
3. [deploy]     - 部署服务 (facilitator/docs/site)
4. [monitor]    - 检查监控和告警
5. [wallet]     - 检查热钱包余额
6. [progress]   - 查看开发进度和待办事项
7. [issues]     - 管理 GitHub Issues
8. [version]    - 查看/更新版本号
9. [changelog]  - 生成变更日志
10. [health]    - 全面健康检查

请输入命令编号或名称:
```

---

## 1. 状态检查 (status)

### 执行步骤

1. **检查线上服务状态**
```bash
# Facilitator
curl -s https://facilitator.t402.io/health | jq '.'
curl -s https://facilitator.t402.io/ready | jq '.'

# 文档站点
curl -s -o /dev/null -w "%{http_code}" https://docs.t402.io/

# 主站
curl -s -o /dev/null -w "%{http_code}" https://t402.io/

# Grafana
curl -s -o /dev/null -w "%{http_code}" https://grafana.facilitator.t402.io/
```

2. **检查 SDK 最新版本**
```bash
# npm
npm view @t402/core version 2>/dev/null
npm view @t402/evm version 2>/dev/null

# PyPI
pip index versions t402 2>/dev/null | head -1

# Go
go list -m -versions github.com/t402-io/t402/go 2>/dev/null | awk '{print $NF}'
```

3. **检查支持的网络**
```bash
curl -s https://facilitator.t402.io/supported | jq -r '.kinds[] | "\(.network)"' | sort -u
```

### 输出格式

```
=== T402 项目状态报告 ===

📡 服务状态:
  Facilitator:  ✅ healthy (v2.0.0)
  Docs:         ✅ 200 OK
  Website:      ✅ 200 OK
  Grafana:      ✅ 200 OK

📦 SDK 版本:
  TypeScript:   @t402/core@2.0.0 (21 packages)
  Python:       t402@1.5.3
  Go:           v1.3.1
  Java:         1.0.0-SNAPSHOT (未发布)

🔗 支持网络:
  EVM: Ethereum, Base, Arbitrum, Optimism, Ink, Unichain, Berachain
  TRON: Mainnet, Nile, Shasta
  Solana: Mainnet, Devnet
  TON: ❌ 未启用
```

---

## 2. 发布管理 (release)

### 发布流程

#### TypeScript (npm)
```bash
# 触发方式: 推送 v* tag 或手动触发
git tag v2.1.0
git push origin v2.1.0

# 或手动触发
gh workflow run npm_release.yml -f package=all -f dry_run=false
```

**Workflow**: `.github/workflows/npm_release.yml`
**Token**: `NPM_TOKEN`
**包列表** (21个):
- core, extensions
- evm, svm, ton, tron
- express, next, hono, fastify
- fetch, axios
- paywall, react, vue
- wdk, wdk-gasless, wdk-bridge, wdk-multisig
- mcp, cli

#### Python (PyPI)
```bash
# 触发方式: 推送 python/v* tag
git tag python/v1.6.0
git push origin python/v1.6.0

# 或手动触发
gh workflow run python_release.yml -f dry_run=false
```

**Workflow**: `.github/workflows/python_release.yml`
**Token**: `PYPI_API_TOKEN`

#### Go (Go Modules)
```bash
# 触发方式: 推送 go/v* tag
git tag go/v1.4.0
git push origin go/v1.4.0
```

**Workflow**: `.github/workflows/go_release.yml`
**注意**: Go modules 通过 tag 自动发布到 proxy.golang.org

#### Java (Maven Central)
```bash
# 触发方式: 推送 java/v* tag
git tag java/v1.0.0
git push origin java/v1.0.0

# 或手动触发
gh workflow run java_release.yml -f dry_run=false
```

**Workflow**: `.github/workflows/java_release.yml`
**Secrets**: `OSSRH_USERNAME`, `OSSRH_TOKEN`, `GPG_PRIVATE_KEY`, `GPG_PASSPHRASE`
**状态**: ⚠️ 需要配置 Maven Central 凭证

### 版本命名规范

| SDK | Tag 格式 | 示例 |
|-----|----------|------|
| TypeScript | `v*` | `v2.1.0` |
| Python | `python/v*` | `python/v1.6.0` |
| Go | `go/v*` | `go/v1.4.0` |
| Java | `java/v*` | `java/v1.0.0` |

---

## 3. 部署管理 (deploy)

### Facilitator 服务

**部署方式**: Watchtower 自动部署 (监听 ghcr.io/t402-io/facilitator:latest)

```bash
# 手动触发构建
gh workflow run facilitator.yml

# 检查最新镜像
docker pull ghcr.io/t402-io/facilitator:latest
docker inspect ghcr.io/t402-io/facilitator:latest | jq '.[0].Created'
```

**Docker Compose 配置**:
- 开发: `services/facilitator/docker-compose.yaml`
- 生产: `services/facilitator/docker-compose.prod.yaml`

**环境变量** (`.env`):
```bash
# 必需
EVM_PRIVATE_KEY=0x...
TRON_PRIVATE_KEY=...
SVM_PRIVATE_KEY=...
TON_MNEMONIC="..."
TON_MAINNET_ADDRESS=EQ...

# 可选
API_KEY_REQUIRED=true
API_KEYS=key1:name1,key2:name2
```

### 文档站点 (docs.t402.io)

**部署方式**: Cloudflare Pages (自动)

```bash
# 触发: 推送到 main 分支的 docs/ 目录变更
# 或手动触发
gh workflow run docs.yml
```

**Workflow**: `.github/workflows/docs.yml`
**Secrets**: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

### 主站 (t402.io)

**部署方式**: 需要确认部署配置

---

## 4. 监控管理 (monitor)

### Grafana Dashboard

**URL**: https://grafana.facilitator.t402.io

**Dashboard 文件**: `services/facilitator/grafana/dashboards/facilitator.json`

### 告警规则

**配置文件**: `services/facilitator/grafana/provisioning/alerting/alerts.yml`

| 告警名称 | 严重程度 | 条件 |
|----------|----------|------|
| Facilitator Service Down | Critical | up{job="facilitator"} < 1 |
| Redis Service Down | Critical | redis_up < 1 |
| High Error Rate (SLO) | Critical | 5xx rate > 0.1% |
| High P95 Latency (SLO) | Warning | P95 > 500ms |
| Very High P99 Latency | Critical | P99 > 2s |
| Verify Endpoint Errors | Critical | /verify 5xx > 0 |
| Settle Endpoint Errors | Critical | /settle 5xx > 0 |
| Low Settlement Success | Warning | success rate < 95% |
| EVM Network Errors | Warning | EVM error rate > 10% |
| Solana Network Errors | Warning | Solana error rate > 10% |

### Prometheus Metrics

**端点**: https://facilitator.t402.io/metrics

**关键指标**:
- `facilitator_requests_total{method,endpoint,status}`
- `facilitator_request_duration_seconds{method,endpoint}`
- `facilitator_verify_total{network,scheme,result}`
- `facilitator_settle_total{network,scheme,result}`
- `facilitator_active_requests`

---

## 5. 热钱包管理 (wallet)

### 检查余额

```bash
# EVM (所有链共用地址)
EVM_ADDR="0xC88f67e776f16DcFBf42e6bDda1B82604448899B"

# Base
curl -s "https://api.basescan.org/api?module=account&action=balance&address=$EVM_ADDR&tag=latest" | jq -r '.result' | awk '{printf "Base: %.6f ETH\n", $1/1e18}'

# Ethereum
curl -s "https://api.etherscan.io/api?module=account&action=balance&address=$EVM_ADDR&tag=latest" | jq -r '.result' | awk '{printf "ETH: %.6f ETH\n", $1/1e18}'

# Arbitrum
curl -s "https://api.arbiscan.io/api?module=account&action=balance&address=$EVM_ADDR&tag=latest" | jq -r '.result' | awk '{printf "Arbitrum: %.6f ETH\n", $1/1e18}'

# Solana
curl -s "https://api.mainnet-beta.solana.com" -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getBalance","params":["8GGtWHRQ1wz5gDKE2KXZLktqzcfV1CBqSbeUZjA7hoWL"]}' \
  | jq -r '.result.value' | awk '{printf "Solana: %.4f SOL\n", $1/1e9}'

# TRON
curl -s "https://api.trongrid.io/v1/accounts/TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5" \
  | jq -r '.data[0].balance // 0' | awk '{printf "TRON: %.2f TRX\n", $1/1e6}'
```

### 钱包地址

| 链 | 地址 | 建议最低余额 |
|----|------|--------------|
| EVM (所有) | `0xC88f67e776f16DcFBf42e6bDda1B82604448899B` | 0.1 ETH (每链) |
| Solana | `8GGtWHRQ1wz5gDKE2KXZLktqzcfV1CBqSbeUZjA7hoWL` | 2 SOL |
| TRON | `TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5` | 2000 TRX |
| TON | 需配置 `TON_MAINNET_ADDRESS` | 50 TON |

### 告警阈值

建议设置余额告警:
- EVM: < 0.01 ETH
- Solana: < 0.5 SOL
- TRON: < 500 TRX
- TON: < 10 TON

---

## 6. 进度追踪 (progress)

### 文件位置

| 文件 | 内容 |
|------|------|
| `/PLAN.md` | SDK 开发计划和任务 |
| `/ROADMAP.md` | 长期路线图 (7 phases) |
| `/SECURITY.md` | 安全审计待办 |
| `/BUG_BOUNTY.md` | Bug Bounty 范围 |

### 未完成任务统计

执行以下命令获取所有待办:
```bash
grep -r "\[ \]" *.md --include="*.md" | wc -l
```

### Phase 进度

| Phase | 内容 | 状态 |
|-------|------|------|
| 1 | Foundation Strengthening (CI/CD) | 🔄 进行中 |
| 2 | Quality & Documentation | 🔄 进行中 |
| 3 | SDK Parity (Python/Go) | 🔄 进行中 |
| 4 | Java SDK Completion | 🔄 进行中 |
| 5 | Security & Performance | ⏳ 未开始 |
| 6 | New SDKs (Rust/Swift) | ⏳ 未开始 |
| 7 | Infrastructure Scaling | ⏳ 未开始 |

### 关键待办

**Critical**:
- [ ] 充值 Facilitator 热钱包 Gas
- [ ] 启用 TON 网络配置

**High**:
- [ ] 发布 Java SDK 到 Maven Central
- [ ] 完成 Python SVM 机制
- [ ] 添加 CI 测试覆盖率

**Medium**:
- [ ] Go WDK 包
- [ ] Python/Go MCP 服务器
- [ ] Java TON/TRON 机制

---

## 7. GitHub Issues 管理 (issues)

### 创建 Issue 模板

```bash
# 创建功能请求
gh issue create --title "Feature: xxx" --label "enhancement" --body "..."

# 创建 Bug 报告
gh issue create --title "Bug: xxx" --label "bug" --body "..."

# 创建任务
gh issue create --title "Task: xxx" --label "task" --body "..."
```

### 建议的标签

```bash
# 优先级
priority/critical, priority/high, priority/medium, priority/low

# SDK
sdk/typescript, sdk/python, sdk/go, sdk/java

# 类型
type/feature, type/bug, type/docs, type/ci, type/refactor

# 状态
status/in-progress, status/blocked, status/needs-review

# 组件
component/facilitator, component/docs, component/website
component/evm, component/svm, component/ton, component/tron
```

### 从 ROADMAP 创建 Issues

建议将 ROADMAP.md 中的 `[ ]` 项转换为 GitHub Issues 以便追踪。

---

## 8. 版本管理 (version)

### 当前版本

| 组件 | 版本 | 文件位置 |
|------|------|----------|
| TypeScript | 2.0.0 | `typescript/packages/*/package.json` |
| Python | 1.5.3 | `python/t402/pyproject.toml` |
| Go | 1.3.1 | `go/go.mod` |
| Java | 1.0.0-SNAPSHOT | `java/pom.xml` |
| Facilitator | 2.0.0 | `services/facilitator/Dockerfile` |

### 更新版本

**TypeScript** (使用 Changesets):
```bash
cd typescript
pnpm changeset        # 创建变更集
pnpm changeset:version  # 更新版本
```

**Python**:
```bash
# 编辑 python/t402/pyproject.toml 中的 version
```

**Go**:
```bash
# 通过 git tag 管理
git tag go/v1.4.0
```

**Java**:
```bash
# 编辑 java/pom.xml 中的 version
mvn versions:set -DnewVersion=1.0.0
```

---

## 9. 变更日志 (changelog)

### 文件位置

| SDK | Changelog |
|-----|-----------|
| TypeScript | `typescript/CHANGELOG.md` |
| Python | `python/CHANGELOG.md` |
| Go | `go/CHANGELOG.md` |
| Java | `java/CHANGELOG.md` |

### 生成 Changelog

**TypeScript** (Changesets 自动生成):
```bash
cd typescript
pnpm changeset:version
```

**其他 SDK** (手动维护):
遵循 [Keep a Changelog](https://keepachangelog.com/) 格式

---

## 10. 健康检查 (health)

### 执行全面检查

1. **服务健康**
   - Facilitator /health, /ready
   - Docs 站点可访问性
   - 主站可访问性
   - Grafana 可访问性

2. **热钱包余额**
   - 所有链的 Gas 余额

3. **CI/CD 状态**
   - 最近的 workflow 运行状态
   - 是否有失败的构建

4. **依赖安全**
   - Dependabot 告警
   - govulncheck 结果
   - npm audit 结果

5. **SSL 证书**
   - 证书过期时间检查

### 健康检查脚本

```bash
#!/bin/bash
echo "=== T402 Health Check ==="

# Services
echo -e "\n📡 Services:"
curl -s https://facilitator.t402.io/health | jq -r '.status'
curl -s -o /dev/null -w "Docs: %{http_code}\n" https://docs.t402.io/
curl -s -o /dev/null -w "Site: %{http_code}\n" https://t402.io/

# Wallets
echo -e "\n💰 Wallets:"
# (执行钱包余额检查)

# CI Status
echo -e "\n🔧 CI Status:"
gh run list --limit 5

# SSL
echo -e "\n🔒 SSL Expiry:"
echo | openssl s_client -servername facilitator.t402.io -connect facilitator.t402.io:443 2>/dev/null | openssl x509 -noout -dates
```

---

## 附录: 项目结构

```
t402/
├── typescript/           # TypeScript SDK (21 packages)
│   ├── packages/
│   │   ├── core/         # @t402/core
│   │   ├── mechanisms/   # @t402/evm, svm, ton, tron
│   │   ├── http/         # @t402/express, next, hono, fastify, fetch, axios, paywall, react, vue
│   │   ├── wdk*/         # @t402/wdk, wdk-gasless, wdk-bridge, wdk-multisig
│   │   ├── mcp/          # @t402/mcp
│   │   └── cli/          # @t402/cli
│   └── package.json
├── python/               # Python SDK
│   └── t402/
│       ├── src/t402/
│       └── pyproject.toml
├── go/                   # Go SDK
│   ├── mechanisms/
│   └── go.mod
├── java/                 # Java SDK
│   ├── src/main/java/io/t402/
│   └── pom.xml
├── services/
│   └── facilitator/      # Facilitator 服务
│       ├── cmd/
│       ├── internal/
│       ├── grafana/
│       ├── docker-compose.yaml
│       └── Dockerfile
├── docs/                 # 文档站点 (Nextra)
├── specs/                # 协议规范
├── .github/workflows/    # CI/CD
│   ├── npm_release.yml
│   ├── python_release.yml
│   ├── go_release.yml
│   ├── java_release.yml
│   ├── facilitator.yml
│   └── docs.yml
├── PLAN.md               # SDK 开发计划
├── ROADMAP.md            # 长期路线图
└── SECURITY.md           # 安全政策
```

---

## 附录: 重要链接

| 资源 | URL |
|------|-----|
| GitHub Repo | https://github.com/t402-io/t402 |
| Facilitator API | https://facilitator.t402.io |
| 文档站点 | https://docs.t402.io |
| 主站 | https://t402.io |
| Grafana | https://grafana.facilitator.t402.io |
| NPM | https://www.npmjs.com/org/t402 |
| PyPI | https://pypi.org/project/t402/ |
| Docker | https://github.com/t402-io/t402/pkgs/container/facilitator |

---

## 附录: Secrets 清单

| Secret | 用途 | Workflow |
|--------|------|----------|
| `NPM_TOKEN` | npm 发布 | npm_release.yml |
| `PYPI_API_TOKEN` | PyPI 发布 | python_release.yml |
| `OSSRH_USERNAME` | Maven Central | java_release.yml |
| `OSSRH_TOKEN` | Maven Central | java_release.yml |
| `GPG_PRIVATE_KEY` | Maven 签名 | java_release.yml |
| `GPG_PASSPHRASE` | Maven 签名 | java_release.yml |
| `CLOUDFLARE_API_TOKEN` | Docs 部署 | docs.yml |
| `CLOUDFLARE_ACCOUNT_ID` | Docs 部署 | docs.yml |
| `GITHUB_TOKEN` | 自动提供 | 所有 workflow |
