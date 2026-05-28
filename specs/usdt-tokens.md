# T402 USDT Token Coverage

**Status:** Recommended supplementary spec
**Audience:** Integrators choosing a scheme + extension combination for Tether-issued and Tether-compatible USD tokens
**Maintainers:** T402 working group

## Overview

T402 is an HTTP-native payment protocol that is **token-agnostic at the wire layer** but in practice operates predominantly on Tether-issued and Tether-compatible stablecoins. This document is the canonical routing reference connecting each token to the scheme and extension(s) that integrators MUST use to settle it correctly.

This document does NOT introduce new wire format. It documents the deterministic mapping between:

- **Token** — the on-chain asset
- **Network** — CAIP-2 chain identifier on which the asset is deployed
- **Scheme** — the t402 payment scheme that handles the asset's transfer authorization model
- **Extension** — additional protocol surface (e.g. gas sponsoring) sometimes required

Without this table, a reader of the core specification and individual scheme docs cannot determine *which scheme to ship* for a given Tether token. The token registries inside `@t402/wdk` and `mechanisms/evm` SDKs make these decisions internally; this document elevates that knowledge to the spec layer so external integrators (including Tether's WDK x402 integration page) can reason about t402 USDT support without reading SDK source.

## 1. Token Universe

T402 distinguishes four token categories among USD-pegged Tether and Tether-compatible assets. The category determines which scheme is REQUIRED:

| Category | Description | Authorization Model | Default Scheme | Required Extensions |
|---|---|---|---|---|
| **USDT0** | Tether's omnichain token via LayerZero OFT standard | EIP-3009 `transferWithAuthorization` + EIP-2612 `permit` | [`exact_evm`](./schemes/exact/scheme_exact_evm.md) | none |
| **USDC** | Circle's USD Coin (not a Tether asset; included for routing completeness) | EIP-3009 `transferWithAuthorization` + EIP-2612 `permit` | [`exact_evm`](./schemes/exact/scheme_exact_evm.md) | none |
| **USAT** | Tether's federally-regulated US stablecoin (Tether America USD) | EIP-2612 `permit` only — **no EIP-3009** | [`legacy_evm`](./schemes/legacy/scheme_legacy_evm.md) | [`eip2612GasSponsoring`](./extensions/eip2612-gas-sponsoring.md) for gasless flow |
| **Legacy USDT** | Original Tether USD on chains predating EIP-3009 (Ethereum, BNB, Avalanche, etc.) | `approve` + `transferFrom` only | [`legacy_evm`](./schemes/legacy/scheme_legacy_evm.md) | [`erc20ApprovalGasSponsoring`](./extensions/erc20-approval-gas-sponsoring.md) for gasless flow |

Non-EVM USDT issuance forms a fifth implicit category routed through chain-specific exact schemes; see Section 3.6 (TRON) and Section 3.7 (TON).

### Authorization Model Compatibility Matrix

The choice of scheme is driven by what the token contract actually supports, not by integrator preference:

| Token | EIP-3009 `transferWithAuthorization` | EIP-2612 `permit` | Native cross-chain (LayerZero OFT) |
|---|---|---|---|
| USDT0 | ✅ | ✅ | ✅ |
| USDC | ✅ | ✅ | ❌ |
| USAT | ❌ | ✅ | ❌ |
| Legacy USDT | ❌ | ❌ | ❌ |

A scheme that requires EIP-3009 MUST NOT be used for USAT or Legacy USDT. Implementations SHOULD reject such combinations at the SDK layer.

## 2. Network Routing Matrix

The following table lists every (token, network) pair recognized by the t402 reference SDKs and the scheme each integrator MUST use. Addresses are reproduced for reference; the canonical source is `sdks/typescript/packages/mechanisms/evm/src/tokens.ts`.

### 2.1 USDT0 (19 networks)

All USDT0 deployments below are LayerZero OFT contracts that support both EIP-3009 and EIP-2612. They MUST be settled via `exact_evm` with `transferMethod: "permit"` unless overridden by the special-case rules in Section 3.

| Network | CAIP-2 | Contract | EIP-712 `name` | Scheme |
|---|---|---|---|---|
| Ethereum Mainnet | `eip155:1` | `0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee` | `TetherToken` (OFT adapter) | See [§3.1](#31-ethereum-mainnet-usdt0-oft-adapter) — use `permit2-proxy` |
| Arbitrum One | `eip155:42161` | `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9` | `TetherToken` | `exact_evm` |
| Ink Mainnet | `eip155:57073` | `0x0200C29006150606B650577BBE7B6248F58470c1` | `TetherToken` | `exact_evm` |
| Berachain | `eip155:80094` | `0x779Ded0c9e1022225f8E0630b35a9b54bE713736` | `TetherToken` | `exact_evm` |
| Unichain | `eip155:130` | `0x9151434b16b9763660705744891fA906F660EcC5` | `TetherToken` | `exact_evm` |
| Polygon PoS | `eip155:137` | `0xc2132D05D31c914a87C6611C10748AEb04B58e8F` | `TetherToken` | `exact_evm` |
| Optimism | `eip155:10` | `0x01bFF41798a0BcF287b996046Ca68b395DbC1071` | `TetherToken` | `exact_evm` |
| Mantle | `eip155:5000` | `0x779Ded0c9e1022225f8E0630b35a9b54bE713736` | `TetherToken` | `exact_evm` |
| Plasma | `eip155:9745` | `0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb` | `TetherToken` | `exact_evm` |
| Sei | `eip155:1329` | `0x9151434b16b9763660705744891fA906F660EcC5` | `TetherToken` | `exact_evm` |
| Conflux eSpace | `eip155:1030` | `0xaf37E8B6C9ED7f6318979f56Fc287d76c30847ff` | `TetherToken` | `exact_evm` |
| Monad | `eip155:143` | `0xe7cd86e13AC4309349F30B3435a9d337750fC82D` | `TetherToken` | `exact_evm` |
| Rootstock | `eip155:30` | `0x779dED0C9e1022225F8e0630b35A9B54Be713736` | `TetherToken` | `exact_evm` |
| XLayer (OKX L2) | `eip155:196` | `0x779Ded0c9e1022225f8E0630b35a9b54bE713736` | `TetherToken` | `exact_evm` |
| Flare | `eip155:14` | `0xe7cd86e13AC4309349F30B3435a9d337750fC82D` | `TetherToken` | `exact_evm` |
| Corn | `eip155:21000000` | `0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb` | `TetherToken` | `exact_evm` |
| HyperEVM | `eip155:999` | `0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb` | `TetherToken` | `exact_evm` |
| MegaETH | `eip155:4326` | `0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb` | `TetherToken` | `exact_evm` |
| Stable | `eip155:988` | `0x779Ded0c9e1022225f8E0630b35a9b54bE713736` | `TetherToken` | `exact_evm` |

All USDT0 deployments use 6 decimals and EIP-712 domain version `"1"`.

### 2.2 USDC (6 networks)

| Network | CAIP-2 | Contract | EIP-712 `name` | Scheme |
|---|---|---|---|---|
| Ethereum Mainnet | `eip155:1` | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | `USD Coin` | `exact_evm` |
| Base Mainnet | `eip155:8453` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | `USD Coin` | `exact_evm` |
| Arbitrum One | `eip155:42161` | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | `USD Coin` | `exact_evm` |
| Polygon PoS | `eip155:137` | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` | `USD Coin` | `exact_evm` |
| Base Sepolia | `eip155:84532` | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | `USDC` | `exact_evm` |
| Ethereum Sepolia | `eip155:11155111` | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | `USDC` | `exact_evm` |

> **EIP-712 name caveat**: Testnet deployments use the literal `"USDC"` whereas production deployments use `"USD Coin"`. Signing with the wrong name produces signatures the contract rejects. The reference SDK looks this up per-deployment via `getEIP712Domain()`.

All USDC deployments use 6 decimals and EIP-712 domain version `"2"`.

### 2.3 USAT — Tether America USD (1 network)

| Network | CAIP-2 | Contract | EIP-712 `name` | Scheme |
|---|---|---|---|---|
| Ethereum Mainnet | `eip155:1` | `0x07041776f5007aca2a54844f50503a18a72a8b68` | `Tether America USD` | `legacy_evm` + `eip2612GasSponsoring` (see [§3.3](#33-usat-no-eip-3009-permit-only)) |

USAT is currently mainnet-only. 6 decimals. EIP-712 domain version `"1"`. **USAT does not support EIP-3009.** Signing a `transferWithAuthorization` against the USAT contract will revert.

### 2.4 Legacy USDT (7 networks)

These deployments predate EIP-3009 and EIP-2612. They MUST be settled via `legacy_evm` (the `approve` + `transferFrom` scheme) and SHOULD be paired with `erc20ApprovalGasSponsoring` for non-native-token holders.

| Network | CAIP-2 | Contract | Decimals | EIP-712 `name` (unused) | Scheme |
|---|---|---|---|---|---|
| Ethereum Mainnet | `eip155:1` | `0xdAC17F958D2ee523a2206206994597C13D831ec7` | 6 | `TetherUSD` | `legacy_evm` |
| Polygon PoS | `eip155:137` | `0xc2132D05D31c914a87C6611C10748AEb04B58e8F` | 6 | `TetherUSD` | `legacy_evm` |
| BNB Chain | `eip155:56` | `0x55d398326f99059fF775485246999027B3197955` | **18** | `Tether USD` | `legacy_evm` |
| Avalanche C-Chain | `eip155:43114` | `0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7` | 6 | `TetherToken` | `legacy_evm` |
| Fantom | `eip155:250` | `0x049d68029688eabf473097a2fc38ef61633a3c7a` | 6 | `Frapped USDT` | `legacy_evm` |
| Celo | `eip155:42220` | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` | **18** | `Tether USD` | `legacy_evm` |
| Kaia (Klaytn) | `eip155:8217` | `0xd077a400968890eacc75cdc901f0356c943e4fdb` | 6 | `Tether USD` | `legacy_evm` |

> **Decimal trap**: BNB Chain and Celo USDT use 18 decimals; all other USDT deployments use 6. A facilitator implementation that hardcodes 6 will silently undercharge by 10^12. Reference SDKs read decimals from the per-deployment registry.

### 2.5 Non-EVM USDT

| Token | Network | Asset Identifier | Scheme |
|---|---|---|---|
| USDT TRC-20 | TRON mainnet (`tron:mainnet`) | `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` | [`exact_tron`](./schemes/exact/scheme_exact_tron.md) |
| USDT TRC-20 (testnet) | TRON Nile (`tron:nile`) | `TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf` | `exact_tron` |
| USDT TRC-20 (testnet) | TRON Shasta (`tron:shasta`) | `TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs` | `exact_tron` |
| USDT (Jetton) | TON mainnet (`ton:mainnet`) | `EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs` | [`exact_ton`](./schemes/exact/scheme_exact_ton.md) |
| USDT (Jetton, testnet) | TON testnet | `kQAvDfWFG0XeYWq7UsA8wWZhjyl_ljOWyjVaqp9HBK7clRwO` | `exact_ton` |

Non-EVM deployments do NOT use EIP-3009 or EIP-712. The `exact_tron` scheme uses off-chain TRC-20 transaction signing forwarded by the facilitator; `exact_ton` uses Jetton transfer messages via TonConnect or raw BOC submission. See those scheme documents for full wire format.

## 3. Special Cases

### 3.1 Ethereum Mainnet USDT0 (OFT Adapter)

USDT0 at `0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee` on Ethereum mainnet is a **LayerZero OFT bridge adapter**, not a standard ERC-20 token contract. It exposes the OFT message-passing surface but **reverts on `name()`, `symbol()`, `decimals()`, and `balanceOf()`**. A naive integrator that calls `getERC20Metadata()` on this address will receive a reverted call.

For Ethereum mainnet USDT0 payments, integrators MUST EITHER:

1. **Use `permit2-proxy` scheme** — Uniswap Permit2 + witness binding works on the underlying ERC-20 the OFT adapter wraps. See [`scheme_permit2_proxy_evm.md`](./schemes/permit2-proxy/scheme_permit2_proxy_evm.md).
2. **Route to Legacy USDT (`0xdAC17F...`) on Ethereum mainnet** using `legacy_evm`. This is the recommended fallback for Ethereum mainnet because the legacy USDT contract is the more liquid pair.

The reference SDK's `TOKEN_REGISTRY["eip155:1"].USDT0` entry exists for completeness but the priority field is set so that `getDefaultToken("eip155:1")` returns USDT (legacy) when not constrained.

### 3.2 USDT on TRON — Off-chain signature forwarding

USDT TRC-20 has no EIP-3009 equivalent. The `exact_tron` scheme implements equivalent gasless flow by having the client sign the TRC-20 transfer transaction off-chain and submit the signed bytes to the facilitator, which broadcasts it on behalf of the client. The facilitator pays the energy/bandwidth cost.

This pattern is t402-pioneered and is the only documented x402-style facilitator-mediated TRC-20 settlement. See `scheme_exact_tron.md` Section 4 for full wire format.

### 3.3 USAT — No EIP-3009, permit-only

USAT supports EIP-2612 `permit` but NOT EIP-3009 `transferWithAuthorization`. A client cannot directly sign a single-step transfer authorization. Two settlement paths exist:

1. **Gasless** — client signs an EIP-2612 permit; facilitator submits `permit()` followed by `transferFrom()` on the token contract. This is the `legacy_evm` scheme combined with the `eip2612GasSponsoring` extension.
2. **Self-paid** — client submits an `approve` + `transferFrom` on chain themselves before invoking the t402 endpoint. This is rarely used because it loses the gasless property t402 emphasizes.

USAT is currently mainnet-only. Its primary value for t402 is **US-regulated rail** for merchants who specifically require Anchorage-issued regulated stablecoin custody. T402 does NOT recommend USAT as a default token; integrators SHOULD prefer USDC or USDT0 on Ethereum mainnet unless their compliance posture requires a federally-regulated issuer.

### 3.4 Legacy USDT — Approval-based flow

Legacy USDT on Ethereum, BNB Chain, Avalanche, Fantom, Celo, Kaia, and Polygon predates the EIP-3009 standard. Settlement requires:

1. Client signs (and either submits or forwards via `erc20ApprovalGasSponsoring`) an `approve(facilitator, amount)` transaction.
2. Client returns the approval transaction hash + signed t402 payload to the server.
3. Facilitator verifies the approval is mined and executes `transferFrom(client, recipient, amount)`.

This is a two-transaction flow on-chain. The `erc20ApprovalGasSponsoring` extension allows the facilitator to fund the client's approval gas, making the user-facing flow comparable to gasless.

### 3.5 Decimal handling

Three deployments use 18 decimals where 6 is otherwise standard:

- BNB Chain USDT (`eip155:56`)
- Celo USDT (`eip155:42220`)
- Any future high-decimal Tether issuance

All amount fields in t402 wire format are encoded as **base units** (smallest integer representation of the token). Implementations MUST query the per-deployment decimals from the registry before converting display amounts to wire amounts. Hardcoding 6 decimals in any production codepath is incorrect.

### 3.6 USDT0 cross-chain consideration

USDT0 is LayerZero OFT. The t402 protocol settles USDT0 on a single network per payment. Cross-network USDT0 movement (e.g. Ethereum-USDT0 → Arbitrum-USDT0) is out of scope for the core schemes; it is a wallet-level concern handled by `@t402/wdk-bridge` and is documented separately. T402 facilitators MUST NOT initiate USDT0 OFT cross-chain transfers as part of settlement.

### 3.7 USDT on TON — Jetton-specific routing

USDT on TON is a Jetton (TON's token standard), distinct from EVM ERC-20. The `exact_ton` scheme handles Jetton transfer messages, BOC encoding, and TonConnect wallet integration. The TRON facilitator-forwarding pattern does NOT apply on TON; TON wallets sign and broadcast their own messages.

## 4. SDK Coverage Matrix

This matrix exposes cross-SDK gaps for transparent integrator planning. ✅ = full implementation, 🟡 = partial / address registry only, ❌ = not present.

| Token | TS `evm-core` | TS `mechanisms/evm` | Go SDK | Python SDK | Java SDK | Facilitator |
|---|---|---|---|---|---|---|
| USDT0 (19 EVM networks) | 🟡 (5 networks) | ✅ (19 networks) | ✅ | ✅ | ✅ | ✅ |
| USDC (6 networks) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **USAT** (1 network) | ❌ | ✅ | **❌** | **❌** | ✅ | unknown |
| Legacy USDT (7 networks) | 🟡 (2 networks) | ✅ (7 networks) | ✅ | ✅ | ✅ | ✅ |
| USDT TRC-20 | n/a | n/a | ✅ (tron pkg) | ✅ | ✅ | ✅ |
| USDT TON Jetton | n/a | n/a | ✅ (ton pkg) | ✅ | ✅ | ✅ |

**Known gaps**:

- `@t402/wdk-evm-core` lists only the 5 USDT0 deployments shared with `evm` (Ethereum, Arbitrum, Ink, Berachain, Unichain). Networks added in Phase 1 (Polygon, Optimism, Mantle, Plasma, Sei, Conflux, Monad) and Phase 2 (Rootstock, XLayer, Flare, Corn, HyperEVM, MegaETH, Stable) live only in `mechanisms/evm`. This SHOULD be reconciled.
- **USAT is missing from Go and Python SDKs.** Java SDK has the address constant. TS has it only in `mechanisms/evm/src/tokens.ts`, not in the shared `evm-core/src/tokens.ts`. This SHOULD be reconciled before claiming cross-SDK USAT parity.
- BNB / Avalanche / Fantom / Celo / Kaia Legacy USDT addresses are absent from `@t402/wdk-evm-core` shared registry; only Ethereum and Polygon legacy USDT are shared.

Integrators using `@t402/wdk-evm-core` directly SHOULD load deployment-specific registries from the `mechanisms/evm` package or pass token configuration explicitly.

## 5. Scheme Selection Algorithm

For a given (network, token) request, t402 implementations SHOULD select the scheme as follows:

```
input:  caip2 (e.g. "eip155:42161"), tokenSymbol (e.g. "USDT0")
output: { scheme, extensions[] }

1. Look up TOKEN_REGISTRY[caip2][tokenSymbol]; if missing, return error
   "unsupported_token_network".

2. If tokenSymbol matches a non-EVM family (TON, TRON), return
   { scheme: family-specific exact, extensions: [] }.

3. If caip2 == "eip155:1" AND tokenSymbol == "USDT0":
     return { scheme: "permit2-proxy", extensions: [] }     # §3.1

4. If config.tokenType == "eip3009":
     return { scheme: "exact_evm", extensions: [] }          # standard

5. If config.tokenType == "legacy":
     if config.supportsEip2612:
       return { scheme: "legacy_evm",
                extensions: ["eip2612GasSponsoring"] }       # §3.3
     else:
       return { scheme: "legacy_evm",
                extensions: ["erc20ApprovalGasSponsoring"] } # §3.4
```

Reference implementations: `getTokenConfig()` / `getTransferMethod()` in `sdks/typescript/packages/mechanisms/evm-core/src/tokens.ts:312` and `sdks/typescript/packages/mechanisms/evm/src/tokens.ts:586`.

## 6. Compatibility with x402 Schemes

For interop with x402-foundation reference clients, the table below maps t402 scheme routing to the x402 scheme name a roundtripped wire message would carry. T402's `permit2-proxy` is an x402-compatible scheme; `exact_evm` matches x402's `exact`. `legacy_evm` does not have a direct x402 equivalent — x402 currently lacks a documented legacy USDT settlement scheme — and any wire format using `legacy_evm` SHOULD declare itself with `scheme: "exact"` and the `extra.allowLegacyApprove: true` field for x402 compatibility (see `@t402/core/src/http/x402Compat.ts`).

| t402 scheme | x402 wire `scheme` field | Notes |
|---|---|---|
| `exact_evm` (EIP-3009) | `"exact"` | Direct interop, ~95% wire compatibility (`x402Version` ↔ `t402Version` field shim) |
| `permit2-proxy` | `"exact"` (with `extra.proxy`) | t402-leading; x402 lacks a documented `permit2-proxy` scheme |
| `legacy_evm` | `"exact"` (with `extra.allowLegacyApprove`) | x402 has no published legacy scheme; t402's is upstream-PR candidate |
| `exact_tron` | `"exact"` (TRON) | x402 PR #2076 is open since 2026-01; t402's TRON scheme is the reference candidate |
| `exact_ton` | `"exact"` (TON) | x402 merged TON spec PR #1455; t402's TS+Go+Java+Python impls are ahead of x402's TS facilitator (PR #1583 open) |

## 7. Appendix

### 7.1 Related specifications

- [Scheme: `exact_evm`](./schemes/exact/scheme_exact_evm.md)
- [Scheme: `exact_tron`](./schemes/exact/scheme_exact_tron.md)
- [Scheme: `exact_ton`](./schemes/exact/scheme_exact_ton.md)
- [Scheme: `legacy_evm`](./schemes/legacy/scheme_legacy_evm.md)
- [Scheme: `permit2-proxy`](./schemes/permit2-proxy/scheme_permit2_proxy_evm.md)
- [Extension: `eip2612GasSponsoring`](./extensions/eip2612-gas-sponsoring.md)
- [Extension: `erc20ApprovalGasSponsoring`](./extensions/erc20-approval-gas-sponsoring.md)

### 7.2 Authoritative sources

- USDT0 deployments: <https://docs.tether.io/usdt0/integration-guide/deployed-contracts>
- USAT issuance: Tether press release (2026-01)
- USDC deployments: <https://www.circle.com/multi-chain-usdc>
- T402 reference SDK token registry: `sdks/typescript/packages/mechanisms/evm/src/tokens.ts`

### 7.3 Changelog

| Date | Version | Change |
|---|---|---|
| 2026-05-28 | 1 | Initial draft. Documents all (token, network, scheme) routing tuples present in reference SDKs as of 2026-05-28. |
