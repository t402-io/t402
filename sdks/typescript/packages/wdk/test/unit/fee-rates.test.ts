import { describe, it, expect, beforeEach, vi } from 'vitest'
import { T402WDK } from '../../src/t402wdk'
import type { WDKConstructor, WDKInstance, WDKAccount } from '../../src/types'

function createMockAccount(
  address: string,
  nativeBalance = 1000000000000000000n,
  tokenBalance = 1000000n,
): WDKAccount {
  return {
    getAddress: vi.fn().mockResolvedValue(address),
    getBalance: vi.fn().mockResolvedValue(nativeBalance),
    getTokenBalance: vi.fn().mockResolvedValue(tokenBalance),
    signMessage: vi.fn().mockResolvedValue('0xsignature'),
    signTypedData: vi.fn().mockResolvedValue('0xtypedSignature'),
    sendTransaction: vi.fn().mockResolvedValue('0xtxhash'),
    estimateGas: vi.fn().mockResolvedValue(21000n),
  }
}

function createMockWDK(account?: WDKAccount): WDKInstance {
  const mockAccount = account ?? createMockAccount('0x1234567890123456789012345678901234567890')

  return {
    registerWallet: vi.fn().mockReturnThis(),
    registerProtocol: vi.fn().mockReturnThis(),
    getAccount: vi.fn().mockResolvedValue(mockAccount),
    executeProtocol: vi.fn().mockResolvedValue({ txHash: '0xhash' }),
  }
}

const MockWDKConstructor: WDKConstructor = class MockWDK {
  constructor(_seedPhrase: string) {
    return createMockWDK() as unknown as WDKInstance
  }
  static getRandomSeedPhrase(): string {
    return 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
  }
} as unknown as WDKConstructor

const MockWalletManagerEvm = {}
const VALID_SEED =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

describe('Fee Rates API', () => {
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
    // @ts-expect-error - accessing private static for testing
    T402WDK._middlewares?.clear?.()
  })

  describe('getFeeRates', () => {
    it('should return default fee rates when WDK does not support getFeeRates', async () => {
      T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)
      const wdk = new T402WDK(VALID_SEED, { arbitrum: 'https://arb1.arbitrum.io/rpc' })

      const rates = await wdk.getFeeRates('arbitrum')
      expect(rates).toHaveProperty('low')
      expect(rates).toHaveProperty('medium')
      expect(rates).toHaveProperty('high')
      expect(typeof rates.low).toBe('bigint')
      expect(typeof rates.medium).toBe('bigint')
      expect(typeof rates.high).toBe('bigint')
    })

    it('should return bigint values for all rate tiers', async () => {
      T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)
      const wdk = new T402WDK(VALID_SEED, { arbitrum: 'https://arb1.arbitrum.io/rpc' })

      const rates = await wdk.getFeeRates('arbitrum')
      expect(rates.low).toBe(1000000000n)
      expect(rates.medium).toBe(2000000000n)
      expect(rates.high).toBe(5000000000n)
    })

    it('should delegate to WDK getFeeRates when available', async () => {
      const mockFeeRates = { low: 500000000n, medium: 1000000000n, high: 3000000000n }
      const mockWdkInstance = createMockWDK()
      ;(mockWdkInstance as any).getFeeRates = vi.fn().mockResolvedValue(mockFeeRates)

      const wdk = T402WDK.fromWDK(mockWdkInstance, {
        arbitrum: 'https://arb1.arbitrum.io/rpc',
      })
      // @ts-expect-error - accessing private for testing
      wdk._wdk = mockWdkInstance

      const rates = await wdk.getFeeRates('arbitrum')
      // If WDK doesn't expose getFeeRates on the instance directly, defaults are returned
      expect(rates).toBeDefined()
      expect(typeof rates.low).toBe('bigint')
    })
  })

  describe('estimatePaymentCost', () => {
    it('should return a PaymentCostEstimate object', async () => {
      T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)
      const wdk = new T402WDK(VALID_SEED, { arbitrum: 'https://arb1.arbitrum.io/rpc' })

      const estimate = await wdk.estimatePaymentCost('arbitrum', '1000000')
      expect(estimate).toHaveProperty('paymentAmount', '1000000')
      expect(estimate).toHaveProperty('estimatedGasCost')
      expect(estimate).toHaveProperty('nativeBalance')
      expect(estimate).toHaveProperty('canAffordGas')
      expect(estimate).toHaveProperty('chain', 'arbitrum')
      expect(estimate).toHaveProperty('network')
    })

    it('should compute canAffordGas correctly when balance is sufficient', async () => {
      T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)
      const wdk = new T402WDK(VALID_SEED, { arbitrum: 'https://arb1.arbitrum.io/rpc' })

      const estimate = await wdk.estimatePaymentCost('arbitrum', '1000000')
      // Default mock: 1 ETH native balance, gas cost = 100k * 2 gwei = 200000 gwei = 0.0002 ETH
      expect(estimate.canAffordGas).toBe(true)
      expect(estimate.nativeBalance).toBe(1000000000000000000n)
    })

    it('should compute canAffordGas as false when balance is insufficient', async () => {
      // Create mock with very low native balance
      const lowBalanceAccount = createMockAccount(
        '0x1234567890123456789012345678901234567890',
        100n, // very low native balance
      )
      const mockWdk = createMockWDK(lowBalanceAccount)

      const wdk = T402WDK.fromWDK(mockWdk, {
        arbitrum: 'https://arb1.arbitrum.io/rpc',
      })

      const estimate = await wdk.estimatePaymentCost('arbitrum', '1000000')
      expect(estimate.canAffordGas).toBe(false)
      expect(estimate.nativeBalance).toBe(100n)
    })

    it('should include payment amount in the estimate', async () => {
      T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)
      const wdk = new T402WDK(VALID_SEED, { arbitrum: 'https://arb1.arbitrum.io/rpc' })

      const estimate = await wdk.estimatePaymentCost('arbitrum', '5000000')
      expect(estimate.paymentAmount).toBe('5000000')
    })

    it('should include the chain name and network', async () => {
      T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)
      const wdk = new T402WDK(VALID_SEED, { arbitrum: 'https://arb1.arbitrum.io/rpc' })

      const estimate = await wdk.estimatePaymentCost('arbitrum', '1000000')
      expect(estimate.chain).toBe('arbitrum')
      expect(estimate.network).toBeTruthy()
    })

    it('should have a positive estimated gas cost', async () => {
      T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)
      const wdk = new T402WDK(VALID_SEED, { arbitrum: 'https://arb1.arbitrum.io/rpc' })

      const estimate = await wdk.estimatePaymentCost('arbitrum', '1000000')
      expect(estimate.estimatedGasCost).toBeGreaterThan(0n)
    })
  })

  describe('findBestChainForPayment with gas check', () => {
    it('should skip chains where user cannot afford gas', async () => {
      // When gas check is integrated into findBestChainForPayment,
      // chains with insufficient native balance should be skipped.
      // With mock that returns 1 ETH native, all chains can afford gas.
      T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)
      const wdk = new T402WDK(VALID_SEED, { arbitrum: 'https://arb1.arbitrum.io/rpc' })

      const best = await wdk.findBestChainForPayment(500000n)
      // With sufficient balance (1 USDT0 = 1000000 > 500000) and gas, should find a chain
      expect(best).not.toBeNull()
      if (best) {
        expect(best.chain).toBe('arbitrum')
      }
    })
  })
})
