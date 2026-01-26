# T402 Facilitator Service

Production-ready facilitator service for the T402 payment protocol.

## Features

- **Multi-chain support**: 32 networks across EVM (Ethereum, Arbitrum, Base, Optimism, Polygon, etc.), TON, TRON, Solana, NEAR, Aptos, Tezos, Polkadot, and Stacks
- **Smart wallet support**: EIP-6492 and EIP-1271 for smart contract wallets (Safe, ERC-4337, etc.)
- **Rate limiting**: Redis-based rate limiting with configurable limits
- **Metrics**: Prometheus metrics for monitoring
- **Health checks**: Liveness and readiness probes for orchestration
- **RPC failover**: Automatic failover with circuit breaker pattern
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

## Smart Wallet Support (EIP-6492)

The facilitator supports smart contract wallet signatures through multiple standards:

### Supported Wallet Types

| Standard | Description | Example Wallets |
|----------|-------------|-----------------|
| **EOA** | Traditional externally owned accounts | MetaMask, Ledger |
| **EIP-1271** | Deployed smart contract wallets | Safe, deployed ERC-4337 |
| **ERC-6492** | Counterfactual (undeployed) wallets | Undeployed Safe, ERC-4337 during first tx |

### How It Works

1. **Signature Detection**: The facilitator automatically detects signature type:
   - 65-byte signatures → EOA (ECDSA)
   - Signatures with ERC-6492 magic suffix → Counterfactual smart wallet
   - Other formats → Deployed smart contract (EIP-1271)

2. **Verification Flow**:
   ```
   Parse ERC-6492 wrapper (if present)
         ↓
   Check if 65 bytes + no factory → EOA verification
         ↓
   Check contract deployment (eth_getCode)
         ↓
   Undeployed + has factory info → Accept (deploy in settle)
   Deployed → EIP-1271 verification
   ```

3. **Settlement**: For undeployed wallets, the facilitator can optionally deploy the smart wallet before executing the transfer.

### ERC-6492 Signature Format

```
┌─────────────────────────────────────────────────────────────────┐
│  abi.encode(address factory, bytes factoryCalldata, bytes sig)  │
├─────────────────────────────────────────────────────────────────┤
│  Magic: 0x6492649264926492...6492 (32 bytes)                    │
└─────────────────────────────────────────────────────────────────┘
```

### Configuration

Enable automatic smart wallet deployment during settlement:

```bash
# Enable ERC-4337 wallet deployment via EIP-6492
DEPLOY_ERC4337_WITH_EIP6492=true
```

### Example: Safe Wallet Payment

```typescript
// Client-side: Create ERC-6492 wrapped signature for undeployed Safe
const safeSignature = await safe.signTypedData(transferAuthHash);
const erc6492Signature = encodeERC6492({
  factory: safeFactory,
  factoryCalldata: safeDeploymentCalldata,
  signature: safeSignature,
});

// The facilitator will:
// 1. Verify the inner signature is valid for the predicted Safe address
// 2. Deploy the Safe if not yet deployed (if configured)
// 3. Execute the transferWithAuthorization
```

### Security Considerations

- The facilitator validates that the predicted address from factory calldata matches the claimed signer
- Smart wallet deployment costs gas - ensure facilitator wallet has sufficient balance
- Rate limiting applies per signer address, not per wallet deployment

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

## RPC Failover

The facilitator supports multiple RPC endpoints per network with automatic failover:

### Configuration

```bash
# Primary RPC
ETH_RPC=https://eth.llamarpc.com

# Fallback RPCs (comma-separated)
ETH_RPC_FALLBACK=https://rpc.ankr.com/eth,https://eth.drpc.org

# Health check settings
RPC_HEALTH_CHECK_INTERVAL=30    # seconds between health checks
RPC_HEALTH_CHECK_TIMEOUT=10     # timeout for health check requests

# Circuit breaker settings
RPC_CIRCUIT_BREAKER_THRESHOLD=5  # failures before opening circuit
RPC_CIRCUIT_BREAKER_TIMEOUT=60   # seconds before trying half-open
```

### Supported Networks

All networks support the same fallback pattern:

| Network | Primary Env | Fallback Env |
|---------|-------------|--------------|
| Ethereum | `ETH_RPC` | `ETH_RPC_FALLBACK` |
| Arbitrum | `ARBITRUM_RPC` | `ARBITRUM_RPC_FALLBACK` |
| Base | `BASE_RPC` | `BASE_RPC_FALLBACK` |
| Optimism | `OPTIMISM_RPC` | `OPTIMISM_RPC_FALLBACK` |
| TON | `TON_RPC` | `TON_RPC_FALLBACK` |
| TRON | `TRON_RPC` | `TRON_RPC_FALLBACK` |
| Solana | `SOLANA_RPC` | `SOLANA_RPC_FALLBACK` |

### Failover Behavior

1. **Provider Selection**: Providers are tried in priority order (primary first)
2. **Health Checking**: Background goroutine periodically checks all providers
3. **Circuit Breaker**: After N failures, a provider is temporarily blocked
4. **Recovery**: Circuit breaker enters half-open state after timeout, allowing test requests

## Security

- Never commit `.env` files with private keys
- Use secret management (Vault, AWS Secrets Manager, etc.) in production
- Enable HTTPS in production via reverse proxy (nginx, Traefik, etc.)
- Consider API key authentication for production use

## License

Apache 2.0
