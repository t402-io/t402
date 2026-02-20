/**
 * WDK + Up-To Payment Example
 *
 * Demonstrates how to use a T402 WDK signer with the Up-To EVM scheme
 * for usage-based billing. The Up-To scheme uses EIP-2612 Permit to
 * authorize a maximum amount, with actual settlement based on usage.
 *
 * Key concept: maxAmount authorization vs actual settlement
 * - Client signs a permit for maxAmount (e.g., 10 USDT0)
 * - Server charges based on actual usage (e.g., 3.5 USDT0)
 * - Remaining authorization is never charged
 *
 * Flow:
 * 1. Client receives 402 with Up-To requirements (includes maxAmount)
 * 2. Client signs EIP-2612 permit for maxAmount
 * 3. Server tracks usage during session
 * 4. Server settles only the actual usage amount
 *
 * Run with: npx tsx index.ts
 */

import type { Address } from 'viem'
import type { WDKAccount, WDKInstance } from '@t402/wdk'

// ============================================================
// Mock WDK for demo purposes
// ============================================================

const DEMO_ADDRESS = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Address
const DEMO_CHAIN = 'base'
const DEMO_NETWORK = 'eip155:8453'
const USDT0_ADDRESS = '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2' as Address

function createMockAccount(): WDKAccount {
  return {
    getAddress: async () => DEMO_ADDRESS,
    getBalance: async () => 500000000000000000n, // 0.5 ETH
    getTokenBalance: async () => 50_000_000n, // 50 USDT0
    signMessage: async (message: string) => {
      console.log(`  [Mock] Signing message (${message.length} chars)`)
      return '0x' + 'ab'.repeat(65)
    },
    signTypedData: async (params) => {
      console.log(`  [Mock] Signing typed data: ${params.primaryType}`)
      // Return a 65-byte mock signature (v, r, s)
      return '0x' + 'cd'.repeat(32) + 'ef'.repeat(32) + '1b'
    },
    sendTransaction: async () => '0x' + 'ff'.repeat(32),
  }
}

function createMockWDKInstance(): WDKInstance {
  const account = createMockAccount()
  const instance: WDKInstance = {
    registerWallet: () => instance,
    registerProtocol: () => instance,
    getAccount: async () => account,
    executeProtocol: async () => ({ txHash: '0x' + 'aa'.repeat(32) }),
  }
  return instance
}

// ============================================================
// Main Example
// ============================================================

async function main() {
  console.log('=== WDK + Up-To Payment Example (Usage-Based Billing) ===\n')

  // Step 1: Set up WDK wallet
  console.log('Step 1: Initialize WDK wallet')
  const mockWDK = createMockWDKInstance()
  const account = await mockWDK.getAccount(DEMO_CHAIN, 0)
  const address = await account.getAddress()
  console.log(`  Wallet address: ${address}`)
  console.log(`  Chain: ${DEMO_CHAIN} (${DEMO_NETWORK})\n`)

  // Step 2: Check balance
  console.log('Step 2: Check USDT0 balance')
  const balance = await account.getTokenBalance(USDT0_ADDRESS)
  console.log(`  USDT0 balance: ${Number(balance) / 1e6} USDT0\n`)

  // Step 3: Receive 402 with Up-To requirements
  console.log('Step 3: Receive Up-To payment requirements (from 402 response)')

  // Server sends these requirements - note the maxAmount field
  const paymentRequirements = {
    scheme: 'upto' as const,
    network: DEMO_NETWORK,
    asset: USDT0_ADDRESS,
    amount: '0', // Minimum amount (usage-based, so starts at 0)
    payTo: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' as Address,
    maxTimeoutSeconds: 3600, // 1 hour session
    extra: {
      // EIP-712 domain parameters required for EIP-2612 permit
      name: 'USD₮0',
      version: '1',
      // Router contract address (optional - if set, permit is to the router)
      routerAddress: undefined,
      // Current permit nonce for this owner from the token contract
      permitNonce: 0,
    },
  }

  // The maxAmount is the upper bound the client authorizes
  const maxAmount = '10000000' // 10 USDT0

  console.log(`  Scheme: ${paymentRequirements.scheme}`)
  console.log(`  Max amount authorized: ${Number(maxAmount) / 1e6} USDT0`)
  console.log(`  Session timeout: ${paymentRequirements.maxTimeoutSeconds}s`)
  console.log(`  Pay to: ${paymentRequirements.payTo}\n`)

  // Step 4: Sign EIP-2612 permit for maxAmount
  console.log('Step 4: Sign EIP-2612 permit for maxAmount')

  const now = Math.floor(Date.now() / 1000)
  const deadline = now + paymentRequirements.maxTimeoutSeconds
  const spender = paymentRequirements.payTo // or extra.routerAddress if set
  const chainId = parseInt(DEMO_NETWORK.split(':')[1])
  const permitNonce = paymentRequirements.extra.permitNonce ?? 0

  console.log(`  Deadline: ${new Date(deadline * 1000).toISOString()}`)
  console.log(`  Permit nonce: ${permitNonce}`)
  console.log(`  Spender: ${spender}\n`)

  // Sign the EIP-2612 Permit typed data
  const permitTypedData = {
    domain: {
      name: paymentRequirements.extra.name as string,
      version: paymentRequirements.extra.version as string,
      chainId,
      verifyingContract: paymentRequirements.asset,
    },
    types: {
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    primaryType: 'Permit',
    message: {
      owner: address,
      spender,
      value: BigInt(maxAmount),
      nonce: BigInt(permitNonce),
      deadline: BigInt(deadline),
    },
  }

  const signature = await account.signTypedData(permitTypedData)

  // Parse v, r, s from 65-byte signature
  const sigHex = signature.slice(2)
  const r = '0x' + sigHex.slice(0, 64)
  const s = '0x' + sigHex.slice(64, 128)
  let v = parseInt(sigHex.slice(128, 130), 16)
  if (v < 27) v += 27

  console.log(`  v: ${v}`)
  console.log(`  r: ${r.slice(0, 20)}...`)
  console.log(`  s: ${s.slice(0, 20)}...\n`)

  // Step 5: Create unique payment nonce
  console.log('Step 5: Generate payment nonce')
  const paymentNonceBytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(paymentNonceBytes)
  const paymentNonce = Array.from(paymentNonceBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  console.log(`  Payment nonce: ${paymentNonce}\n`)

  // Step 6: Assemble Up-To payment payload
  console.log('Step 6: Assemble Up-To payment payload')

  const paymentPayload = {
    t402Version: 2,
    accepted: {
      ...paymentRequirements,
      maxAmount, // Include the authorized max
    },
    payload: {
      signature: { v, r, s },
      authorization: {
        owner: address,
        spender,
        value: maxAmount,
        deadline: deadline.toString(),
        nonce: permitNonce,
      },
      paymentNonce,
    },
  }

  console.log('  Payment payload assembled successfully')
  console.log(`  Owner: ${address}`)
  console.log(`  Max authorized: ${Number(maxAmount) / 1e6} USDT0`)
  console.log(`  Payment nonce: ${paymentNonce}\n`)

  // Step 7: Simulate usage-based session
  console.log('Step 7: Simulate usage-based session')
  console.log('  --- Client uses the API ---')

  const usageLog = [
    { endpoint: '/api/query', cost: 100000 },    // 0.1 USDT0
    { endpoint: '/api/query', cost: 100000 },    // 0.1 USDT0
    { endpoint: '/api/generate', cost: 500000 }, // 0.5 USDT0
    { endpoint: '/api/query', cost: 100000 },    // 0.1 USDT0
    { endpoint: '/api/generate', cost: 500000 }, // 0.5 USDT0
  ]

  let totalUsage = 0
  for (const usage of usageLog) {
    totalUsage += usage.cost
    console.log(`  ${usage.endpoint}: ${usage.cost / 1e6} USDT0 (running total: ${totalUsage / 1e6})`)
  }

  console.log(`\n  Total usage: ${totalUsage / 1e6} USDT0`)
  console.log(`  Max authorized: ${Number(maxAmount) / 1e6} USDT0`)
  console.log(`  Unused allowance: ${(Number(maxAmount) - totalUsage) / 1e6} USDT0 (not charged)\n`)

  // Step 8: Server settles actual usage
  console.log('Step 8: Server settles actual usage on-chain')
  console.log(`  Settlement amount: ${totalUsage / 1e6} USDT0`)
  console.log('  The server calls token.permit() then token.transferFrom()')
  console.log('  Only the actual usage is transferred, not the full maxAmount')
  console.log('  The remaining permit allowance expires at deadline\n')

  console.log('=== Up-To payment flow complete ===')
  console.log('Key takeaway: Client authorized 10 USDT0, but only 1.3 USDT0 was charged')
}

main().catch(console.error)
