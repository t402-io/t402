/**
 * E2E Bridge + Payment Flow Test
 *
 * Tests the combined flow: mock bridge + payment. Verifies that
 * WDK can bridge tokens across chains then make a payment.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { T402WDK } from '../../src/t402wdk'
import { BridgeError } from '../../src/errors'
import type { WDKConstructor, WDKInstance, WDKAccount } from '../../src/types'

const VALID_SEED =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const MOCK_ADDRESS = '0x1234567890123456789012345678901234567890'
const MOCK_SIGNATURE = '0x' + 'ab'.repeat(65)
const MOCK_BRIDGE_TX = '0x' + 'bb'.repeat(32)

function createMockAccount(tokenBalance: bigint = 5_000_000n): WDKAccount {
  return {
    getAddress: vi.fn().mockResolvedValue(MOCK_ADDRESS),
    getBalance: vi.fn().mockResolvedValue(1000000000000000000n),
    getTokenBalance: vi.fn().mockResolvedValue(tokenBalance),
    signMessage: vi.fn().mockResolvedValue(MOCK_SIGNATURE),
    signTypedData: vi.fn().mockResolvedValue(MOCK_SIGNATURE),
    sendTransaction: vi.fn().mockResolvedValue('0x' + 'ef'.repeat(32)),
  }
}

function createMockWDKInstance(account?: WDKAccount): WDKInstance {
  const mockAccount = account ?? createMockAccount()
  const instance: WDKInstance = {
    registerWallet: vi.fn().mockReturnThis(),
    registerProtocol: vi.fn().mockReturnThis(),
    getAccount: vi.fn().mockResolvedValue(mockAccount),
    executeProtocol: vi.fn().mockResolvedValue({ txHash: MOCK_BRIDGE_TX }),
  }
  return instance
}

describe('E2E: Bridge + Payment Flow', () => {
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

  it('should bridge tokens from one chain then sign payment on destination', async () => {
    const mockInstance = createMockWDKInstance()

    const MockWDK: WDKConstructor = class {
      constructor() {
        return mockInstance as unknown as WDKInstance
      }
      static getRandomSeedPhrase(): string {
        return VALID_SEED
      }
    } as unknown as WDKConstructor

    T402WDK.registerWDK(MockWDK, {}, {}) // Register with bridge protocol

    const wdk = new T402WDK(VALID_SEED, {
      arbitrum: 'https://arb1.arbitrum.io/rpc',
      ethereum: 'https://eth.llamarpc.com',
    })

    // Step 1: Bridge USDT0 from Arbitrum to Ethereum
    const bridgeResult = await wdk.bridgeUsdt0({
      fromChain: 'arbitrum',
      toChain: 'ethereum',
      amount: 2_000_000n, // 2 USDT0
    })

    expect(bridgeResult.txHash).toBe(MOCK_BRIDGE_TX)
    expect(bridgeResult.estimatedTime).toBeGreaterThan(0)

    // Verify executeProtocol was called with bridge params
    expect(mockInstance.executeProtocol).toHaveBeenCalledWith(
      'bridge-usdt0',
      expect.objectContaining({
        fromChain: 'arbitrum',
        toChain: 'ethereum',
        amount: 2_000_000n,
      }),
    )

    // Step 2: Sign payment on Ethereum
    const ethSigner = await wdk.getSigner('ethereum')
    const sig = await ethSigner.signTypedData({
      domain: {
        name: 'USD₮0',
        version: '1',
        chainId: 1,
        verifyingContract: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      },
      types: {
        TransferWithAuthorization: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'validAfter', type: 'uint256' },
          { name: 'validBefore', type: 'uint256' },
          { name: 'nonce', type: 'bytes32' },
        ],
      },
      primaryType: 'TransferWithAuthorization',
      message: {
        from: ethSigner.address,
        to: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        value: 2_000_000n,
        validAfter: 0n,
        validBefore: BigInt(Math.floor(Date.now() / 1000) + 300),
        nonce: '0x' + '00'.repeat(32),
      },
    })

    expect(sig).toBe(MOCK_SIGNATURE)
  })

  it('should reject bridge to same chain', async () => {
    const MockWDK: WDKConstructor = class {
      constructor() {
        return createMockWDKInstance() as unknown as WDKInstance
      }
      static getRandomSeedPhrase(): string {
        return VALID_SEED
      }
    } as unknown as WDKConstructor

    T402WDK.registerWDK(MockWDK, {}, {})

    const wdk = new T402WDK(VALID_SEED, {
      arbitrum: 'https://arb1.arbitrum.io/rpc',
    })

    await expect(
      wdk.bridgeUsdt0({
        fromChain: 'arbitrum',
        toChain: 'arbitrum',
        amount: 1_000_000n,
      }),
    ).rejects.toThrow(BridgeError)
  })

  it('should reject bridge with zero amount', async () => {
    const MockWDK: WDKConstructor = class {
      constructor() {
        return createMockWDKInstance() as unknown as WDKInstance
      }
      static getRandomSeedPhrase(): string {
        return VALID_SEED
      }
    } as unknown as WDKConstructor

    T402WDK.registerWDK(MockWDK, {}, {})

    const wdk = new T402WDK(VALID_SEED, {
      arbitrum: 'https://arb1.arbitrum.io/rpc',
      ethereum: 'https://eth.llamarpc.com',
    })

    await expect(
      wdk.bridgeUsdt0({
        fromChain: 'arbitrum',
        toChain: 'ethereum',
        amount: 0n,
      }),
    ).rejects.toThrow(BridgeError)
  })

  it('should emit bridge events', async () => {
    const mockInstance = createMockWDKInstance()

    const MockWDK: WDKConstructor = class {
      constructor() {
        return mockInstance as unknown as WDKInstance
      }
      static getRandomSeedPhrase(): string {
        return VALID_SEED
      }
    } as unknown as WDKConstructor

    T402WDK.registerWDK(MockWDK, {}, {})

    const wdk = new T402WDK(VALID_SEED, {
      arbitrum: 'https://arb1.arbitrum.io/rpc',
      ethereum: 'https://eth.llamarpc.com',
    })

    const events: string[] = []

    wdk.on('bridge:start', () => events.push('start'))
    wdk.on('bridge:confirmed', () => events.push('confirmed'))

    await wdk.bridgeUsdt0({
      fromChain: 'arbitrum',
      toChain: 'ethereum',
      amount: 1_000_000n,
    })

    expect(events).toContain('start')
    expect(events).toContain('confirmed')
  })

  it('should find best chain for payment considering bridge', async () => {
    // Create two accounts - one with high balance, one with low
    const richAccount = createMockAccount(100_000_000n) // 100 USDT0

    const mockInstance = createMockWDKInstance(richAccount)

    const MockWDK: WDKConstructor = class {
      constructor() {
        return mockInstance as unknown as WDKInstance
      }
      static getRandomSeedPhrase(): string {
        return VALID_SEED
      }
    } as unknown as WDKConstructor

    T402WDK.registerWDK(MockWDK, {}, {})

    const wdk = new T402WDK(VALID_SEED, {
      arbitrum: 'https://arb1.arbitrum.io/rpc',
    })

    // Find best chain for 50 USDT0
    const best = await wdk.findBestChainForPayment(50_000_000n)
    expect(best).not.toBeNull()
    expect(best?.chain).toBe('arbitrum')
    expect(best?.balance).toBeGreaterThanOrEqual(50_000_000n)
  })

  it('should check bridgeable chains', () => {
    const MockWDK: WDKConstructor = class {
      constructor() {
        return createMockWDKInstance() as unknown as WDKInstance
      }
      static getRandomSeedPhrase(): string {
        return VALID_SEED
      }
    } as unknown as WDKConstructor

    T402WDK.registerWDK(MockWDK, {})

    const wdk = new T402WDK(VALID_SEED, {
      arbitrum: 'https://arb1.arbitrum.io/rpc',
      ethereum: 'https://eth.llamarpc.com',
    })

    // Check bridgeable chains - both arbitrum and ethereum support bridging
    const bridgeable = wdk.getBridgeableChains()
    expect(Array.isArray(bridgeable)).toBe(true)

    // canBridge should reject same chain
    expect(wdk.canBridge('arbitrum', 'arbitrum')).toBe(false)
  })
})
