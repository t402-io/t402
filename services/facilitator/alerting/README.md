# T402 Facilitator Alerting

This directory contains Prometheus alerting rules and Alertmanager configuration for the T402 Facilitator service.

## Files

| File | Description |
|------|-------------|
| `prometheus-rules.yml` | Prometheus alerting rules |
| `alertmanager.yml` | Alertmanager configuration template |

## Alert Categories

### Availability Alerts
| Alert | Severity | Description |
|-------|----------|-------------|
| `FacilitatorDown` | Critical | Service is unreachable |
| `FacilitatorHighRestartRate` | Warning | Service restarting frequently |

### Error Alerts
| Alert | Severity | Description |
|-------|----------|-------------|
| `FacilitatorHighErrorRate` | Critical | Error rate > 5% |
| `FacilitatorVerifyFailures` | Warning | Verify failure rate > 10% |
| `FacilitatorSettleFailures` | Critical | Settle failure rate > 10% |

### Performance Alerts
| Alert | Severity | Description |
|-------|----------|-------------|
| `FacilitatorHighLatency` | Warning | P95 latency > 2s |
| `FacilitatorSettlementSlow` | Warning | P95 settlement > 2min |
| `FacilitatorSettlementVerySlow` | Critical | P95 settlement > 5min |

### Resource Alerts
| Alert | Severity | Description |
|-------|----------|-------------|
| `FacilitatorLowWalletBalance` | Warning | Balance < 0.1 |
| `FacilitatorCriticalWalletBalance` | Critical | Balance < 0.01 |
| `FacilitatorHighRateLimiting` | Warning | High rate limiting |

### Infrastructure Alerts
| Alert | Severity | Description |
|-------|----------|-------------|
| `FacilitatorRPCUnhealthy` | Warning | Single RPC unhealthy |
| `FacilitatorAllRPCsUnhealthy` | Critical | All RPCs for network down |
| `FacilitatorDBUnhealthy` | Critical | Database unreachable |
| `FacilitatorStaleSync` | Warning | No sync for 10+ minutes |

### Capacity Alerts
| Alert | Severity | Description |
|-------|----------|-------------|
| `FacilitatorHighTraffic` | Info | > 1000 req/s |
| `FacilitatorVeryHighTraffic` | Warning | > 5000 req/s |
| `FacilitatorHighActiveRequests` | Warning | > 100 concurrent |

## Setup

### 1. Copy Rules to Prometheus

```bash
# Copy alerting rules to Prometheus rules directory
cp prometheus-rules.yml /etc/prometheus/rules/facilitator.yml

# Verify rules syntax
promtool check rules /etc/prometheus/rules/facilitator.yml

# Reload Prometheus configuration
curl -X POST http://localhost:9090/-/reload
```

### 2. Configure Alertmanager

```bash
# Edit alertmanager.yml with your notification settings
vim alertmanager.yml

# Copy to Alertmanager config directory
cp alertmanager.yml /etc/alertmanager/alertmanager.yml

# Verify config syntax
amtool check-config /etc/alertmanager/alertmanager.yml

# Reload Alertmanager configuration
curl -X POST http://localhost:9093/-/reload
```

### 3. Prometheus Configuration

Add to `prometheus.yml`:

```yaml
# Alerting configuration
alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

# Rule files
rule_files:
  - /etc/prometheus/rules/facilitator.yml

# Scrape facilitator metrics
scrape_configs:
  - job_name: 'facilitator'
    static_configs:
      - targets: ['facilitator:8080']
    metrics_path: /metrics
```

## Notification Channels

### Slack

```yaml
receivers:
  - name: 'slack-critical'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/XXX/YYY/ZZZ'
        channel: '#t402-alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ .CommonAnnotations.description }}'
```

### PagerDuty

```yaml
receivers:
  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: 'your-service-key'
        severity: '{{ .CommonLabels.severity }}'
```

### Email

```yaml
global:
  smtp_smarthost: 'smtp.example.com:587'
  smtp_from: 'alerts@t402.io'
  smtp_auth_username: 'alertmanager'
  smtp_auth_password: 'password'

receivers:
  - name: 'email'
    email_configs:
      - to: 'ops@t402.io'
```

### Webhook (Discord, Telegram, etc.)

```yaml
receivers:
  - name: 'webhook'
    webhook_configs:
      - url: 'https://your-webhook-endpoint.com/alerts'
        send_resolved: true
```

## Testing Alerts

```bash
# Check if alerts are firing
curl -s http://localhost:9090/api/v1/alerts | jq '.data.alerts[] | {alert: .labels.alertname, state: .state}'

# View active alerts in Alertmanager
amtool alert query

# Silence an alert for maintenance
amtool silence add alertname="FacilitatorRPCUnhealthy" network="eip155:1" --duration=2h --comment="Scheduled maintenance"
```

## Metrics Reference

All metrics exposed by the facilitator:

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `facilitator_requests_total` | Counter | method, endpoint, status | Total HTTP requests |
| `facilitator_request_duration_seconds` | Histogram | method, endpoint | Request latency |
| `facilitator_verify_total` | Counter | network, scheme, result | Verify operations |
| `facilitator_settle_total` | Counter | network, scheme, result | Settle operations |
| `facilitator_errors_total` | Counter | type, network | Error count by type |
| `facilitator_settle_duration_seconds` | Histogram | network, scheme | Settlement duration |
| `facilitator_wallet_balance` | Gauge | network, address, asset | Wallet balance |
| `facilitator_rpc_healthy` | Gauge | network, endpoint | RPC health (0/1) |
| `facilitator_db_healthy` | Gauge | - | Database health (0/1) |
| `facilitator_rate_limit_exceeded_total` | Counter | ip, api_key | Rate limit events |
| `facilitator_active_requests` | Gauge | - | Current active requests |
| `facilitator_api_key_usage_total` | Counter | key_name, endpoint | API key usage |

## Grafana Dashboard

Import the facilitator dashboard from `../grafana/dashboards/facilitator.json` for visualization.
