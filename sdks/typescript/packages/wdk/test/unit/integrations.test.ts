/**
 * Unit tests for WDK integration adapters
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { T402WDK } from '../../src/t402wdk'
import { createWdkA2APaymentClient } from '../../src/integrations/a2a-adapter'
import {
  toFacilitatorWdkSigner,
  createFacilitatorSigners,
} from '../../src/integrations/facilitator-adapter'
import { toSIWxSigner, createSIWxSigners } from '../../src/integrations/siwx-adapter'
import type { WDKConstructor, WDKInstance, WDKAccount } from '../../src/types'

const VALID_SEED =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const MOCK_ADDRESS = '0x1234567890123456789012345678901234567890'
const MOCK_SIGNATURE = '0x' + 'ab'.repeat(65)

function createMockAccount(): WDKAccount {
  return {
    getAddress: vi.fn().mockResolvedValue(MOCK_ADDRESS),
    getBalance: vi.fn().mockResolvedValue(1000000000000000000n),
    getTokenBalance: vi.fn().mockResolvedValue(5_000_000n),
    signMessage: vi.fn().mockResolvedValue(MOCK_SIGNATURE),
    signTypedData: vi.fn().mockResolvedValue(MOCK_SIGNATURE),
    sendTransaction: vi.fn().mockResolvedValue('0x' + 'ef'.repeat(32)),
  }
}

function createMockWDKInstance(): WDKInstance {
  const account = createMockAccount()
  const instance: WDKInstance = {
    registerWallet: vi.fn().mockReturnThis(),
    registerProtocol: vi.fn().mockReturnThis(),
    getAccount: vi.fn().mockResolvedValue(account),
    executeProtocol: vi.fn().mockResolvedValue({ txHash: '0xbridge' }),
  }
  return instance
}

const MockWDKConstructor: WDKConstructor = class MockWDK {
  constructor() {
    return createMockWDKInstance() as unknown as WDKInstance
  }
  static getRandomSeedPhrase(): string {
    return VALID_SEED
  }
} as unknown as WDKConstructor

function setupWDK() {
  // @ts-expect-error - accessing private static for testing
  T402WDK._WDK = null
  // @ts-expect-error - accessing private static for testing
  T402WDK._WalletManagerEvm = null
  // @ts-expect-error - accessing private static for testing
  T402WDK._BridgeUsdt0Evm = null
  // @ts-expect-error - accessing private static for testing
  T402WDK._WalletModules = {}
  // @ts-expect-error - accessing private static for testing
  T402WDK._ProtocolModules = {}

  T402WDK.registerWDK(MockWDKConstructor, {})

  return new T402WDK(VALID_SEED, {
    arbitrum: 'https://arb1.arbitrum.io/rpc',
    base: 'https://mainnet.base.org',
  })
}

// ============================================================
// A2A Adapter Tests
// ============================================================

describe('A2A Adapter', () => {
  let wdk: T402WDK

  beforeEach(() => {
    wdk = setupWDK()
  })

  it('should create A2A payment client with signers', async () => {
    const { signers, paymentHandler } = await createWdkA2APaymentClient(wdk)

    expect(signers.length).toBeGreaterThan(0)
    expect(typeof paymentHandler).toBe('function')
  })

  it('should handle payment with matching signer', async () => {
    const { paymentHandler } = await createWdkA2APaymentClient(wdk)

    const paymentRequired = {
      t402Version: 2,
      resource: { url: 'https://api.example.com/data' },
      accepts: [
        {
          scheme: 'exact',
          network: 'eip155:42161', // arbitrum
          asset: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
          amount: '1000000',
          payTo: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
          maxTimeoutSeconds: 300,
          extra: {},
        },
      ],
    }

    const payload = await paymentHandler(paymentRequired)

    expect(payload.t402Version).toBe(2)
    expect(payload.accepted.network).toBe('eip155:42161')
    expect(payload.payload.signature).toBeDefined()
    expect(payload.payload.from).toBe(MOCK_ADDRESS)
  })

  it('should respect spending limit', async () => {
    const { paymentHandler } = await createWdkA2APaymentClient(wdk, {
      spendingLimit: 500_000n, // 0.5 USDT0
    })

    const paymentRequired = {
      t402Version: 2,
      resource: { url: 'https://api.example.com/data' },
      accepts: [
        {
          scheme: 'exact',
          network: 'eip155:42161',
          asset: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
          amount: '1000000', // 1 USDT0 - exceeds limit
          payTo: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
          maxTimeoutSeconds: 300,
          extra: {},
        },
      ],
    }

    await expect(paymentHandler(paymentRequired)).rejects.toThrow('exceeds spending limit')
  })

  it('should call approval callback', async () => {
    const onApprovalRequired = vi.fn().mockResolvedValue(true)

    const { paymentHandler } = await createWdkA2APaymentClient(wdk, {
      onApprovalRequired,
    })

    const paymentRequired = {
      t402Version: 2,
      resource: { url: 'https://api.example.com/data' },
      accepts: [
        {
          scheme: 'exact',
          network: 'eip155:42161',
          asset: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
          amount: '1000000',
          payTo: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
          maxTimeoutSeconds: 300,
          extra: {},
        },
      ],
    }

    await paymentHandler(paymentRequired)

    expect(onApprovalRequired).toHaveBeenCalledWith({
      amount: 1_000_000n,
      network: 'eip155:42161',
    })
  })

  it('should reject when approval callback returns false', async () => {
    const { paymentHandler } = await createWdkA2APaymentClient(wdk, {
      onApprovalRequired: async () => false,
    })

    const paymentRequired = {
      t402Version: 2,
      resource: { url: 'https://api.example.com/data' },
      accepts: [
        {
          scheme: 'exact',
          network: 'eip155:42161',
          asset: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
          amount: '1000000',
          payTo: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
          maxTimeoutSeconds: 300,
          extra: {},
        },
      ],
    }

    await expect(paymentHandler(paymentRequired)).rejects.toThrow('rejected by approval')
  })

  it('should throw when no accepts in requirements', async () => {
    const { paymentHandler } = await createWdkA2APaymentClient(wdk)

    await expect(
      paymentHandler({
        t402Version: 2,
        resource: { url: 'https://example.com' },
        accepts: [],
      }),
    ).rejects.toThrow('No payment options')
  })
})

// ============================================================
// Facilitator Adapter Tests
// ============================================================

describe('Facilitator Adapter', () => {
  let wdk: T402WDK

  beforeEach(() => {
    wdk = setupWDK()
  })

  it('should create facilitator signer for a chain', async () => {
    const signer = await toFacilitatorWdkSigner(wdk, 'arbitrum')

    expect(signer.address).toBe(MOCK_ADDRESS)
    expect(typeof signer.signTransaction).toBe('function')
    expect(typeof signer.signTypedData).toBe('function')
    expect(typeof signer.sendTransaction).toBe('function')
  })

  it('should sign typed data via facilitator signer', async () => {
    const signer = await toFacilitatorWdkSigner(wdk, 'arbitrum')

    const sig = await signer.signTypedData({
      domain: { name: 'Test', version: '1' },
      types: { Test: [{ name: 'v', type: 'uint256' }] },
      primaryType: 'Test',
      message: { v: '1' },
    })

    expect(sig).toBe(MOCK_SIGNATURE)
  })

  it('should sign EIP-712 transaction via signTransaction', async () => {
    const signer = await toFacilitatorWdkSigner(wdk, 'arbitrum')

    const sig = await signer.signTransaction({
      domain: { name: 'Test', version: '1' },
      types: { Test: [{ name: 'v', type: 'uint256' }] },
      primaryType: 'Test',
      message: { v: '1' },
    })

    expect(sig).toBe(MOCK_SIGNATURE)
  })

  it('should sign string message via signTransaction', async () => {
    const signer = await toFacilitatorWdkSigner(wdk, 'arbitrum')

    const sig = await signer.signTransaction('hello world')
    expect(sig).toBe(MOCK_SIGNATURE)
  })

  it('should send transaction via facilitator signer', async () => {
    const signer = await toFacilitatorWdkSigner(wdk, 'arbitrum')

    const hash = await signer.sendTransaction({
      to: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      value: 0n,
    })

    expect(hash).toBe('0x' + 'ef'.repeat(32))
  })

  it('should create signers for all chains', async () => {
    const signers = await createFacilitatorSigners(wdk)

    expect(signers.size).toBe(2) // arbitrum + base
    expect(signers.has('arbitrum')).toBe(true)
    expect(signers.has('base')).toBe(true)

    const arbSigner = signers.get('arbitrum')!
    expect(arbSigner.address).toBe(MOCK_ADDRESS)
  })

  it('should reject unsupported transaction format', async () => {
    const signer = await toFacilitatorWdkSigner(wdk, 'arbitrum')

    await expect(signer.signTransaction(12345)).rejects.toThrow('Unsupported transaction format')
  })
})

// ============================================================
// SIWx Adapter Tests
// ============================================================

describe('SIWx Adapter', () => {
  let wdk: T402WDK

  beforeEach(() => {
    wdk = setupWDK()
  })

  it('should create SIWx signer for a chain', async () => {
    const signer = await toSIWxSigner(wdk, 'arbitrum')

    expect(signer.address).toBe(MOCK_ADDRESS)
    expect(typeof signer.signMessage).toBe('function')
    expect(typeof signer.signTypedData).toBe('function')
  })

  it('should sign a personal message', async () => {
    const signer = await toSIWxSigner(wdk, 'arbitrum')

    const sig = await signer.signMessage('Sign in to example.com')
    expect(sig).toBe(MOCK_SIGNATURE)
  })

  it('should sign typed data for EIP-712', async () => {
    const signer = await toSIWxSigner(wdk, 'arbitrum')

    const sig = await signer.signTypedData({
      domain: { name: 'example.com', version: '1', chainId: 42161 },
      types: {
        SIWx: [
          { name: 'domain', type: 'string' },
          { name: 'address', type: 'address' },
        ],
      },
      primaryType: 'SIWx',
      message: { domain: 'example.com', address: MOCK_ADDRESS },
    })

    expect(sig).toBe(MOCK_SIGNATURE)
  })

  it('should create SIWx signers for all chains', async () => {
    const signers = await createSIWxSigners(wdk)

    expect(signers.size).toBe(2) // arbitrum + base
    expect(signers.has('arbitrum')).toBe(true)
    expect(signers.has('base')).toBe(true)

    const arbSigner = signers.get('arbitrum')!
    expect(arbSigner.address).toBe(MOCK_ADDRESS)
  })
})
