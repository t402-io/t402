# @t402/btc

Bitcoin & Lightning Network payment mechanism for the t402 protocol.

Supports:

- **BTC On-chain**: PSBT-based payments using the `exact` scheme
- **Lightning Network**: BOLT11 invoice payments with preimage verification

## Installation

```bash
npm install @t402/btc @t402/core
# or
pnpm add @t402/btc @t402/core
```

For PSBT construction with bitcoinjs-lib (optional):

```bash
npm install bitcoinjs-lib
```

## Networks

| Network           | CAIP-2 ID                                 |
| ----------------- | ----------------------------------------- |
| BTC Mainnet       | `bip122:000000000019d6689c085ae165831e93` |
| BTC Testnet       | `bip122:000000000933ea01ad0ee984209779ba` |
| Lightning Mainnet | `lightning:mainnet`                       |
| Lightning Testnet | `lightning:testnet`                       |

## Usage

### BTC On-chain Client

```typescript
import { registerExactBtcScheme } from '@t402/btc/exact/client'
import { t402Client } from '@t402/core/client'

const client = new t402Client()
registerExactBtcScheme(client, {
  signer: {
    signPsbt: async (psbt) => {
      /* sign PSBT */
    },
    getAddress: () => 'bc1q...',
    getPublicKey: () => '02...',
  },
})
```

### Lightning Client

```typescript
import { registerLightningScheme } from '@t402/btc/lightning/client'
import { t402Client } from '@t402/core/client'

const client = new t402Client()
registerLightningScheme(client, {
  signer: {
    payInvoice: async (bolt11) => {
      // Pay invoice via your Lightning node
      return { preimage: '...', paymentHash: '...' }
    },
    getNodePubKey: () => '02...',
  },
})
```

### Server (Resource Server)

```typescript
import { registerExactBtcScheme } from '@t402/btc/exact/server'
import { registerLightningScheme } from '@t402/btc/lightning/server'
import { t402ResourceServer } from '@t402/core/server'

const server = new t402ResourceServer(facilitatorClient)

// BTC on-chain
registerExactBtcScheme(server, {
  schemeConfig: { payTo: 'bc1q...' },
})

// Lightning
registerLightningScheme(server, {
  schemeConfig: {
    generateInvoice: async (amountSats, description, expiry) => {
      // Generate BOLT11 invoice via your Lightning node
      return { bolt11Invoice: 'lnbc...', paymentHash: '...' }
    },
  },
})
```

### Facilitator

```typescript
import { registerExactBtcScheme } from '@t402/btc/exact/facilitator'
import { registerLightningScheme } from '@t402/btc/lightning/facilitator'
import { t402Facilitator } from '@t402/core/facilitator'

const facilitator = new t402Facilitator()

// BTC on-chain
registerExactBtcScheme(facilitator, {
  signer: btcFacilitatorSigner,
  networks: 'bip122:000000000019d6689c085ae165831e93',
})

// Lightning
registerLightningScheme(facilitator, {
  signer: lnFacilitatorSigner,
  networks: 'lightning:mainnet',
})
```

## License

Apache-2.0
