# Agentic Commerce Demo

AI agent autonomously browses, selects, and pays for digital products using the t402 payment protocol.

## Architecture

```
Agent (buyer)                    Server (seller)
  |                                  |
  |  GET /products                   |
  |--------------------------------->|  Browse catalog (free)
  |<---------------------------------|
  |                                  |
  |  GET /products/search?q=data     |
  |--------------------------------->|  Search products (free)
  |<---------------------------------|
  |                                  |
  |  POST /purchase/prod-002         |
  |--------------------------------->|
  |<-- 402 + payment requirements ---|  Pay to access
  |                                  |
  |  (sign EIP-3009 authorization)   |
  |                                  |
  |  POST /purchase/prod-002         |
  |  + PAYMENT-SIGNATURE header      |
  |--------------------------------->|
  |<-- 200 + purchased resource -----|  Access granted
```

## Quick Start

```bash
# Terminal 1: Start the server
npx tsx src/server.ts

# Terminal 2: Run the agent
npx tsx src/agent.ts
```

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /products | Free | Browse catalog |
| GET | /products/search?q= | Free | Search products |
| GET | /products/:id | Free | Product details |
| POST | /purchase/:id | 402 | Purchase (t402 protected) |

## Integration with t402 MCP

In production, the agent would use the `t402/autoPay` MCP tool:

```
Agent → t402/autoPay(url: "/purchase/prod-002")
  → Receives 402
  → Signs payment with wallet
  → Retries with signature
  → Returns purchased resource
```

The entire payment flow is handled automatically by one MCP tool call.
