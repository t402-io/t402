# @t402/paywall Development Plan

> Last Updated: 2026-01-20

## Overview

This document outlines the development plan for expanding the @t402/paywall package with new features and improvements.

---

## Phase 1: Core Improvements (1-2 weeks)

### P0: Multi-Network Selection UI

**Current State**: `PaywallApp.tsx` only renders the first `accepts` item.

**Goal**: Allow users to choose which network to pay with when multiple options are available.

**Implementation**:
- Create `NetworkSelector.tsx` component
- Show network options with icons, names, and amounts
- Update `PaywallApp.tsx` to handle network selection state

**Files to modify**:
- `src/PaywallApp.tsx`
- `src/paywallUtils.ts` (add network icons)
- New: `src/components/NetworkSelector.tsx`

### P0: Dark Mode Support

**Current State**: Only light theme with hardcoded CSS.

**Goal**: Support light/dark/auto themes via CSS variables.

**Implementation**:
- Add dark mode CSS variables to `styles.css`
- Add `theme` option to `PaywallConfig`
- Apply theme class based on config or system preference

**Files to modify**:
- `src/styles.css`
- `src/types.ts`
- All `paywall.ts` files (inject theme config)

### P1: Progress Indicator

**Current State**: Simple string status messages.

**Goal**: Visual step-by-step progress indicator.

**Implementation**:
- Create `PaymentProgress.tsx` component
- Define payment state machine
- Show steps: Connect → Sign → Submit → Confirm

**Files to modify**:
- New: `src/components/PaymentProgress.tsx`
- All `*Paywall.tsx` components

### P1: Accessibility (a11y) Improvements

**Current State**: Missing ARIA labels, limited keyboard navigation.

**Goal**: WCAG 2.1 AA compliance.

**Implementation**:
- Add ARIA labels to buttons and interactive elements
- Implement keyboard navigation for wallet selection
- Add `role="status"` for live status updates
- Add focus management

**Files to modify**:
- All `*Paywall.tsx` components
- `src/styles.css` (focus styles)

---

## Phase 2: User Experience Enhancement (2-3 weeks)

### P1: Brand Customization System

**Goal**: Allow merchants to customize colors, logo, and styling.

**Implementation**:
```typescript
interface PaywallConfig {
  theme?: {
    mode: 'light' | 'dark' | 'auto';
    colors?: {
      primary?: string;
      background?: string;
      text?: string;
      border?: string;
    };
    borderRadius?: string;
    fontFamily?: string;
  };
}
```

**Files to modify**:
- `src/types.ts`
- `src/styles.css`
- All `paywall.ts` files

### P2: Mobile Optimization

**Goal**: Improve mobile wallet connection experience.

**Implementation**:
- Add responsive CSS breakpoints
- Implement WalletConnect deep linking for EVM
- Detect mobile environment and show appropriate wallet options
- Optimize touch targets (min 44x44px)

**Files to modify**:
- `src/styles.css`
- `src/evm/EvmPaywall.tsx`
- `src/Providers.tsx`

### P2: QR Code Payment Flow

**Goal**: Allow desktop users to scan QR with mobile wallet.

**Implementation**:
- Generate payment URI for QR code
- Create `PaymentQRCode.tsx` component
- Implement payment status polling/websocket

**Files to create**:
- `src/components/PaymentQRCode.tsx`

---

## Phase 3: New Network Support (3-4 weeks)

### P1: Stacks (Bitcoin L2)

**CAIP-2**: `stacks:1` (mainnet), `stacks:2147483648` (testnet)

**Wallet**: Leather, Xverse via @stacks/connect

**Implementation**:
- Create `src/stacks/` directory following existing patterns
- Implement `StacksPaywall.tsx`
- Add Stacks USDC contract addresses

### P2: Cosmos/Noble (USDC Native)

**CAIP-2**: `cosmos:noble-1`

**Wallet**: Keplr, Leap via @cosmos-kit

**Implementation**:
- Create `src/cosmos/` directory
- Implement `CosmosPaywall.tsx`
- Support Noble USDC transfers

### P2: Near Protocol

**CAIP-2**: `near:mainnet`

**Wallet**: NEAR Wallet Selector

**Implementation**:
- Create `src/near/` directory
- Implement `NearPaywall.tsx`
- Support Circle USDC on Near

### P3: Lightning Network

**CAIP-2**: `bip122:lightning`

**Complexity**: High (requires invoice generation, BOLT11)

**Implementation**: TBD - requires backend invoice generation

---

## Phase 4: Advanced Features (4+ weeks)

### P2: Transaction Status Tracking

**Goal**: Real-time transaction confirmation status.

**Implementation**:
- Create structured payment state machine
- Poll for transaction confirmation
- Show block confirmations for on-chain payments

### P2: Bundle Size Optimization

**Current sizes**:
- EVM: 3.4 MB (mainly viem/chains)
- SVM: 1.0 MB
- TON: 1.7 MB
- TRON: 0.9 MB

**Goal**: Reduce by 50%+

**Implementation**:
- Dynamic chain imports
- Use lighter RPC clients
- Better tree-shaking configuration

### P3: Go SDK Template Integration

**Goal**: Use pre-built React paywall templates in Go HTTP middleware.

**Implementation**:
- Update `go/http/server.go` to use generated templates
- Add template injection similar to TypeScript

---

## Implementation Checklist

### Phase 1 (Complete)
- [x] Multi-network selection UI
- [x] Dark mode support
- [x] Progress indicator
- [x] Basic a11y improvements

### Phase 2 (Complete)
- [x] Brand customization system
- [x] Mobile optimization (WalletConnect, mobile detection)
- [x] QR code payment flow

### Phase 3
- [x] Stacks paywall (Leather/Xverse wallet support)
- [ ] Cosmos/Noble paywall
- [ ] Near paywall

### Phase 4
- [ ] Transaction tracking
- [ ] Bundle optimization
- [ ] Go SDK integration

---

## Technical Notes

### CSS Variables Structure

```css
:root {
  /* Light theme (default) */
  --t402-bg: #f9fafb;
  --t402-bg-container: #ffffff;
  --t402-text: #111827;
  --t402-text-secondary: #6b7280;
  --t402-primary: #2563eb;
  --t402-primary-hover: #1d4ed8;
  --t402-border: #e5e7eb;
  --t402-radius: 0.75rem;
}

.dark {
  --t402-bg: #111827;
  --t402-bg-container: #1f2937;
  --t402-text: #f9fafb;
  --t402-text-secondary: #9ca3af;
  --t402-primary: #3b82f6;
  --t402-primary-hover: #2563eb;
  --t402-border: #374151;
}
```

### Network Icons

Use inline SVG for network icons to avoid external dependencies:
- Ethereum: Blue diamond
- Solana: Purple gradient
- TON: Blue diamond
- TRON: Red circle
- Base: Blue circle
- Arbitrum: Blue/orange

### Payment State Machine

```typescript
type PaymentState =
  | { step: 'idle' }
  | { step: 'connecting' }
  | { step: 'connected'; address: string }
  | { step: 'signing' }
  | { step: 'submitting' }
  | { step: 'pending'; txHash?: string }
  | { step: 'confirmed'; txHash: string }
  | { step: 'error'; message: string };
```

---

## References

- [CAIP-2 Chain ID Specification](https://github.com/ChainAgnostic/CAIPs/blob/master/CAIPs/caip-2.md)
- [WalletConnect v2 Docs](https://docs.walletconnect.com/2.0)
- [Wallet Standard](https://github.com/wallet-standard/wallet-standard)
- [TonConnect Protocol](https://docs.ton.org/develop/dapps/ton-connect/overview)
