# Paywall Templates (Python SDK)

This directory contains 7 CDN-mode paywall HTML templates (one per chain family).
Each is ~4KB — a minimal HTML shell that loads the t402 paywall UI assets from
the t402 CDN at runtime.

## Files

- `evm_paywall_template.py` — EIP-155 chains (Ethereum, Base, Arbitrum, etc.)
- `svm_paywall_template.py` — Solana
- `ton_paywall_template.py` — TON
- `tron_paywall_template.py` — TRON
- `stacks_paywall_template.py` — Stacks
- `cosmos_paywall_template.py` — Cosmos (Noble USDT)
- `near_paywall_template.py` — NEAR

## Architecture

Each template is a self-contained Python module exporting a single string
constant (e.g. `EVM_PAYWALL_TEMPLATE`). The string is an HTML document with a
`<head>` block ready for `paywall.py`'s `inject_payment_data()` to insert
`window.t402` config.

Templates are selected by CAIP-2 network prefix in `paywall.py`'s
`get_paywall_template()`:

| Network prefix | Template |
|---|---|
| `solana:` | SVM |
| `ton:` | TON |
| `tron:` | TRON |
| `stacks:` | STACKS |
| `cosmos:` | COSMOS |
| `near:` | NEAR |
| (else, e.g. `eip155:`) | EVM |

## Removed: inline mode (v3.0)

In versions < 3.0, the Python SDK also shipped 7 "inline" template variants
(`*_paywall_template_inline.py`) embedding full HTML+JS+CSS in each file
(5.3MB total). This was a poor UX (each 402 response would send 1-2.7MB),
incompatible with CDN caching, and never used in production.

The inline templates were removed in 3.0. `delivery_mode="inline"` arguments
to `get_paywall_template()` are silently treated as `"cdn"` for API compat.

## Regenerating templates

The 7 templates are generated from a single source in the TypeScript paywall
package (`sdks/typescript/packages/http/paywall/`). To update:

1. Build the TS paywall package: `cd sdks/typescript && pnpm --filter "@t402/paywall" build`
2. Run the export script (TODO: codify in `scripts/export-paywall-to-python.ts`)
3. Verify generated `*_paywall_template.py` files compile + tests pass

Do not edit these `.py` files by hand — changes will be lost next regeneration.

## Cross-SDK consistency

The TypeScript, Go, Python, Java SDKs all consume from the same TS source via
generation scripts. The 7 chain-family split exists because each chain has
slightly different wallet-connect logic (e.g. EVM uses ethers/viem, Solana uses
@solana/wallet-adapter, TON uses TonConnect SDK).
