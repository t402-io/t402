# T402 Bazaar — Service Marketplace

API for AI agents to discover and register t402-protected paid services.

## Quick Start

```bash
cd services/bazaar
npm install
npm run dev     # http://localhost:3402
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/search?q=&category=&maxPrice=&network=` | Search services |
| GET | `/api/v1/services/:id` | Get service details |
| POST | `/api/v1/services` | Register new service |
| GET | `/api/v1/categories` | List categories |
| GET | `/api/v1/stats` | Marketplace statistics |
| GET | `/health` | Health check |

## Docker

```bash
docker build -t t402-bazaar .
docker run -p 3402:3402 t402-bazaar
```

## MCP Integration

The `t402/searchBazaar` MCP tool queries this service.
