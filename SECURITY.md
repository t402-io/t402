# Security Policy

> *Last Updated: 2026-01-16*

The T402 team takes security seriously. This document outlines our security practices, threat model, and guidelines for secure deployment.

## Table of Contents

- [Reporting Vulnerabilities](#reporting-vulnerabilities)
- [Supported Versions](#supported-versions)
- [Security Architecture](#security-architecture)
- [Cryptographic Primitives](#cryptographic-primitives)
- [Threat Model](#threat-model)
- [Chain-Specific Security](#chain-specific-security)
- [Deployment Security](#deployment-security)
- [Security Best Practices](#security-best-practices)
- [Responsible Disclosure](#responsible-disclosure)

---

## Reporting Vulnerabilities

**Please do not report security vulnerabilities through public GitHub issues.**

### Reporting Channels

1. **GitHub Security Advisories** (preferred): [Report a vulnerability](https://github.com/t402-io/t402/security/advisories/new)
2. **Email**: security@t402.io

### What to Include

- Type of vulnerability (e.g., signature bypass, replay attack, injection)
- Affected component (SDK, facilitator, specific chain mechanism)
- Steps to reproduce the issue
- Proof-of-concept code (if possible)
- Impact assessment
- Suggested fix (if any)

### Response Timeline

| Severity | Initial Response | Status Update | Fix Timeline |
|----------|-----------------|---------------|--------------|
| Critical | 24 hours | 3 days | 7 days |
| High | 48 hours | 7 days | 30 days |
| Medium | 72 hours | 14 days | Next release |
| Low | 7 days | 30 days | Best effort |

---

## Supported Versions

| Version | Supported | Notes |
|---------|-----------|-------|
| 2.x | Yes | Current stable, actively maintained |
| 1.x | No | Deprecated, no security updates |

---

## Security Architecture

### Overview

T402 is a payment protocol that enables HTTP-based payments using cryptocurrency. The security model relies on:

1. **Cryptographic signatures** for payment authorization
2. **On-chain verification** for settlement finality
3. **Time-bounded validity** to prevent replay attacks
4. **Server-side verification** before resource delivery

### Component Security

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   Server    │────▶│ Facilitator │
│  (Wallet)   │     │ (Resource)  │     │ (Settler)   │
└─────────────┘     └─────────────┘     └─────────────┘
      │                   │                   │
      │ Signs payment     │ Verifies sig      │ Executes
      │ off-chain         │ & requirements    │ on-chain
      └───────────────────┴───────────────────┘
```

**Client Security:**
- Private keys never leave the client
- Signatures created locally (browser, mobile, CLI)
- Support for hardware wallets and secure enclaves

**Server Security:**
- Verifies payment signatures before serving resources
- Validates payment parameters (amount, recipient, deadline)
- Does not hold user funds

**Facilitator Security:**
- Executes on-chain settlements
- Holds hot wallet for gas fees
- Rate-limited and API key protected

---

## Cryptographic Primitives

### EVM Chains (Ethereum, Base, Arbitrum, etc.)

| Component | Algorithm | Standard |
|-----------|-----------|----------|
| Signature | ECDSA secp256k1 | EIP-712 |
| Authorization | EIP-3009 | TransferWithAuthorization |
| Hashing | Keccak-256 | EIP-191 |
| Nonce | Random 32 bytes | Unique per transaction |

**EIP-712 Typed Data:**
- Domain separator prevents cross-chain replay
- Structured data prevents signature malleability
- Human-readable signing prompts

### TON Blockchain

| Component | Algorithm | Standard |
|-----------|-----------|----------|
| Signature | Ed25519 | TON standard |
| Address | SHA-256 + workchain | TON address format |
| Cell Encoding | BOC (Bag of Cells) | TON TL-B |

### TRON Blockchain

| Component | Algorithm | Standard |
|-----------|-----------|----------|
| Signature | ECDSA secp256k1 | TRON standard |
| Address | Base58Check | TRON address format |
| Transaction | Protobuf | TRON protocol |

### Solana (SVM)

| Component | Algorithm | Standard |
|-----------|-----------|----------|
| Signature | Ed25519 | Solana standard |
| Address | Base58 | Solana pubkey |
| Transaction | Borsh serialization | Solana protocol |

---

## Threat Model

### In Scope

| Threat | Mitigation |
|--------|------------|
| **Replay attacks** | Nonces, deadlines, chain-specific domain separators |
| **Signature forgery** | Industry-standard ECDSA/Ed25519, verified on-chain |
| **Man-in-the-middle** | HTTPS required, signatures cover all parameters |
| **Double spending** | On-chain settlement with blockchain finality |
| **Insufficient payment** | Amount verified before and after settlement |
| **Wrong recipient** | payTo address included in signed data |
| **Expired authorization** | Deadline checked on-chain |

### Out of Scope

| Threat | Responsibility |
|--------|----------------|
| Private key compromise | User/integrator |
| Phishing attacks | User education |
| Smart contract bugs (USDT) | Token issuer (Tether) |
| Blockchain consensus attacks | Blockchain network |
| DNS hijacking | Infrastructure provider |

### Trust Assumptions

1. **Blockchain Security**: Underlying blockchains are secure
2. **Token Contracts**: USDT/USDT0 contracts function correctly
3. **Client Integrity**: User's device is not compromised
4. **TLS/HTTPS**: Transport layer is secure

---

## Chain-Specific Security

### EVM (Ethereum, Base, Arbitrum, Optimism, etc.)

**USDT0 (EIP-3009):**
```solidity
// Authorization includes all critical parameters
transferWithAuthorization(
    from,      // Payer address
    to,        // Recipient address
    value,     // Amount in smallest unit
    validAfter,  // Not valid before this timestamp
    validBefore, // Not valid after this timestamp
    nonce,     // Random 32-byte nonce (replay protection)
    v, r, s    // ECDSA signature
)
```

**Security Considerations:**
- Always verify `validBefore` is in the future
- Use cryptographically random nonces
- Check return value of transfer

### TON

**Jetton Transfer:**
- Uses comment field for metadata
- Verify sender wallet address matches signed address
- Check query_id for replay protection

**Security Considerations:**
- Validate workchain ID (0 for basechain)
- Verify Jetton master contract address
- Check sufficient balance before sending

### TRON

**TRC-20 Transfer:**
- Standard approve + transferFrom pattern
- Energy/bandwidth considerations

**Security Considerations:**
- Validate Base58Check address format
- Check contract is official USDT
- Verify sufficient energy for transaction

### Solana

**SPL Token Transfer:**
- Associated Token Accounts (ATA)
- Compute unit limits

**Security Considerations:**
- Validate token mint address
- Check ATA ownership
- Verify transaction simulation before signing

---

## Deployment Security

### Facilitator Service

#### Required Security Measures

```bash
# 1. Use strong, random secrets
export REDIS_PASSWORD=$(openssl rand -hex 32)
export GRAFANA_PASSWORD=$(openssl rand -hex 32)
export API_KEYS="$(openssl rand -hex 32):production"

# 2. Never expose internal services
# Only Caddy (reverse proxy) should be exposed to internet

# 3. Enable API key authentication
export API_KEY_REQUIRED=true
```

#### Docker Security Checklist

- [x] Run containers as non-root
- [x] Use read-only filesystem where possible
- [x] Enable `no-new-privileges`
- [x] Use internal networks for service communication
- [x] Limit container resources (memory, CPU)
- [x] Scan images for vulnerabilities (Trivy)
- [x] Use specific image tags, not `latest`

#### Network Security

```yaml
# docker-compose.prod.yaml security configuration
networks:
  internal:
    internal: true  # No external access
  external:
    driver: bridge  # Only for reverse proxy

security_opt:
  - no-new-privileges:true

read_only: true
tmpfs:
  - /tmp:noexec,nosuid,size=64M
```

### Hot Wallet Security

1. **Minimum Balance**: Keep only necessary funds for gas
2. **Monitoring**: Alert on unusual activity
3. **Rotation**: Rotate wallet addresses periodically
4. **Separation**: Use different wallets per environment
5. **Multi-sig**: Consider multi-sig for high-value operations

### Rate Limiting

Default production limits:
- 1000 requests per 60 seconds per IP
- Configurable via `RATE_LIMIT_REQUESTS` and `RATE_LIMIT_WINDOW`

---

## Security Best Practices

### For Integrators

#### Private Key Management

```go
// Good: Load from environment
signer, _ := evmsigners.NewClientSignerFromPrivateKey(os.Getenv("PRIVATE_KEY"))

// Good: Load from secret manager
signer, _ := evmsigners.NewClientSignerFromPrivateKey(vault.GetSecret("evm-key"))

// Bad: Hardcoded
signer, _ := evmsigners.NewClientSignerFromPrivateKey("0x1234...")
```

#### Server-Side Verification

```go
// Always verify on server before delivering content
result, err := facilitator.Verify(ctx, payloadBytes, requirementsBytes)
if err != nil || !result.IsValid {
    return http.StatusPaymentRequired
}

// Settle after delivery (or use escrow pattern)
settleResult, err := facilitator.Settle(ctx, payloadBytes, requirementsBytes)
```

#### Payment Parameter Validation

```typescript
// Validate all parameters match expectations
if (payment.amount < expectedAmount) {
  throw new Error("Insufficient payment");
}
if (payment.payTo !== myAddress) {
  throw new Error("Wrong recipient");
}
if (payment.deadline < Date.now() / 1000) {
  throw new Error("Payment expired");
}
```

### For End Users

1. **Verify URLs**: Ensure you're on the correct domain
2. **Check Amounts**: Review payment details before signing
3. **Use Hardware Wallets**: For high-value transactions
4. **Monitor Transactions**: Set up alerts for wallet activity

---

## Security Audits

### Planned Audits

- [ ] Protocol security review (Trail of Bits, OpenZeppelin, or similar)
- [ ] Penetration testing of facilitator service
- [ ] Smart contract integration review

### Continuous Security

- **Dependency Scanning**: Dependabot, govulncheck, npm audit
- **Container Scanning**: Trivy in CI/CD pipeline
- **SBOM Generation**: Software Bill of Materials for each release
- **Secret Scanning**: GitHub secret scanning enabled

---

## Responsible Disclosure

We follow responsible disclosure practices:

1. **Report**: Submit vulnerability privately via channels above
2. **Acknowledge**: We respond within the timeline specified
3. **Investigate**: We confirm and assess the issue
4. **Fix**: We develop and test a fix
5. **Release**: We deploy the fix and publish a security advisory
6. **Credit**: We credit the reporter (unless anonymity requested)

### Bug Bounty

We have an active bug bounty program. See **[BUG_BOUNTY.md](BUG_BOUNTY.md)** for:
- Reward tiers ($50 - $10,000 in USDT)
- Scope and vulnerability categories
- Reporting guidelines
- Response timeline

### Hall of Fame

Security researchers who have helped improve T402:

*No submissions yet - be the first!*

---

## Contact

- **Security Issues**: security@t402.io
- **General Support**: See [SUPPORT.md](SUPPORT.md)
- **Code of Conduct**: See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
