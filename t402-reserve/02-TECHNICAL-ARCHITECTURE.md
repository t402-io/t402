# T402 Technical Architecture

> Detailed technical design for Tether-first payment protocol

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           T402 Protocol Stack                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        Application Layer                             │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │    │
│  │  │ Express  │ │  Hono    │ │ Next.js  │ │ FastAPI  │ │  Flask   │  │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         SDK Layer                                    │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │    │
│  │  │ @t402/core  │  │ @t402/evm   │  │ @t402/svm   │                  │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                  │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │    │
│  │  │ @t402/wdk   │  │@t402/paywall│  │@t402/extensions│               │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                       Protocol Layer                                 │    │
│  │  ┌───────────────────────────────────────────────────────────────┐  │    │
│  │  │                    Payment Schemes                             │  │    │
│  │  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │  │    │
│  │  │  │exact (EIP3009)│ │exact (legacy)│ │  exact (OFT) │           │  │    │
│  │  │  │ USDT0, USDC  │ │ USDT approve │ │ CrossChain   │           │  │    │
│  │  │  └──────────────┘ └──────────────┘ └──────────────┘           │  │    │
│  │  └───────────────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                       Signer Layer                                   │    │
│  │  ┌───────────────────────────────────────────────────────────────┐  │    │
│  │  │                  @t402/signer (Abstract)                       │  │    │
│  │  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │  │    │
│  │  │  │  WDK Signer  │ │ Viem Signer  │ │Ethers Signer │           │  │    │
│  │  │  │  (Default)   │ │ (Compatible) │ │ (Compatible) │           │  │    │
│  │  │  └──────────────┘ └──────────────┘ └──────────────┘           │  │    │
│  │  └───────────────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     Tether WDK Layer                                 │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │    │
│  │  │wallet-evm│ │wallet-btc│ │wallet-ton│ │wallet-trx│ │wallet-sol│  │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │    │
│  │  ┌────────────────────┐  ┌────────────────────┐                     │    │
│  │  │ bridge-usdt0-evm   │  │  swap-velora-evm   │                     │    │
│  │  └────────────────────┘  └────────────────────┘                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      Blockchain Layer                                │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │    │
│  │  │ Ethereum │ │ Arbitrum │ │   Base   │ │   TON    │ │  TRON    │  │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐               │    │
│  │  │   Ink    │ │Berachain │ │ MegaETH  │ │  Solana  │               │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. T402 Core (@t402/core)

The protocol-agnostic core providing:

- **T402Client**: Creates payment payloads
- **T402ResourceServer**: Verifies payments, builds requirements
- **T402Facilitator**: Verifies and settles payments
- **Types**: Protocol data structures (v1 & v2)

```typescript
// Core interfaces
interface T402Client {
  createPayment(requirements: PaymentRequirements): Promise<PaymentPayload>
}

interface T402ResourceServer {
  getRequirements(resource: string): PaymentRequirements[]
  verifyPayment(payload: PaymentPayload): Promise<VerifyResponse>
}

interface T402Facilitator {
  verify(payload: PaymentPayload, requirements: PaymentRequirements): Promise<VerifyResponse>
  settle(payload: PaymentPayload, requirements: PaymentRequirements): Promise<SettleResponse>
}
```

### 2. Mechanism Packages

#### @t402/evm - EVM Chain Support

Supports multiple payment schemes:

| Scheme | Token Support | Method |
|--------|---------------|--------|
| exact-eip3009 | USDT0, USDC | transferWithAuthorization |
| exact-legacy | USDT (legacy) | approve + transferFrom |
| exact-permit | DAI, etc. | EIP-2612 permit |

#### @t402/svm - Solana Support

| Scheme | Token Support | Method |
|--------|---------------|--------|
| exact-spl | USDC, any SPL | TransferChecked |
| exact-token2022 | Token2022 | TransferChecked |

### 3. Signer Abstraction (@t402/signer)

New abstraction layer for signing operations:

```typescript
interface T402Signer {
  // Get signer address
  getAddress(): Promise<string>

  // Sign EIP-712 typed data (for EIP-3009)
  signTypedData(domain: TypedDataDomain, types: TypedDataTypes, value: Record<string, any>): Promise<string>

  // Sign raw message
  signMessage(message: string | Uint8Array): Promise<string>

  // Send transaction
  sendTransaction(tx: TransactionRequest): Promise<TransactionResponse>
}

// Implementations
class WDKSigner implements T402Signer { ... }      // Default - Tether WDK
class ViemSigner implements T402Signer { ... }     // Compatible - Viem
class EthersSigner implements T402Signer { ... }   // Compatible - Ethers.js
```

### 4. WDK Integration (@t402/wdk)

Deep integration with Tether's Wallet Development Kit:

```typescript
import WDK from '@tetherto/wdk'
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'
import BridgeUsdt0 from '@tetherto/wdk-protocol-bridge-usdt0-evm'

export class T402WDK {
  private wdk: WDK

  constructor(seedPhrase: string) {
    this.wdk = new WDK(seedPhrase)
      .registerWallet('ethereum', WalletManagerEvm, {
        provider: process.env.ETH_RPC_URL
      })
      .registerWallet('arbitrum', WalletManagerEvm, {
        provider: process.env.ARB_RPC_URL
      })
      .registerProtocol('bridge-usdt0', BridgeUsdt0)
  }

  // Create T402 signer from WDK
  getSigner(chain: string, accountIndex = 0): T402Signer {
    return new WDKSigner(this.wdk, chain, accountIndex)
  }

  // Bridge USDT0 between chains
  async bridgeUsdt0(params: BridgeParams): Promise<BridgeResult> {
    return this.wdk.executeProtocol('bridge-usdt0', params)
  }

  // Get USDT/USDT0 balance across chains
  async getUsdtBalance(chain: string): Promise<bigint> {
    const account = await this.wdk.getAccount(chain, 0)
    return account.getTokenBalance(USDT_ADDRESSES[chain])
  }
}
```

---

## Payment Flow

### Standard T402 Payment Flow

```
┌────────┐     ┌──────────────┐     ┌─────────────┐     ┌────────────┐
│ Client │     │Resource Server│     │ Facilitator │     │ Blockchain │
└───┬────┘     └──────┬───────┘     └──────┬──────┘     └─────┬──────┘
    │                 │                     │                  │
    │ 1. Request      │                     │                  │
    │────────────────>│                     │                  │
    │                 │                     │                  │
    │ 2. 402 + Requirements                 │                  │
    │<────────────────│                     │                  │
    │                 │                     │                  │
    │ 3. Create Payment (WDK Sign)          │                  │
    │─────────────────────────────────────────────────────────>│
    │                 │                     │                  │
    │ 4. Request + PaymentPayload           │                  │
    │────────────────>│                     │                  │
    │                 │                     │                  │
    │                 │ 5. Verify           │                  │
    │                 │────────────────────>│                  │
    │                 │                     │                  │
    │                 │ 6. VerifyResponse   │                  │
    │                 │<────────────────────│                  │
    │                 │                     │                  │
    │                 │ 7. Settle           │                  │
    │                 │────────────────────>│                  │
    │                 │                     │                  │
    │                 │                     │ 8. Execute Tx    │
    │                 │                     │─────────────────>│
    │                 │                     │                  │
    │                 │                     │ 9. Tx Hash       │
    │                 │                     │<─────────────────│
    │                 │                     │                  │
    │                 │ 10. SettleResponse  │                  │
    │                 │<────────────────────│                  │
    │                 │                     │                  │
    │ 11. 200 OK + Response                 │                  │
    │<────────────────│                     │                  │
    │                 │                     │                  │
```

### USDT0 Cross-Chain Payment Flow

```
┌────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│ Client │     │Resource Server│     │ Facilitator │     │  LayerZero   │
│(Chain A)│    │  (Chain B)   │     │             │     │   (Bridge)   │
└───┬────┘     └──────┬───────┘     └──────┬──────┘     └──────┬───────┘
    │                 │                     │                   │
    │ 1. Request (from Chain A)             │                   │
    │────────────────>│                     │                   │
    │                 │                     │                   │
    │ 2. 402 + Requirements (Chain B accepted)                  │
    │<────────────────│                     │                   │
    │                 │                     │                   │
    │ 3. Bridge USDT0 A→B (via WDK)         │                   │
    │──────────────────────────────────────────────────────────>│
    │                 │                     │                   │
    │ 4. Bridge Complete                    │                   │
    │<──────────────────────────────────────────────────────────│
    │                 │                     │                   │
    │ 5. Create Payment (Chain B)           │                   │
    │────────────────>│                     │                   │
    │                 │                     │                   │
    │        [Standard payment flow continues...]               │
```

---

## Token Configuration

### Multi-Token Registry

```typescript
// @t402/core/src/tokens/registry.ts

export interface TokenConfig {
  symbol: string
  name: string
  decimals: number
  address: Address
  type: 'eip3009' | 'legacy' | 'spl' | 'oft'
  priority: number  // Lower = higher priority
}

export const TOKEN_REGISTRY: Record<string, Record<string, TokenConfig>> = {
  // Arbitrum One
  'eip155:42161': {
    'USDT0': {
      symbol: 'USDT0',
      name: 'Tether USD (USDT0)',
      decimals: 6,
      address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      type: 'eip3009',  // USDT0 supports EIP-3009!
      priority: 1
    },
    'USDC': {
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      type: 'eip3009',
      priority: 2
    }
  },

  // Ethereum Mainnet
  'eip155:1': {
    'USDT0': {
      symbol: 'USDT0',
      name: 'Tether USD (OFT)',
      decimals: 6,
      address: '0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee', // OFT Adapter
      type: 'oft',
      priority: 1
    },
    'USDT': {
      symbol: 'USDT',
      name: 'Tether USD (Legacy)',
      decimals: 6,
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      type: 'legacy',  // No EIP-3009, needs approve+transfer
      priority: 2
    },
    'USDC': {
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      type: 'eip3009',
      priority: 3
    }
  },

  // Base
  'eip155:8453': {
    'USDT0': {
      symbol: 'USDT0',
      name: 'Tether USD (USDT0)',
      decimals: 6,
      address: 'TBD', // To be deployed
      type: 'eip3009',
      priority: 1
    },
    'USDC': {
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      type: 'eip3009',
      priority: 2
    }
  }
}
```

---

## Security Considerations

### Trust Model

1. **Client**: Controls private keys via WDK (self-custodial)
2. **Resource Server**: Cannot move funds beyond payment
3. **Facilitator**: Cannot move funds outside client intentions

### EIP-3009 Security

- Random nonce prevents replay attacks
- Time window limits authorization validity
- Signature verification at contract level

### WDK Security

- Keys never leave user device
- Stateless architecture
- No server-side key storage

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Payment creation | < 100ms |
| Verification | < 500ms |
| Settlement | < 30s (blockchain dependent) |
| Cross-chain bridge | < 5min |
