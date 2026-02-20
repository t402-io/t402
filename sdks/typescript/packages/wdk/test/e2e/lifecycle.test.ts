/**
 * E2E Lifecycle Test
 *
 * Tests the full WDK lifecycle: Create -> Use -> Dispose -> Verify cleanup.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { T402WDK } from '../../src/t402wdk'
import type { WDKConstructor, WDKInstance, WDKAccount } from '../../src/types'

const VALID_SEED =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const MOCK_ADDRESS = '0x1234567890123456789012345678901234567890'

function createMockAccount(): WDKAccount {
  return {
    getAddress: vi.fn().mockResolvedValue(MOCK_ADDRESS),
    getBalance: vi.fn().mockResolvedValue(1000000000000000000n),
    getTokenBalance: vi.fn().mockResolvedValue(5_000_000n),
    signMessage: vi.fn().mockResolvedValue('0x' + 'ab'.repeat(65)),
    signTypedData: vi.fn().mockResolvedValue('0x' + 'cd'.repeat(65)),
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

describe('E2E: Lifecycle', () => {
  beforeEach(() => {
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
  })

  it('should create, use, and dispose WDK instance', async () => {
    T402WDK.registerWDK(MockWDKConstructor, {})

    // Create
    const wdk = new T402WDK(VALID_SEED, {
      arbitrum: 'https://arb1.arbitrum.io/rpc',
      base: 'https://mainnet.base.org',
    })
    expect(wdk.isInitialized).toBe(true)
    expect(wdk.getConfiguredChains()).toContain('arbitrum')
    expect(wdk.getConfiguredChains()).toContain('base')

    // Use - create signers
    const arbSigner = await wdk.getSigner('arbitrum')
    expect(arbSigner.address).toBe(MOCK_ADDRESS)

    const baseSigner = await wdk.getSigner('base')
    expect(baseSigner.address).toBe(MOCK_ADDRESS)

    // Use - sign a payment
    const sig = await arbSigner.signTypedData({
      domain: {
        name: 'Test',
        version: '1',
        chainId: 42161,
        verifyingContract: '0x' + '00'.repeat(20),
      },
      types: { Test: [{ name: 'v', type: 'uint256' }] },
      primaryType: 'Test',
      message: { v: 1n },
    })
    expect(sig).toBeDefined()

    // Dispose
    wdk.dispose()
    expect(wdk.isDisposed).toBe(true)

    // After dispose, all public methods should throw
    await expect(wdk.getSigner('arbitrum')).rejects.toThrow('T402WDK has been disposed')
  })

  it('should clear signer cache independently of dispose', async () => {
    T402WDK.registerWDK(MockWDKConstructor, {})

    const wdk = new T402WDK(VALID_SEED, {
      arbitrum: 'https://arb1.arbitrum.io/rpc',
    })

    // Create and cache a signer
    const signer1 = await wdk.getSigner('arbitrum')

    // Clear cache
    wdk.clearSignerCache()

    // Get signer again - should be a new instance
    const signer2 = await wdk.getSigner('arbitrum')
    expect(signer2).not.toBe(signer1)
    expect(signer2.address).toBe(MOCK_ADDRESS)
  })

  it('should invalidate balance cache', async () => {
    T402WDK.registerWDK(MockWDKConstructor, {})

    const wdk = new T402WDK(VALID_SEED, {
      arbitrum: 'https://arb1.arbitrum.io/rpc',
    })

    // Fetch balance (populates cache)
    const balance1 = await wdk.getUsdt0Balance('arbitrum')
    expect(balance1).toBeGreaterThanOrEqual(0n)

    // Invalidate cache
    wdk.invalidateBalanceCache()
    expect(wdk.getCacheStats().balanceCache.validSize).toBe(0)

    // Fetch again (should go to RPC/mock)
    const balance2 = await wdk.getUsdt0Balance('arbitrum')
    expect(balance2).toBeGreaterThanOrEqual(0n)
  })

  it('should handle events throughout lifecycle', async () => {
    T402WDK.registerWDK(MockWDKConstructor, {})

    const wdk = new T402WDK(VALID_SEED, {
      arbitrum: 'https://arb1.arbitrum.io/rpc',
    })

    const signerEvents: Array<{ chain: string; address: string }> = []
    wdk.on('signer:initialized', (data) => {
      signerEvents.push({ chain: data.chain, address: data.address })
    })

    // Create signers (should emit events)
    await wdk.getSigner('arbitrum')
    expect(signerEvents.length).toBe(1)
    expect(signerEvents[0].chain).toBe('arbitrum')
    expect(signerEvents[0].address).toBe(MOCK_ADDRESS)

    // Getting cached signer should NOT emit again
    await wdk.getSigner('arbitrum')
    expect(signerEvents.length).toBe(1) // Still 1

    // Clear cache and get again
    wdk.clearSignerCache()
    await wdk.getSigner('arbitrum')
    expect(signerEvents.length).toBe(2) // Now 2

    // Dispose clears everything
    wdk.dispose()
  })

  it('should support fromWDK factory method', () => {
    const mockInstance = createMockWDKInstance()

    const wdk = T402WDK.fromWDK(mockInstance, {
      arbitrum: 'https://arb1.arbitrum.io/rpc',
    })

    expect(wdk.isInitialized).toBe(true)
    expect(wdk.getConfiguredChains()).toContain('arbitrum')
  })

  it('should manage receipt store', async () => {
    T402WDK.registerWDK(MockWDKConstructor, {})

    const wdk = new T402WDK(VALID_SEED, {
      arbitrum: 'https://arb1.arbitrum.io/rpc',
    })

    const receiptStore = wdk.getReceiptStore()
    expect(receiptStore).toBeDefined()

    // Store a receipt
    await receiptStore.save({
      id: 'test-receipt-1',
      timestamp: new Date().toISOString(),
      url: 'https://api.example.com/data',
      network: 'eip155:42161',
      scheme: 'exact',
      amount: '1000000',
      payTo: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      success: true,
      txHash: '0x' + 'aa'.repeat(32),
      chainFamily: 'evm',
    })

    // Retrieve receipt
    const receipt = await receiptStore.getById('test-receipt-1')
    expect(receipt).toBeDefined()
    expect(receipt?.network).toBe('eip155:42161')

    // Cleanup
    wdk.dispose()
  })
})
