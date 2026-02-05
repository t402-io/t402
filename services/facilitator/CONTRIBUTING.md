# Facilitator Service Contributing Guide

Guide for developing and contributing to the t402 Facilitator service.

## Contents

- [Repository Structure](#repository-structure)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Adding Features](#adding-features)
- [Testing](#testing)
- [Code Quality](#code-quality)
- [Deployment](#deployment)

## Repository Structure

The Facilitator service is a Go application that handles payment verification and settlement.

```
services/facilitator/
├── cmd/
│   ├── facilitator/           # Main service entry point
│   │   └── main.go
│   └── facilitator-cli/       # CLI tool (multi-chain signer management)
│       └── main.go
│
├── internal/
│   ├── auth/                  # Authentication & authorization middleware
│   ├── cache/                 # Redis caching layer
│   ├── config/                # Configuration loading
│   ├── errors/                # Error definitions & handling
│   ├── health/                # Health & readiness probes
│   ├── idempotency/           # Request deduplication
│   ├── intent/                # Payment intent processing
│   ├── metrics/               # Prometheus metrics
│   ├── persistence/           # Data persistence (PostgreSQL)
│   ├── ratelimit/             # Rate limiting
│   ├── rpc/                   # RPC provider management & failover
│   ├── server/                # HTTP server, handlers, middleware
│   ├── streaming/             # Streaming payment support
│   └── tracing/               # Distributed tracing (OpenTelemetry)
│
├── alerting/                  # Monitoring & alerting
│   ├── prometheus-rules.yml   # Prometheus alert rules
│   └── alertmanager.yml       # AlertManager configuration
│
├── k8s/                       # Kubernetes manifests (Kustomize)
│   ├── base/
│   └── overlays/
│       ├── staging/
│       └── production/
│
├── docker-compose.yml         # Local development stack
├── Dockerfile                 # Container build
├── .env.example               # Environment template
├── Makefile                   # Build commands
└── README.md                  # Documentation
```

## Development Setup

### Prerequisites

- Go 1.24+
- Docker and Docker Compose
- Redis (via Docker or local install)
- (Optional) golangci-lint

### Installation

```bash
cd services/facilitator

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# At minimum, set EVM_PRIVATE_KEY for testing

# Start dependencies
docker-compose up -d redis

# Run the service
go run ./cmd/facilitator
```

### Environment Variables

Key environment variables for development:

| Variable | Description | Required |
|----------|-------------|----------|
| `EVM_PRIVATE_KEY` | Private key for EVM transactions | Yes |
| `REDIS_URL` | Redis connection URL | No (default: redis://localhost:6379) |
| `PORT` | Server port | No (default: 8080) |
| `ENVIRONMENT` | development or production | No (default: development) |

## Development Workflow

### Makefile Commands

From the `services/facilitator/` directory:

| Command | Description |
|---------|-------------|
| `make build` | Build the binary |
| `make run` | Run locally |
| `make test` | Run unit tests |
| `make test-cover` | Run tests with coverage |
| `make lint` | Run golangci-lint |
| `make docker` | Build Docker image |
| `make docker-run` | Run via Docker Compose |
| `make clean` | Remove build artifacts |

### Quick Verification

Before submitting changes:

```bash
make lint && make test
```

### Testing the API

```bash
# Health check
curl http://localhost:8080/health

# List supported networks
curl http://localhost:8080/supported

# Verify a payment (example)
curl -X POST http://localhost:8080/verify \
  -H "Content-Type: application/json" \
  -d @test/fixtures/verify_request.json
```

## Adding Features

### Adding a New Chain

To add support for a new blockchain:

1. Add chain configuration in `internal/config/`:

```go
type ChainConfig struct {
    // ...
    YourChainRPC string `env:"YOURCHAIN_RPC"`
}
```

2. Implement the scheme interfaces (client/server/facilitator) in the Go SDK at `sdks/go/mechanisms/yourchain/`.

3. Register the chain's RPC configuration in `internal/rpc/`.

4. Register handlers in `internal/server/handlers.go`.

5. Add tests for verification and settlement.

### Adding API Endpoints

1. Add handler in `internal/server/handlers.go`:

```go
func (s *Server) handleYourEndpoint(w http.ResponseWriter, r *http.Request) {
    // Handle request
}
```

2. Register route in `internal/server/server.go`:

```go
router.HandleFunc("/your-endpoint", s.handleYourEndpoint).Methods("POST")
```

3. Add metrics in `internal/metrics/metrics.go`:

```go
var YourMetric = prometheus.NewCounterVec(
    prometheus.CounterOpts{
        Name: "facilitator_your_metric_total",
        Help: "Description of your metric",
    },
    []string{"label1", "label2"},
)
```

4. Add tests and update README.md.

### Adding Middleware

Middleware lives in `internal/server/middleware.go`:

```go
func (s *Server) yourMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Pre-processing
        next.ServeHTTP(w, r)
        // Post-processing
    })
}
```

## Testing

### Unit Tests

```bash
# All tests
make test

# With coverage
make test-cover

# Specific package
go test -v ./internal/verify/...
```

### Integration Tests

Integration tests require running dependencies:

```bash
# Start dependencies
docker-compose up -d redis

# Run integration tests
go test -v -tags=integration ./test/integration/...
```

### Test Fixtures

Test fixtures live in `test/fixtures/`:

- `verify_request.json` - Sample verification request
- `settle_request.json` - Sample settlement request

### Mocking

Use interfaces for mockable dependencies:

```go
type RedisClient interface {
    Get(ctx context.Context, key string) (string, error)
    Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error
}
```

## Code Quality

### Linting

```bash
make lint
```

Uses golangci-lint with configuration in `.golangci.yml`.

### Code Style

- Follow standard Go conventions
- Use meaningful variable and function names
- Add comments on exported types and functions
- Handle errors explicitly
- Use structured logging (zerolog)

### Logging

Use zerolog for structured logging:

```go
import "github.com/rs/zerolog/log"

func handleVerify(w http.ResponseWriter, r *http.Request) {
    log.Info().
        Str("network", network).
        Str("scheme", scheme).
        Msg("Processing verification request")
}
```

### Error Handling

Return meaningful error responses:

```go
type ErrorResponse struct {
    Error   string `json:"error"`
    Code    string `json:"code,omitempty"`
    Details string `json:"details,omitempty"`
}
```

## Deployment

### Docker

```bash
# Build image
make docker

# Run with Docker Compose
docker-compose up -d

# With monitoring stack
docker-compose --profile monitoring up -d
```

### Kubernetes

Kubernetes manifests use Kustomize for multi-environment deployment:

```bash
# Validate manifests
kubectl kustomize k8s/overlays/staging

# Deploy to staging
kubectl apply -k k8s/overlays/staging

# Deploy to production
kubectl apply -k k8s/overlays/production
```

See [INFRASTRUCTURE.md](INFRASTRUCTURE.md) for multi-region architecture and [DISASTER_RECOVERY.md](DISASTER_RECOVERY.md) for recovery procedures.

### Monitoring

Grafana dashboards are in `grafana/dashboards/`:

- Import via Grafana UI
- See `grafana/ROLLBACK.md` for recovery procedures

### Health Checks

The service exposes health endpoints:

- `/health` - Liveness probe (service is running)
- `/ready` - Readiness probe (dependencies available)

Configure in Kubernetes:

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8080
readinessProbe:
  httpGet:
    path: /ready
    port: 8080
```

## Security Considerations

1. **Private Keys**: Never commit private keys. Use secret management.
2. **API Keys**: Enable API key authentication in production.
3. **Rate Limiting**: Configure appropriate rate limits.
4. **HTTPS**: Use a reverse proxy (nginx, Traefik) for TLS termination.
5. **Network**: Restrict access to internal services.

## Facilitator CLI

A CLI tool for managing signers and interacting with the facilitator:

```bash
go run ./cmd/facilitator-cli
```

Supports multi-chain signer operations (EVM, Solana, TON, TRON, NEAR, Stacks, Cosmos).

## Module Reference

| Module | Purpose |
|--------|---------|
| `internal/auth` | API key authentication and authorization |
| `internal/cache` | Redis caching for payments and nonces |
| `internal/config` | Environment-based configuration loading |
| `internal/errors` | Structured error types and codes |
| `internal/health` | Liveness and readiness probes |
| `internal/idempotency` | Request deduplication for settlements |
| `internal/intent` | Payment intent processing pipeline |
| `internal/metrics` | Prometheus metrics collectors |
| `internal/persistence` | PostgreSQL data persistence layer |
| `internal/ratelimit` | Per-client and per-endpoint rate limiting |
| `internal/rpc` | RPC provider management with failover |
| `internal/server` | HTTP server, routing, handlers, middleware |
| `internal/streaming` | Streaming payment channel support |
| `internal/tracing` | OpenTelemetry distributed tracing |

## Getting Help

- Open an issue on GitHub
- Check the [README.md](README.md) for API documentation
- Reference the [Go SDK](../../sdks/go/) for protocol details
