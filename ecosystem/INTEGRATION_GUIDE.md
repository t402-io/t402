# t402 Integration Guide

This guide covers how to integrate with the t402 protocol for each ecosystem role. Pick the section that matches your use case.

## Table of Contents

- [For Merchants](#for-merchants)
- [For Facilitators](#for-facilitators)
- [For SDK Developers](#for-sdk-developers)
- [For Infrastructure Providers](#for-infrastructure-providers)
- [For AI Agent Platforms](#for-ai-agent-platforms)

---

## For Merchants

Accept t402 payments for your APIs, content, or services. Integration takes 3 steps with any supported framework.

### Express.js

```bash
pnpm add @t402/express @t402/evm
```

```typescript
import express from "express";
import { paymentMiddleware, t402ResourceServer } from "@t402/express";
import { ExactEvmScheme } from "@t402/evm/exact/server";

const app = express();

app.use(
  paymentMiddleware(
    {
      "GET /api/data": {
        accepts: [
          { scheme: "exact", price: "$0.01", network: "eip155:8453", payTo: "0xYOUR_ADDRESS" },
        ],
        description: "Premium API data",
      },
    },
    new t402ResourceServer(facilitatorClient)
      .register("eip155:8453", new ExactEvmScheme()),
  ),
);

app.get("/api/data", (req, res) => {
  res.json({ data: "premium content" });
});

app.listen(3000);
```

### Hono

```bash
pnpm add @t402/hono @t402/evm
```

```typescript
import { Hono } from "hono";
import { paymentMiddleware } from "@t402/hono";

const app = new Hono();

app.use("/api/*", paymentMiddleware({
  "GET /api/data": {
    accepts: [{ scheme: "exact", price: "$0.01", network: "eip155:8453", payTo: "0xYOUR_ADDRESS" }],
    description: "Premium API data",
  },
}, server));

app.get("/api/data", (c) => c.json({ data: "premium content" }));
```

### Next.js

```bash
pnpm add @t402/next @t402/evm
```

```typescript
// app/api/data/route.ts
import { withPayment } from "@t402/next";

export const GET = withPayment(
  async (req) => {
    return Response.json({ data: "premium content" });
  },
  {
    accepts: [{ scheme: "exact", price: "$0.01", network: "eip155:8453", payTo: "0xYOUR_ADDRESS" }],
    description: "Premium API data",
  },
  server,
);
```

### Python (Flask)

```bash
pip install t402
```

```python
from flask import Flask
from t402.flask import create_paywall

app = Flask(__name__)
paywall = create_paywall(
    routes={
        "GET /api/data": {
            "price": "$0.01",
            "network": "eip155:8453",
            "pay_to": "0xYOUR_ADDRESS",
            "description": "Premium API data",
        },
    },
    facilitator_url="https://facilitator.t402.io",
)
app.register_blueprint(paywall)

@app.route("/api/data")
def get_data():
    return {"data": "premium content"}
```

### Python (FastAPI)

```bash
pip install t402
```

```python
from fastapi import FastAPI
from t402.fastapi import PaymentMiddleware

app = FastAPI()
app.add_middleware(PaymentMiddleware, routes={
    "GET /api/data": {
        "price": "$0.01",
        "network": "eip155:8453",
        "pay_to": "0xYOUR_ADDRESS",
    },
}, facilitator_url="https://facilitator.t402.io")

@app.get("/api/data")
def get_data():
    return {"data": "premium content"}
```

### Go (net/http)

```bash
go get github.com/t402-io/t402/sdks/go
```

```go
server := t402.NewResourceServer(facilitatorClient)
mux := http.NewServeMux()

mux.Handle("/api/data", t402http.PaymentMiddleware(
    server,
    t402http.RouteConfig{
        Path: "GET /api/data",
        Accepts: []t402.PaymentRequirement{
            {Scheme: "exact", Price: "$0.01", Network: "eip155:8453", PayTo: "0xYOUR_ADDRESS"},
        },
    },
    http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Write([]byte(`{"data": "premium content"}`))
    }),
))
```

### Java (Spring Boot)

```xml
<dependency>
  <groupId>io.t402</groupId>
  <artifactId>t402</artifactId>
  <version>1.10.0</version>
</dependency>
```

```java
@Configuration
public class PaymentConfig {
    @Bean
    public PaymentFilter paymentFilter() {
        return new PaymentFilter(Map.of(
            "GET /api/data", new RouteConfig()
                .scheme("exact")
                .price("$0.01")
                .network("eip155:8453")
                .payTo("0xYOUR_ADDRESS")
        ), facilitatorClient);
    }
}
```

### Choosing a Network

t402 supports 44+ networks. Common choices for merchants:

| Network | Chain ID | Gas Costs | Settlement Speed |
|---------|----------|-----------|-----------------|
| Base | `eip155:8453` | Very low | ~2 seconds |
| Arbitrum | `eip155:42161` | Low | ~1 second |
| Optimism | `eip155:10` | Low | ~2 seconds |
| Solana | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` | Very low | ~400ms |
| TON | `ton:mainnet` | Very low | ~5 seconds |
| TRON | `tron:mainnet` | Very low | ~3 seconds |

Accept multiple networks to maximize your reach. Clients choose their preferred network.

### Testing

Use the hosted facilitator for testing:

```
https://facilitator.t402.io
```

Deploy testnet contracts first, then switch to mainnet when ready.

---

## For Facilitators

Facilitators verify payment signatures and settle transactions on-chain. Running your own facilitator gives you full control over fee structures and settlement logic.

### Docker Deployment

```bash
docker pull ghcr.io/t402-io/facilitator:latest

docker run -d \
  --name t402-facilitator \
  -p 8080:8080 \
  -e DATABASE_URL="postgres://..." \
  -e EVM_RPC_URL="https://..." \
  ghcr.io/t402-io/facilitator:latest
```

### Required Endpoints

A facilitator must implement these HTTP endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/verify` | POST | Verify a payment signature is valid |
| `/settle` | POST | Submit the payment transaction on-chain |
| `/supported` | GET | Return supported networks and schemes |

### Verify Flow

```
POST /verify
Content-Type: application/json

{
  "paymentPayload": "<base64-encoded>",
  "paymentRequirements": { ... }
}

Response:
{
  "isValid": true,
  "scheme": "exact",
  "network": "eip155:8453"
}
```

### Settle Flow

```
POST /settle
Content-Type: application/json

{
  "paymentPayload": "<base64-encoded>",
  "paymentRequirements": { ... }
}

Response:
{
  "success": true,
  "txHash": "0x...",
  "network": "eip155:8453"
}
```

### Interface Requirements

Each supported chain family requires implementing the `SchemeNetworkFacilitator` interface. See the [SDK documentation](https://docs.t402.io) for interface definitions in each language.

---

## For SDK Developers

Build a t402 SDK in a new language by implementing the core interfaces.

### Core Types

Every SDK must define these types:

- **PaymentRequirements**: What the server requires (scheme, network, amount, payTo, deadline, etc.)
- **PaymentPayload**: What the client signs (base64-encoded payment authorization)
- **VerifyResponse**: Result of facilitator verification
- **SettleResponse**: Result of on-chain settlement

### Required Interfaces

#### Client

```
CreatePaymentPayload(requirements) -> PaymentPayload
```

Takes payment requirements, prompts the user's wallet to sign, and returns a signed payload.

#### Server

```
EnhancePaymentRequirements(config) -> PaymentRequirements
ParsePrice(price, network) -> AssetAmount
```

Converts route configuration into full payment requirements with on-chain details (token address, decimals, etc.).

#### Facilitator

```
Verify(payload, requirements) -> VerifyResponse
Settle(payload, requirements) -> SettleResponse
```

Verifies signatures off-chain and submits transactions on-chain.

### HTTP Transport

Implement HTTP header parsing and generation:

- **Request header**: `PAYMENT-SIGNATURE` (base64-encoded PaymentPayload)
- **Response header**: `PAYMENT-REQUIRED` (JSON PaymentRequirements on 402 responses)
- **Response header**: `PAYMENT-RESPONSE` (JSON settlement result on 200 responses)

### Reference Implementations

Study existing SDKs for patterns:

| SDK | Entry Point | Key Files |
|-----|-------------|-----------|
| TypeScript | `sdks/typescript/packages/core/` | `src/types/`, `src/client.ts`, `src/server.ts` |
| Go | `sdks/go/` | `types.go`, `interfaces.go`, `client.go`, `server.go` |
| Python | `sdks/python/t402/src/t402/` | `types.py`, `client.py`, `server.py` |
| Java | `sdks/java/t402/` | `src/main/java/io/t402/` |

### Checklist for a New SDK

- [ ] Core types (PaymentRequirements, PaymentPayload, VerifyResponse, SettleResponse)
- [ ] Client interface with at least one mechanism (EVM recommended for broadest coverage)
- [ ] Server interface with price parsing and requirements generation
- [ ] Facilitator client (HTTP calls to verify/settle endpoints)
- [ ] HTTP transport (header parsing/generation)
- [ ] At least one HTTP framework integration
- [ ] CLI tool (verify, settle, encode, decode, supported)
- [ ] Tests (unit + integration against hosted facilitator)
- [ ] Documentation (README, API docs, examples)
- [ ] CI/CD pipeline for publishing

---

## For Infrastructure Providers

Infrastructure providers power the t402 ecosystem by providing RPC access, indexing, bridging, and account abstraction services.

### RPC Providers

t402 SDKs accept standard RPC endpoints. To become a recommended provider:

1. Support the networks listed in the [supported networks](https://github.com/t402-io/t402#supported-networks) section.
2. Provide reliable, low-latency endpoints.
3. Open a partner registration issue with your supported networks and endpoint URLs.

### Indexers

Transaction indexing helps facilitators track settlement status. Useful for:

- Confirming on-chain settlement
- Tracking USDT0 bridge messages via LayerZero Scan
- Monitoring payment volumes and analytics

### Bridge Operators

t402 uses LayerZero for USDT0 cross-chain bridging across 19 EVM networks. Bridge operators can integrate by:

1. Supporting USDT0 OFT (Omnichain Fungible Token) standard
2. Providing fee quotes and message tracking
3. Implementing the bridge interface in the SDK

### ERC-4337 Services

Gasless payments require bundler and paymaster infrastructure:

- **Bundlers**: Accept and submit UserOperations to EntryPoint v0.7
- **Paymasters**: Sponsor gas fees for USDT/USDT0 transfers
- **Smart Account Factories**: Deploy Safe smart accounts with 4337 modules

---

## For AI Agent Platforms

t402 is designed for AI agent commerce. The MCP server enables any AI agent to handle payments autonomously.

### MCP Server Integration

```bash
# Install
npm install -g @t402/mcp

# Run
npx @t402/mcp
```

#### Claude Desktop Configuration

```json
{
  "mcpServers": {
    "t402": {
      "command": "npx",
      "args": ["@t402/mcp"],
      "env": {
        "T402_DEMO_MODE": "true"
      }
    }
  }
}
```

#### Available MCP Tools

| Tool | Description |
|------|-------------|
| `t402/getBalance` | Check wallet balance on a specific chain |
| `t402/getAllBalances` | Check balances across all configured chains |
| `t402/pay` | Execute a t402 payment |
| `t402/payGasless` | Execute gasless payment via ERC-4337 |
| `t402/getBridgeFee` | Get USDT0 bridge fee quote |
| `t402/bridge` | Bridge USDT0 between chains |
| `t402/getSwapQuote` | Get DeFi swap quote |
| `t402/swap` | Execute DeFi swap |
| `t402/getChains` | List configured chains |
| `t402/getTokens` | List supported tokens |
| `t402/getTransactionHistory` | View transaction history |

### A2A (Agent-to-Agent) Transport

For multi-agent workflows, t402 supports the A2A transport protocol. This allows agents to negotiate and execute payments without human intervention.

See the [A2A specification](https://github.com/t402-io/t402/tree/main/specs/transports-v2/a2a.md) for protocol details.

### Building an AI Agent with t402

1. **Discovery**: Agent encounters a 402 response with payment requirements.
2. **Evaluation**: Agent evaluates whether the resource is worth the cost.
3. **Payment**: Agent uses MCP tools to sign and submit payment.
4. **Access**: Agent receives the paid resource and continues its task.

This flow works with any MCP-compatible AI agent framework.

---

## Next Steps

- Browse the [examples](https://github.com/t402-io/t402/tree/main/examples) directory for working code
- Read the [protocol specification](https://github.com/t402-io/t402/tree/main/specs) for technical details
- Check the [documentation site](https://docs.t402.io) for tutorials and API reference
- [Register as a partner](https://github.com/t402-io/t402/issues/new?template=ecosystem-partner.yml) to join the ecosystem directory
