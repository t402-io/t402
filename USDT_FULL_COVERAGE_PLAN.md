# T402 USDT/USDT0 Full Blockchain Coverage Plan

> **Goal**: Support 100% of all blockchains with USDT or USDT0 deployments
>
> Created: 2026-01-22
> Last Updated: 2026-01-22
>
> **Phase 1 & 2 Complete**: Legacy EVM USDT (BNB, Avalanche, Celo, Kaia, Fantom)
> **Phase 3 In Progress**: Near Protocol (spec + Go mechanism done)

---

## Executive Summary

This plan outlines T402's strategy to become the definitive payment protocol for USDT/USDT0 across **ALL** supported blockchains. Based on comprehensive research, we have identified:

| Category | Networks | T402 Status |
|----------|----------|-------------|
| USDT0 (LayerZero OFT) | 19 | ✅ 100% Complete |
| Native USDT (Major) | 6 | ✅ 100% Complete |
| Legacy EVM USDT | 5 | ✅ 100% Complete |
| Near Protocol | 1 | ⚠️ In Progress (spec + Go done) |
| Native USDT (Emerging) | 3+ | ❌ Planned |
| **Total Target** | **33+** | **85% → 100%** |

---

## Part I: Current Coverage Status

### ✅ USDT0 Networks - COMPLETE (19/19)

All LayerZero OFT USDT0 networks are now supported:

| Network | Chain ID | Status | Paywall |
|---------|----------|--------|---------|
| Ethereum | 1 | ✅ | ✅ |
| Arbitrum | 42161 | ✅ | ✅ |
| Optimism | 10 | ✅ | ✅ |
| Polygon | 137 | ✅ | ✅ |
| Ink | 57073 | ✅ | ✅ |
| Berachain | 80094 | ✅ | ✅ |
| Unichain | 130 | ✅ | ✅ |
| Mantle | 5000 | ✅ | ✅ |
| Plasma | 9745 | ✅ | ✅ |
| Sei | 1329 | ✅ | ✅ |
| Conflux | 1030 | ✅ | ✅ |
| Monad | 143 | ✅ | ✅ |
| Flare | 14 | ✅ | ✅ |
| Rootstock | 30 | ✅ | ✅ |
| XLayer | 196 | ✅ | ✅ |
| Stable | 988 | ✅ | ✅ |
| HyperEVM | 999 | ✅ | ✅ |
| MegaETH | 4326 | ✅ | ✅ |
| Corn | 21000000 | ✅ | ✅ |

### ✅ Native USDT - Supported (3 networks)

| Network | Token Standard | Status | Paywall |
|---------|----------------|--------|---------|
| TON | Jetton | ✅ | ✅ |
| TRON | TRC-20 | ✅ | ✅ |
| Solana | SPL | ✅ | ✅ |

### ❌ Native USDT - Not Yet Supported

| Network | Token Standard | Priority | Complexity |
|---------|----------------|----------|------------|
| BNB Chain | BEP-20 | P0 | Low (EVM) |
| Avalanche | C-Chain | P0 | Low (EVM) |
| Celo | ERC-20 | P1 | Low (EVM) |
| Near | NEP-141 | P1 | Medium |
| Aptos | Move | P2 | High |
| Tezos | FA2 | P2 | High |
| Polkadot | Asset Hub | P2 | High |
| Kaia (Klaytn) | KIP-7 | P1 | Low (EVM) |

---

## Part II: Implementation Phases

### Phase 1: EVM Native USDT (P0) - 2 weeks

**Networks**: BNB Chain, Avalanche

These are straightforward EVM chains with legacy USDT (no EIP-3009).

#### BNB Chain (BEP-20)

| Item | Value |
|------|-------|
| Chain ID | 56 |
| USDT Address | `0x55d398326f99059fF775485246999027B3197955` |
| RPC | https://bsc-dataseed.binance.org |
| Token Type | Legacy (approve + transferFrom) |
| CAIP-2 | `eip155:56` |

**Implementation**:
1. Add to `go/mechanisms/evm/constants.go`
2. Add to `typescript/packages/mechanisms/evm/src/tokens.ts`
3. Add to `python/t402/src/t402/chains.py`
4. Add to Facilitator config
5. Implement legacy token flow (non-EIP-3009)

#### Avalanche C-Chain

| Item | Value |
|------|-------|
| Chain ID | 43114 |
| USDT Address | `0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7` |
| RPC | https://api.avax.network/ext/bc/C/rpc |
| Token Type | Legacy |
| CAIP-2 | `eip155:43114` |

**Files to modify**:
```
go/mechanisms/evm/constants.go
go/mechanisms/evm/legacy.go (NEW)
typescript/packages/mechanisms/evm/src/tokens.ts
typescript/packages/mechanisms/evm/src/legacy/ (NEW)
python/t402/src/t402/chains.py
services/facilitator/internal/config/config.go
services/facilitator/cmd/facilitator/main.go
```

### Phase 2: Additional EVM USDT (P1) - 2 weeks

**Networks**: Celo, Kaia (Klaytn), Fantom

#### Celo

| Item | Value |
|------|-------|
| Chain ID | 42220 |
| USDT Address | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` |
| RPC | https://forno.celo.org |
| CAIP-2 | `eip155:42220` |

#### Kaia (formerly Klaytn)

| Item | Value |
|------|-------|
| Chain ID | 8217 |
| USDT Address | `0xcee8faf64bb97a73bb51e115aa89c17ffa8dd167` |
| RPC | https://public-en.node.kaia.io |
| CAIP-2 | `eip155:8217` |

#### Fantom

| Item | Value |
|------|-------|
| Chain ID | 250 |
| USDT Address | `0x049d68029688eabf473097a2fc38ef61633a3c7a` |
| RPC | https://rpc.ftm.tools |
| CAIP-2 | `eip155:250` |

### Phase 3: Non-EVM Chains (P1-P2) - 4-6 weeks

#### Near Protocol (P1)

| Item | Value |
|------|-------|
| USDT Address | `usdt.tether-token.near` |
| Standard | NEP-141 |
| RPC | https://rpc.mainnet.near.org |
| CAIP-2 | `near:mainnet` |

**Implementation**:
- Near wallet integration (already have paywall)
- Near SDK for signing (`near-api-js`)
- Transaction format differs from EVM

**Files to create**:
```
go/mechanisms/near/ (NEW)
typescript/packages/mechanisms/near/ (NEW)
python/t402/src/t402/near/ (NEW)
```

#### Aptos (P2)

| Item | Value |
|------|-------|
| USDT Address | `0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDT` |
| Standard | Move Coin |
| RPC | https://fullnode.mainnet.aptoslabs.com/v1 |
| CAIP-2 | `aptos:1` |

**Complexity**: High - requires Move VM understanding and Aptos SDK

#### Tezos (P2)

| Item | Value |
|------|-------|
| USDT Address | `KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o` |
| Standard | FA2 |
| RPC | https://mainnet.api.tez.ie |
| CAIP-2 | `tezos:NetXdQprcVkpaWU` |

**Complexity**: High - requires Michelson/LIGO understanding

#### Polkadot Asset Hub (P2)

| Item | Value |
|------|-------|
| Asset ID | TBD |
| Standard | Assets Pallet |
| RPC | wss://polkadot-asset-hub-rpc.polkadot.io |
| CAIP-2 | `polkadot:91b171bb158e2d3848fa23a9f1c25182` |

**Complexity**: High - requires Substrate/Polkadot.js

---

## Part III: Technical Architecture

### Legacy USDT Flow (Non-EIP-3009)

For chains without EIP-3009 support, implement approve + transferFrom:

```
┌─────────┐     ┌─────────┐     ┌─────────────┐     ┌─────────────┐
│ Client  │────▶│ Server  │────▶│ Facilitator │────▶│ Blockchain  │
└─────────┘     └─────────┘     └─────────────┘     └─────────────┘
     │               │                 │                   │
     │  1. Request   │                 │                   │
     │──────────────▶│                 │                   │
     │               │                 │                   │
     │  2. 402 + Requirements          │                   │
     │◀──────────────│                 │                   │
     │               │                 │                   │
     │  3. Approve tx (client signs)   │                   │
     │─────────────────────────────────────────────────────▶
     │               │                 │                   │
     │  4. Submit approval proof       │                   │
     │──────────────▶│                 │                   │
     │               │                 │                   │
     │               │  5. Verify      │                   │
     │               │────────────────▶│                   │
     │               │                 │                   │
     │               │                 │  6. transferFrom  │
     │               │                 │──────────────────▶│
     │               │                 │                   │
     │  7. Resource  │                 │                   │
     │◀──────────────│                 │                   │
```

### Token Type Detection

```typescript
interface TokenConfig {
  address: Address;
  symbol: string;
  decimals: number;
  tokenType: 'eip3009' | 'legacy' | 'native';
  // EIP-3009 specific
  name?: string;
  version?: string;
}

function getPaymentFlow(token: TokenConfig) {
  switch (token.tokenType) {
    case 'eip3009':
      return createEIP3009Payload; // transferWithAuthorization
    case 'legacy':
      return createLegacyPayload;  // approve + transferFrom
    case 'native':
      return createNativePayload;  // direct transfer
  }
}
```

### New Scheme: `legacy`

Add a new payment scheme for legacy tokens:

```json
{
  "scheme": "legacy",
  "network": "eip155:56",
  "asset": "eip155:56/erc20:0x55d398326f99059fF775485246999027B3197955",
  "amount": "1000000",
  "payTo": "0x...",
  "approvalTxHash": "0x...",
  "nonce": 12345
}
```

---

## Part IV: Implementation Checklist

### Phase 1: EVM Legacy USDT (Weeks 1-2)

- [ ] Create `legacy` scheme specification
- [ ] Implement legacy scheme in TypeScript
  - [ ] `@t402/evm/legacy/client`
  - [ ] `@t402/evm/legacy/server`
  - [ ] `@t402/evm/legacy/facilitator`
- [ ] Implement legacy scheme in Go
  - [ ] `go/mechanisms/evm/legacy/`
- [ ] Implement legacy scheme in Python
  - [ ] `python/t402/src/t402/evm_legacy.py`
- [ ] Add BNB Chain support
  - [ ] Token config
  - [ ] RPC endpoints
  - [ ] Tests
- [ ] Add Avalanche support
  - [ ] Token config
  - [ ] RPC endpoints
  - [ ] Tests
- [ ] Update Facilitator
  - [ ] Add legacy settlement logic
  - [ ] Add network configs
- [ ] Update Paywall
  - [ ] Add BNB/Avalanche chains

### Phase 2: Additional EVM (Weeks 3-4)

- [ ] Add Celo support
- [ ] Add Kaia support
- [ ] Add Fantom support
- [ ] Comprehensive testing
- [ ] Documentation updates

### Phase 3: Non-EVM (Weeks 5-10)

- [ ] Near Protocol
  - [ ] Create `@t402/near` package
  - [ ] Implement client/server/facilitator
  - [ ] Wallet integration
  - [ ] Tests
- [ ] Aptos (if prioritized)
  - [ ] Research Move VM
  - [ ] Create `@t402/aptos` package
  - [ ] Implement mechanisms
- [ ] Tezos (if prioritized)
  - [ ] Research FA2 standard
  - [ ] Create `@t402/tezos` package
- [ ] Polkadot (if prioritized)
  - [ ] Research Assets Pallet
  - [ ] Create `@t402/polkadot` package

---

## Part V: Resource Requirements

### Development Team

| Role | Phase 1 | Phase 2 | Phase 3 |
|------|---------|---------|---------|
| TypeScript Dev | 1 | 1 | 2 |
| Go Dev | 1 | 0.5 | 1 |
| Python Dev | 0.5 | 0.5 | 0.5 |
| DevOps | 0.5 | 0.5 | 0.5 |

### Infrastructure

| Item | Cost/Month |
|------|------------|
| Additional RPC endpoints | $200-500 |
| Testing infrastructure | $100 |
| Monitoring expansion | $50 |

---

## Part VI: Success Metrics

### Coverage Metrics

| Milestone | Target | Timeline |
|-----------|--------|----------|
| Phase 1 Complete | 25 networks | Week 2 |
| Phase 2 Complete | 28 networks | Week 4 |
| Phase 3 Complete | 33+ networks | Week 10 |

### Quality Metrics

- Test coverage: >90% for all new code
- Facilitator uptime: >99.9%
- Settlement success rate: >99%

---

## Part VII: Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Legacy USDT requires gas | User experience | Document clearly, consider gas sponsoring |
| Non-EVM complexity | Development time | Phased approach, start with simpler chains |
| RPC reliability | Service availability | Multiple RPC providers, fallback logic |
| Token contract changes | Breaking changes | Version monitoring, graceful degradation |

---

## Part VIII: Competitive Analysis

### T402 vs x402 After Full Coverage

| Metric | T402 | x402 |
|--------|------|------|
| Total Networks | **33+** | 5 |
| USDT0 Networks | 19 | 0 |
| Native USDT | 14+ | 5 |
| Non-EVM | 7+ | 1 (Solana) |
| Legacy USDT | ✅ | ❌ |

---

## Appendix A: Complete Network Reference

### All USDT/USDT0 Networks

| # | Network | Chain ID | Type | Status |
|---|---------|----------|------|--------|
| 1 | Ethereum | 1 | USDT0 + Legacy | ✅ |
| 2 | Arbitrum | 42161 | USDT0 | ✅ |
| 3 | Optimism | 10 | USDT0 | ✅ |
| 4 | Polygon | 137 | USDT0 | ✅ |
| 5 | Ink | 57073 | USDT0 | ✅ |
| 6 | Berachain | 80094 | USDT0 | ✅ |
| 7 | Unichain | 130 | USDT0 | ✅ |
| 8 | Mantle | 5000 | USDT0 | ✅ |
| 9 | Plasma | 9745 | USDT0 | ✅ |
| 10 | Sei | 1329 | USDT0 | ✅ |
| 11 | Conflux | 1030 | USDT0 | ✅ |
| 12 | Monad | 143 | USDT0 | ✅ |
| 13 | Flare | 14 | USDT0 | ✅ |
| 14 | Rootstock | 30 | USDT0 | ✅ |
| 15 | XLayer | 196 | USDT0 | ✅ |
| 16 | Stable | 988 | USDT0 | ✅ |
| 17 | HyperEVM | 999 | USDT0 | ✅ |
| 18 | MegaETH | 4326 | USDT0 | ✅ |
| 19 | Corn | 21000000 | USDT0 | ✅ |
| 20 | TON | - | Native | ✅ |
| 21 | TRON | - | Native | ✅ |
| 22 | Solana | - | Native | ✅ |
| 23 | BNB Chain | 56 | Legacy | ✅ Complete |
| 24 | Avalanche | 43114 | Legacy | ✅ Complete |
| 25 | Celo | 42220 | Legacy | ✅ Complete |
| 26 | Kaia | 8217 | Legacy | ✅ Complete |
| 27 | Fantom | 250 | Legacy | ✅ Complete |
| 28 | Near | - | NEP-141 | ⚠️ In Progress |
| 29 | Aptos | - | Move | ❌ Phase 3 |
| 30 | Tezos | - | FA2 | ❌ Phase 3 |
| 31 | Polkadot | - | Assets | ❌ Phase 3 |
| 32 | Cosmos/Noble | - | Native | ✅ (USDC) |
| 33 | Stacks | - | sBTC | ✅ (sUSDC) |

---

## Appendix B: USDT Contract Addresses

### Legacy USDT (Non-EIP-3009)

| Network | Chain ID | Address |
|---------|----------|---------|
| Ethereum | 1 | `0xdAC17F958D2ee523a2206206994597C13D831ec7` |
| BNB Chain | 56 | `0x55d398326f99059fF775485246999027B3197955` |
| Avalanche | 43114 | `0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7` |
| Polygon | 137 | `0xc2132D05D31c914a87C6611C10748AEb04B58e8F` |
| Fantom | 250 | `0x049d68029688eabf473097a2fc38ef61633a3c7a` |
| Celo | 42220 | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` |
| Kaia | 8217 | `0xcee8faf64bb97a73bb51e115aa89c17ffa8dd167` |

### Non-EVM USDT

| Network | Address |
|---------|---------|
| TON Mainnet | `EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs` |
| TRON Mainnet | `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` |
| Solana | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` |
| Near | `usdt.tether-token.near` |
| Aptos | `0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDT` |
| Tezos | `KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o` |

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-22 | Initial comprehensive plan |

---

## References

- [USDT0 Documentation](https://docs.usdt0.to)
- [Tether Official](https://tether.io)
- [LayerZero Documentation](https://docs.layerzero.network)
- [CAIP-2 Specification](https://github.com/ChainAgnostic/CAIPs/blob/master/CAIPs/caip-2.md)
