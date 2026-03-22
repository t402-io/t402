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
| GET | `/` | HTML status page (AJAX auto-updating) |
| GET | `/service/:id` | Per-service detail page with latency chart + percentiles |
| GET | `/api/status` | JSON health data for all services |
| GET | `/api/incidents` | Incident history (`?limit=N`, max 100) |
| GET | `/api/uptime` | Uptime percentages (`?days=N`, max 90) |
| GET | `/api/service/:id` | Per-service detail JSON (checks, daily uptime, incidents, percentiles) |
| GET | `/api/maintenance` | Upcoming scheduled maintenance windows |
| POST | `/api/incidents` | Create manual incident (requires `X-API-Key`) |
| PATCH | `/api/incidents/:id` | Update/resolve incident (requires `X-API-Key`) |
| POST | `/api/maintenance` | Add maintenance window (requires `X-API-Key`) |
| DELETE | `/api/maintenance/:id` | Remove maintenance window (requires `X-API-Key`) |
| GET | `/badge` | Overall status SVG badge |
| GET | `/badge/:id` | Per-service status SVG badge |
| GET | `/rss` | RSS feed of recent incidents |
| GET | `/metrics` | Prometheus exposition format metrics |
| GET | `/health` | Own health check |

## Monitored Services (11)

**Websites**: t402.io, docs.t402.io, demo.t402.io
**Core**: Facilitator API, Scan2Pay Frontend, Scan2Pay API, Grafana
**New**: Bazaar, Explorer, Agent Dashboard, Sandbox

Checks run every 300 seconds (5 minutes). Services require 2 consecutive failures before being marked as down.

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `PORT` | `3403` | Server port |
| `DATA_DIR` | `/data` | Persistent storage directory |
| `ADMIN_API_KEY` | — | API key for admin endpoints (POST/PATCH/DELETE) |
| `WEBHOOK_URLS` | — | Comma-separated webhook URLs (Discord, Slack, Telegram, or generic) |
| `SERVICES_JSON` | — | JSON array of service definitions (overrides defaults) |
| `SERVICES_FILE` | — | Path to JSON file with service definitions |
| `CHECK_INTERVAL_MS` | `300000` | Health check interval in milliseconds |
| `FAIL_THRESHOLD` | `2` | Consecutive failures before marking down |
| `RATE_LIMIT_PER_MINUTE` | `60` | Global rate limit per IP |
| `MAINTENANCE_JSON` | `[]` | JSON array of maintenance windows |
| `MAINTENANCE_FILE` | `/data/maintenance.json` | Path to maintenance JSON file |

## Architecture

```
src/
  config.js        — Externalized service config (env/file/defaults)
  checker.js       — Health check logic with fail-count tracking
  history.js       — Per-service indexed storage, binary search, memoized uptime
  storage.js       — Atomic flat-file JSON persistence
  notifications.js — Discord/Slack/Telegram webhooks with cooldown + dedup
  maintenance.js   — Maintenance windows with hot-reload + CRUD
  server.js        — Express routes, HTML pages, badges, RSS, metrics
test/
  server.test.js   — 42 tests covering all endpoints and modules
```

## Features

- **AJAX auto-update**: Status page updates in-place every 30s without page reload
- **Uptime bars**: 90-day color-coded uptime visualization per service (CSS tooltips)
- **Latency percentiles**: p50/p95/p99 response times on detail pages
- **Relative timestamps**: Human-friendly "3h ago" dates with full date on hover
- **Persistence**: Check history and incidents survive restarts (flat-file JSON)
- **Performance**: Per-service Map indexing + binary search (~700x faster than v1)
- **Webhooks**: Discord/Slack/Telegram/generic notifications with cooldown + dedup
- **Manual incidents**: Create/update incidents via admin API for postmortems
- **Maintenance windows**: Scheduled maintenance with hot-reload and admin CRUD
- **Dependency mapping**: Shows affected services when upstream is down
- **Badges**: SVG status badges for README embedding
- **Prometheus**: `/metrics` endpoint for Grafana integration
- **RSS**: Incident feed for subscribers
- **Body validation**: API services verified by response content, not just HTTP status
- **Security**: HSTS, CSP, XFO, Permissions-Policy, global rate limiting
- **Empty state**: Shows "Checking Services..." until first check cycle completes
