import { describe, it, expect, vi } from 'vitest'
import { DefiPrePaymentProcessor, createDefiProcessor } from '../../src/processor.js'
import type {
  DefiStrategy,
  DefiStrategyParams,
  DefiStrategyResult,
  DefiEstimate,
} from '../../src/types.js'
import type { PaymentRequirements } from '@t402/core/types'

// Mock strategy factory
function createMockStrategy(
  name: string,
  options: {
    canExecute?: boolean
    outputAmount?: bigint
    fee?: bigint
  } = {},
): DefiStrategy {
  const { canExecute = true, outputAmount = 1000000n, fee = 0n } = options

  return {
    name,
    canExecute: vi.fn().mockResolvedValue(canExecute),
    execute: vi.fn().mockResolvedValue({
      txHashes: ['0xmock123'],
      outputToken: '0xtarget',
      outputAmount,
      fees: fee,
      steps: [
        {
          type: 'swap' as const,
          protocol: 'mock',
          fromToken: '0xfrom',
          toToken: '0xtarget',
          amount: outputAmount,
          txHash: '0xmock123',
        },
      ],
    } satisfies DefiStrategyResult),
    estimate: vi.fn().mockResolvedValue({
      outputAmount,
      totalFees: fee,
      estimatedTime: 30,
      steps: [
        {
          type: 'swap' as const,
          protocol: 'mock',
          fromToken: '0xfrom',
          toToken: '0xtarget',
          amount: outputAmount,
        },
      ],
    } satisfies DefiEstimate),
  }
}

describe('DefiPrePaymentProcessor', () => {
  describe('constructor', () => {
    it('should create processor with default config', () => {
      const processor = new DefiPrePaymentProcessor()
      expect(processor.getStrategyNames()).toEqual([])
    })

    it('should create processor via factory', () => {
      const processor = createDefiProcessor({ defaultChain: 'arbitrum' })
      expect(processor).toBeInstanceOf(DefiPrePaymentProcessor)
    })
  })

  describe('registerStrategy', () => {
    it('should register a strategy', () => {
      const processor = new DefiPrePaymentProcessor()
      const strategy = createMockStrategy('swap')
      processor.registerStrategy(strategy)
      expect(processor.getStrategyNames()).toEqual(['swap'])
    })

    it('should replace strategy with same name', () => {
      const processor = new DefiPrePaymentProcessor()
      const strategy1 = createMockStrategy('swap')
      const strategy2 = createMockStrategy('swap')
      processor.registerStrategy(strategy1)
      processor.registerStrategy(strategy2)
      expect(processor.getStrategyNames()).toEqual(['swap'])
    })

    it('should register multiple strategies', () => {
      const processor = new DefiPrePaymentProcessor()
      processor.registerStrategy(createMockStrategy('swap'))
      processor.registerStrategy(createMockStrategy('borrow'))
      expect(processor.getStrategyNames()).toEqual(['swap', 'borrow'])
    })
  })

  describe('removeStrategy', () => {
    it('should remove a strategy by name', () => {
      const processor = new DefiPrePaymentProcessor()
      processor.registerStrategy(createMockStrategy('swap'))
      processor.registerStrategy(createMockStrategy('borrow'))
      processor.removeStrategy('swap')
      expect(processor.getStrategyNames()).toEqual(['borrow'])
    })

    it('should handle removing non-existent strategy', () => {
      const processor = new DefiPrePaymentProcessor()
      expect(() => processor.removeStrategy('nonexistent')).not.toThrow()
    })
  })

  describe('estimate', () => {
    it('should return best estimate by fee', async () => {
      const processor = new DefiPrePaymentProcessor()
      processor.registerStrategy(
        createMockStrategy('swap', { fee: 100n, outputAmount: 1000000n }),
      )
      processor.registerStrategy(
        createMockStrategy('borrow', { fee: 50n, outputAmount: 1000000n }),
      )

      const params: DefiStrategyParams = {
        targetToken: '0xtarget',
        targetAmount: 1000000n,
        targetNetwork: 'arbitrum',
        currentBalances: { '0xfrom': 2000000n },
        availableTokens: ['0xfrom'],
      }

      const estimate = await processor.estimate(params)
      expect(estimate).not.toBeNull()
      expect(estimate!.totalFees).toBe(50n)
    })

    it('should return null when no strategies can execute', async () => {
      const processor = new DefiPrePaymentProcessor()
      processor.registerStrategy(createMockStrategy('swap', { canExecute: false }))

      const params: DefiStrategyParams = {
        targetToken: '0xtarget',
        targetAmount: 1000000n,
        targetNetwork: 'arbitrum',
        currentBalances: {},
        availableTokens: [],
      }

      const estimate = await processor.estimate(params)
      expect(estimate).toBeNull()
    })

    it('should skip strategies that throw', async () => {
      const processor = new DefiPrePaymentProcessor()
      const failingStrategy = createMockStrategy('failing')
      ;(failingStrategy.estimate as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('fail'),
      )
      processor.registerStrategy(failingStrategy)
      processor.registerStrategy(
        createMockStrategy('working', { fee: 10n }),
      )

      const params: DefiStrategyParams = {
        targetToken: '0xtarget',
        targetAmount: 1000000n,
        targetNetwork: 'arbitrum',
        currentBalances: { '0xfrom': 2000000n },
        availableTokens: ['0xfrom'],
      }

      const estimate = await processor.estimate(params)
      expect(estimate).not.toBeNull()
      expect(estimate!.totalFees).toBe(10n)
    })
  })

  describe('createBeforePayHook', () => {
    it('should return null when balance is sufficient', async () => {
      const processor = new DefiPrePaymentProcessor()
      processor.registerStrategy(createMockStrategy('swap'))

      const hook = processor.createBeforePayHook()
      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'eip155:42161',
        asset: '0xtarget',
        amount: '1000000',
        payTo: '0x1111111111111111111111111111111111111111',
        maxTimeoutSeconds: 300,
        extra: {},
      }

      const result = await hook(requirements, { '0xtarget': 2000000n })
      expect(result).toBeNull()
    })

    it('should execute strategy when balance is insufficient', async () => {
      const processor = new DefiPrePaymentProcessor()
      const strategy = createMockStrategy('swap')
      processor.registerStrategy(strategy)

      const hook = processor.createBeforePayHook()
      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'eip155:42161',
        asset: '0xtarget',
        amount: '1000000',
        payTo: '0x1111111111111111111111111111111111111111',
        maxTimeoutSeconds: 300,
        extra: {},
      }

      const result = await hook(requirements, {
        '0xfrom': 2000000n,
        '0xtarget': 0n,
      })
      expect(result).not.toBeNull()
      expect(result!.txHashes).toEqual(['0xmock123'])
    })

    it('should return null when no target token in requirements', async () => {
      const processor = new DefiPrePaymentProcessor()
      processor.registerStrategy(createMockStrategy('swap'))

      const hook = processor.createBeforePayHook()
      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'eip155:42161',
        asset: '',
        amount: '1000000',
        payTo: '0x1111111111111111111111111111111111111111',
        maxTimeoutSeconds: 300,
        extra: {},
      }

      const result = await hook(requirements, { '0xfrom': 2000000n })
      expect(result).toBeNull()
    })

    it('should return null when amount is zero', async () => {
      const processor = new DefiPrePaymentProcessor()
      processor.registerStrategy(createMockStrategy('swap'))

      const hook = processor.createBeforePayHook()
      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'eip155:42161',
        asset: '0xtarget',
        amount: '0',
        payTo: '0x1111111111111111111111111111111111111111',
        maxTimeoutSeconds: 300,
        extra: {},
      }

      const result = await hook(requirements, { '0xfrom': 2000000n })
      expect(result).toBeNull()
    })
  })
})
