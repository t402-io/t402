# T402 Tether WDK Deep Integration Guide

> Complete guide for integrating Tether's Wallet Development Kit

---

## Overview

T402 deeply integrates with [Tether WDK](https://wallet.tether.io/) as the default signing and wallet management layer, providing:

- **Self-custodial** wallet management
- **Multi-chain** support (EVM, Bitcoin, TON, TRON, Solana)
- **Native USDT0** bridge integration
- **Gasless** transaction support
- **AI Agent** compatible (via wdk-mcp)

---

## WDK Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         T402 + WDK Integration                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                       @t402/wdk Package                          │    │
│  │                                                                   │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │    │
│  │  │   T402WDK       │  │  WDKSigner      │  │ WDKBridge       │  │    │
│  │  │   (Main Class)  │  │  (T402Signer)   │  │ (Cross-chain)   │  │    │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘  │    │
│  │                                                                   │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │    │
│  │  │ WDKGasless      │  │  WDKBalance     │  │ WDKConfig       │  │    │
│  │  │ (Meta-tx)       │  │  (Multi-chain)  │  │ (Setup)         │  │    │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                    │                                     │
│                                    ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                     Tether WDK Core                              │    │
│  │                                                                   │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐ │    │
│  │  │@tetherto/wdk│ │wallet-evm   │ │wallet-btc   │ │wallet-ton  │ │    │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘ │    │
│  │                                                                   │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐ │    │
│  │  │wallet-tron  │ │wallet-solana│ │wallet-spark │ │evm-erc4337 │ │    │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘ │    │
│  │                                                                   │    │
│  │  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ │    │
│  │  │bridge-usdt0-evm  │ │ swap-velora-evm  │ │  lending-aave    │ │    │
│  │  └──────────────────┘ └──────────────────┘ └──────────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Installation

```bash
# Core T402 packages
npm install @t402/core @t402/evm @t402/wdk

# WDK dependencies (peer dependencies)
npm install @tetherto/wdk @tetherto/wdk-wallet-evm @tetherto/wdk-wallet-btc

# Optional: Additional WDK modules
npm install @tetherto/wdk-wallet-ton @tetherto/wdk-wallet-tron
npm install @tetherto/wdk-protocol-bridge-usdt0-evm
npm install @tetherto/wdk-protocol-swap-velora-evm
```

---

## Basic Usage

### Initialization

```typescript
// @t402/wdk/src/index.ts

import WDK from '@tetherto/wdk'
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'
import WalletManagerBtc from '@tetherto/wdk-wallet-btc'
import WalletManagerTon from '@tetherto/wdk-wallet-ton'
import WalletManagerTron from '@tetherto/wdk-wallet-tron'
import BridgeUsdt0Evm from '@tetherto/wdk-protocol-bridge-usdt0-evm'

export interface T402WDKConfig {
  // RPC endpoints
  ethereum?: string
  arbitrum?: string
  base?: string
  // Add more chains as needed
}

export class T402WDK {
  private wdk: WDK
  private config: T402WDKConfig

  constructor(seedPhrase: string, config: T402WDKConfig = {}) {
    this.config = config
    this.wdk = this.initializeWDK(seedPhrase)
  }

  private initializeWDK(seedPhrase: string): WDK {
    let wdk = new WDK(seedPhrase)

    // Register EVM wallets
    if (this.config.ethereum) {
      wdk = wdk.registerWallet('ethereum', WalletManagerEvm, {
        provider: this.config.ethereum,
        chainId: 1
      })
    }

    if (this.config.arbitrum) {
      wdk = wdk.registerWallet('arbitrum', WalletManagerEvm, {
        provider: this.config.arbitrum,
        chainId: 42161
      })
    }

    if (this.config.base) {
      wdk = wdk.registerWallet('base', WalletManagerEvm, {
        provider: this.config.base,
        chainId: 8453
      })
    }

    // Register bridge protocol
    wdk = wdk.registerProtocol('bridge-usdt0', BridgeUsdt0Evm)

    return wdk
  }

  // Generate new seed phrase
  static generateSeedPhrase(): string {
    return WDK.getRandomSeedPhrase()
  }

  // Get T402-compatible signer
  getSigner(chain: string, accountIndex = 0): WDKSigner {
    return new WDKSigner(this.wdk, chain, accountIndex)
  }

  // Get account address
  async getAddress(chain: string, accountIndex = 0): Promise<string> {
    const account = await this.wdk.getAccount(chain, accountIndex)
    return account.getAddress()
  }

  // Get USDT/USDT0 balance across all chains
  async getUsdtBalances(): Promise<Record<string, bigint>> {
    const balances: Record<string, bigint> = {}

    for (const chain of Object.keys(this.config)) {
      try {
        const account = await this.wdk.getAccount(chain, 0)
        const tokenAddress = USDT_ADDRESSES[chain]
        if (tokenAddress) {
          balances[chain] = await account.getTokenBalance(tokenAddress)
        }
      } catch (e) {
        balances[chain] = 0n
      }
    }

    return balances
  }

  // Bridge USDT0 between chains
  async bridgeUsdt0(params: {
    fromChain: string
    toChain: string
    amount: bigint
    recipient?: string
  }): Promise<{ txHash: string }> {
    const recipient = params.recipient || await this.getAddress(params.toChain)

    return this.wdk.executeProtocol('bridge-usdt0', {
      fromChain: params.fromChain,
      toChain: params.toChain,
      amount: params.amount,
      recipient
    })
  }
}

// USDT/USDT0 addresses per chain
const USDT_ADDRESSES: Record<string, string> = {
  ethereum: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  arbitrum: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  // Add more
}
```

### WDK Signer Implementation

```typescript
// @t402/wdk/src/signer.ts

import { T402Signer, TypedDataDomain, TypedDataTypes } from '@t402/core'
import WDK from '@tetherto/wdk'

export class WDKSigner implements T402Signer {
  private wdk: WDK
  private chain: string
  private accountIndex: number
  private _account: any = null

  constructor(wdk: WDK, chain: string, accountIndex = 0) {
    this.wdk = wdk
    this.chain = chain
    this.accountIndex = accountIndex
  }

  private async getAccount() {
    if (!this._account) {
      this._account = await this.wdk.getAccount(this.chain, this.accountIndex)
    }
    return this._account
  }

  async getAddress(): Promise<string> {
    const account = await this.getAccount()
    return account.getAddress()
  }

  async signTypedData(
    domain: TypedDataDomain,
    types: TypedDataTypes,
    value: Record<string, any>
  ): Promise<string> {
    const account = await this.getAccount()

    // WDK uses EIP-712 signing
    return account.signTypedData({
      domain,
      types,
      primaryType: Object.keys(types)[0],
      message: value
    })
  }

  async signMessage(message: string | Uint8Array): Promise<string> {
    const account = await this.getAccount()
    return account.signMessage(
      typeof message === 'string' ? message : Buffer.from(message).toString()
    )
  }

  async sendTransaction(tx: {
    to: string
    value?: bigint
    data?: string
  }): Promise<{ hash: string }> {
    const account = await this.getAccount()
    const hash = await account.sendTransaction(tx)
    return { hash }
  }

  // Get token balance
  async getTokenBalance(tokenAddress: string): Promise<bigint> {
    const account = await this.getAccount()
    return account.getTokenBalance(tokenAddress)
  }

  // Estimate gas
  async estimateGas(tx: {
    to: string
    value?: bigint
    data?: string
  }): Promise<bigint> {
    const account = await this.getAccount()
    return account.estimateGas(tx)
  }
}
```

---

## T402 Client with WDK

### Complete Client Example

```typescript
// examples/wdk-client.ts

import { T402WDK, WDKSigner } from '@t402/wdk'
import { createT402Client } from '@t402/core'
import { evmMechanism } from '@t402/evm'

async function main() {
  // Initialize WDK with seed phrase
  const seedPhrase = T402WDK.generateSeedPhrase()
  console.log('Seed phrase (save this!):', seedPhrase)

  const wdk = new T402WDK(seedPhrase, {
    ethereum: 'https://eth.drpc.org',
    arbitrum: 'https://arb1.arbitrum.io/rpc',
    base: 'https://mainnet.base.org'
  })

  // Get signer for Arbitrum (USDT0 hub)
  const signer = wdk.getSigner('arbitrum')
  const address = await signer.getAddress()
  console.log('Wallet address:', address)

  // Check USDT0 balance
  const balance = await signer.getTokenBalance(
    '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9' // USDT0 on Arbitrum
  )
  console.log('USDT0 balance:', balance.toString())

  // Create T402 client with WDK signer
  const client = createT402Client({
    signer,
    mechanisms: [evmMechanism]
  })

  // Make a payment
  const response = await client.fetch('https://api.example.com/premium-data', {
    method: 'GET'
  })

  console.log('Response:', await response.json())
}

main().catch(console.error)
```

### Express Server with WDK

```typescript
// examples/wdk-server.ts

import express from 'express'
import { paymentMiddleware } from '@t402/express'
import { T402WDK } from '@t402/wdk'
import { evmMechanism } from '@t402/evm'

const app = express()

// Server-side WDK for facilitator operations
const facilitatorWdk = new T402WDK(process.env.FACILITATOR_SEED!, {
  arbitrum: process.env.ARBITRUM_RPC
})

app.use(
  paymentMiddleware({
    'GET /api/premium': {
      description: 'Premium API endpoint',
      accepts: [
        {
          scheme: 'exact',
          network: 'eip155:42161',  // Arbitrum
          amount: '100000',          // 0.1 USDT0
          asset: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
          payTo: process.env.MERCHANT_ADDRESS!,
          maxTimeoutSeconds: 60,
          extra: {
            name: 'USDT0',
            version: '1'
          }
        }
      ]
    }
  }, {
    mechanisms: [evmMechanism],
    facilitatorUrl: 'https://facilitator.t402.io'
  })
)

app.get('/api/premium', (req, res) => {
  res.json({ data: 'Premium content!' })
})

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000')
})
```

---

## Advanced Features

### Gasless Transactions (Account Abstraction)

```typescript
// @t402/wdk/src/gasless.ts

import WalletManagerEvmErc4337 from '@tetherto/wdk-wallet-evm-erc-4337'

export class T402WDKGasless extends T402WDK {
  constructor(seedPhrase: string, config: T402WDKConfig) {
    super(seedPhrase, config)

    // Register ERC-4337 wallet for gasless support
    if (config.arbitrum) {
      this.wdk = this.wdk.registerWallet('arbitrum-gasless', WalletManagerEvmErc4337, {
        provider: config.arbitrum,
        chainId: 42161,
        bundlerUrl: config.bundlerUrl,
        paymasterUrl: config.paymasterUrl
      })
    }
  }

  // Get gasless signer
  getGaslessSigner(chain: string, accountIndex = 0): WDKSigner {
    return new WDKSigner(this.wdk, `${chain}-gasless`, accountIndex)
  }

  // Send gasless USDT0 payment
  async sendGaslessUsdt0(params: {
    to: string
    amount: bigint
    chain: string
  }): Promise<{ userOpHash: string }> {
    const gaslessSigner = this.getGaslessSigner(params.chain)

    // ERC-4337 UserOperation
    return gaslessSigner.sendTransaction({
      to: USDT_ADDRESSES[params.chain],
      data: encodeTransferData(params.to, params.amount)
    })
  }
}
```

### Multi-Chain Balance Aggregation

```typescript
// @t402/wdk/src/balance.ts

export interface ChainBalance {
  chain: string
  network: string  // CAIP-2
  usdt0: bigint
  usdt: bigint
  usdc: bigint
  native: bigint
}

export async function getAggregatedBalances(
  wdk: T402WDK
): Promise<ChainBalance[]> {
  const chains = ['ethereum', 'arbitrum', 'base']
  const balances: ChainBalance[] = []

  for (const chain of chains) {
    const signer = wdk.getSigner(chain)

    balances.push({
      chain,
      network: CHAIN_TO_CAIP2[chain],
      usdt0: await getTokenBalance(signer, TOKENS[chain].usdt0),
      usdt: await getTokenBalance(signer, TOKENS[chain].usdt),
      usdc: await getTokenBalance(signer, TOKENS[chain].usdc),
      native: await signer.getBalance()
    })
  }

  return balances
}

// Find best chain for payment
export function findBestChainForPayment(
  balances: ChainBalance[],
  amount: bigint,
  preferredToken: 'usdt0' | 'usdt' | 'usdc' = 'usdt0'
): { chain: string; token: string } | null {
  // Priority: USDT0 > USDC > USDT
  const tokenPriority = ['usdt0', 'usdc', 'usdt']

  if (preferredToken !== 'usdt0') {
    // Move preferred to front
    const idx = tokenPriority.indexOf(preferredToken)
    tokenPriority.splice(idx, 1)
    tokenPriority.unshift(preferredToken)
  }

  for (const token of tokenPriority) {
    for (const balance of balances) {
      if (balance[token] >= amount) {
        return { chain: balance.chain, token }
      }
    }
  }

  return null
}
```

### Cross-Chain Payment Flow

```typescript
// @t402/wdk/src/crosschain.ts

export async function executePaymentWithBridge(
  wdk: T402WDK,
  params: {
    requirements: PaymentRequirements
    sourceChain: string  // Where user has funds
  }
): Promise<PaymentResult> {
  const targetChain = caip2ToChain(params.requirements.network)

  // If different chains, bridge first
  if (params.sourceChain !== targetChain) {
    console.log(`Bridging USDT0 from ${params.sourceChain} to ${targetChain}`)

    const bridgeResult = await wdk.bridgeUsdt0({
      fromChain: params.sourceChain,
      toChain: targetChain,
      amount: BigInt(params.requirements.amount)
    })

    // Wait for bridge completion
    await waitForBridgeCompletion(bridgeResult.txHash)
    console.log('Bridge complete!')
  }

  // Now execute payment on target chain
  const signer = wdk.getSigner(targetChain)
  const client = createT402Client({ signer, mechanisms: [evmMechanism] })

  return client.createPayment(params.requirements)
}
```

---

## WDK MCP Integration (AI Agents)

For AI agent support, WDK provides MCP (Model Context Protocol) integration:

```typescript
// @t402/wdk/src/mcp.ts

import { WdkMcp } from '@tetherto/wdk-mcp'

export async function createT402McpServer(
  seedPhrase: string,
  config: T402WDKConfig
) {
  const wdk = new T402WDK(seedPhrase, config)

  // Create MCP server with T402 tools
  const mcp = new WdkMcp(wdk.wdk)

  // Register T402-specific tools
  mcp.registerTool('t402_pay', {
    description: 'Make a T402 payment',
    parameters: {
      url: { type: 'string', description: 'URL to pay for' },
      maxAmount: { type: 'string', description: 'Max USDT amount' }
    },
    handler: async (params) => {
      const client = createT402Client({
        signer: wdk.getSigner('arbitrum'),
        mechanisms: [evmMechanism]
      })

      return client.fetch(params.url)
    }
  })

  mcp.registerTool('t402_balance', {
    description: 'Get USDT/USDT0 balance',
    handler: async () => {
      return wdk.getUsdtBalances()
    }
  })

  return mcp
}
```

---

## Security Best Practices

### Seed Phrase Management

```typescript
// NEVER hardcode seed phrases
// Use secure storage mechanisms

// ❌ Bad
const wdk = new T402WDK('word1 word2 word3 ...')

// ✅ Good - Environment variable
const wdk = new T402WDK(process.env.SEED_PHRASE!)

// ✅ Good - Secure storage (React Native)
import * as SecureStore from 'expo-secure-store'
const seedPhrase = await SecureStore.getItemAsync('seed_phrase')
const wdk = new T402WDK(seedPhrase!)

// ✅ Good - Hardware wallet (future)
const wdk = new T402WDK({ type: 'hardware', device: 'ledger' })
```

### Transaction Limits

```typescript
// Implement spending limits
export class SafeT402WDK extends T402WDK {
  private dailyLimit: bigint
  private dailySpent: bigint = 0n

  constructor(seedPhrase: string, config: T402WDKConfig, dailyLimit: bigint) {
    super(seedPhrase, config)
    this.dailyLimit = dailyLimit
  }

  async createPayment(requirements: PaymentRequirements): Promise<PaymentPayload> {
    const amount = BigInt(requirements.amount)

    if (this.dailySpent + amount > this.dailyLimit) {
      throw new Error('Daily spending limit exceeded')
    }

    const payload = await super.createPayment(requirements)
    this.dailySpent += amount

    return payload
  }
}
```

---

## Error Handling

```typescript
// @t402/wdk/src/errors.ts

export class WDKError extends Error {
  constructor(message: string, public code: string) {
    super(message)
    this.name = 'WDKError'
  }
}

export class InsufficientBalanceError extends WDKError {
  constructor(required: bigint, available: bigint) {
    super(
      `Insufficient balance: required ${required}, available ${available}`,
      'INSUFFICIENT_BALANCE'
    )
  }
}

export class BridgeError extends WDKError {
  constructor(message: string) {
    super(message, 'BRIDGE_ERROR')
  }
}

export class SigningError extends WDKError {
  constructor(message: string) {
    super(message, 'SIGNING_ERROR')
  }
}
```

---

## Testing

```typescript
// @t402/wdk/test/wdk.test.ts

import { T402WDK } from '@t402/wdk'
import { describe, it, expect, beforeAll } from 'vitest'

describe('T402WDK', () => {
  let wdk: T402WDK

  beforeAll(() => {
    // Use test seed phrase
    const testSeed = T402WDK.generateSeedPhrase()
    wdk = new T402WDK(testSeed, {
      arbitrum: 'https://arb1.arbitrum.io/rpc'
    })
  })

  it('should generate valid address', async () => {
    const address = await wdk.getAddress('arbitrum')
    expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/)
  })

  it('should create valid signer', async () => {
    const signer = wdk.getSigner('arbitrum')
    expect(signer).toBeDefined()
    expect(await signer.getAddress()).toBeDefined()
  })

  it('should sign typed data', async () => {
    const signer = wdk.getSigner('arbitrum')

    const signature = await signer.signTypedData(
      { name: 'Test', version: '1', chainId: 42161, verifyingContract: '0x...' },
      { Message: [{ name: 'content', type: 'string' }] },
      { content: 'Hello' }
    )

    expect(signature).toMatch(/^0x[a-fA-F0-9]+$/)
  })
})
```
