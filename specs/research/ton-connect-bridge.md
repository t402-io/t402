# TON Connect Bridge: Research and Integration Analysis

**Date:** 2026-02-18
**Status:** Research
**Relevance:** Integration of TON Connect wallet protocol for t402 TON payments

## Summary

TON Connect is the standard protocol for connecting dApps to TON wallets (Tonkeeper, OpenMask, MyTonWallet, etc.). It enables secure communication between web/mobile applications and wallet applications through a bridge relay server. This document analyzes the bridge architecture, deployment options, and integration recommendations for t402.

## TON Connect Protocol Overview

TON Connect provides wallet connectivity for the TON blockchain. The protocol consists of three parties:

1. **dApp** (application requesting wallet interaction)
2. **Bridge** (relay server that forwards encrypted messages)
3. **Wallet** (user's wallet application that signs transactions)

The bridge is a stateless relay. It does not inspect message contents; all payloads are end-to-end encrypted between the dApp and the wallet.

### Connection Flow

1. dApp generates an ephemeral x25519 keypair
2. dApp creates a connection request URI containing its public key and bridge URL
3. URI is presented to user as a QR code or deep link
4. Wallet scans/opens the URI, generates its own x25519 keypair
5. Both parties derive a shared secret via x25519 Diffie-Hellman
6. All subsequent messages are encrypted with xsalsa20-poly1305 using the shared secret
7. Messages are routed through the bridge using client IDs derived from the public keys

## Bridge Versions

### Bridge v1 (Deprecated)

- **Transport**: WebSocket-based bidirectional communication
- **Limitations**: WebSocket connections are stateful, harder to scale, and incompatible with serverless/edge environments
- **Status**: Deprecated in favor of v2

### Bridge v2 (Current)

Bridge v2 replaced WebSockets with Server-Sent Events (SSE) for receiving messages and HTTP POST for sending messages.

**Architecture:**

```
dApp                    Bridge                    Wallet
  |                       |                         |
  |-- SSE connect ------->|                         |
  |<--- SSE heartbeat ----|                         |
  |                       |<----- SSE connect ------|
  |                       |------ SSE heartbeat --->|
  |                       |                         |
  |-- POST message ------>|                         |
  |                       |------ SSE event ------->|
  |                       |                         |
  |                       |<----- POST message -----|
  |<--- SSE event --------|                         |
```

**Key properties:**

| Property | Value |
|----------|-------|
| Encryption | x25519-xsalsa20-poly1305 (NaCl box) |
| Client ID | Hex-encoded x25519 public key |
| Message format | Base64-encoded encrypted payload |
| Heartbeat interval | Configurable (default: ~30 seconds) |
| Message TTL | Configurable (default: 300 seconds) |
| Rate limits | Per-client; bridge-specific |
| Public bridge | `bridge.tonapi.io` (operated by Tonkeeper) |

**SSE Endpoint:**

```
GET https://bridge.tonapi.io/bridge/events?client_id={hex_public_key}
```

Returns an SSE stream with:
- `heartbeat` events at regular intervals
- `message` events containing encrypted payloads from the counterparty

**Send Endpoint:**

```
POST https://bridge.tonapi.io/bridge/message?client_id={sender_id}&to={recipient_id}&ttl=300
Content-Type: text/plain

{base64_encrypted_message}
```

### Bridge v3 (Emerging)

No formal specification exists yet. Community discussions suggest:
- Potential support for additional transport mechanisms
- Improved batching for multi-message flows
- Enhanced session management
- Backward compatibility with v2

For t402 integration, v2 is the target.

## Message Encryption

All messages between dApp and wallet are end-to-end encrypted:

1. **Key exchange**: x25519 Diffie-Hellman
2. **Symmetric encryption**: xsalsa20-poly1305 (NaCl secretbox)
3. **Nonce**: 24-byte random nonce prepended to each message

```
shared_secret = x25519(my_private_key, their_public_key)
encrypted = nacl.box(message, nonce, shared_secret)
payload = base64(nonce || encrypted)
```

The bridge never has access to the shared secret and cannot decrypt messages.

## SSE Connection Analysis

### Browser Limitations

**HTTP/1.1**: Browsers enforce a 6-connection-per-domain limit. Each SSE connection consumes one of these slots. If a page opens multiple SSE connections to the same bridge domain, it can exhaust the browser's connection pool, blocking other requests (fetches, images, etc.).

**HTTP/2**: Multiplexes all streams over a single TCP connection, effectively removing the per-domain limit for SSE. Most modern browsers and servers support HTTP/2. The public bridge (`bridge.tonapi.io`) serves over HTTP/2.

**Implications for t402:**
- A single SSE connection per wallet session is sufficient
- For multi-wallet scenarios, use a single bridge connection and multiplex by client ID
- Ensure the bridge endpoint supports HTTP/2 in production

### Connection Lifecycle

- SSE connections auto-reconnect on failure (built into the EventSource API)
- The `Last-Event-ID` header enables resuming from the last received event
- Heartbeats detect stale connections (if no heartbeat within 2x the interval, reconnect)

## Self-Hosted Bridge Deployment

### Docker Image

The TON Connect bridge is open source and can be self-hosted:

```bash
# Official TON Connect bridge
docker run -d \
  --name ton-bridge \
  -p 8080:8080 \
  -e REDIS_URL=redis://redis:6379 \
  ghcr.io/nickolay-aspect/ton-connect-bridge:latest
```

### Resource Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 1 vCPU | 2 vCPU |
| Memory | 256 MB | 512 MB |
| Redis | Required | Redis 7+ |
| Storage | Minimal (messages are ephemeral) | - |
| Bandwidth | Low per connection | Scales with active sessions |

### Redis Dependency

The bridge uses Redis for:
- Message queue (pending messages for offline clients)
- Client session tracking
- TTL-based message expiration
- Pub/sub for horizontal scaling

**Redis configuration recommendations:**
- `maxmemory-policy allkeys-lru` (evict oldest messages when memory is full)
- `notify-keyspace-events Ex` (for TTL expiration notifications)
- Memory: 64 MB minimum, scale based on concurrent sessions

### Reverse Proxy Configuration

**Nginx example:**

```nginx
server {
    listen 443 ssl http2;
    server_name bridge.yourdomain.com;

    ssl_certificate     /etc/ssl/certs/bridge.crt;
    ssl_certificate_key /etc/ssl/private/bridge.key;

    location /bridge/events {
        proxy_pass http://ton-bridge:8080;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;

        # SSE-specific settings
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;  # 24 hours
        proxy_send_timeout 86400s;

        # Disable gzip for SSE
        gzip off;
    }

    location /bridge/message {
        proxy_pass http://ton-bridge:8080;
        proxy_set_header Host $host;
    }
}
```

**Key requirements:**
- SSL/TLS is required (wallets reject non-HTTPS bridges)
- HTTP/2 strongly recommended for SSE multiplexing
- Disable response buffering for the SSE endpoint
- Set long read timeouts (SSE connections are long-lived)

### SSL/TLS Requirements

- All wallet implementations require HTTPS for the bridge URL
- Certificate must be valid (not self-signed) for mobile wallets
- Let's Encrypt is sufficient for production use
- HSTS headers are recommended

## Scaling Strategies

### Horizontal Scaling

- Deploy multiple bridge instances behind a load balancer
- Use Redis pub/sub for cross-instance message delivery
- Client ID-based consistent hashing for SSE sticky sessions (optional but reduces cross-instance traffic)

### Load Balancer Configuration

- Use Layer 7 (HTTP) load balancing
- Enable sticky sessions for SSE endpoints (by `client_id` query parameter)
- Health check: `GET /bridge/health`
- Configure longer idle timeouts (matching SSE connection lifetime)

### Capacity Planning

| Concurrent Sessions | Bridge Instances | Redis Memory |
|---------------------|-----------------|--------------|
| < 1,000 | 1 | 64 MB |
| 1,000 - 10,000 | 2-3 | 256 MB |
| 10,000 - 100,000 | 5-10 | 1 GB |

## Recommendations for t402

### Self-Host vs. Public Bridge

| Factor | Self-Hosted | Public (bridge.tonapi.io) |
|--------|------------|--------------------------|
| Reliability | Full control, SLA defined by you | Dependent on Tonkeeper infrastructure |
| Privacy | No third-party sees client IDs | Tonkeeper sees connection metadata |
| Latency | Co-locate with facilitator | Varies by region |
| Cost | Server + Redis | Free |
| Maintenance | You manage updates | Managed |

**Recommendation:** Start with the public bridge for development and initial deployment. Self-host when:
- TON payment volume exceeds 1,000 sessions/day
- Privacy requirements prohibit third-party metadata exposure
- Low-latency guarantees are needed (co-locate with facilitator)

### Integration Approach

1. **Client-side (dApp/paywall)**:
   - Use `@tonconnect/sdk` or `@tonconnect/ui` for wallet connection
   - Generate connection URI with the bridge URL
   - Listen for wallet responses via SSE
   - On receiving a signed transaction, create the t402 `PaymentPayload`

2. **Server-side (facilitator)**:
   - No bridge interaction needed. The facilitator receives the signed transaction in the `PaymentPayload` and submits it to the TON blockchain
   - Verification uses TON RPC (not the bridge)

3. **Bridge configuration**:
   - Use `bridge.tonapi.io` by default
   - Allow override via environment variable (e.g., `T402_TON_BRIDGE_URL`)
   - Support self-hosted bridges for enterprise deployments

### Security Considerations

- The bridge is a relay only; it cannot decrypt or modify messages
- Client IDs (public keys) are visible to the bridge operator
- Use fresh ephemeral keypairs per session to limit metadata correlation
- Validate all received messages (check encryption, format, expected sender)
- Implement rate limiting on the application side even when using a public bridge
- For self-hosted bridges, apply standard server hardening (firewall, updates, monitoring)

## References

- [TON Connect Protocol Specification](https://github.com/ton-connect/docs)
- [TON Connect SDK](https://github.com/ton-connect/sdk)
- [TON Connect Bridge Reference Implementation](https://github.com/nickolay-aspect/ton-connect-bridge)
- [CAIP-2: TON](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md)
- [NaCl cryptography library](https://nacl.cr.yp.to/)
