# T402 Bazaar — Service Marketplace

API for AI agents to discover and register t402-protected paid services.

## Quick Start

```bash
cd services/bazaar
npm install
BAZAAR_ADMIN_KEY=my-secret npm run dev   # http://localhost:3402
```

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/search?q=&category=&maxPrice=&network=&limit=&offset=` | No | Search services |
| GET | `/api/v1/services/:id` | No | Get service details |
| POST | `/api/v1/services` | Yes | Register new service |
| PUT | `/api/v1/services/:id` | Yes | Update service |
| DELETE | `/api/v1/services/:id` | Yes | Remove service |
| GET | `/api/v1/services/:id/verify` | No | Re-verify service URL |
| GET | `/api/v1/featured` | No | Top 5 verified services |
| GET | `/api/v1/categories` | No | List categories |
| GET | `/api/v1/stats` | No | Marketplace statistics |
| GET | `/health` | No | Health check |
| GET | `/ready` | No | Readiness probe |
| GET | `/metrics` | No | Request/store metrics |

## Auth

Write operations require `BAZAAR_ADMIN_KEY` via `X-API-Key` header or `Authorization: Bearer` token.

## Storage

Uses SQLite (via `better-sqlite3`) for persistence. Falls back to in-memory if SQLite is unavailable. Data survives container restarts when using a volume.

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3402` | Server port |
| `BAZAAR_ADMIN_KEY` | — | API key for write operations (required) |
| `BAZAAR_DB_PATH` | `/app/data/bazaar.db` | SQLite database path |
| `RATE_LIMIT_PER_MINUTE` | `60` | Rate limit per IP |
| `REVERIFY_STALE_HOURS` | `24` | Re-verify services older than N hours |
| `REVERIFY_INTERVAL_MS` | `1800000` | Re-verification check interval (30 min) |

## Docker

```bash
docker build -t t402-bazaar .
docker run -p 3402:3402 -v bazaar-data:/app/data -e BAZAAR_ADMIN_KEY=my-secret t402-bazaar
```

## MCP Integration

The `t402/searchBazaar` MCP tool queries this service.
