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
│   └── facilitator/
│       └── main.go          # Entry point
│
├── internal/
│   ├── config/              # Configuration loading
│   │   └── config.go
│   │
│   ├── server/              # HTTP server
│   │   ├── server.go
│   │   ├── handlers.go      # API handlers
│   │   └── middleware.go    # Auth, rate limiting, etc.
│   │
│   ├── verify/              # Payment verification
│   │   └── verify.go
│   │
│   ├── settle/              # Payment settlement
│   │   └── settle.go
│   │
│   └── metrics/             # Prometheus metrics
│       └── metrics.go
│
├── pkg/                     # Shared packages
│   └── utils/
│
├── grafana/                 # Grafana dashboards
│   ├── dashboards/
│   └── ROLLBACK.md
│
├── k8s/                     # Kubernetes manifests (WIP)
│
├── docker-compose.yml       # Local development stack
├── Dockerfile               # Container build
├── .env.example             # Environment template
├── Makefile                 # Build commands
└── README.md                # Documentation
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

2. Implement verification logic in `internal/verify/`:

```go
func verifyYourChain(ctx context.Context, payload, requirements interface{}) (*VerifyResult, error) {
    // Implement verification
}
```

3. Implement settlement logic in `internal/settle/`:

```go
func settleYourChain(ctx context.Context, payload, requirements interface{}) (*SettleResult, error) {
    // Implement settlement
}
```

4. Register handlers in `internal/server/handlers.go`.

5. Add tests in `internal/verify/` and `internal/settle/`.

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

Kubernetes manifests are in the `k8s/` directory:

- `deployment.yaml` - Service deployment
- `service.yaml` - ClusterIP service
- `ingress.yaml` - Ingress configuration
- `configmap.yaml` - Configuration
- `secret.yaml` - Secrets template

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

## Getting Help

- Open an issue on GitHub
- Check the [README.md](README.md) for API documentation
- Reference the [Go SDK](../../go/) for protocol details
