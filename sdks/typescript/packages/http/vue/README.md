# @t402/vue

Vue components and composables for the t402 Payment Protocol. Build payment-aware UIs with pre-built components and reactive composables.

## Installation

```bash
npm install @t402/vue
```

## Quick Start

```vue
<script setup lang="ts">
import { PaymentButton, usePaymentRequired } from '@t402/vue'

const { paymentRequired, requirements, pay, status } = usePaymentRequired('/api/data')
</script>

<template>
  <div v-if="paymentRequired">
    <PaymentButton :requirements="requirements" :status="status" @pay="pay" />
  </div>
  <div v-else>Premium content loaded!</div>
</template>
```

## Components

### PaymentButton

Renders a payment action button with loading and status states.

```vue
<PaymentButton :requirements="requirements" :status="status" @pay="handlePay" />
```

### PaymentDetails

Displays payment requirements (amount, network, recipient).

```vue
<PaymentDetails :requirements="requirements" />
```

### PaymentStatusDisplay

Shows the current payment status with appropriate UI feedback.

```vue
<PaymentStatusDisplay :status="status" />
```

### AddressDisplay

Renders a blockchain address with truncation and copy functionality.

```vue
<AddressDisplay address="0x1234...5678" />
```

## Composables

### usePaymentRequired

Detects 402 responses and extracts payment requirements.

```typescript
const {
  paymentRequired, // Ref<boolean>
  requirements, // Ref<PaymentRequirements[]>
  pay, // () => Promise<void>
  status, // Ref<PaymentStatus>
} = usePaymentRequired(url, options)
```

### usePaymentStatus

Tracks the lifecycle of a payment (idle, pending, confirming, complete, error).

```typescript
const { status, error, reset } = usePaymentStatus()
```

### useAsyncPayment

Manages async payment flows with automatic retry and status tracking.

```typescript
const { execute, status, error } = useAsyncPayment(paymentFn)
```

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
} from '@t402/vue'

// Network detection
isEvmNetwork('eip155:8453') // true

// Display helpers
getNetworkDisplayName('eip155:8453') // "Base"
truncateAddress('0x1234567890abcdef') // "0x1234...cdef"
formatTokenAmount(1500000n, 6) // "1.50"
```

## Peer Dependencies

- `vue` ^3.3.0

## Development

```bash
pnpm build    # Build the package
pnpm test     # Run unit tests
```

## Related Packages

- `@t402/core` - Core protocol types
- `@t402/react` - React components & hooks
- `@t402/paywall` - Universal paywall UI
- `@t402/fetch` - Fetch wrapper with automatic payment
