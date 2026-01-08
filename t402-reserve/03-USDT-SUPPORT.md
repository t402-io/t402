# T402 USDT/USDT0 Support Specification

> Complete specification for Tether stablecoin integration

---

## Overview

T402 provides first-class support for both traditional USDT and the new USDT0 omnichain token.

### Token Comparison

| Feature | Traditional USDT | USDT0 |
|---------|-----------------|-------|
| **EIP-3009 Support** | ❌ No | ✅ Yes |
| **EIP-2612 Permit** | ❌ No | ✅ Yes |
| **Cross-chain** | Bridge required | ✅ Native OFT |
| **Gasless Transfers** | ❌ No | ✅ Yes |
| **Networks** | Ethereum, TRON, etc. | Arbitrum, Ink, Berachain, etc. |
| **T402 Integration** | Legacy scheme | Primary scheme |

---

## USDT0 Integration

### Supported Networks

| Network | CAIP-2 ID | Contract Address | Status |
|---------|-----------|------------------|--------|
| Ethereum (OFT Adapter) | eip155:1 | `0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee` | ✅ |
| Arbitrum One | eip155:42161 | `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9` | ✅ |
| Ink | eip155:57073 | TBD | 🔄 |
| Berachain | eip155:80094 | TBD | 🔄 |
| Base | eip155:8453 | TBD | 📋 |
| MegaETH | TBD | TBD | 📋 |

### EIP-3009 Implementation for USDT0

```typescript
// @t402/evm/src/exact/usdt0.ts

import { Address, encodeFunctionData, keccak256, toBytes } from 'viem'

// USDT0 supports EIP-3009 transferWithAuthorization
export const USDT0_EIP3009_ABI = [
  {
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'signature', type: 'bytes' }
    ],
    name: 'transferWithAuthorization',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' }
    ],
    name: 'receiveWithAuthorization',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const

// EIP-712 Domain for USDT0
export function getUsdt0Domain(chainId: number, contractAddress: Address) {
  return {
    name: 'TetherToken',
    version: '1',
    chainId,
    verifyingContract: contractAddress
  }
}

// Authorization types
export const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' }
  ]
} as const

// Create USDT0 payment authorization
export async function createUsdt0Authorization(
  signer: T402Signer,
  params: {
    from: Address
    to: Address
    value: bigint
    validAfter: bigint
    validBefore: bigint
    chainId: number
    contractAddress: Address
  }
): Promise<{
  authorization: Authorization
  signature: string
}> {
  // Generate random nonce
  const nonce = keccak256(toBytes(crypto.randomUUID()))

  const authorization = {
    from: params.from,
    to: params.to,
    value: params.value.toString(),
    validAfter: params.validAfter.toString(),
    validBefore: params.validBefore.toString(),
    nonce
  }

  // Sign with EIP-712
  const signature = await signer.signTypedData(
    getUsdt0Domain(params.chainId, params.contractAddress),
    TRANSFER_WITH_AUTHORIZATION_TYPES,
    authorization
  )

  return { authorization, signature }
}
```

### USDT0 Verification

```typescript
// @t402/evm/src/exact/server/usdt0.ts

export async function verifyUsdt0Payment(
  payload: PaymentPayload,
  requirements: PaymentRequirements,
  publicClient: PublicClient
): Promise<VerifyResponse> {
  const { authorization, signature } = payload.payload

  // 1. Verify signature recovers to the from address
  const recoveredAddress = await recoverTypedDataAddress({
    domain: getUsdt0Domain(requirements.chainId, requirements.asset),
    types: TRANSFER_WITH_AUTHORIZATION_TYPES,
    primaryType: 'TransferWithAuthorization',
    message: authorization,
    signature
  })

  if (recoveredAddress.toLowerCase() !== authorization.from.toLowerCase()) {
    return { isValid: false, invalidReason: 'invalid_signature' }
  }

  // 2. Verify amount meets requirements
  if (BigInt(authorization.value) < BigInt(requirements.amount)) {
    return { isValid: false, invalidReason: 'insufficient_amount' }
  }

  // 3. Verify time window
  const now = BigInt(Math.floor(Date.now() / 1000))
  if (now < BigInt(authorization.validAfter)) {
    return { isValid: false, invalidReason: 'authorization_not_yet_valid' }
  }
  if (now > BigInt(authorization.validBefore)) {
    return { isValid: false, invalidReason: 'authorization_expired' }
  }

  // 4. Verify recipient matches
  if (authorization.to.toLowerCase() !== requirements.payTo.toLowerCase()) {
    return { isValid: false, invalidReason: 'recipient_mismatch' }
  }

  // 5. Verify balance
  const balance = await publicClient.readContract({
    address: requirements.asset,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [authorization.from]
  })

  if (balance < BigInt(authorization.value)) {
    return { isValid: false, invalidReason: 'insufficient_balance' }
  }

  // 6. Simulate transaction
  try {
    await publicClient.simulateContract({
      address: requirements.asset,
      abi: USDT0_EIP3009_ABI,
      functionName: 'transferWithAuthorization',
      args: [
        authorization.from,
        authorization.to,
        BigInt(authorization.value),
        BigInt(authorization.validAfter),
        BigInt(authorization.validBefore),
        authorization.nonce,
        signature
      ]
    })
  } catch (error) {
    return { isValid: false, invalidReason: 'simulation_failed' }
  }

  return {
    isValid: true,
    payer: authorization.from
  }
}
```

---

## Traditional USDT Integration (Legacy Scheme)

For networks where USDT doesn't support EIP-3009, we implement a legacy scheme.

### Legacy Scheme Flow

```
┌────────┐                    ┌──────────────┐                    ┌────────────┐
│ Client │                    │Resource Server│                    │ Blockchain │
└───┬────┘                    └──────┬───────┘                    └─────┬──────┘
    │                                │                                  │
    │ 1. Request                     │                                  │
    │───────────────────────────────>│                                  │
    │                                │                                  │
    │ 2. 402 + Requirements (legacy scheme)                             │
    │<───────────────────────────────│                                  │
    │                                │                                  │
    │ 3. User approves USDT spend    │                                  │
    │────────────────────────────────────────────────────────────────>  │
    │                                │                                  │
    │ 4. Create Payment (approval tx hash)                              │
    │───────────────────────────────>│                                  │
    │                                │                                  │
    │                                │ 5. Verify approval               │
    │                                │─────────────────────────────────>│
    │                                │                                  │
    │                                │ 6. Execute transferFrom          │
    │                                │─────────────────────────────────>│
    │                                │                                  │
    │ 7. 200 OK + Response           │                                  │
    │<───────────────────────────────│                                  │
```

### Legacy Scheme Implementation

```typescript
// @t402/evm/src/exact/legacy/scheme.ts

export const LEGACY_SCHEME_ID = 'exact-legacy'

export interface LegacyPaymentPayload {
  t402Version: 2
  scheme: 'exact-legacy'
  network: string
  approved: {
    spender: Address      // Facilitator address
    amount: string        // Approved amount
    txHash: string        // Approval transaction hash
  }
  from: Address           // Payer address
}

// Server-side verification
export async function verifyLegacyPayment(
  payload: LegacyPaymentPayload,
  requirements: PaymentRequirements,
  publicClient: PublicClient
): Promise<VerifyResponse> {
  // 1. Verify approval transaction confirmed
  const receipt = await publicClient.getTransactionReceipt({
    hash: payload.approved.txHash
  })

  if (!receipt || receipt.status !== 'success') {
    return { isValid: false, invalidReason: 'approval_not_confirmed' }
  }

  // 2. Check current allowance
  const allowance = await publicClient.readContract({
    address: requirements.asset,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [payload.from, payload.approved.spender]
  })

  if (allowance < BigInt(requirements.amount)) {
    return { isValid: false, invalidReason: 'insufficient_allowance' }
  }

  // 3. Check balance
  const balance = await publicClient.readContract({
    address: requirements.asset,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [payload.from]
  })

  if (balance < BigInt(requirements.amount)) {
    return { isValid: false, invalidReason: 'insufficient_balance' }
  }

  return { isValid: true, payer: payload.from }
}

// Settlement via transferFrom
export async function settleLegacyPayment(
  payload: LegacyPaymentPayload,
  requirements: PaymentRequirements,
  walletClient: WalletClient
): Promise<SettleResponse> {
  try {
    const txHash = await walletClient.writeContract({
      address: requirements.asset,
      abi: erc20Abi,
      functionName: 'transferFrom',
      args: [
        payload.from,
        requirements.payTo,
        BigInt(requirements.amount)
      ]
    })

    return {
      success: true,
      transaction: txHash,
      network: requirements.network,
      payer: payload.from
    }
  } catch (error) {
    return {
      success: false,
      errorReason: error.message,
      transaction: '',
      network: requirements.network,
      payer: payload.from
    }
  }
}
```

---

## USDT0 Cross-Chain Support

### LayerZero OFT Integration

```typescript
// @t402/evm/src/exact/oft/bridge.ts

import { Options } from '@layerzerolabs/lz-v2-utilities'

export interface BridgeParams {
  fromChain: string    // CAIP-2 chain ID
  toChain: string      // CAIP-2 chain ID
  amount: bigint
  recipient: Address
}

export async function bridgeUsdt0(
  params: BridgeParams,
  signer: T402Signer
): Promise<{ txHash: string; estimatedTime: number }> {
  const oftContract = getOftContract(params.fromChain)
  const dstEid = getLayerZeroEndpointId(params.toChain)

  // Prepare send parameters
  const sendParam = {
    dstEid,
    to: addressToBytes32(params.recipient),
    amountLD: params.amount,
    minAmountLD: params.amount * 99n / 100n,  // 1% slippage
    extraOptions: Options.newOptions().addExecutorLzReceiveOption(200000, 0).toHex(),
    composeMsg: '0x',
    oftCmd: '0x'
  }

  // Quote the fee
  const [nativeFee] = await oftContract.read.quoteSend([sendParam, false])

  // Execute the bridge
  const txHash = await oftContract.write.send(
    [sendParam, { nativeFee, lzTokenFee: 0n }, params.recipient],
    { value: nativeFee }
  )

  return {
    txHash,
    estimatedTime: 300  // ~5 minutes typical
  }
}

// LayerZero Endpoint IDs
const LAYERZERO_ENDPOINT_IDS: Record<string, number> = {
  'eip155:1': 30101,      // Ethereum
  'eip155:42161': 30110,  // Arbitrum
  'eip155:8453': 30184,   // Base
  'eip155:57073': 30291,  // Ink
  // Add more as USDT0 expands
}
```

---

## Payment Requirements Format

### USDT0 Payment Requirements

```json
{
  "t402Version": 2,
  "scheme": "exact",
  "network": "eip155:42161",
  "amount": "1000000",
  "asset": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  "payTo": "0x...",
  "maxTimeoutSeconds": 60,
  "extra": {
    "name": "USDT0",
    "version": "1",
    "tokenType": "eip3009"
  }
}
```

### Legacy USDT Payment Requirements

```json
{
  "t402Version": 2,
  "scheme": "exact-legacy",
  "network": "eip155:1",
  "amount": "1000000",
  "asset": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  "payTo": "0x...",
  "maxTimeoutSeconds": 300,
  "extra": {
    "name": "USDT",
    "version": "1",
    "tokenType": "legacy",
    "approvalRequired": true,
    "facilitatorSpender": "0x..."
  }
}
```

---

## Migration Path: USDT → USDT0

For users holding traditional USDT, T402 provides a migration path:

```typescript
// @t402/wdk/src/migration.ts

export async function migrateToUsdt0(
  wdk: T402WDK,
  params: {
    fromChain: 'ethereum' | 'tron' | 'ton'
    toChain: string  // Any USDT0 chain
    amount: bigint
  }
): Promise<MigrationResult> {
  // Use Legacy Mesh for migration
  // USDT on Ethereum/Tron/TON → USDT0 on Arbitrum → Any USDT0 chain

  if (params.fromChain === 'ethereum') {
    // Step 1: Lock USDT in Legacy Mesh
    const lockTx = await lockUsdtInLegacyMesh(wdk, params.amount)

    // Step 2: Receive USDT0 on Arbitrum
    const usdt0Received = await waitForUsdt0(wdk, 'arbitrum')

    // Step 3: Bridge to destination if needed
    if (params.toChain !== 'eip155:42161') {
      return bridgeUsdt0({
        fromChain: 'eip155:42161',
        toChain: params.toChain,
        amount: params.amount,
        recipient: await wdk.getAddress(params.toChain)
      }, wdk.getSigner('arbitrum'))
    }

    return usdt0Received
  }

  // Similar flow for TRON and TON
}
```

---

## Supported Token Priority

When a resource accepts multiple tokens, T402 clients should prefer:

1. **USDT0** (highest priority) - Best UX, gasless, cross-chain
2. **USDC** - Wide support, EIP-3009
3. **USDT Legacy** - Requires approval, more steps
4. **Other stablecoins** - As configured

```typescript
// @t402/core/src/client/tokenSelector.ts

export function selectBestPaymentMethod(
  requirements: PaymentRequirements[],
  userTokens: UserTokenBalance[]
): PaymentRequirements | null {
  // Sort by priority
  const sorted = requirements.sort((a, b) => {
    const priorityA = TOKEN_PRIORITY[a.extra?.name] ?? 999
    const priorityB = TOKEN_PRIORITY[b.extra?.name] ?? 999
    return priorityA - priorityB
  })

  // Find first one user can pay
  for (const req of sorted) {
    const balance = userTokens.find(
      t => t.asset === req.asset && t.network === req.network
    )
    if (balance && BigInt(balance.amount) >= BigInt(req.amount)) {
      return req
    }
  }

  return null
}

const TOKEN_PRIORITY: Record<string, number> = {
  'USDT0': 1,
  'USDC': 2,
  'USDT': 3,
  'DAI': 4
}
```
