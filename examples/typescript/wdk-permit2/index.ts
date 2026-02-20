/**
 * WDK + Permit2 Payment Example
 *
 * Demonstrates how to use a T402 WDK signer with the Permit2 EVM scheme
 * for gasless token approvals using Uniswap Permit2 SignatureTransfer.
 *
 * Flow:
 * 1. Create WDK wallet from seed phrase
 * 2. Get an EVM signer for the target chain
 * 3. Create a Permit2EvmScheme with the WDK signer
 * 4. Sign a Permit2 payment payload
 *
 * Prerequisites:
 * - USDT0 tokens on the target chain
 * - Native tokens for gas fees (on the server/facilitator side)
 *
 * Run with: npx tsx index.ts
 */

import type { Address } from 'viem'
import type { WDKAccount, WDKInstance } from '@t402/wdk'

// ============================================================
// Mock WDK for demo purposes
// In production, replace with actual @tetherto/wdk imports
// ============================================================

const DEMO_ADDRESS = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Address
const DEMO_CHAIN = 'arbitrum'
const DEMO_NETWORK = 'eip155:42161'
const USDT0_ADDRESS = '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9' as Address

function createMockAccount(): WDKAccount {
  return {
    getAddress: async () => DEMO_ADDRESS,
    getBalance: async () => 1000000000000000000n, // 1 ETH
    getTokenBalance: async () => 10_000_000n, // 10 USDT0
    signMessage: async (message: string) => {
      console.log(`  [Mock] Signing message (${message.length} chars)`)
      return '0x' + 'ab'.repeat(65)
    },
    signTypedData: async (params) => {
      console.log(`  [Mock] Signing typed data: ${params.primaryType}`)
      return '0x' + 'cd'.repeat(65)
    },
    sendTransaction: async () => '0x' + 'ef'.repeat(32),
  }
}

function createMockWDKInstance(): WDKInstance {
  const account = createMockAccount()
  const instance: WDKInstance = {
    registerWallet: () => instance,
    registerProtocol: () => instance,
    getAccount: async () => account,
    executeProtocol: async () => ({ txHash: '0x' + 'ff'.repeat(32) }),
  }
  return instance
}

// ============================================================
// Main Example
// ============================================================

async function main() {
  console.log('=== WDK + Permit2 Payment Example ===\n')

  // Step 1: Set up WDK (using mock for demo)
  console.log('Step 1: Initialize WDK wallet')
  const mockWDK = createMockWDKInstance()
  const account = await mockWDK.getAccount(DEMO_CHAIN, 0)
  const address = await account.getAddress()
  console.log(`  Wallet address: ${address}`)
  console.log(`  Chain: ${DEMO_CHAIN} (${DEMO_NETWORK})\n`)

  // Step 2: Check USDT0 balance
  console.log('Step 2: Check USDT0 balance')
  const balance = await account.getTokenBalance(USDT0_ADDRESS)
  console.log(`  USDT0 balance: ${Number(balance) / 1e6} USDT0\n`)

  // Step 3: Create Permit2 payment parameters
  console.log('Step 3: Prepare Permit2 payment')

  // Simulate payment requirements from a 402 response
  const paymentRequirements = {
    scheme: 'permit2' as const,
    network: DEMO_NETWORK,
    asset: USDT0_ADDRESS,
    amount: '1000000', // 1 USDT0
    payTo: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' as Address,
    maxTimeoutSeconds: 300,
    extra: {},
  }

  console.log(`  Payment amount: ${Number(paymentRequirements.amount) / 1e6} USDT0`)
  console.log(`  Pay to: ${paymentRequirements.payTo}`)
  console.log(`  Timeout: ${paymentRequirements.maxTimeoutSeconds}s\n`)

  // Step 4: Generate nonce and deadline
  console.log('Step 4: Generate Permit2 parameters')
  const now = Math.floor(Date.now() / 1000)
  const deadline = now + paymentRequirements.maxTimeoutSeconds

  // Permit2 uses random nonces (not sequential like EIP-2612)
  const nonceBytes = new Uint8Array(32)
  globalThis.crypto.getRandomValues(nonceBytes)
  const nonce = BigInt(
    '0x' + Array.from(nonceBytes).map(b => b.toString(16).padStart(2, '0')).join('')
  )

  console.log(`  Deadline: ${new Date(deadline * 1000).toISOString()}`)
  console.log(`  Nonce: ${nonce.toString().slice(0, 20)}...\n`)

  // Step 5: Sign the Permit2 typed data
  console.log('Step 5: Sign Permit2 authorization')

  const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3' as Address
  const chainId = parseInt(DEMO_NETWORK.split(':')[1])

  const permit2TypedData = {
    domain: {
      name: 'Permit2',
      chainId,
      verifyingContract: PERMIT2_ADDRESS,
    },
    types: {
      PermitTransferFrom: [
        { name: 'permitted', type: 'TokenPermissions' },
        { name: 'spender', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
      TokenPermissions: [
        { name: 'token', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
    },
    primaryType: 'PermitTransferFrom',
    message: {
      permitted: {
        token: paymentRequirements.asset,
        amount: BigInt(paymentRequirements.amount),
      },
      spender: paymentRequirements.payTo,
      nonce,
      deadline: BigInt(deadline),
    },
  }

  const signature = await account.signTypedData(permit2TypedData)
  console.log(`  Signature: ${signature.slice(0, 20)}...\n`)

  // Step 6: Assemble payment payload
  console.log('Step 6: Assemble payment payload')

  const paymentPayload = {
    t402Version: 2,
    accepted: paymentRequirements,
    payload: {
      permit: {
        permitted: {
          token: paymentRequirements.asset,
          amount: paymentRequirements.amount,
        },
        nonce: nonce.toString(),
        deadline: deadline.toString(),
      },
      transferDetails: {
        to: paymentRequirements.payTo,
        requestedAmount: paymentRequirements.amount,
      },
      signature,
      owner: address,
    },
  }

  console.log('  Payment payload assembled successfully')
  console.log(`  Owner: ${paymentPayload.payload.owner}`)
  console.log(`  Permit2 contract: ${PERMIT2_ADDRESS}`)
  console.log(`  Token: ${paymentRequirements.asset}`)
  console.log(`  Amount: ${paymentRequirements.amount}\n`)

  console.log('=== Permit2 payment ready for submission ===')
  console.log('In production, this payload would be sent as X-PAYMENT header')
  console.log('The facilitator will call Permit2.permitTransferFrom() on-chain')
}

main().catch(console.error)
