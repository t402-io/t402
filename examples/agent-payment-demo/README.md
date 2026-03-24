# AI Agent Payment Demo

Demonstrates AI agents paying for API access using T402 + MCP tools.

## Scenario

```
  AGENT A (buyer)                    AGENT B (seller)
  ────────────────                   ─────────────────
  "I need premium data"              Hosts paid API endpoint
        │                                    │
        ├── 1. Discover: GET /api ───────────►│
        │◄── 2. 402 Payment Required ────────┤
        │                                    │
        ├── 3. MCP: checkBalance()           │
        ├── 4. MCP: pay() → sign tx          │
        │                                    │
        ├── 5. Retry with PAYMENT-SIGNATURE──►│
        │◄── 6. 200 OK (premium data) ───────┤
        │                                    │
        └── 7. MCP: verifySignature() ✓      │
```

## How It Works

### Seller (server.ts)

An Express server using `@t402/quick` to gate an endpoint:

```typescript
import express from "express";
import { t402 } from "@t402/quick/express";

const app = express();

// Free endpoint — describes what's available
app.get("/api", (req, res) => {
  res.json({
    service: "Premium Data API",
    endpoints: [
      { path: "/api/data", price: "0.10 USDT", description: "Real-time market data" },
    ],
  });
});

// Paid endpoint — requires 0.10 USDT
app.use("/api/data", t402({
  price: "0.10",
  payTo: process.env.SELLER_WALLET!,
}));

app.get("/api/data", (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    data: { btc: 98500, eth: 3800, usdt_supply: "145B" },
  });
});

app.listen(3000, () => console.log("Seller API at http://localhost:3000"));
```

### Buyer (agent.ts)

An AI agent using T402 MCP tools to discover, pay, and access the API:

```typescript
import { t402Fetch } from "@t402/fetch";

async function agentBuyer() {
  const API = "http://localhost:3000";

  // Step 1: Discover available endpoints (free)
  const discovery = await fetch(`${API}/api`).then(r => r.json());
  console.log("Available:", discovery.endpoints);

  // Step 2: Access paid endpoint — t402Fetch handles 402 automatically
  // It will:
  //   a) Receive 402 Payment Required
  //   b) Sign a payment authorization (using the agent's wallet)
  //   c) Retry with PAYMENT-SIGNATURE header
  //   d) Return the 200 response
  const data = await t402Fetch(`${API}/api/data`, {
    walletPrivateKey: process.env.BUYER_PRIVATE_KEY!,
  });

  console.log("Premium data:", data);
}

agentBuyer().catch(console.error);
```

### MCP Integration

For AI agents using MCP (Model Context Protocol), T402 provides 33 tools:

```
Agent: "I want to access https://api.example.com/premium-data"

MCP Server: [T402 tools available]
  → t402_auto_pay: Automatically handle 402 responses
  → t402_check_balance: Check USDT balance on any chain
  → t402_pay: Sign and submit a payment
  → t402_verify_signature: Verify a payment receipt
  → t402_get_token_price: Get current USDT price
  → t402_estimate_fee: Estimate gas cost for payment
  → ... (33 tools total)

Agent calls t402_auto_pay({
  url: "https://api.example.com/premium-data",
  maxPrice: "1.00"
})
→ Returns: { status: 200, data: "premium content", payment: { tx: "0x...", amount: "1.00 USDT" } }
```

## Why This Matters

Traditional API monetization requires:
- API key management
- Billing systems
- Subscription tiers
- Payment processors (Stripe, etc.)

T402 replaces all of that with one HTTP header. The agent signs a payment authorization, the facilitator settles it, and the API returns the content. No accounts. No subscriptions. No API keys.

This is how autonomous AI agents will pay for resources in the agent economy.

## Running the Demo

```bash
# Terminal 1: Start the seller
SELLER_WALLET=0xYourWallet node server.ts

# Terminal 2: Run the buyer agent
BUYER_PRIVATE_KEY=0xYourKey node agent.ts
```

## Supported Networks

The agent can pay on any of T402's 33+ supported networks. The facilitator handles settlement automatically.
