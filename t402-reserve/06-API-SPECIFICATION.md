# T402 API Specification

> Protocol and SDK API reference for T402

---

## Protocol Version

**T402 Protocol Version**: 2.0
**Based on**: t402 v2 specification

---

## Core Types

### PaymentRequirements

```typescript
interface PaymentRequirements {
  scheme: string              // "exact" | "exact-legacy"
  network: string             // CAIP-2 format, e.g., "eip155:42161"
  amount: string              // Amount in atomic units (e.g., "1000000" for 1 USDT)
  asset: string               // Token contract address
  payTo: string               // Recipient address
  maxTimeoutSeconds: number   // Max time for payment completion
  extra?: {
    name: string              // Token name, e.g., "USDT0"
    version: string           // Token version
    tokenType?: string        // "eip3009" | "legacy" | "oft"
    [key: string]: unknown
  }
}
```

### PaymentPayload

```typescript
interface PaymentPayload {
  t402Version: 2
  resource?: ResourceInfo
  accepted: PaymentRequirements
  payload: SchemePayload       // Scheme-specific payload
  extensions?: Record<string, ExtensionData>
}

// For exact scheme (EIP-3009)
interface ExactSchemePayload {
  signature: string            // EIP-712 signature
  authorization: {
    from: string
    to: string
    value: string
    validAfter: string
    validBefore: string
    nonce: string              // bytes32
  }
}

// For exact-legacy scheme (approve + transferFrom)
interface ExactLegacyPayload {
  from: string
  approved: {
    spender: string
    amount: string
    txHash: string
  }
}
```

### Responses

```typescript
interface VerifyResponse {
  isValid: boolean
  invalidReason?: string
  payer?: string
}

interface SettleResponse {
  success: boolean
  errorReason?: string
  transaction: string          // Transaction hash
  network: string
  payer?: string
}

interface PaymentRequiredResponse {
  t402Version: 2
  error?: string
  resource: ResourceInfo
  accepts: PaymentRequirements[]
  extensions?: Record<string, ExtensionData>
}
```

---

## SDK APIs

### @t402/core

#### T402Client

```typescript
import { createT402Client, T402ClientConfig } from '@t402/core'

interface T402ClientConfig {
  signer: T402Signer
  mechanisms: T402Mechanism[]
  facilitatorUrl?: string
}

const client = createT402Client({
  signer: wdkSigner,
  mechanisms: [evmMechanism, svmMechanism]
})

// Methods
class T402Client {
  // Create payment payload for given requirements
  createPayment(requirements: PaymentRequirements): Promise<PaymentPayload>

  // Fetch with automatic payment handling
  fetch(url: string, init?: RequestInit): Promise<Response>

  // Select best payment method from multiple options
  selectPaymentMethod(
    accepts: PaymentRequirements[],
    preferences?: PaymentPreferences
  ): PaymentRequirements | null
}
```

#### T402ResourceServer

```typescript
import { createT402ResourceServer } from '@t402/core'

const server = createT402ResourceServer({
  mechanisms: [evmMechanism],
  facilitatorUrl: 'https://facilitator.t402.io'
})

class T402ResourceServer {
  // Get payment requirements for a resource
  getRequirements(resource: string): PaymentRequirements[]

  // Verify a payment payload
  verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<VerifyResponse>

  // Settle a verified payment
  settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<SettleResponse>
}
```

---

### @t402/wdk

#### T402WDK

```typescript
import { T402WDK } from '@t402/wdk'

interface T402WDKConfig {
  ethereum?: string    // RPC URL
  arbitrum?: string
  base?: string
  // ... more chains
}

class T402WDK {
  // Constructor
  constructor(seedPhrase: string, config: T402WDKConfig)

  // Static: Generate new seed phrase
  static generateSeedPhrase(): string

  // Get signer for a specific chain
  getSigner(chain: string, accountIndex?: number): WDKSigner

  // Get address for a chain
  getAddress(chain: string, accountIndex?: number): Promise<string>

  // Get USDT/USDT0 balances across all configured chains
  getUsdtBalances(): Promise<Record<string, bigint>>

  // Bridge USDT0 between chains
  bridgeUsdt0(params: BridgeParams): Promise<BridgeResult>
}

interface BridgeParams {
  fromChain: string
  toChain: string
  amount: bigint
  recipient?: string   // Defaults to same address on destination
}

interface BridgeResult {
  txHash: string
  estimatedTime: number  // seconds
}
```

#### WDKSigner

```typescript
class WDKSigner implements T402Signer {
  // Get wallet address
  getAddress(): Promise<string>

  // Sign EIP-712 typed data
  signTypedData(
    domain: TypedDataDomain,
    types: TypedDataTypes,
    value: Record<string, any>
  ): Promise<string>

  // Sign raw message
  signMessage(message: string | Uint8Array): Promise<string>

  // Send transaction
  sendTransaction(tx: TransactionRequest): Promise<TransactionResponse>

  // Get token balance
  getTokenBalance(tokenAddress: string): Promise<bigint>

  // Get native balance
  getBalance(): Promise<bigint>
}
```

---

### @t402/evm

#### EVM Mechanism

```typescript
import { evmMechanism, createEvmMechanism } from '@t402/evm'

// Default mechanism (uses provided signer)
const mechanism = evmMechanism

// Custom mechanism with specific config
const customMechanism = createEvmMechanism({
  supportedNetworks: ['eip155:42161', 'eip155:8453'],
  rpcUrls: {
    'eip155:42161': 'https://arb1.arbitrum.io/rpc',
    'eip155:8453': 'https://mainnet.base.org'
  }
})
```

#### Token Configuration

```typescript
import { registerToken, getTokenConfig } from '@t402/evm'

// Register custom token
registerToken('eip155:42161', {
  symbol: 'USDT0',
  name: 'Tether USD (USDT0)',
  decimals: 6,
  address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  type: 'eip3009',
  priority: 1
})

// Get token config
const config = getTokenConfig('eip155:42161', 'USDT0')
```

---

### @t402/express

```typescript
import { paymentMiddleware, paymentMiddlewareFromConfig } from '@t402/express'

// Direct configuration
app.use(paymentMiddleware({
  'GET /api/premium': {
    description: 'Premium API',
    accepts: [
      {
        scheme: 'exact',
        network: 'eip155:42161',
        amount: '100000',  // 0.1 USDT0
        asset: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
        payTo: '0x...',
        maxTimeoutSeconds: 60,
        extra: { name: 'USDT0', version: '1' }
      }
    ]
  }
}, {
  mechanisms: [evmMechanism],
  facilitatorUrl: 'https://facilitator.t402.io'
}))

// Config-based (load from file/env)
app.use(paymentMiddlewareFromConfig('./t402.config.json'))
```

---

### @t402/fetch

```typescript
import { wrapFetchWithPayment } from '@t402/fetch'

const t402Fetch = wrapFetchWithPayment(fetch, {
  signer: wdkSigner,
  mechanisms: [evmMechanism]
})

// Use like regular fetch - payments handled automatically
const response = await t402Fetch('https://api.example.com/premium')
```

---

## Facilitator API

### POST /verify

Verify a payment without executing.

**Request**:
```json
{
  "paymentPayload": { ... },
  "paymentRequirements": { ... }
}
```

**Response**:
```json
{
  "isValid": true,
  "payer": "0x..."
}
```

### POST /settle

Execute a verified payment.

**Request**:
```json
{
  "paymentPayload": { ... },
  "paymentRequirements": { ... }
}
```

**Response**:
```json
{
  "success": true,
  "transaction": "0x...",
  "network": "eip155:42161",
  "payer": "0x..."
}
```

### GET /supported

Get supported schemes, networks, and extensions.

**Response**:
```json
{
  "kinds": [
    { "t402Version": 2, "scheme": "exact", "network": "eip155:42161" },
    { "t402Version": 2, "scheme": "exact", "network": "eip155:8453" },
    { "t402Version": 2, "scheme": "exact-legacy", "network": "eip155:1" }
  ],
  "extensions": ["bazaar"],
  "signers": {
    "eip155:*": ["0x..."]
  }
}
```

---

## HTTP Headers

### Request Headers

| Header | Description |
|--------|-------------|
| `X-PAYMENT-SIGNATURE` | Base64-encoded PaymentPayload |

### Response Headers

| Header | Description |
|--------|-------------|
| `X-PAYMENT-REQUIRED` | Base64-encoded PaymentRequiredResponse |
| `X-PAYMENT-RESPONSE` | Base64-encoded SettleResponse |

---

## Error Codes

| Code | Description |
|------|-------------|
| `insufficient_funds` | Payer has insufficient balance |
| `invalid_signature` | Payment signature is invalid |
| `authorization_expired` | Payment authorization has expired |
| `authorization_not_yet_valid` | Authorization validAfter is in the future |
| `recipient_mismatch` | Payment recipient doesn't match requirements |
| `amount_insufficient` | Payment amount is less than required |
| `unsupported_scheme` | Scheme not supported by facilitator |
| `unsupported_network` | Network not supported by facilitator |
| `simulation_failed` | Transaction simulation failed |
| `settlement_failed` | On-chain settlement failed |

---

## Network Identifiers (CAIP-2)

| Network | CAIP-2 ID | USDT0 Support |
|---------|-----------|---------------|
| Ethereum Mainnet | eip155:1 | OFT Adapter |
| Arbitrum One | eip155:42161 | Native |
| Base | eip155:8453 | TBD |
| Ink | eip155:57073 | Native |
| Berachain | eip155:80094 | Native |
| Solana Mainnet | solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp | N/A |

---

## Code Examples

### Complete Client Example

```typescript
import { T402WDK } from '@t402/wdk'
import { createT402Client } from '@t402/core'
import { evmMechanism } from '@t402/evm'

async function makePayment() {
  // 1. Initialize WDK
  const wdk = new T402WDK(process.env.SEED_PHRASE!, {
    arbitrum: 'https://arb1.arbitrum.io/rpc'
  })

  // 2. Get signer
  const signer = wdk.getSigner('arbitrum')

  // 3. Create client
  const client = createT402Client({
    signer,
    mechanisms: [evmMechanism]
  })

  // 4. Make payment-enabled request
  const response = await client.fetch('https://api.example.com/premium', {
    method: 'GET'
  })

  // 5. Handle response
  if (response.ok) {
    const data = await response.json()
    console.log('Data:', data)

    // Check payment receipt
    const receipt = response.headers.get('X-PAYMENT-RESPONSE')
    if (receipt) {
      const decoded = JSON.parse(atob(receipt))
      console.log('Payment tx:', decoded.transaction)
    }
  }
}
```

### Complete Server Example

```typescript
import express from 'express'
import { paymentMiddleware } from '@t402/express'
import { evmMechanism } from '@t402/evm'

const app = express()

// Configure payment protection
app.use(paymentMiddleware({
  'GET /api/weather': {
    description: 'Weather data API',
    accepts: [
      // Primary: USDT0 on Arbitrum
      {
        scheme: 'exact',
        network: 'eip155:42161',
        amount: '10000',  // 0.01 USDT0
        asset: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
        payTo: process.env.MERCHANT_ADDRESS!,
        maxTimeoutSeconds: 60,
        extra: { name: 'USDT0', version: '1', tokenType: 'eip3009' }
      },
      // Fallback: USDC on Arbitrum
      {
        scheme: 'exact',
        network: 'eip155:42161',
        amount: '10000',
        asset: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        payTo: process.env.MERCHANT_ADDRESS!,
        maxTimeoutSeconds: 60,
        extra: { name: 'USDC', version: '2', tokenType: 'eip3009' }
      }
    ]
  }
}, {
  mechanisms: [evmMechanism],
  facilitatorUrl: 'https://facilitator.t402.io'
}))

// Protected endpoint
app.get('/api/weather', (req, res) => {
  res.json({
    temperature: 72,
    conditions: 'Sunny',
    location: 'San Francisco'
  })
})

app.listen(3000)
```
