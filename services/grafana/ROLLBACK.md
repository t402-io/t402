# Grafana Rollback Procedure

## Quick Rollback

If a Grafana deployment causes issues, follow these steps to rollback:

### 1. Find Previous Image SHA

```bash
# List recent image tags from GitHub Container Registry
docker images ghcr.io/t402-io/grafana --format "{{.Tag}} {{.CreatedAt}}"

# Or check GitHub Actions for the previous successful build SHA
# https://github.com/t402-io/t402/actions/workflows/grafana.yml
```

### 2. Rollback to Previous Version

```bash
# SSH to server
ssh doge@220.134.32.65

# Navigate to facilitator directory
cd ~/github/t402/services/facilitator

# Pull the previous image by SHA
docker pull ghcr.io/t402-io/grafana:<previous-sha>

# Tag it as latest to prevent Watchtower from overwriting
docker tag ghcr.io/t402-io/grafana:<previous-sha> ghcr.io/t402-io/grafana:latest

# Restart Grafana with the rolled-back image
docker compose -f docker-compose.prod.yaml up -d grafana

# Verify the rollback
curl -s https://grafana.facilitator.t402.io/api/health
```

### 3. Pause Watchtower (Optional)

To prevent Watchtower from auto-updating back to the broken version:

```bash
# Stop Watchtower temporarily
docker compose -f docker-compose.prod.yaml stop watchtower

# Fix the issue in the codebase, push the fix, wait for CI/CD

# Resume Watchtower
docker compose -f docker-compose.prod.yaml start watchtower
```

## Rollback Scenarios

### Dashboard Not Loading

```bash
# Check Grafana logs
docker logs facilitator-grafana-1 --tail 100

# Common issues:
# - Invalid JSON in dashboard file
# - Missing datasource UID
# - Template variable syntax error
```

### Datasource Connection Failed

```bash
# Verify Prometheus is running
docker ps | grep prometheus

# Check Prometheus health
curl -s http://localhost:9090/-/healthy

# Verify datasource UID matches
docker exec facilitator-grafana-1 cat /etc/grafana/provisioning/datasources/prometheus.yml
```

### Alerts Not Firing

```bash
# Check alerting configuration
docker exec facilitator-grafana-1 cat /etc/grafana/provisioning/alerting/alerts.yml

# Verify unified alerting is enabled
docker exec facilitator-grafana-1 env | grep GF_UNIFIED_ALERTING
```

## Prevention

1. **Always test locally first**
   ```bash
   cd services/facilitator/grafana
   docker build -t grafana-test .
   docker run -p 3000:3000 grafana-test
   ```

2. **Validate JSON before commit**
   ```bash
   jq empty dashboards/facilitator.json
   ```

3. **Check CI/CD smoke tests**
   - The workflow runs smoke tests before notifying
   - If smoke tests fail, investigate before redeploying

## Image History

To view deployment history:

```bash
# On server
docker images ghcr.io/t402-io/grafana --format "table {{.Tag}}\t{{.ID}}\t{{.CreatedAt}}"

# Recent Watchtower updates
docker logs facilitator-watchtower-1 --since 24h | grep grafana
```

## Contact

If rollback doesn't resolve the issue:
1. Check GitHub Issues: https://github.com/t402-io/t402/issues
2. Review recent commits to `services/facilitator/grafana/`
