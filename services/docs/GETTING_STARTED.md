# Getting Started with t402

This guide will help you integrate t402 payments into your application in 15 minutes.

## Overview

t402 is an HTTP-native payment protocol that enables micropayments for web services. It works by:

1. Server declares payment requirements via HTTP 402 response
2. Client signs a payment authorization
3. Server verifies and processes the request
4. Facilitator settles the payment on-chain

## Choose Your Path

- [Server Integration](#server-integration) - Accept payments in your API
- [Client Integration](#client-integration) - Make payments to t402-enabled APIs
- [Full Stack Example](#full-stack-example) - Complete working example

---

## Server Integration

### TypeScript (Express)

**1. Install packages:**

```bash
pnpm add @t402/core @t402/express @t402/evm
```

**2. Add payment middleware:**

```typescript
import express from "express";
import { paymentMiddleware } from "@t402/express";
import { createFacilitatorClient } from "@t402/core";
import { ExactEvmScheme } from "@t402/evm/exact/server";

const app = express();

// Create facilitator client
const facilitator = createFacilitatorClient({
  url: "https://facilitator.t402.io",
});

// Configure payment routes
app.use(
  paymentMiddleware(
    {
      "GET /api/premium": {
        accepts: [
          {
            scheme: "exact",
            network: "eip155:8453", // Base
            price: "$0.01",
            payTo: "0xYourWalletAddress",
          },
        ],
        description: "Premium API endpoint",
      },
    },
    facilitator,
  ),
);

// Your protected endpoint
app.get("/api/premium", (req, res) => {
  res.json({ data: "Premium content!" });
});

app.listen(3000);
```

### Python (Flask)

**1. Install package:**

```bash
pip install t402
```

**2. Add payment middleware:**

```python
from flask import Flask
from t402.flask import create_paywall

app = Flask(__name__)

paywall = create_paywall(
    routes={
        "GET /api/premium": {
            "price": "$0.01",
            "network": "eip155:8453",
            "pay_to": "0xYourWalletAddress",
            "description": "Premium API endpoint",
        },
    },
    facilitator_url="https://facilitator.t402.io",
)
app.register_blueprint(paywall)

@app.route("/api/premium")
def premium():
    return {"data": "Premium content!"}

if __name__ == "__main__":
    app.run(port=3000)
```

### Go (net/http)

**1. Install package:**

```bash
go get github.com/t402-io/t402/go@latest
```

**2. Add payment middleware:**

```go
package main

import (
    "encoding/json"
    "net/http"

    t402 "github.com/t402-io/t402/go"
    t402http "github.com/t402-io/t402/go/http"
)

func main() {
    // Create facilitator client
    facilitator := t402http.NewHTTPFacilitatorClient(&t402http.FacilitatorConfig{
        URL: "https://facilitator.t402.io",
    })

    mux := http.NewServeMux()

    // Protected endpoint with payment
    mux.Handle("/api/premium", t402http.PaymentMiddleware(
        facilitator,
        t402http.RouteConfig{
            Path: "GET /api/premium",
            Accepts: []t402.PaymentRequirement{
                {
                    Scheme:  "exact",
                    Network: "eip155:8453",
                    Price:   "$0.01",
                    PayTo:   "0xYourWalletAddress",
                },
            },
        },
        http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            json.NewEncoder(w).Encode(map[string]string{
                "data": "Premium content!",
            })
        }),
    ))

    http.ListenAndServe(":3000", mux)
}
```

---

## Client Integration

### TypeScript (Fetch)

**1. Install packages:**

```bash
pnpm add @t402/core @t402/fetch @t402/evm
```

**2. Make payments:**

```typescript
import { t402Client, wrapFetchWithPayment } from "@t402/fetch";
import { registerExactEvmScheme } from "@t402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

// Create client
const client = new t402Client();

// Register EVM payment scheme
registerExactEvmScheme(client, {
  signer: privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`),
});

// Wrap fetch with automatic payment handling
const fetchWithPayment = wrapFetchWithPayment(fetch, client);

// Make requests - payments are handled automatically!
const response = await fetchWithPayment("https://api.example.com/api/premium");
const data = await response.json();
```

### Python

```python
import httpx
from t402 import T402Client, ExactEvmSigner

# Create client
client = T402Client(
    signer=ExactEvmSigner(private_key="0x..."),
)

# Make request with automatic payment
response = await client.fetch("https://api.example.com/api/premium")
data = response.json()
```

### Go

```go
package main

import (
    "fmt"

    t402 "github.com/t402-io/t402/go"
    "github.com/t402-io/t402/go/mechanisms/evm/exact/client"
)

func main() {
    // Create client
    c := t402.NewClient()

    // Register EVM signer
    evmScheme := client.NewExactEvmScheme(privateKey)
    c.Register("eip155:8453", evmScheme)

    // Make request with automatic payment
    resp, err := c.Fetch("https://api.example.com/api/premium")
    if err != nil {
        panic(err)
    }

    fmt.Println(resp.Body)
}
```

---

## Full Stack Example

Here's a complete working example with both server and client.

### Server (server.ts)

```typescript
import express from "express";
import cors from "cors";
import { paymentMiddleware } from "@t402/express";
import { createFacilitatorClient } from "@t402/core";

const app = express();
app.use(cors());

const facilitator = createFacilitatorClient({
  url: "https://facilitator.t402.io",
});

// Free endpoint
app.get("/api/free", (req, res) => {
  res.json({ message: "This is free!" });
});

// Paid endpoint
app.use(
  paymentMiddleware(
    {
      "GET /api/weather": {
        accepts: [
          {
            scheme: "exact",
            network: "eip155:8453",
            price: "$0.001", // 0.1 cents per request
            payTo: process.env.WALLET_ADDRESS!,
          },
        ],
        description: "Weather data API",
      },
    },
    facilitator,
  ),
);

app.get("/api/weather", (req, res) => {
  res.json({
    temperature: 72,
    conditions: "Sunny",
    location: "San Francisco",
  });
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
```

### Client (client.ts)

```typescript
import { t402Client, wrapFetchWithPayment } from "@t402/fetch";
import { registerExactEvmScheme } from "@t402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

async function main() {
  const client = new t402Client();

  registerExactEvmScheme(client, {
    signer: privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`),
  });

  const fetchWithPayment = wrapFetchWithPayment(fetch, client);

  // This works without payment
  const freeResponse = await fetch("http://localhost:3000/api/free");
  console.log("Free:", await freeResponse.json());

  // This automatically handles the payment
  const paidResponse = await fetchWithPayment("http://localhost:3000/api/weather");
  console.log("Weather:", await paidResponse.json());
}

main();
```

---

## Supported Networks

| Network | ID | Tokens |
|---------|-----|--------|
| Base | `eip155:8453` | USDC, USDT0 |
| Arbitrum | `eip155:42161` | USDC, USDT0 |
| Optimism | `eip155:10` | USDC, USDT0 |
| Ethereum | `eip155:1` | USDC, USDT |
| Solana | `solana:5eykt...` | USDC |
| TON | `ton:mainnet` | USDT Jetton |
| TRON | `tron:mainnet` | USDT TRC-20 |

---

## Advanced Features

### Gasless Payments (ERC-4337)

Let users pay without gas fees using Account Abstraction:

```typescript
import { createWdkGaslessClient } from "@t402/wdk-gasless";

const client = await createWdkGaslessClient({
  wdkAccount: myWdkAccount,
  publicClient,
  chainId: 8453,
  bundler: { bundlerUrl: "https://api.pimlico.io/..." },
  paymaster: { address: "0x...", type: "sponsoring" },
});

await client.pay({ to: "0x...", amount: 1000000n }); // 1 USDT0
```

### Cross-Chain Bridging

Bridge USDT0 between chains:

```typescript
import { Usdt0Bridge } from "@t402/evm";

const bridge = new Usdt0Bridge(signer, "arbitrum");
const result = await bridge.send({
  fromChain: "arbitrum",
  toChain: "ethereum",
  amount: 100_000000n,
  recipient: "0x...",
});
```

### AI Agent Payments (MCP)

Enable AI agents to make payments:

```bash
npx @t402/mcp
```

Configure in Claude Desktop:
```json
{
  "mcpServers": {
    "t402": {
      "command": "npx",
      "args": ["@t402/mcp"]
    }
  }
}
```

---

## CLI Tools

All SDKs include CLI tools:

```bash
# TypeScript
npx @t402/cli supported

# Python
t402 supported

# Go
go run github.com/t402-io/t402/go/cmd/t402@latest supported
```

---

## Next Steps

- [API Reference](https://docs.t402.io/api) - Full API documentation
- [Examples](../examples/) - More code examples
- [Specification](../specs/) - Protocol specification
- [GitHub](https://github.com/t402-io/t402) - Source code and issues

## Getting Help

- [GitHub Issues](https://github.com/t402-io/t402/issues)
- [Discord Community](https://discord.gg/t402)
- [Documentation](https://docs.t402.io)
