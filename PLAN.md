# T402 SDK 开发计划

## 项目概览

基于对代码库的深入分析，T402 已经拥有相当成熟的 SDK 实现：

### 当前状态总结

| SDK | 版本 | 发布状态 | 核心功能 | CLI 工具 | 文档 |
|-----|------|---------|---------|---------|------|
| **TypeScript** | 2.0.0 | npm ✅ | 完整 (21个包) | ✅ @t402/cli | ✅ 基础文档 |
| **Python** | 1.4.0 | PyPI ✅ | 完整 | ✅ 内置 | ⚠️ 需更新 |
| **Go** | 1.24.0 | Go Modules ✅ | 完整 | ⚠️ 部分 | ⚠️ 需更新 |

---

## 第一部分：npm SDK (TypeScript)

### 1.1 现有包结构

已发布的 21 个包：

```
核心包:
├── @t402/core          - 协议类型、HTTP 工具 (v2.0.0)
├── @t402/extensions    - 协议扩展 (v2.0.0)

机制包 (Blockchain-specific):
├── @t402/evm           - EVM 链 (v2.2.0)
├── @t402/svm           - Solana (v2.0.0)
├── @t402/ton           - TON (v2.1.0)
├── @t402/tron          - TRON (v2.0.0)

HTTP 服务端框架:
├── @t402/express       - Express.js 中间件
├── @t402/next          - Next.js 集成
├── @t402/hono          - Hono 中间件
├── @t402/fastify       - Fastify 中间件

HTTP 客户端:
├── @t402/fetch         - Fetch API 封装
├── @t402/axios         - Axios 拦截器

UI 组件:
├── @t402/paywall       - 通用支付墙
├── @t402/react         - React 组件
├── @t402/vue           - Vue 组件

WDK 集成 (Tether Wallet Development Kit):
├── @t402/wdk           - WDK 核心集成
├── @t402/wdk-gasless   - ERC-4337 无 Gas 支付
├── @t402/wdk-bridge    - LayerZero 跨链桥接
├── @t402/wdk-multisig  - Safe 多签钱包

工具:
├── @t402/mcp           - AI Agent MCP 服务器
├── @t402/cli           - 命令行工具
```

### 1.2 需要完成的工作

#### A. 版本对齐
- [ ] 统一所有核心包到一致的版本号

#### B. 测试覆盖率提升
- [ ] 为 @t402/ton 添加集成测试
- [ ] 为 @t402/tron 添加集成测试
- [ ] 为 @t402/wdk-* 包添加单元测试
- [ ] 为 @t402/mcp 添加测试
- [ ] 达到 80%+ 覆盖率

#### C. API 文档生成
- [ ] 配置 TypeDoc 生成 API 文档
- [ ] 为每个包添加 TSDoc 注释
- [ ] 发布到 docs.t402.io/api

### 1.3 发布流程

**Changesets 方式** (推荐):
```bash
cd typescript
pnpm changeset   # 创建变更记录
# PR 合并后自动创建 "Version Packages" PR
# 合并该 PR 触发发布
```

**Tag 方式**:
```bash
git tag v2.1.0
git push origin v2.1.0
```

---

## 第二部分：Python SDK

### 2.1 现有结构

```
python/t402/
├── pyproject.toml      # 项目配置 (v1.4.0)
├── README.md           # 包文档
├── src/t402/
│   ├── __init__.py     # 主模块 (290+ exports)
│   ├── types.py        # 类型定义
│   ├── facilitator.py  # Facilitator 客户端
│   ├── exact.py        # EVM exact scheme
│   ├── ton.py          # TON 支持
│   ├── tron.py         # TRON 支持
│   ├── erc4337/        # ERC-4337 支持
│   ├── bridge/         # USDT0 跨链桥
│   ├── wdk/            # Tether WDK 集成
│   ├── fastapi/        # FastAPI 中间件
│   ├── flask/          # Flask 中间件
│   └── clients/        # HTTP 客户端 (httpx, requests)
```

### 2.2 需要完成的工作

#### A. 功能完善
- [ ] 补全 SVM (Solana) 机制的完整实现
- [ ] 完善 USDT0 Bridge 功能
- [ ] 添加 CLI 工具的更多命令

#### B. 测试完善
- [ ] 增加 pytest 测试覆盖率
- [ ] 添加 TON/TRON 集成测试
- [ ] 添加 ERC-4337 模块测试

#### C. 文档更新
- [ ] 更新 README.md 反映所有功能
- [ ] 添加详细的 API 文档 (Sphinx/MkDocs)
- [ ] 创建快速入门指南

### 2.3 发布流程

```bash
# 1. 更新版本号
# 编辑 python/t402/pyproject.toml: version = "1.5.0"

# 2. 提交并创建 tag
git add .
git commit -m "chore: bump Python SDK to v1.5.0"
git tag python/v1.5.0
git push origin python/v1.5.0

# 自动执行:
# - 运行 pytest 测试 (Python 3.10, 3.11, 3.12)
# - 构建 wheel 和 sdist
# - 发布到 PyPI (使用 Trusted Publisher)
# - 创建 GitHub Release
```

---

## 第三部分：Go SDK

### 3.1 现有结构

```
go/
├── go.mod              # Go 1.24.0
├── client.go           # X402Client
├── server.go           # X402ResourceServer
├── facilitator.go      # X402Facilitator
├── interfaces.go       # 核心接口
├── types.go            # 类型定义
├── cmd/
│   └── t402/           # CLI 工具 (待完善)
├── http/
│   ├── client.go       # HTTP 客户端
│   ├── server.go       # HTTP 服务端
│   └── gin/            # Gin 中间件
├── mechanisms/
│   ├── evm/exact/      # EVM mechanism
│   ├── svm/exact/      # Solana mechanism
│   └── ton/exact/      # TON mechanism
├── signers/
│   ├── evm/            # EVM 签名器
│   └── svm/            # Solana 签名器
└── extensions/
    └── bazaar/         # API 发现扩展
```

### 3.2 需要完成的工作

#### A. CLI 工具完善
- [ ] 实现 `t402 verify <payload>` 命令
- [ ] 实现 `t402 settle <payload>` 命令
- [ ] 实现 `t402 supported` 命令
- [ ] 实现 `t402 encode/decode` 命令
- [ ] 实现 `t402 info <network>` 命令

#### B. 功能增强
- [ ] 添加 TRON mechanism 实现
- [ ] 添加 WDK 等价功能
- [ ] 完善错误处理

#### C. 测试完善
- [ ] 增加单元测试覆盖率到 80%+
- [ ] 添加 TON/TRON 集成测试
- [ ] 添加 benchmarks

### 3.3 发布流程

```bash
# 1. 确保测试通过
cd go && go test ./...

# 2. 创建 tag
git tag go/v1.25.0
git push origin go/v1.25.0

# 自动执行:
# - 运行测试 (Go 1.22, 1.23, 1.24)
# - 验证 go.mod
# - 创建 GitHub Release
```

用户安装:
```bash
go get github.com/t402-io/t402/go@v1.25.0
go install github.com/t402-io/t402/go/cmd/t402@v1.25.0
```

---

## 第四部分：文档网站更新 (docs.t402.io)

### 4.1 现有结构

```
docs/
├── package.json        # Nextra 3.0 + Next.js 14
├── theme.config.tsx    # 主题配置
├── pages/
│   ├── _meta.ts        # 导航配置
│   ├── index.mdx       # 首页
│   ├── getting-started/
│   ├── use-cases/
│   ├── sdks/
│   │   ├── typescript/
│   │   ├── python.mdx
│   │   └── go.mdx
│   ├── chains/
│   ├── advanced/
│   └── reference/
```

### 4.2 文档更新计划

#### A. SDK 文档完善
- [ ] **TypeScript**: 扩展现有文档，添加每个包的详细 API
- [ ] **Python**: 从基础文档扩展为完整指南
- [ ] **Go**: 从基础文档扩展为完整指南

#### B. 新增内容
- [ ] 添加 `/sdks/typescript/core.mdx` - @t402/core 详细文档
- [ ] 添加 `/sdks/typescript/evm.mdx` - @t402/evm 详细文档
- [ ] 添加 `/sdks/typescript/ton.mdx` - @t402/ton 详细文档
- [ ] 添加 `/sdks/typescript/tron.mdx` - @t402/tron 详细文档
- [ ] 扩展 `/sdks/python.mdx` 为 `/sdks/python/` 目录
- [ ] 扩展 `/sdks/go.mdx` 为 `/sdks/go/` 目录

#### C. API Reference 自动化
- [ ] 集成 TypeDoc 生成的 TypeScript API 文档
- [ ] 添加 Python API 文档 (pdoc/Sphinx)
- [ ] 添加 Go API 文档 (godoc)

### 4.3 部署流程

```bash
# 本地预览
cd docs
pnpm dev

# 构建
pnpm build

# 部署 (通过 GitHub Actions -> docs.yml)
# 推送到 main 分支自动部署到 Cloudflare Pages
```

---

## 第五部分：API 设计规范

### 5.1 核心接口

所有 SDK 应实现一致的核心接口：

```typescript
// Client 接口
interface T402Client {
  register(network: string, scheme: SchemeNetworkClient): void;
  createPaymentPayload(requirements: PaymentRequirements): Promise<PaymentPayload>;
  fetch(url: string, options?: RequestOptions): Promise<Response>;
}

// Server 接口
interface T402ResourceServer {
  register(network: string, scheme: SchemeNetworkServer): void;
  verify(payload: PaymentPayload, requirements: PaymentRequirements): Promise<VerifyResponse>;
  settle(payload: PaymentPayload, requirements: PaymentRequirements): Promise<SettleResponse>;
  buildPaymentRequirements(config: RouteConfig): Promise<PaymentRequirements>;
}

// Facilitator 接口
interface T402Facilitator {
  register(network: string, scheme: SchemeNetworkFacilitator): void;
  verify(payload: PaymentPayload, requirements: PaymentRequirements): Promise<VerifyResponse>;
  settle(payload: PaymentPayload, requirements: PaymentRequirements): Promise<SettleResponse>;
  getSupported(): SupportedResponse;
}
```

### 5.2 类型定义

```typescript
// 支付需求
interface PaymentRequirements {
  t402Version: number;  // 协议版本 (2)
  scheme: string;       // 支付方案 ("exact" | "upto")
  network: string;      // CAIP-2 网络标识 (e.g., "eip155:8453")
  amount: string;       // 原子单位金额
  asset: string;        // 资产地址
  payTo: string;        // 收款地址
  facilitator: string;  // Facilitator URL
  description?: string; // 资源描述
  extra?: Record<string, unknown>;
}

// 支付 Payload
interface PaymentPayload {
  t402Version: number;
  accepted: PaymentRequirements;
  payload: Record<string, unknown>;
  resource?: {
    url: string;
    description?: string;
    mimeType?: string;
  };
}

// 验证响应
interface VerifyResponse {
  isValid: boolean;
  invalidReason?: string;
  payer?: string;
}

// 结算响应
interface SettleResponse {
  success: boolean;
  transactionHash?: string;
  error?: string;
  networkId?: string;
}
```

---

## 第六部分：实施优先级

### 高优先级 (立即执行)
1. Go CLI 工具完善
2. Python README 更新
3. 文档网站 SDK 页面更新

### 中优先级 (后续)
1. Go TRON mechanism 实现
2. TypeScript 测试覆盖率提升
3. API 文档自动生成

### 低优先级 (长期)
1. WDK 功能移植到 Go/Python
2. 性能优化和 benchmarks
3. 高级功能文档

---

## 关键文件清单

### TypeScript SDK
- `typescript/packages/core/src/` - 核心实现
- `typescript/packages/cli/` - CLI 工具
- `.github/workflows/npm_release.yml` - 发布流程

### Python SDK
- `python/t402/pyproject.toml` - 项目配置
- `python/t402/src/t402/__init__.py` - 主模块
- `.github/workflows/python_release.yml` - 发布流程

### Go SDK
- `go/go.mod` - 模块定义
- `go/interfaces.go` - 核心接口
- `.github/workflows/go_release.yml` - 发布流程

### 文档
- `docs/pages/sdks/` - SDK 文档
- `docs/pages/_meta.ts` - 导航配置
- `.github/workflows/docs.yml` - 文档部署
