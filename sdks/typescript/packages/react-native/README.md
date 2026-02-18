# @t402/react-native

React Native SDK for [t402](https://t402.io) — the HTTP-native payment protocol for USDT/USDT0 stablecoins.

Provides a context provider, payment hooks, and a ready-made PaymentSheet component for integrating t402 payments into React Native apps.

## Installation

```bash
npm install @t402/react-native @t402/core
# or
yarn add @t402/react-native @t402/core
```

### Peer Dependencies

- `react >= 18.0.0`
- `react-native >= 0.72.0`

## Quick Start

### 1. Wrap your app with T402Provider

```tsx
import { T402Provider } from '@t402/react-native';

function App() {
  return (
    <T402Provider
      config={{
        facilitatorUrl: 'https://facilitator.t402.io',
        networks: ['eip155:42161', 'ton:mainnet'],
        signer: yourSignerInstance, // or use wdkSeedPhrase
      }}
    >
      <MyApp />
    </T402Provider>
  );
}
```

### 2. Use the payment hook

```tsx
import { useT402Payment } from '@t402/react-native';
import { View, Text, TouchableOpacity } from 'react-native';

function PremiumContent() {
  const { state, pay, reset } = useT402Payment();

  const handlePurchase = async () => {
    const result = await pay({
      url: 'https://api.example.com/content/123',
      preferredNetwork: 'eip155:42161',
    });

    if (result.success) {
      const data = await result.response?.json();
      console.log('Content:', data);
    }
  };

  return (
    <View>
      <Text>Status: {state.status}</Text>
      {state.error && <Text>Error: {state.error.message}</Text>}
      <TouchableOpacity onPress={handlePurchase}>
        <Text>Purchase ($0.01)</Text>
      </TouchableOpacity>
    </View>
  );
}
```

### 3. Use the PaymentSheet component

```tsx
import { useState } from 'react';
import { PaymentSheet, useT402Payment } from '@t402/react-native';
import { Button } from 'react-native';

function ContentScreen() {
  const { state, pay, reset } = useT402Payment();
  const [showSheet, setShowSheet] = useState(false);

  return (
    <>
      <Button title="Buy Content" onPress={() => setShowSheet(true)} />
      <PaymentSheet
        visible={showSheet}
        onClose={() => { setShowSheet(false); reset(); }}
        paymentRequired={state.paymentRequired}
        selectedRequirement={state.paymentRequired?.accepts[0]}
        onPay={() => pay({ url: 'https://api.example.com/content' })}
        state={state}
      />
    </>
  );
}
```

## API Reference

### `T402Provider`

Context provider that initializes the t402 client for all child components.

| Prop | Type | Description |
|------|------|-------------|
| `config` | `T402ProviderConfig` | Configuration object |
| `children` | `ReactNode` | Child components |

### `T402ProviderConfig`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `facilitatorUrl` | `string` | Yes | URL of the t402 facilitator |
| `networks` | `string[]` | No | Supported CAIP-2 network IDs |
| `signer` | `unknown` | No | External signer instance |
| `wdkSeedPhrase` | `string` | No | WDK seed phrase for built-in wallet |
| `chains` | `Record<string, string>` | No | Chain RPC endpoints |

### `useT402Payment()`

Hook for the full payment flow. Returns:

| Field | Type | Description |
|-------|------|-------------|
| `state` | `PaymentState` | Current payment state |
| `pay` | `(options: PaymentOptions) => Promise<PaymentResult>` | Initiate payment |
| `reset` | `() => void` | Reset to idle state |

### `PaymentSheet`

Bottom-sheet modal component for displaying payment details.

| Prop | Type | Description |
|------|------|-------------|
| `visible` | `boolean` | Sheet visibility |
| `onClose` | `() => void` | Close callback |
| `paymentRequired` | `PaymentRequired` | 402 response data |
| `selectedRequirement` | `PaymentRequirements` | Selected payment option |
| `onPay` | `() => Promise<void>` | Pay callback |
| `state` | `PaymentState` | Current payment state |
| `style` | `object` | Custom styles |

### `PaymentState`

| Field | Type | Description |
|-------|------|-------------|
| `status` | `PaymentStatus` | `'idle' \| 'loading' \| 'awaiting_payment' \| 'signing' \| 'verifying' \| 'success' \| 'error'` |
| `error` | `Error` | Error details (when status is `'error'`) |
| `txHash` | `string` | Transaction hash (when status is `'success'`) |
| `paymentRequired` | `PaymentRequired` | The 402 response from the server |

## Supported Networks

Any CAIP-2 network supported by the t402 facilitator:

- **EVM**: `eip155:42161` (Arbitrum), `eip155:8453` (Base), `eip155:1` (Ethereum), etc.
- **TON**: `ton:mainnet`, `ton:testnet`
- **Solana**: `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`
- **TRON**: `tron:mainnet`

## License

Apache-2.0
