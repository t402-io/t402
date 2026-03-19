# T402 Status — Public Health Monitoring

Real-time health monitoring for all t402 services.

## Quick Start

```bash
cd services/status
npm install
npm run dev     # http://localhost:3403
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | HTML status page |
| GET | `/api/status` | JSON health data |
| GET | `/health` | Own health check |

## Monitored Services

- t402.io, docs.t402.io, demo.t402.io
- facilitator.t402.io, scan2pay.t402.io, scan2pay-api.t402.io
- grafana-facilitator.t402.io

Checks run every 60 seconds.
