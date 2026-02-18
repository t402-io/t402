# Permit2 Scheme

## Overview

The `permit2` scheme enables token transfers using Uniswap's [Permit2](https://github.com/Uniswap/permit2) contract. Unlike the `exact` scheme (which relies on EIP-3009 `transferWithAuthorization`), Permit2 works with **any ERC20 token** that has been approved to the Permit2 contract, including tokens without built-in meta-transaction support.

## Scheme Identifier

```
scheme: "permit2"
```

## How It Works

1. **Token Owner** approves the Permit2 contract (`0x000000000022D473030F116dDEE9F6B43aC78BA3`) to spend their tokens (one-time `approve` call).
2. **Client** signs an EIP-712 `PermitTransferFrom` message specifying the token, amount, recipient (spender), nonce, and deadline.
3. **Facilitator** calls `permitTransferFrom` on the Permit2 contract with the signed permit and transfer details.

## Advantages Over EIP-3009

- Works with **any ERC20 token** (not just EIP-3009 tokens like USDC/USDT0)
- Single approval to the canonical Permit2 contract covers all future transfers
- Nonce management is handled by the Permit2 contract (non-sequential nonces)
- Widely adopted across DeFi (Uniswap, 1inch, etc.)

## Network Support

The Permit2 contract is deployed at the same address on all EVM chains:

```
0x000000000022D473030F116dDEE9F6B43aC78BA3
```

See [scheme_permit2_evm.md](./scheme_permit2_evm.md) for EVM-specific implementation details.
