# T402 Agent Dashboard — AI Payment Monitor

Web dashboard for monitoring AI agent payment activity, balances, and budget usage.

## Quick Start

```bash
cd services/agent-dashboard
npm install
npm run dev     # http://localhost:3405 (demo mode)
```

## Modes

| Mode | Trigger | Data Source |
|------|---------|-------------|
| Demo | No `DATABASE_URL` | Deterministic synthetic data |
| Live | `DATABASE_URL` set | Facilitator PostgreSQL (settlements table) |

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Dashboard UI |
| GET | `/api/v1/payments?address=&days=&limit=&offset=` | Payment history |
| GET | `/api/v1/balances/:addr` | Multi-chain balances |
| GET | `/api/v1/budget/:addr` | Budget vs policy limits |
| GET | `/api/v1/stats/:addr` | Spending analytics |
| GET | `/api/v1/alerts/:addr` | Active budget alerts |
| GET | `/api/v1/export/:addr?days=` | CSV export |
| GET | `/api/v1/info` | Mode and version |
| GET | `/health` | Health check (+ pool stats in live mode) |
| GET | `/metrics` | Prometheus metrics |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3405` | Server port |
| `DATABASE_URL` | — | PostgreSQL connection (enables live mode) |
| `DASHBOARD_API_KEY` | — | API key for `/api/v1/*` (optional) |
| `ALLOWED_ORIGINS` | `*` | Comma-separated CORS origins (live mode) |
| `RATE_LIMIT_PER_MINUTE` | `100` | Per-IP rate limit |
| `BUDGET_MAX_PER_PAYMENT` | `1000000` | Max per payment (smallest units) |
| `BUDGET_MAX_PER_SESSION` | `10000000` | Max per session |
| `BUDGET_MAX_PER_DAY` | `50000000` | Max per day |

## Security

- CSP with nonce-based script/style
- Rate limiting (100 req/min, 5 req/min for export)
- Optional API key authentication
- CORS restriction in live mode
- Input validation on all endpoints
- HTML escaping for XSS prevention
