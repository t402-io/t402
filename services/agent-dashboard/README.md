# T402 Agent Dashboard — AI Payment Monitor

Web dashboard for monitoring AI agent payment activity, balances, and budget usage.

## Quick Start

```bash
cd services/agent-dashboard
npm install
npm run dev     # http://localhost:3405
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Dashboard UI |
| GET | `/api/v1/payments?address=` | Payment history |
| GET | `/api/v1/balances/:addr` | Multi-chain balances |
| GET | `/api/v1/budget/:addr` | Budget vs policy limits |
| GET | `/api/v1/stats/:addr` | Spending analytics |
| GET | `/health` | Health check |
