# Cross-Chain Bridge Risk Documentation

## Overview

t402's cross-chain bridge functionality uses **LayerZero OFT (Omnichain Fungible Token)** protocol to bridge **USDT0** across EVM chains. This document describes the external dependencies and their associated risks.

## External Dependencies

### LayerZero Protocol

- **Role**: Cross-chain messaging layer for USDT0 OFT transfers
- **Trust model**: Relies on LayerZero's Decentralized Verifier Network (DVN)
  for message verification. Messages are verified by configurable sets of DVNs
  before delivery.
- **Risk**: If the DVN set is compromised, cross-chain messages could be
  forged, potentially minting unbacked tokens on the destination chain.
- **Mitigation**: USDT0 uses Tether's own DVN configuration with multiple
  independent verifiers. LayerZero V2 supports configurable security stacks.

### USDT0 (Tether)

- **Role**: Cross-chain stablecoin used as the default payment asset
- **Trust model**: USDT0 is an OFT extension of USDT, backed 1:1 by USDT
  reserves on Ethereum mainnet. Tether controls minting/burning.
- **De-peg risk**: If USDT loses its peg or Tether faces regulatory action,
  USDT0 on all chains would be affected.
- **Bridge risk**: If LayerZero messaging is disrupted, USDT0 on secondary
  chains may temporarily trade at a discount to USDT on Ethereum.

## Failure Modes

| Scenario | Impact | Severity |
|----------|--------|----------|
| LayerZero DVN compromise | Unauthorized token minting on destination chain | Critical |
| LayerZero outage | Bridge transactions stuck/pending, no fund loss | Medium |
| USDT de-peg | All USDT0 balances devalue proportionally | High |
| Chain reorg on source | Bridge tx included then reverted, destination may still credit | High |
| Gas price spike | Bridge transactions may fail or cost more than expected | Low |

## Historical Precedents

Cross-chain bridges have historically been high-value attack targets:
- Wormhole (2022): $320M exploit via signature verification bypass
- Ronin Bridge (2022): $625M via compromised validator keys
- Nomad (2022): $190M via initialization vulnerability

LayerZero has not suffered a major exploit as of 2026, but the attack surface
of cross-chain messaging remains a top concern in DeFi security.

## Recommendations for Deployers

1. **Set bridge amount limits** in the facilitator configuration
2. **Monitor bridge transaction confirmations** — do not credit funds until
   both source and destination chains confirm
3. **Use mainnet-only OFT contracts** — verify contract addresses against
   Tether's official deployment list
4. **Implement circuit breakers** — halt bridging if unusual volume is detected
5. **Consider USDC as an alternative** where USDT0 bridge risk is unacceptable
