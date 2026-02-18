# @t402/paywall Audit Report

**Date**: 2026-02-18
**Scope**: Issues #129 (Standalone Paywall UI) and #151 (Dynamic Wallet List Sync)

---

## 1. Network Paywall Feature Matrix

All 7 network paywalls share a consistent architecture:

| Feature | EVM | SVM | TON | TRON | Stacks | Cosmos | NEAR |
|---------|-----|-----|-----|------|--------|--------|------|
| Wallet connection | Wagmi connectors | Wallet Standard | TonConnect UI | TronLink | Leather/Xverse | Keplr/Leap | MyNearWallet/Meteor |
| Wallet selection UI | Dropdown (connectors) | Dropdown (standard) | Modal (TonConnect) | Auto-detect | Multi-button | Multi-button | Multi-button |
| Balance display | USDC (hide/show) | USDC (hide/show) | USDT (hide/show) | USDT (hide/show) | sUSDC (hide/show) | USDC (hide/show) | USDC (hide/show) |
| Payment progress | 4-step indicator | 4-step indicator | 4-step indicator | 4-step indicator | 4-step indicator | 4-step indicator | 4-step indicator |
| Chain switching | Auto switch chain | N/A (single chain) | N/A | N/A | N/A | N/A | N/A |
| Testnet faucet link | Circle faucet | Circle faucet | Telegram bot | TronGrid faucet | Hiro explorer | Generic text | NEAR faucet |
| Disconnect flow | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Error handling | Status bar | Status bar | Status bar | Status bar | Status bar | Status bar | Status bar |
| Loading states | Spinner on Pay | Spinner on Pay | Spinner on Pay | Spinner on Pay | Spinner on Pay | Spinner on Pay | Spinner on Pay |
| Wallet install prompt | N/A (browser) | Yes | N/A (modal) | N/A (auto) | Yes (Leather/Xverse) | Yes (Keplr/Leap) | Yes (MyNearWallet/Meteor) |
| Silent connection | No | Yes | No | No | No | No | No |

### Key Findings

**Consistent across all networks:**
- Shared `PaymentProgress` component with 4 steps: Connect -> Sign -> Submit -> Confirm
- Shared `Spinner` component for loading states
- Shared `styles.css` with light/dark theme, responsive design, and reduced-motion support
- Shared `paywallUtils.ts` for network detection, display names, and icons
- All use `window.t402` config pattern for server-to-client data passing
- All handle `onSuccessfulResponse` with HTML replacement or blob download

**Network-specific differences (by design):**
- EVM has chain switching logic (required for multi-chain EVM)
- SVM has silent wallet connection and wallet standard event handling
- TON uses TonConnect UI modal (handles wallet list internally)
- Stacks has per-wallet connect buttons rather than dropdown
- Cosmos and NEAR have wallet detection with install prompts

## 2. Shared Components Audit

### PaymentProgress (`src/components/PaymentProgress.tsx`)
- 4-step progress indicator: Connect, Sign, Submit, Confirm
- ARIA `progressbar` role with `aria-valuenow/min/max`
- Visual states: completed (green check), current (blue/processing spinner/error red), pending (gray)
- Has `usePaymentProgress` helper hook
- **Status: Complete**

### TransactionStatus (`src/components/TransactionStatus.tsx`)
- Displays tx hash (truncated), copy button, explorer link
- Block explorer support for all 7 networks
- Confirmation progress bar with polling
- ARIA `status` role with `aria-live="polite"`
- `useTransactionStatus` hook for state management
- **Status: Complete**

### PaymentQRCode (`src/components/PaymentQRCode.tsx`)
- Pure JS QR code generator (no external deps), supports versions 1-6
- Canvas rendering with device pixel ratio support
- Payment URI generators for ethereum, solana, ton, tron
- Copy-to-clipboard with fallback
- **Status: Complete**

### NetworkSelector (`src/components/NetworkSelector.tsx`)
- Multi-network payment option display
- Per-network SVG icons and amount formatting
- ARIA `listbox` and `option` roles
- Keyboard navigable buttons
- **Status: Complete**

## 3. Customization & Theming

### Theme System (`src/themeUtils.ts` + `src/types.ts`)
- **Color mode**: `light`, `dark`, `auto` (follows `prefers-color-scheme`)
- **Custom colors**: `primary`, `background`, `containerBackground`, `text`, `secondaryText`, `border`
- **Custom border radius** and **font family**
- Applied via CSS custom properties at runtime
- **Status: Complete**

### CSS Design (`src/styles.css`)
- CSS custom properties for all colors (835 lines)
- Light and dark theme variables
- Responsive breakpoint at 640px
- `prefers-reduced-motion` media query
- Min touch target 44px for buttons
- Focus-visible outlines for keyboard navigation
- **Status: Complete**

## 4. Accessibility

| Feature | Status |
|---------|--------|
| ARIA roles (progressbar, status, listbox, option) | Present |
| `aria-label` on buttons and interactive elements | Present |
| `aria-live="polite"` on status regions | Present |
| `aria-hidden="true"` on decorative SVGs | Present |
| `aria-valuenow/min/max` on progress indicators | Present |
| Keyboard navigation (focus-visible) | Present |
| Min touch target (44px) | Present |
| Reduced motion media query | Present |
| Color contrast (CSS variables configurable) | Configurable |

**Status: Comprehensive accessibility support is in place.**

## 5. Vue / React Feature Parity

### @t402/react
| Feature | Status |
|---------|--------|
| `usePaymentRequired` hook | Yes |
| `usePaymentStatus` hook | Yes |
| `useAsyncPayment` hook | Yes |
| `useGaslessPayment` hook | Yes |
| `useBridgePayment` hook | Yes |
| `useMultiSigPayment` hook | Yes |
| `PaymentProvider` context | Yes |
| `PaymentButton` component | Yes |
| `PaymentStatus` display | Yes |
| `PaymentDetails` component | Yes |
| `AddressDisplay` component | Yes |
| `Spinner` component | Yes |
| Utility functions | Yes |

### @t402/vue
| Feature | Status |
|---------|--------|
| `usePaymentRequired` composable | Yes |
| `usePaymentStatus` composable | Yes |
| `useAsyncPayment` composable | Yes |
| `useGaslessPayment` composable | Yes |
| `useBridgePayment` composable | Yes |
| `useMultiSigPayment` composable | Yes |
| `PaymentButton` component | Yes |
| `PaymentStatusDisplay` component | Yes |
| `PaymentDetails` component | Yes |
| `AddressDisplay` component | Yes |
| `Spinner` component | Yes |
| Utility functions | Yes |

### Differences
- React has `PaymentProvider` context; Vue does not (composables are self-contained via Vue's reactivity, so a provider is not needed)
- Both have identical test coverage patterns

**Status: Feature parity achieved (architectural differences are idiomatic).**

## 6. Delivery Modes

| Mode | Size | Use Case |
|------|------|----------|
| `cdn` (default) | ~500B HTML shell | Production: loads JS/CSS from jsDelivr CDN |
| `inline` | ~2.7MB | Offline/restricted environments: all assets embedded |

Both modes are supported across all 7 networks. Browser bundles are generated per-network at `dist/browser/{network}.min.js`.

## 7. Changes Made

### Issue #151: Dynamic Wallet List Sync

**New file: `src/ton/wallets.ts`** (~250 lines)
- `TonWalletInfo` interface with name, appName, imageUrl, aboutUrl, platforms, bridges, universalUrl, deepLink
- `BUNDLED_WALLETS` constant: 12 wallets (Tonkeeper, MyTonWallet, Telegram Wallet, Tonhub, Bitget, OKX, Binance, HOT, Bybit, DeWallet, SafePal, OpenMask)
- `fetchTonWallets(cacheTTL?)`: Fetches from `ton-blockchain/wallets-list` with 1-hour cache, falls back to bundled
- `getBundledWallets()`: Synchronous access to bundled list
- `filterWalletsByPlatform()`: Filter by ios/android/desktop/browser
- `generateWalletDeepLink()`: Generate deep link or universal link for wallet connection
- `parseWalletsList()`: Parse upstream wallets-v2.json format
- `detectPlatform()`: UA-based platform detection
- `resetWalletsCache()`: Cache invalidation (testing)

**New file: `src/ton/wallets.test.ts`** (~230 lines, 19 tests)
- `getBundledWallets`: non-empty, includes Tonkeeper, all required fields
- `fetchTonWallets`: cache hit, fallback on error, fallback on non-ok, TTL expiry
- `filterWalletsByPlatform`: ios, android, browser, desktop filtering
- `generateWalletDeepLink`: deep link, universal URL, query params, null case
- `parseWalletsList`: valid entries, skip invalid, non-array fallback, all-invalid fallback

**Modified: `src/ton/paywall.ts`**
- Added `tonWallets` option to `TonPaywallOptions`
- Embeds wallet list into `window.t402.tonWallets` at HTML generation time
- Falls back to `getBundledWallets()` when no list provided

**Modified: `src/ton/index.ts`**
- Re-exports wallet utilities (`fetchTonWallets`, `getBundledWallets`, `filterWalletsByPlatform`, `generateWalletDeepLink`, `resetWalletsCache`)
- Re-exports wallet types (`TonWalletInfo`, `TonWalletPlatform`, `TonWalletBridge`)

**Modified: `src/window.d.ts`**
- Added `tonWallets?: TonWalletInfo[]` to global `Window.t402` type

### Issue #129: Audit Summary

No code changes required for this issue. The audit confirms:
1. All 7 networks have consistent feature sets with appropriate network-specific adaptations
2. Vue and React packages have feature parity
3. Theming (colors, dark mode, fonts, border radius) is fully customizable
4. Accessibility is comprehensive (ARIA, keyboard, reduced motion)
5. Responsive design with mobile breakpoint
6. Shared components (PaymentProgress, TransactionStatus, PaymentQRCode, NetworkSelector) are complete
7. Both CDN and inline delivery modes work across all networks

## 8. Test Results

```
 PASS  src/paywallUtils.test.ts (17 tests)
 PASS  src/ton/wallets.test.ts (19 tests)
 PASS  src/components/PaymentQRCode.test.tsx (9 tests)
 PASS  src/network-handlers.test.ts (6 tests)
 PASS  src/builder.test.ts (16 tests)
 PASS  src/components/NetworkSelector.test.tsx (7 tests)
 PASS  src/components/PaymentProgress.test.tsx (12 tests)
 PASS  src/network-paywall.test.ts (12 tests)
 PASS  src/components/TransactionStatus.test.tsx (15 tests)
 PASS  src/index.test.ts (6 tests)

Test Files  10 passed (10)
     Tests  119 passed (119)
```

## 9. Server-Side Usage Example

```typescript
import { createPaywall, tonPaywall } from "@t402/paywall";
import { fetchTonWallets } from "@t402/paywall/ton";

// At server startup, pre-fetch the wallet list
const tonWallets = await fetchTonWallets();

// When generating paywall HTML
const paywall = createPaywall()
  .withNetwork(tonPaywall)
  .withConfig({ testnet: false })
  .build();

// The wallet list is automatically embedded via getBundledWallets()
// Or pass a dynamic list via the TON handler options
const html = paywall.generateHtml(paymentRequired);
```
