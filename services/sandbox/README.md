# T402 Sandbox Facilitator

Public testnet facilitator for developer testing across 7 testnet networks. No API key needed. No real funds.

## Supported Networks

| Network | CAIP-2 | Token | Scheme |
|---------|--------|-------|--------|
| Base Sepolia | `eip155:84532` | USDC | exact |
| Ethereum Sepolia | `eip155:11155111` | USDC | exact |
| Arbitrum Sepolia | `eip155:421614` | USDC | exact |
| Solana Devnet | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` | USDC | exact |
| TON Testnet | `ton:testnet` | USDT | exact |
| TRON Nile | `tron:nile` | USDT | exact |
| Stellar Testnet | `stellar:testnet` | USDC | exact |

## Quick Start

### TypeScript
```typescript
import { HTTPFacilitatorClient } from "@t402/http";

const client = new HTTPFacilitatorClient({
  url: "https://sandbox.t402.io"
});
```

### Go
```go
import "github.com/t402-io/t402/sdks/go/http"

client := http.NewFacilitatorClient("https://sandbox.t402.io")
```

### Python
```python
from t402 import FacilitatorClient

client = FacilitatorClient("https://sandbox.t402.io")
```

### Java
```yaml
# application.yml
t402:
  facilitator-url: https://sandbox.t402.io
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Landing page |
| `GET` | `/health` | Health check |
| `GET` | `/ready` | Readiness (checks upstream facilitator) |
| `GET` | `/supported` | Supported testnet kinds (SupportedResponse) |
| `GET` | `/faucets` | Testnet token faucet links |
| `GET` | `/examples` | Example payment flows per network |
| `GET` | `/usage` | Usage statistics |
| `GET` | `/metrics` | Prometheus metrics |
| `GET` | `/playground` | Interactive API playground |
| `POST` | `/verify` | Verify payment signature |
| `POST` | `/settle` | Settle payment on-chain |
| `POST` | `/webhook/test` | Test webhook delivery to your endpoint |

## Rate Limits

- 100 requests/minute per IP
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`
- Set `TRUST_CF_HEADER=true` behind Cloudflare to use `CF-Connecting-IP` for per-client rate limiting
- Testnet tokens only — not for production use

## Getting Test Tokens

| Network | Token | Faucet |
|---------|-------|--------|
| Base Sepolia | USDC + ETH | [Coinbase Faucet](https://portal.cdp.coinbase.com/products/faucet) |
| Ethereum Sepolia | ETH | [Google Cloud Faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia) |
| Ethereum Sepolia | USDC | [Circle Faucet](https://faucet.circle.com/) |
| Arbitrum Sepolia | ETH | [Alchemy Faucet](https://www.alchemy.com/faucets/arbitrum-sepolia) |
| Solana Devnet | SOL | [Solana Faucet](https://faucet.solana.com/) |
| Solana Devnet | USDC | [Circle Faucet](https://faucet.circle.com/) |
| TON Testnet | TON | [TON Faucet](https://faucet.tonxapi.com/) |
| TRON Nile | TRX + USDT | [Nile Faucet](https://nileex.io/join/getJoinPage) |
| Stellar Testnet | XLM + USDC | [Stellar Friendbot](https://friendbot.stellar.org/) |

## Magic Test Addresses

Like Stripe's test card numbers, use these as the `payer` field for deterministic responses — no real tokens needed:

| Address | Verify | Settle | Use Case |
|---------|--------|--------|----------|
| `0x...CAFE01` | isValid: true | success: true | Happy path |
| `0x...CAFE02` | isValid: false (invalid_signature) | success: true | Signature failure |
| `0x...CAFE03` | isValid: false (authorization_expired) | success: true | Expired auth |
| `0x...CAFE11` | isValid: true | success: true | Settle-specific success |
| `0x...CAFE12` | isValid: true | success: false (insufficient_funds) | Insufficient funds |
| `0x...CAFE13` | isValid: true | success: false (settlement_timeout) | Settlement timeout |
| `0x...CAFE99` | 2s delay → isValid: true | 2s delay → success: true | Timeout testing |

Magic addresses are case-insensitive and work on any testnet network. The payer can be in `paymentPayload.payload.payer`, `paymentPayload.authorization.payer`, or `paymentPayload.payer`.

## Timeout Behavior

| Operation | Timeout | On Timeout |
|-----------|---------|------------|
| Verify upstream | 30s | 503 with `mock: true` |
| Settle upstream | 90s | 503 with `mock: true` |
| Upstream health check | 5s | Marks upstream unreachable |
| Webhook delivery | 10s | 502 with `delivered: false` |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3406` | Server port |
| `FACILITATOR_URL` | `http://localhost:8080` | Upstream facilitator URL (http/https) |
| `FACILITATOR_API_KEY` | — | API key for upstream facilitator (required for /verify, /settle) |
| `RATE_LIMIT_PER_MINUTE` | `100` | Max requests per IP per minute |
| `TRUST_CF_HEADER` | `false` | Use `CF-Connecting-IP` header for rate limiting (enable behind Cloudflare) |
| `WEBHOOK_SECRET` | `sandbox-webhook-test-secret` | HMAC-SHA256 secret for webhook signature verification |

## Mock Fallback

When the upstream facilitator is unreachable, the sandbox returns **503 error responses** with `"mock": true`. This makes it clear no on-chain verification or settlement occurred.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| All responses have `mock: true` | Upstream facilitator unreachable | Check `GET /ready`; use magic addresses for mock testing |
| 415 Unsupported Media Type | Missing Content-Type header | Add `-H "Content-Type: application/json"` to POST requests |
| 429 Too Many Requests | Rate limit exceeded | Wait 60s, or increase `RATE_LIMIT_PER_MINUTE` locally |
| 400 "unsupported network" | Using mainnet chain ID | Use testnet equivalent (see `suggestion` in error response) |
| 400 "missing network" | `paymentRequirements.network` not set | Include a valid testnet CAIP-2 network string |

## Development

```bash
npm install
npm run dev    # starts with --watch
npm test       # runs test suite
```

## Docker

```bash
# Standalone (includes testnet facilitator)
docker compose up -d

# Production (uses host facilitator)
# See services/docker-compose.new-services.yml
```
