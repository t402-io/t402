# Security Policy

The T402 team takes security seriously. Please do not file a public ticket discussing a potential vulnerability.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.x     | :white_check_mark: |
| 1.x     | :x:                |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Report vulnerabilities through one of these channels:

1. **GitHub Security Advisories** (preferred): [Report a vulnerability](https://github.com/t402-io/t402/security/advisories/new)
2. **Email**: security@t402.io

### What to Include

- Type of vulnerability (e.g., signature bypass, replay attack, injection)
- Affected component (SDK, facilitator, specific chain)
- Steps to reproduce the issue
- Proof-of-concept code (if possible)
- Impact assessment

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Based on severity
  - Critical: Within 7 days
  - High: Within 30 days
  - Medium/Low: Next regular release

## Security Best Practices

### Private Key Management

- Never commit private keys to version control
- Use environment variables or secret management (Vault, AWS Secrets Manager)
- Use separate keys for testnet and mainnet
- Rotate keys periodically

### API Key Security (Facilitator)

- Generate strong keys (minimum 32 bytes of entropy)
- Rotate API keys periodically
- Monitor usage for anomalies
- Use different keys per environment

### Payment Verification

- Always verify signatures server-side
- Validate all payment parameters (amount, recipient, expiration)
- Check for replay attacks via nonce/deadline validation
- Log payment attempts for auditing

## Responsible Disclosure

We follow responsible disclosure practices:

1. Reporter submits vulnerability privately
2. We acknowledge within 48 hours
3. We investigate and confirm the issue
4. We develop and test a fix
5. We release the fix and publish a security advisory
6. We credit the reporter (unless anonymity is requested)
