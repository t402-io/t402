# T402 Status — Public Health Monitoring

Real-time health monitoring for all T402 services.

## Quick Start

```bash
cd services/status
npm install
npm run dev     # http://localhost:3403
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | HTML status page (auto-refreshing) |
| GET | `/service/:id` | Per-service detail page with latency chart |
| GET | `/api/status` | JSON health data for all services |
| GET | `/api/incidents` | Incident history (`?limit=N`, max 100) |
| GET | `/api/uptime` | Uptime percentages (`?days=N`, max 90) |
| GET | `/api/service/:id` | Per-service detail JSON (checks, daily uptime, incidents) |
| GET | `/api/maintenance` | Upcoming scheduled maintenance windows |
| GET | `/badge` | Overall status SVG badge |
| GET | `/badge/:id` | Per-service status SVG badge |
| GET | `/rss` | RSS feed of recent incidents |
| GET | `/metrics` | Prometheus exposition format metrics |
| GET | `/health` | Own health check |

## Monitored Services (11)

**Vercel**: t402.io, docs.t402.io, demo.t402.io
**Core**: Facilitator API, Scan2Pay Frontend, Scan2Pay API, Grafana
**New**: Bazaar, Explorer, Agent Dashboard, Sandbox

Checks run every 300 seconds (5 minutes). Services require 2 consecutive failures before being marked as down.

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `PORT` | `3403` | Server port |
| `DATA_DIR` | `/data` | Persistent storage directory |
| `WEBHOOK_URLS` | — | Comma-separated webhook URLs (Discord, Slack, or generic) |
| `MAINTENANCE_JSON` | `[]` | JSON array of maintenance windows |
| `MAINTENANCE_FILE` | `/data/maintenance.json` | Path to maintenance JSON file |

## Features

- **Uptime bars**: 90-day color-coded uptime visualization per service
- **Latency sparklines**: SVG response time charts on detail pages
- **Persistence**: Check history and incidents survive restarts (flat-file JSON)
- **Webhooks**: Discord/Slack/generic notifications on status changes with retry
- **Maintenance windows**: Scheduled maintenance suppresses false incidents
- **Badges**: SVG status badges for README embedding
- **Prometheus**: `/metrics` endpoint for Grafana integration
- **RSS**: Incident feed for subscribers
- **Body validation**: API services verified by response content, not just HTTP status

