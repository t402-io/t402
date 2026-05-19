# T402 Services Deployment Guide

## Overview

| Service | URL | Platform | Port |
|---------|-----|----------|------|
| Main Site | https://t402.io | Docker ($DEPLOY_HOST) | 3010 |
| Docs | https://docs.t402.io | Docker ($DEPLOY_HOST) | 3011 |
| Demo | https://demo.t402.io | Docker ($DEPLOY_HOST) | 3012 |
| Facilitator | https://facilitator.t402.io | Docker ($DEPLOY_HOST) | 8080 |
| Grafana | https://grafana-facilitator.t402.io | Docker ($DEPLOY_HOST) | 3000 |
| Scan2Pay API | https://scan2pay-api.t402.io | Docker ($DEPLOY_HOST) | 8081 |
| Scan2Pay Frontend | https://scan2pay.t402.io | Docker ($DEPLOY_HOST) | 3001 |
| Status | https://status.t402.io | Docker ($DEPLOY_HOST) | 3403 |
| Sandbox | https://sandbox.t402.io | Docker ($DEPLOY_HOST) | 3406 |

## Prerequisites

- SSH access: `ssh doge@$DEPLOY_HOST`
- Docker + Docker Compose on production server
- GitHub Actions secrets configured: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`
- Cloudflare Tunnel running on prod (`$CF_TUNNEL_ID`)

## Static Sites

All three run as Docker containers via Cloudflare Tunnel (migrated from Vercel/Cloudflare Pages on 2026-03-20).

```bash
ssh doge@$DEPLOY_HOST
cd /home/doge/github/t402-main/services
docker compose -f docker-compose.sites.yml build site docs demo
docker compose -f docker-compose.sites.yml up -d
```

| Service | Port | Health Check |
|---------|------|-------------|
| site | 3010 | `curl -s localhost:3010` |
| docs | 3011 | `curl -s localhost:3011` |
| demo | 3012 | `curl -s localhost:3012` |

### t402.io (Main Site)

- **Location**: `services/site/`
- **Port**: 3010
- **Build + Deploy**: `docker compose -f docker-compose.sites.yml build site && docker compose -f docker-compose.sites.yml up -d site`
- **Health check**: `curl -s localhost:3010`
- **Gotchas**: Also compiles the whitepaper (requires texlive) as part of the build

### docs.t402.io

- **Location**: `services/docs/`
- **Port**: 3011
- **Build + Deploy**: `docker compose -f docker-compose.sites.yml build docs && docker compose -f docker-compose.sites.yml up -d docs`
- **Health check**: `curl -s localhost:3011`
- **Gotchas**: Pinned to Next.js `~14.2.35` (Nextra 3.x incompatible with 15)

### demo.t402.io

- **Location**: `services/demo/`
- **Port**: 3012
- **Build + Deploy**: `docker compose -f docker-compose.sites.yml build demo && docker compose -f docker-compose.sites.yml up -d demo`
- **Health check**: `curl -s localhost:3012`

## Docker Services (Production Server: $DEPLOY_HOST)

### Facilitator

- **Location (prod)**: `/home/doge/github/t402/services/facilitator/facilitator/`
- **Location (repo)**: `services/facilitator/facilitator/` (submodule)
- **Build**: CI builds `ghcr.io/t402-io/facilitator:latest` on push to main
- **Deploy**:
  ```bash
  ssh doge@$DEPLOY_HOST
  cd /home/doge/github/t402/services/facilitator/facilitator
  docker compose -f docker-compose.prod.yaml pull facilitator
  docker compose -f docker-compose.prod.yaml up -d
  ```
- **Deploy (CI)**: Automatic on push to `main` in facilitator repo via `appleboy/ssh-action`
- **Health check**: `curl -s localhost:8080/health`
- **Env vars** (in `.env.prod`): `REDIS_PASSWORD`, `POSTGRES_PASSWORD`, `API_KEYS`, `EVM_PRIVATE_KEY`, `GRAFANA_PASSWORD`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- **Gotchas**:
  - ALWAYS use `docker-compose.prod.yaml`. Dev compose creates containers on the wrong Docker network, causing Redis connection panic.
  - When restarting just the facilitator: `docker compose -f docker-compose.prod.yaml up -d --no-deps facilitator`
  - Stack includes: facilitator, redis, postgres, prometheus, grafana, loki, promtail, blackbox-exporter, redis-exporter, redis-backup, postgres-backup (11 containers)

### Grafana

Grafana runs as part of the Facilitator compose stack (not separately).

- **Location (prod)**: same as Facilitator — `/home/doge/github/t402/services/facilitator/facilitator/`
- **Build**: CI builds `ghcr.io/t402-io/grafana:latest` via `services/facilitator/.github/workflows/grafana.yml`
- **Deploy**: Deployed as part of the Facilitator stack
  ```bash
  docker compose -f docker-compose.prod.yaml pull grafana
  docker compose -f docker-compose.prod.yaml up -d --no-deps grafana
  ```
- **Health check**: `curl -s localhost:3000/api/health`
- **Env vars**: `GRAFANA_PASSWORD`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- **Gotchas**:
  - Mounts Scan2Pay dashboards from `../../scan2pay/scan2pay-java/monitoring/grafana/dashboards` — this path must exist on the prod server
  - Alert contact points and notification policies are mounted from repo (not baked into image) for faster iteration

### Scan2Pay

- **Location (prod)**: `/home/doge/github/scan2pay-t402/scan2pay-java/` (separate checkout, NOT the submodule)
- **Location (repo)**: `services/scan2pay/` (submodule, for reference only)
- **Build + Deploy**:
  ```bash
  ssh doge@$DEPLOY_HOST
  cd /home/doge/github/scan2pay-t402/scan2pay-java
  git pull origin main
  docker compose build api frontend
  docker compose up -d --no-deps api frontend
  ```
- **Health check**:
  ```bash
  curl -s localhost:8081/actuator/health   # API (behind auth, returns 401 or 200)
  curl -s localhost:3001                    # Frontend
  ```
- **Env vars** (in `.env.prod` or `docker-compose.yml`): `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_PASSWORD`, `SPRING_DATA_REDIS_PASSWORD`, `FACILITATOR_API_KEY`, `FACILITATOR_TIMEOUT_MS`, `NEXT_PUBLIC_API_DIRECT_URL`
- **Gotchas**:
  - Production checkout is at `/home/doge/github/scan2pay-t402/`, NOT the submodule under `services/scan2pay/`
  - Use `--no-deps` to avoid recreating postgres/redis containers
  - Frontend needs `NEXT_PUBLIC_API_DIRECT_URL=https://scan2pay-api.t402.io` as a build arg — without it, Ethereum settlements (>30s) time out through the Next.js proxy
  - Stack includes: api, frontend, postgres, redis, backup, postgres-exporter, redis-exporter (7 containers)

### New Services (Status, Sandbox)

- **Location (prod)**: `/home/doge/github/t402-main/services/`
- **Location (repo)**: `services/` (status, sandbox directories)
- **Build + Deploy**:
  ```bash
  ssh doge@$DEPLOY_HOST
  cd /home/doge/github/t402-main/services
  git pull origin main
  docker compose -f docker-compose.new-services.yml build --parallel
  docker compose -f docker-compose.new-services.yml up -d
  ```
- **Deploy script** (alternative):
  ```bash
  bash deploy-new-services.sh
  ```
- **Health checks**:
  ```bash
  curl -s localhost:3403/health   # status
  curl -s localhost:3406/health   # sandbox
  ```
- **Env vars**: `WEBHOOK_URLS`, `DATABASE_URL`
- **Gotchas**:
  - Sandbox connects to the facilitator via `https://facilitator.t402.io` (set in docker-compose)
  - Status uses named volume (`status-data`) for persistence

### Sandbox (sandbox.t402.io)

- **Location**: `services/sandbox/`
- **Port**: 3406
- **Playground**: https://sandbox.t402.io/playground
- **Health checks**:
  ```bash
  curl -s localhost:3406/health   # liveness
  curl -s localhost:3406/ready    # readiness (checks upstream facilitator connectivity)
  ```
- **Metrics**: `curl -s localhost:3406/metrics` (Prometheus format — request counts, latency histograms, upstream errors)
- **Environment variables**:
  | Variable | Default | Description |
  |----------|---------|-------------|
  | `PORT` | `3406` | Server listen port |
  | `FACILITATOR_URL` | `http://localhost:8080` | Upstream facilitator endpoint (`http://localhost:8080` standalone; production compose overrides to `https://facilitator.t402.io`) |
  | `FACILITATOR_API_KEY` | (none) | API key for upstream facilitator — **must be set** or `/verify` and `/settle` return 401 from upstream (sandbox logs a warning on startup if missing) |
  | `RATE_LIMIT_PER_MINUTE` | `100` | Per-IP rate limit |
  | `TRUST_CF_HEADER` | `true` | Use `CF-Connecting-IP` header for rate limiting (set `true` behind Cloudflare Tunnel) |
- **Production mode** (part of the new-services stack):
  ```bash
  cd /home/doge/github/t402-main/services
  docker compose -f docker-compose.new-services.yml build sandbox
  docker compose -f docker-compose.new-services.yml up -d --no-deps sandbox
  ```
  Uses the production facilitator at `https://facilitator.t402.io` (configured in `docker-compose.new-services.yml`). Set `FACILITATOR_API_KEY` in `.env`.
- **Standalone mode** (bundles a testnet facilitator for local development):
  ```bash
  cd services/sandbox && docker compose up -d
  ```
  Starts both the sandbox and a testnet-only facilitator container. Requires `EVM_PRIVATE_KEY` in `.env` for the testnet wallet.
- **Gotchas**:
  - `FACILITATOR_API_KEY` must be set in `.env` or the sandbox will log a startup warning and all `/verify`, `/settle` calls will return 401 from the upstream facilitator
  - In production mode, sandbox reaches the facilitator via `https://facilitator.t402.io` (set in `docker-compose.new-services.yml`)
  - Logs are collected automatically by Promtail (Docker SD auto-discovers all compose containers)
  - Metrics are scraped by Prometheus via `host.docker.internal:3406`

## Infrastructure

### Cloudflare Tunnel

Tunnel ID: `$CF_TUNNEL_ID`
Config: `~/.cloudflared/config.yml` on prod server

**Routing table:**

| Hostname | Target |
|----------|--------|
| `t402.io` | `localhost:3010` |
| `docs.t402.io` | `localhost:3011` |
| `demo.t402.io` | `localhost:3012` |
| `facilitator.t402.io` | `localhost:8080` |
| `grafana-facilitator.t402.io` | `localhost:3000` |
| `scan2pay.t402.io` | `localhost:3001` |
| `scan2pay-api.t402.io` | `localhost:8081` |
| `status.t402.io` | `localhost:3403` |
| `sandbox.t402.io` | `localhost:3406` |

After modifying tunnel config:
```bash
sudo systemctl restart cloudflared
```

All ports bind to localhost only. Public access is exclusively through the Cloudflare Tunnel. SSL is terminated by Cloudflare (cert auto-renews).

### Docker Networks

| Network | Scope | Services |
|---------|-------|----------|
| `facilitator_internal` | Bridge, internal (no internet) | facilitator, redis, postgres, loki, promtail, redis-exporter, blackbox-exporter, redis-backup, postgres-backup |
| `facilitator_external` | Bridge | facilitator, prometheus, grafana, blackbox-exporter (also reaches scan2pay exporters) |
| `scan2pay-network` | Bridge | scan2pay api, frontend, postgres, redis, backup, exporters |

### Backups

**Facilitator** (automated, in compose stack):
- Redis: RDB dump every 6 hours, 7-day retention (`redis-backup` container)
- Postgres: `pg_dump` every 6 hours, 7-day retention (`postgres-backup` container)

**Scan2Pay** (automated):
- Postgres: Daily/Weekly/Monthly `pg_dump` + gzip, cloud upload via rclone, 3-tier retention (`backup` container)

Backup volumes: `redis_backups`, `postgres_backups` (facilitator), managed by Docker.

## Troubleshooting

**Facilitator won't start / Redis panic:**
You used dev compose. Always use `docker compose -f docker-compose.prod.yaml`. Dev compose puts the facilitator on a single network where it cannot reach Redis on `facilitator_internal`.

**Scan2Pay: "submodule not found" or wrong code:**
Production uses a separate git checkout at `/home/doge/github/scan2pay-t402/`, not the submodule at `services/scan2pay/`. The submodule in the main repo is a pointer only.

**Ethereum payments timing out (>30s):**
The Scan2Pay frontend must be built with `NEXT_PUBLIC_API_DIRECT_URL=https://scan2pay-api.t402.io` so the browser calls the API directly instead of proxying through Next.js (which has a ~30s socket timeout).

**Grafana dashboards missing for Scan2Pay:**
Grafana mounts dashboards from `../../scan2pay/scan2pay-java/monitoring/grafana/dashboards` relative to the facilitator compose dir. Ensure the scan2pay repo is checked out at the expected path on the prod server.

**Cloudflare Tunnel not routing:**
Check `~/.cloudflared/config.yml` has the hostname entry, then `sudo systemctl restart cloudflared`. Verify DNS CNAME points to `$CF_TUNNEL_ID.cfargotunnel.com`.

**Container logs:**
```bash
docker compose -f <compose-file> logs -f <service-name> --tail 100
```

**Full health check (all services):**
```bash
for svc in 3010 3011 3012 8080 3000 3001 8081 3402 3403 3404 3405 3406; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://localhost:${svc}/health" 2>/dev/null || echo "000")
  echo "Port ${svc}: HTTP ${code}"
done
```

**Restart a single service without touching dependencies:**
```bash
# Facilitator stack
docker compose -f docker-compose.prod.yaml up -d --no-deps <service>

# Scan2Pay
docker compose up -d --no-deps <service>

# New services
docker compose -f docker-compose.new-services.yml up -d --no-deps <service>
```
