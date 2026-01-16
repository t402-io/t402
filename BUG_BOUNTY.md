# T402 Bug Bounty Program

> *Last Updated: 2026-01-16*

We invite security researchers to help us identify vulnerabilities in the T402 protocol. This program rewards responsible disclosure of security issues.

## Rewards

| Severity | Description | Reward |
|----------|-------------|--------|
| **Critical** | Loss of funds, signature bypass, unauthorized settlements | $1,000 - $10,000 |
| **High** | Replay attacks, authentication bypass, data exposure | $500 - $1,000 |
| **Medium** | Rate limit bypass, information disclosure, DoS | $100 - $500 |
| **Low** | Minor issues, best practice violations | $50 - $100 |

Rewards are paid in USDT on your preferred supported chain (Ethereum, Base, Arbitrum, TON, TRON, or Solana).

---

## Scope

### In Scope

#### Protocol & SDKs

| Component | Repository Path | Priority |
|-----------|-----------------|----------|
| TypeScript SDK | `typescript/packages/*` | High |
| Go SDK | `go/*` | High |
| Python SDK | `python/*` | High |
| Java SDK | `java/*` | Medium |

#### Facilitator Service

| Component | Path | Priority |
|-----------|------|----------|
| Core Service | `services/facilitator/*` | Critical |
| API Endpoints | `/verify`, `/settle`, `/supported` | Critical |
| Authentication | API key validation | High |
| Rate Limiting | Redis-based limiter | Medium |

#### Chain Mechanisms

| Chain | Components | Priority |
|-------|------------|----------|
| EVM | EIP-3009, EIP-712 signing, USDT0 | Critical |
| TON | Jetton transfers, wallet signing | Critical |
| TRON | TRC-20 transfers | Critical |
| Solana | SPL token transfers | Critical |

### Out of Scope

- Third-party dependencies (report upstream)
- USDT/USDT0 smart contracts (report to Tether)
- Blockchain consensus issues
- Social engineering attacks
- Physical security attacks
- Issues in test/example code only
- Already known issues (check existing advisories)
- Denial of service via rate limiting (expected behavior)

---

## Vulnerability Categories

### Critical

- Unauthorized token transfers
- Signature forgery or bypass
- Replay attacks across chains or sessions
- Authentication bypass in facilitator
- Private key exposure
- Remote code execution

### High

- Cross-site scripting (XSS) in paywall
- SQL/NoSQL injection
- Improper access control
- Sensitive data exposure
- Session hijacking
- API key leakage

### Medium

- Rate limit bypass
- Information disclosure (non-sensitive)
- Denial of service (application-level)
- Improper input validation
- Missing security headers
- Verbose error messages

### Low

- Best practice violations
- Minor configuration issues
- Code quality issues with security implications
- Missing rate limiting on non-critical endpoints

---

## Rules

### Do

- Test only against testnet/development environments
- Report vulnerabilities promptly
- Provide detailed reproduction steps
- Keep findings confidential until resolved
- Allow reasonable time for fixes (see response timeline)

### Don't

- Test against production systems without permission
- Access or modify other users' data
- Perform denial of service attacks
- Use automated scanners aggressively
- Publicly disclose before coordination
- Demand payment before providing details

---

## How to Report

### 1. GitHub Security Advisories (Preferred)

1. Go to [Security Advisories](https://github.com/t402-io/t402/security/advisories/new)
2. Click "Report a vulnerability"
3. Fill out the form with details below

### 2. Email

Send to: **security@t402.io**

Subject: `[BUG BOUNTY] <Brief Description>`

### Report Template

```markdown
## Summary
Brief description of the vulnerability.

## Severity
Critical / High / Medium / Low

## Affected Component
- [ ] TypeScript SDK
- [ ] Go SDK
- [ ] Python SDK
- [ ] Java SDK
- [ ] Facilitator Service
- [ ] EVM Mechanism
- [ ] TON Mechanism
- [ ] TRON Mechanism
- [ ] Solana Mechanism
- [ ] Other: ___

## Description
Detailed explanation of the vulnerability.

## Steps to Reproduce
1. Step one
2. Step two
3. ...

## Proof of Concept
Code or commands to demonstrate the issue.

## Impact
What can an attacker achieve?

## Suggested Fix
(Optional) How would you fix this?

## Environment
- SDK Version:
- Chain/Network:
- OS:
- Other relevant details:

## Your Information
- Name/Handle:
- Payment Address (USDT):
- Preferred Chain:
```

---

## Response Timeline

| Stage | Timeline |
|-------|----------|
| Acknowledgment | 24-48 hours |
| Initial Assessment | 3-5 days |
| Status Update | Weekly |
| Fix Development | Varies by severity |
| Reward Payment | Within 14 days of fix |

---

## Reward Determination

Rewards are based on:

1. **Severity**: Impact on users and protocol
2. **Quality**: Clarity of report and reproduction steps
3. **Novelty**: Previously unknown vulnerability class
4. **Fix Assistance**: Providing a working fix

### Bonus Multipliers

| Condition | Multiplier |
|-----------|------------|
| Working fix provided | 1.25x |
| Multiple related issues | 1.5x |
| Novel attack vector | 2x |
| First report of class | 1.5x |

### Deductions

| Condition | Effect |
|-----------|--------|
| Incomplete report | -25% |
| Delayed response | -10% per week |
| Public disclosure | Disqualified |

---

## Legal

### Safe Harbor

We will not pursue legal action against researchers who:

- Act in good faith
- Follow responsible disclosure
- Do not access others' data
- Do not disrupt services
- Report through official channels

### Terms

- One reward per vulnerability
- First reporter receives reward
- Duplicate reports receive acknowledgment only
- We reserve right to adjust severity
- Rewards are discretionary
- Must be 18+ to receive payment

---

## Hall of Fame

Security researchers who have helped improve T402:

| Researcher | Findings | Date |
|------------|----------|------|
| *Be the first!* | - | - |

---

## Updates

| Date | Change |
|------|--------|
| 2025-01-12 | Program launched |

---

## Contact

- **Bug Reports**: security@t402.io
- **Program Questions**: security@t402.io
- **Twitter**: [@t402_io](https://x.com/t402_io)

---

## Related Documents

- [SECURITY.md](SECURITY.md) - Security policy and architecture
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) - Community guidelines
