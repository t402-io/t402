# T402 Monitoring Stack

Grafana + Prometheus monitoring stack for the T402 Facilitator service, deployed at [grafana.facilitator.t402.io](https://grafana.facilitator.t402.io).

## Tech Stack

- **Grafana**: v11.4.0
- **Prometheus**: v2.48.0
- **Orchestration**: Docker Compose

## Quick Start

```bash
# Start monitoring stack
docker-compose up -d

# Grafana UI: http://localhost:3000
# Prometheus:  http://localhost:9090
```

Default credentials: `admin` / `admin` (change via `GRAFANA_PASSWORD` env var).

## Structure

```
services/grafana/
├── docker-compose.yml               # Grafana + Prometheus services
├── Dockerfile                       # Grafana image with provisioning
├── prometheus.yml                   # Prometheus scrape configuration
├── dashboards/
│   └── facilitator.json             # Facilitator monitoring dashboard
├── provisioning/
│   ├── datasources/
│   │   └── prometheus.yml           # Prometheus datasource
│   ├── dashboards/
│   │   └── default.yml              # Dashboard provisioning
│   └── alerting/
│       ├── alerts.yml               # 20+ alert rules
│       ├── contact-points.yml       # Notification contacts
│       └── notification-policies.yml # Routing policies
└── ROLLBACK.md                      # Rollback procedures
```

## Dashboards

**Facilitator Dashboard** — Monitors:
- Request rates and latencies (P95/P99)
- Verify/Settle success rates
- Error rates by status code and endpoint
- Network-specific settlement metrics (EVM, Solana, TON, TRON)
- Redis health and memory usage
- Rate limiting saturation

## Alert Rules

| Category | Examples | Severity |
|----------|----------|----------|
| Availability | Service down, Redis down | Critical |
| SLO | Error rate > 0.1%, P95 > 500ms, P99 > 2s | Critical |
| Payment | Settlement/verification failures | Warning |
| Network | Per-chain error rates | Warning |
| Security | API key auth attacks | Critical |

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `GRAFANA_PASSWORD` | Admin password | `admin` |
| `GRAFANA_ROOT_URL` | Public URL | `http://localhost:3000` |
| `FACILITATOR_URL` | Metrics scrape target | `https://facilitator.t402.io` |

## Deployment

The monitoring stack runs as Docker containers alongside the facilitator service. Auto-deployed via Watchtower watching `ghcr.io/t402-io/grafana`.

See [ROLLBACK.md](ROLLBACK.md) for rollback procedures.

## Data Retention

- **Prometheus**: 30 days (configurable via `--storage.tsdb.retention.time`)
- **Scrape interval**: 15 seconds
