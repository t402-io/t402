/**
 * E2E Payment Flow Test
 *
 * Tests the full WDK payment flow:
 * WDK creates signer -> receives 402 -> signs payment -> gets content
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { T402WDK } from '../../src/t402wdk'
import type { WDKConstructor, WDKInstance, WDKAccount } from '../../src/types'

const MOCK_ADDRESS = '0x1234567890123456789012345678901234567890'
const MOCK_SIGNATURE = '0x' + 'ab'.repeat(65)
const VALID_SEED =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

function createMockAccount(address: string = MOCK_ADDRESS): WDKAccount {
  return {
    getAddress: vi.fn().mockResolvedValue(address),
    getBalance: vi.fn().mockResolvedValue(1000000000000000000n),
    getTokenBalance: vi.fn().mockResolvedValue(5_000_000n), // 5 USDT0
    signMessage: vi.fn().mockResolvedValue(MOCK_SIGNATURE),
    signTypedData: vi.fn().mockResolvedValue(MOCK_SIGNATURE),
    sendTransaction: vi.fn().mockResolvedValue('0x' + 'ff'.repeat(32)),
  }
}

function createMockWDKInstance(account?: WDKAccount): WDKInstance {
  const mockAccount = account ?? createMockAccount()
  const instance: WDKInstance = {
    registerWallet: vi.fn().mockReturnThis(),
    registerProtocol: vi.fn().mockReturnThis(),
    getAccount: vi.fn().mockResolvedValue(mockAccount),
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

describe('E2E: Payment Flow', () => {
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

  it('should complete full payment flow: signer -> sign -> payload', async () => {
    // Register WDK
    T402WDK.registerWDK(MockWDKConstructor, {})

    // Create wallet
    const wdk = new T402WDK(VALID_SEED, {
      arbitrum: 'https://arb1.arbitrum.io/rpc',
    })

    // Get signer
    const signer = await wdk.getSigner('arbitrum')
    expect(signer.address).toBe(MOCK_ADDRESS)

    // Simulate 402 payment requirements
    const paymentRequirements = {
      scheme: 'exact',
      network: 'eip155:42161',
      asset: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      amount: '1000000',
      payTo: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      maxTimeoutSeconds: 300,
      extra: {},
    }

    // Sign payment (EIP-3009 transferWithAuthorization)
    const signature = await signer.signTypedData({
      domain: {
        name: 'USD₮0',
        version: '1',
        chainId: 42161,
        verifyingContract: paymentRequirements.asset,
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
        from: signer.address,
        to: paymentRequirements.payTo,
        value: BigInt(paymentRequirements.amount),
        validAfter: 0n,
        validBefore: BigInt(Math.floor(Date.now() / 1000) + 300),
        nonce: '0x' + '00'.repeat(32),
      },
    })

    expect(signature).toBe(MOCK_SIGNATURE)

    // Assemble full payment payload
    const paymentPayload = {
      t402Version: 2,
      accepted: paymentRequirements,
      payload: {
        signature,
        from: signer.address,
        validAfter: '0',
        validBefore: String(Math.floor(Date.now() / 1000) + 300),
        nonce: '0x' + '00'.repeat(32),
      },
    }

    expect(paymentPayload.t402Version).toBe(2)
    expect(paymentPayload.payload.signature).toBe(MOCK_SIGNATURE)
    expect(paymentPayload.payload.from).toBe(MOCK_ADDRESS)
  })

  it('should get all signers for multi-scheme use', async () => {
    T402WDK.registerWDK(MockWDKConstructor, {})

    const wdk = new T402WDK(VALID_SEED, {
      arbitrum: 'https://arb1.arbitrum.io/rpc',
      base: 'https://mainnet.base.org',
    })

    const signers = await wdk.getAllSigners({ schemes: ['exact', 'permit2'] })

    // Should have entries for both chains and both schemes
    expect(signers.length).toBeGreaterThanOrEqual(2)
    expect(signers.some((s) => s.network === 'eip155:42161')).toBe(true)
    expect(signers.some((s) => s.network === 'eip155:8453')).toBe(true)
  })

  it('should handle multiple sequential payments', async () => {
    T402WDK.registerWDK(MockWDKConstructor, {})

    const wdk = new T402WDK(VALID_SEED, {
      arbitrum: 'https://arb1.arbitrum.io/rpc',
    })

    const signer = await wdk.getSigner('arbitrum')

    // Make multiple payments
    for (let i = 0; i < 3; i++) {
      const sig = await signer.signTypedData({
        domain: {
          name: 'Test',
          version: '1',
          chainId: 42161,
          verifyingContract: '0x' + '00'.repeat(20),
        },
        types: { Test: [{ name: 'value', type: 'uint256' }] },
        primaryType: 'Test',
        message: { value: BigInt(i + 1) * 1000000n },
      })
      expect(sig).toBe(MOCK_SIGNATURE)
    }

    // Signer should be cached (same instance returned)
    const sameSigner = await wdk.getSigner('arbitrum')
    expect(sameSigner).toBe(signer)
  })

  it('should select best chain based on balance', async () => {
    // Create accounts with different balances
    const richAccount = createMockAccount()
    ;(richAccount.getTokenBalance as ReturnType<typeof vi.fn>).mockResolvedValue(100_000_000n) // 100 USDT0

    const mockInstance = createMockWDKInstance(richAccount)

    const RichWDKConstructor: WDKConstructor = class RichWDK {
      constructor() {
        return mockInstance as unknown as WDKInstance
      }
      static getRandomSeedPhrase(): string {
        return VALID_SEED
      }
    } as unknown as WDKConstructor

    T402WDK.registerWDK(RichWDKConstructor, {})

    const wdk = new T402WDK(VALID_SEED, {
      arbitrum: 'https://arb1.arbitrum.io/rpc',
    })

    const best = await wdk.findBestChainForPayment(50_000_000n) // 50 USDT0
    expect(best).not.toBeNull()
    expect(best?.chain).toBe('arbitrum')
  })
})
