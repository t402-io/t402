# T402 Facilitator Service

Production-ready facilitator service for the T402 payment protocol.

## Features

- **Multi-chain support**: EVM (Ethereum, Arbitrum, Base, etc.), TON, TRON, Solana
- **Rate limiting**: Redis-based rate limiting with configurable limits
- **Metrics**: Prometheus metrics for monitoring
- **Health checks**: Liveness and readiness probes for orchestration
- **Docker support**: Ready for containerized deployment

## Quick Start

### Local Development

1. Copy the environment file:
   ```bash
   cp .env.example .env
   ```

2. Add your private keys to `.env`:
   ```bash
   EVM_PRIVATE_KEY=0x...
   ```

3. Start Redis:
   ```bash
   docker-compose up -d redis
   ```

4. Run the facilitator:
   ```bash
   go run ./cmd/facilitator
   ```

### Docker

```bash
# Build and run
docker-compose up --build

# With monitoring (Prometheus + Grafana)
docker-compose --profile monitoring up --build
```

## API Endpoints

### POST /verify
Verify a payment signature without executing settlement.

```bash
curl -X POST http://localhost:8080/verify \
  -H "Content-Type: application/json" \
  -d '{
    "x402Version": 2,
    "paymentPayload": {...},
    "paymentRequirements": {...}
  }'
```

**Response:**
```json
{
  "isValid": true,
  "payer": "0x..."
}
```

### POST /settle
Execute on-chain settlement after verification.

```bash
curl -X POST http://localhost:8080/settle \
  -H "Content-Type: application/json" \
  -d '{
    "x402Version": 2,
    "paymentPayload": {...},
    "paymentRequirements": {...}
  }'
```

**Response:**
```json
{
  "success": true,
  "transaction": "0x...",
  "network": "eip155:8453",
  "payer": "0x..."
}
```

### GET /supported
List supported payment schemes and networks.

```bash
curl http://localhost:8080/supported
```

**Response:**
```json
{
  "kinds": [
    { "x402Version": 2, "scheme": "exact", "network": "eip155:8453" }
  ],
  "signers": {
    "eip155:*": ["0x..."]
  }
}
```

### GET /health
Liveness probe - returns 200 if service is running.

```bash
curl http://localhost:8080/health
```

### GET /ready
Readiness probe - returns 200 if all dependencies are available.

```bash
curl http://localhost:8080/ready
```

### GET /metrics
Prometheus metrics endpoint.

```bash
curl http://localhost:8080/metrics
```

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `8080` |
| `ENVIRONMENT` | Environment (development/production) | `development` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `RATE_LIMIT_REQUESTS` | Max requests per window | `1000` |
| `RATE_LIMIT_WINDOW` | Rate limit window (seconds) | `60` |
| `API_KEYS` | Comma-separated API keys (key:name format) | - |
| `API_KEY_REQUIRED` | Require API key for all requests | `false` |
| `EVM_PRIVATE_KEY` | Private key for EVM chains | - |
| `ETH_RPC` | Ethereum RPC endpoint | `https://eth.llamarpc.com` |
| `ARBITRUM_RPC` | Arbitrum RPC endpoint | `https://arb1.arbitrum.io/rpc` |
| `BASE_RPC` | Base RPC endpoint | `https://mainnet.base.org` |

## API Key Authentication

The facilitator supports API key authentication for protected endpoints.

### Configuration

Set API keys via environment variable:

```bash
# Single key
API_KEYS=my-secret-key:production

# Multiple keys
API_KEYS=key1:app1,key2:app2,key3:analytics
```

To require API keys for all requests (except /health, /ready, /metrics, /supported):

```bash
API_KEY_REQUIRED=true
```

### Usage

Provide the API key in one of three ways:

1. **X-API-Key header** (recommended):
   ```bash
   curl -H "X-API-Key: my-secret-key" http://localhost:8080/verify
   ```

2. **Authorization header** (Bearer token):
   ```bash
   curl -H "Authorization: Bearer my-secret-key" http://localhost:8080/verify
   ```

3. **Query parameter**:
   ```bash
   curl "http://localhost:8080/verify?api_key=my-secret-key"
   ```

### Behavior

- If `API_KEYS` is empty and `API_KEY_REQUIRED=false`: No authentication required
- If `API_KEYS` is set: Requests with valid keys succeed, invalid keys are rejected
- If `API_KEY_REQUIRED=true`: All requests must include a valid API key

### Excluded Endpoints

These endpoints never require authentication:
- `/health` - Liveness probe
- `/ready` - Readiness probe
- `/metrics` - Prometheus metrics
- `/supported` - Supported networks

## Rate Limiting

Rate limiting is enforced per client IP address. Headers returned:

- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Unix timestamp when limit resets

When rate limited, returns `429 Too Many Requests` with `Retry-After` header.

## Metrics

Available Prometheus metrics:

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `facilitator_requests_total` | Counter | method, endpoint, status | Total HTTP requests |
| `facilitator_request_duration_seconds` | Histogram | method, endpoint | Request duration |
| `facilitator_verify_total` | Counter | network, scheme, result | Verify requests |
| `facilitator_settle_total` | Counter | network, scheme, result | Settle requests |
| `facilitator_active_requests` | Gauge | - | Currently active requests |
| `facilitator_api_key_usage_total` | Counter | key_name, endpoint | Requests per API key |
| `facilitator_api_key_auth_failed_total` | Counter | reason | Failed authentication attempts |

## Deployment

### Docker Compose (Development)

```bash
docker-compose up -d
```

### Kubernetes

See the `k8s/` directory for Kubernetes manifests (coming soon).

### Cloud Run / App Engine

The service is stateless (except Redis) and can be deployed to:
- Google Cloud Run
- AWS App Runner
- Azure Container Apps

## Security

- Never commit `.env` files with private keys
- Use secret management (Vault, AWS Secrets Manager, etc.) in production
- Enable HTTPS in production via reverse proxy (nginx, Traefik, etc.)
- Consider API key authentication for production use

## License

Apache 2.0
