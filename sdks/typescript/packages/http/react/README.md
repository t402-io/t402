# @t402/react

React components and hooks for the t402 Payment Protocol. Build payment-aware UIs with pre-built components and reactive hooks.

## Installation

```bash
npm install @t402/react
```

## Quick Start

```tsx
import { PaymentProvider, PaymentButton, usePaymentRequired } from "@t402/react";

function App() {
  return (
    <PaymentProvider>
      <ProtectedContent />
    </PaymentProvider>
  );
}

function ProtectedContent() {
  const { paymentRequired, requirements, pay, status } = usePaymentRequired("/api/data");

  if (paymentRequired) {
    return <PaymentButton requirements={requirements} onPay={pay} status={status} />;
  }

  return <div>Premium content loaded!</div>;
}
```

## Components

### PaymentButton

Renders a payment action button with loading and status states.

```tsx
import { PaymentButton } from "@t402/react";

<PaymentButton
  requirements={requirements}
  onPay={handlePay}
  status={status}
/>
```

### PaymentDetails

Displays payment requirements (amount, network, recipient).

```tsx
import { PaymentDetails } from "@t402/react";

<PaymentDetails requirements={requirements} />
```

### PaymentStatusDisplay

Shows the current payment status with appropriate UI feedback.

```tsx
import { PaymentStatusDisplay } from "@t402/react";

<PaymentStatusDisplay status={status} />
```

### AddressDisplay

Renders a blockchain address with truncation and copy functionality.

```tsx
import { AddressDisplay } from "@t402/react";

<AddressDisplay address="0x1234...5678" />
```

## Hooks

### usePaymentRequired

Detects 402 responses and extracts payment requirements.

```tsx
const {
  paymentRequired,  // boolean - whether payment is needed
  requirements,     // PaymentRequirements[] from 402 response
  pay,             // () => Promise<void> - trigger payment
  status,          // PaymentStatus - current state
} = usePaymentRequired(url, options);
```

### usePaymentStatus

Tracks the lifecycle of a payment (idle, pending, confirming, complete, error).

```tsx
const { status, error, reset } = usePaymentStatus();
```

### useAsyncPayment

Manages async payment flows with automatic retry and status tracking.

```tsx
const { execute, status, error } = useAsyncPayment(paymentFn);
```

## Provider

### PaymentProvider

Wraps your app to provide payment context to all child components.

```tsx
import { PaymentProvider } from "@t402/react";

<PaymentProvider>
  <App />
</PaymentProvider>
```

Access context directly with `usePaymentContext()`.

## Utilities

```typescript
import {
  isEvmNetwork,
  isSvmNetwork,
  isTonNetwork,
  getNetworkDisplayName,
  truncateAddress,
  formatTokenAmount,
  choosePaymentRequirement,
} from "@t402/react";

// Network detection
isEvmNetwork("eip155:8453"); // true

// Display helpers
getNetworkDisplayName("eip155:8453"); // "Base"
truncateAddress("0x1234567890abcdef"); // "0x1234...cdef"
formatTokenAmount(1500000n, 6); // "1.50"
```

## Peer Dependencies

- `react` ^18.0.0 || ^19.0.0
- `react-dom` ^18.0.0 || ^19.0.0

## Development

```bash
pnpm build    # Build the package
pnpm test     # Run unit tests
```

## Related Packages

- `@t402/core` - Core protocol types
- `@t402/vue` - Vue components & composables
- `@t402/paywall` - Universal paywall UI
- `@t402/fetch` - Fetch wrapper with automatic payment
