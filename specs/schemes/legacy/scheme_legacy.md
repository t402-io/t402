# Scheme: `legacy`

## Summary

`legacy` is a scheme for ERC-20 tokens that do not support EIP-3009 `transferWithAuthorization`. It uses the standard ERC-20 `approve` + `transferFrom` pattern where the client first approves the facilitator to spend tokens, then the facilitator executes the transfer.

## Motivation

Many widely-used stablecoins, including USDT on most chains (BNB Chain, Avalanche, Polygon native, etc.), do not implement EIP-3009. The `legacy` scheme enables T402 to support these tokens while maintaining the same user experience pattern.

## Key Differences from `exact`

| Aspect | `exact` (EIP-3009) | `legacy` (ERC-20) |
|--------|-------------------|-------------------|
| Client Action | Sign off-chain authorization | Submit on-chain approval tx |
| Gas Required | No (gasless) | Yes (client pays approval gas) |
| Facilitator Action | Call `transferWithAuthorization` | Call `transferFrom` |
| Security Model | Time-bounded, single-use nonce | Allowance-based |

## Example Use Cases

- Paying with USDT on BNB Chain
- Paying with USDT on Avalanche C-Chain
- Paying with any ERC-20 token that lacks EIP-3009 support

## Flow Diagram

```
┌─────────┐     ┌─────────┐     ┌─────────────┐     ┌─────────────┐
│ Client  │     │ Server  │     │ Facilitator │     │ Blockchain  │
└────┬────┘     └────┬────┘     └──────┬──────┘     └──────┬──────┘
     │               │                 │                   │
     │ 1. Request    │                 │                   │
     │──────────────▶│                 │                   │
     │               │                 │                   │
     │ 2. 402 + Requirements           │                   │
     │   (scheme: legacy)              │                   │
     │◀──────────────│                 │                   │
     │               │                 │                   │
     │ 3. approve(facilitator, amount) │                   │
     │─────────────────────────────────────────────────────▶
     │               │                 │                   │
     │ 4. Request + X-Payment header   │                   │
     │   (includes approval txHash)    │                   │
     │──────────────▶│                 │                   │
     │               │                 │                   │
     │               │ 5. Verify       │                   │
     │               │────────────────▶│                   │
     │               │                 │ 6. Check allowance│
     │               │                 │──────────────────▶│
     │               │                 │                   │
     │               │                 │ 7. transferFrom   │
     │               │                 │──────────────────▶│
     │               │                 │                   │
     │ 8. Resource   │                 │                   │
     │◀──────────────│                 │                   │
```

## Appendix

### Security Considerations

1. **Allowance Persistence**: Unlike EIP-3009 authorizations which are single-use, ERC-20 allowances persist until revoked. Clients should approve only the exact amount needed.

2. **Front-running Risk**: There is a theoretical risk of allowance front-running. Mitigations include:
   - Approving exact amounts (not unlimited)
   - Using the approval txHash to verify timing

3. **Gas Costs**: Clients must pay gas for the approval transaction. This is a trade-off for supporting legacy tokens.

### Comparison with Permit (EIP-2612)

Some tokens support EIP-2612 `permit` which allows gasless approvals. However:
- Not all legacy USDT tokens support EIP-2612
- The `legacy` scheme provides a universal fallback
- Future T402 versions may add a dedicated `permit` scheme
