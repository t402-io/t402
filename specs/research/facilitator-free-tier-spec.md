# Facilitator Free Tier — Mini-Spec

Date: 2026-03-24
Status: DRAFT
Depends on: facilitator (Go service at services/facilitator/)

## Overview

Add a free tier to the T402 facilitator that allows developers to start using
T402 without running their own facilitator. 1,000 transactions/month per API key.

## API Key Model

### Registration: POST /register

```json
Request:
{
  "email": "dev@example.com",
  "projectName": "My API"
}

Response (201):
{
  "apiKey": "t402_sk_abc123...",
  "projectName": "My API",
  "quota": {
    "limit": 1000,
    "period": "monthly",
    "used": 0,
    "resetsAt": "2026-05-01T00:00:00Z"
  }
}
```

### Key format
`t402_sk_` prefix + 32 random hex chars = `t402_sk_a1b2c3d4e5f6...` (40 chars total)

### Idempotency (wallet-as-identity)
If `email` already has a key → return existing key (not create new).
This enables the Scan2Pay "wallet-as-login" pattern from the design review.

### Storage
Redis hash: `facilitator:apikeys:{apiKey}` → `{ email, projectName, createdAt }`
Redis hash: `facilitator:emails:{email}` → `{ apiKey }` (for idempotent lookup)

## Quota Tracking

### Per-request check
On every /verify and /settle request:
1. Extract API key from `Authorization: Bearer t402_sk_...` header
2. Validate key exists in Redis
3. Increment counter: `INCR facilitator:quota:{apiKey}:{YYYY-MM}`
4. Check against limit (1000)
5. If exceeded → HTTP 429 `{ "error": "Monthly quota exceeded", "limit": 1000, "used": N, "resetsAt": "..." }`

### Monthly reset
No explicit reset needed — counter key includes `{YYYY-MM}`.
Old keys expire via `EXPIRE facilitator:quota:{apiKey}:{YYYY-MM} 2678400` (31 days).

### Redis failure mode
**Fail-open.** If Redis is unreachable:
- Log warning: "quota check failed, allowing request"
- Allow the request (don't block payments because quota tracking is down)
- Set circuit breaker: after 5 consecutive Redis failures, skip quota check for 60s

## Rate Limiting

### Per-key rate limit
10 transactions/minute per API key.
Implementation: Redis sliding window (`ZRANGEBYSCORE` on timestamps).
Exceeding → HTTP 429 `{ "error": "Rate limit exceeded. Max 10 tx/min." }`

### Registration rate limit
5 registrations/hour per IP address.
Implementation: `INCR facilitator:reg-limit:{IP}:{YYYY-MM-DD-HH}`
Exceeding → HTTP 429 `{ "error": "Registration rate limit exceeded. Try again later." }`

## Security

### API key is NOT a signing key
Free-tier API keys authorize access to the shared facilitator's /verify and /settle
endpoints. They do NOT grant signing authority. The facilitator's hot wallet keys
are separate and never exposed to API key holders.

### Authentication flow
```
Developer request → API key in Authorization header
                  → Facilitator validates key + checks quota
                  → Facilitator uses its OWN signing keys to settle
                  → Settlement result returned to developer
```

### Abuse prevention
- Registration: email required (for contact, not verified in v1)
- Per-IP registration limit: 5/hour
- Per-key rate limit: 10 tx/min
- Per-key monthly quota: 1,000 tx/month
- No programmatic key rotation in v1 (manual via /register re-call with same email)

### Key rotation (v1)
Not implemented. Developer re-registers with same email to get existing key.
Planned for v2: explicit key rotation endpoint.

## Backward Compatibility

### Existing facilitator behavior (no API key)
The facilitator currently accepts all requests without authentication.
Free tier adds OPTIONAL authentication — requests without API keys continue
to work as before. This preserves backward compatibility for existing users.

### Migration path
1. Phase 1: API keys are optional. Facilitator accepts both authenticated and unauthenticated requests.
2. Phase 2: API keys become required for the hosted facilitator. Self-hosted facilitators can disable auth.
3. Phase 3: Paid tier with higher limits.

## Implementation Plan

### Files to modify (in facilitator Go service)
1. `cmd/facilitator/main.go` — add /register route
2. New: `internal/apikey/handler.go` — registration handler
3. New: `internal/apikey/store.go` — Redis key storage
4. New: `internal/middleware/quota.go` — quota check middleware
5. New: `internal/middleware/ratelimit.go` — rate limit middleware
6. `internal/api/verify.go` — add optional API key extraction
7. `internal/api/settle.go` — add optional API key extraction

### Estimated effort
Human: ~2 weeks | CC: ~3 days

### Dependencies
- Redis (already deployed alongside facilitator)
- No new infrastructure needed
