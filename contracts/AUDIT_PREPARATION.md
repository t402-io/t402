# External Security Audit Preparation

This document outlines the preparation requirements for engaging an external security auditor for the T402 smart contracts.

## Audit Scope

### In-Scope Contracts

| Contract | LOC | Complexity | Priority |
|----------|-----|------------|----------|
| `T402UptoRouter.sol` | 202 | Low | P0 |
| `IT402UptoRouter.sol` | 65 | Interface | P0 |
| `IERC20Permit.sol` | 51 | Interface | P0 |

**Total Lines of Code**: ~320 LOC (excluding tests and mocks)

### Out of Scope
- Test contracts (`test/`)
- Mock contracts (`test/mocks/`)
- Deployment scripts (`script/`)
- Third-party dependencies (`lib/forge-std`)

## Contract Overview

### T402UptoRouter

**Purpose**: Router contract for the T402 "upto" payment scheme, enabling usage-based billing by combining EIP-2612 permit with flexible settlement amounts.

**Key Features**:
1. Execute permit + transferFrom in single transaction
2. Settle any amount up to the permitted maximum
3. Facilitator-only access control
4. Owner-managed facilitator list

**Trust Assumptions**:
- Owner is trusted (should be multisig)
- Facilitators are trusted to settle correct amounts
- Tokens implement EIP-2612 correctly

**External Interactions**:
- Calls `permit()` on ERC20 tokens
- Calls `transferFrom()` on ERC20 tokens
- Calls `nonces()`, `DOMAIN_SEPARATOR()`, `balanceOf()` for view functions

## Security Concerns

### Areas Requiring Focus

1. **Permit Signature Handling**
   - Verify correct EIP-2612 implementation
   - Check for signature replay vectors
   - Validate deadline enforcement

2. **Access Control**
   - Owner privilege escalation
   - Facilitator management edge cases
   - Modifier bypass scenarios

3. **Token Interactions**
   - Non-standard ERC20 behavior
   - Reentrancy via malicious tokens
   - Return value handling

4. **Economic Attacks**
   - Front-running permit signatures
   - Griefing attacks on facilitators
   - Gas price manipulation

### Known Issues (Accepted Risks)

1. **Immutable Owner**: Ownership cannot be transferred. Mitigated by using multisig.
2. **No Pause**: Contract cannot be paused. Mitigated by removing all facilitators.
3. **Leftover Allowance**: Unused permit allowance remains. Not exploitable.

## Test Coverage

```
| File                  | % Lines | % Statements | % Branches | % Functions |
|-----------------------|---------|--------------|------------|-------------|
| T402UptoRouter.sol    | 100%    | 100%         | 100%       | 100%        |
```

### Test Categories
- Unit tests: 17 tests
- Fuzz tests: 1 test (256 runs)
- Edge case tests: 4 tests
- **Total**: 22 tests, all passing

## Deployment Information

### Target Networks
1. Base Sepolia (testnet) - Chain ID: 84532
2. Base Mainnet - Chain ID: 8453
3. Ethereum Mainnet - Chain ID: 1
4. Arbitrum One - Chain ID: 42161

### Constructor Parameters
```solidity
constructor(address initialFacilitator)
```

**Production Value**: `0xC88f67e776f16DcFBf42e6bDda1B82604448899B` (T402 Facilitator)

### Compiler Settings
```toml
solc = "0.8.24"
optimizer = true
optimizer_runs = 200
via_ir = true
```

## Documentation

| Document | Description |
|----------|-------------|
| `README.md` | Contract overview and deployment guide |
| `SECURITY_AUDIT.md` | Internal security review findings |
| `src/T402UptoRouter.sol` | Fully documented with NatSpec |
| `src/interfaces/*.sol` | Interface documentation |

## Audit Timeline Recommendation

| Phase | Duration | Description |
|-------|----------|-------------|
| Initial Review | 2-3 days | Code familiarization |
| Deep Analysis | 3-5 days | Vulnerability hunting |
| Report Drafting | 1-2 days | Findings documentation |
| Review & Response | 2-3 days | Address findings |
| **Total** | **8-13 days** | For ~320 LOC |

## Recommended Auditors

Based on expertise in ERC20, EIP-2612, and payment protocols:

| Auditor | Specialization | Website |
|---------|---------------|---------|
| Trail of Bits | Smart contracts, formal verification | trailofbits.com |
| OpenZeppelin | ERC standards, access control | openzeppelin.com |
| Consensys Diligence | DeFi, token standards | consensys.net/diligence |
| Spearbit | Security research | spearbit.com |
| Code4rena | Competitive audit | code4rena.com |

## Deliverables Expected

1. **Audit Report**
   - Executive summary
   - Detailed findings with severity ratings
   - Code quality observations
   - Recommendations

2. **Verification**
   - Confirmation of fixes
   - Re-audit of changed code
   - Final sign-off

## Budget Estimation

| Audit Type | Estimated Cost | Timeline |
|------------|---------------|----------|
| Solo Auditor | $5,000 - $10,000 | 1-2 weeks |
| Boutique Firm | $15,000 - $30,000 | 2-3 weeks |
| Top-tier Firm | $30,000 - $50,000 | 3-4 weeks |
| Competitive (Code4rena) | $20,000 - $40,000 | 1 week |

*Estimates based on ~320 LOC of low-complexity code*

## Pre-Audit Checklist

- [x] All tests passing
- [x] 100% test coverage
- [x] NatSpec documentation complete
- [x] Internal security review complete
- [x] README with deployment instructions
- [x] CI/CD pipeline configured
- [ ] Freeze code (no changes during audit)
- [ ] Prepare Q&A document for auditor
- [ ] Set up secure communication channel

## Contact

**Project**: T402 Payment Protocol
**Security Contact**: security@t402.io
**Repository**: https://github.com/t402-io/t402/tree/main/contracts
