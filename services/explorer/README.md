# T402 Explorer — Payment Transaction Browser

Browse and search t402 settlement transactions across all chains.

## Quick Start

```bash
cd services/explorer
npm install
npm run dev     # http://localhost:3404
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | HTML explorer UI |
| GET | `/api/v1/transactions` | List transactions |
| GET | `/api/v1/transactions/:hash` | Get by hash |
| GET | `/api/v1/search?q=` | Search by hash/address |
| GET | `/api/v1/stats` | Protocol statistics |
| GET | `/health` | Health check |
