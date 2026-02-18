import { describe, it, expect, vi } from 'vitest'
import { SwapStrategy, createSwapStrategy } from '../../../src/strategies/swap.js'
import type { DefiStrategyParams } from '../../../src/types.js'
import { SUPPORTED_SWAP_TOKENS } from '../../../src/constants.js'

const WETH_ARBITRUM = SUPPORTED_SWAP_TOKENS.arbitrum.WETH

function createMockWdk(overrides: Record<string, unknown> = {}) {
  return {
    canSwap: vi.fn().mockReturnValue(true),
    getSwapQuote: vi.fn().mockResolvedValue({
      outputAmount: 2000000n,
      fee: 1000n,
      route: ['0xweth', '0xusdt0'],
    }),
    swapAndPay: vi.fn().mockResolvedValue({
      txHash: '0xswap123',
      outputAmount: 2000000n,
    }),
    ...overrides,
  }
}

describe('SwapStrategy', () => {
  describe('canExecute', () => {
    it('should return true when swap is available and user has tokens', async () => {
      const strategy = createSwapStrategy({ wdk: createMockWdk() })
      const params: DefiStrategyParams = {
        targetToken: '0xusdt0',
        targetAmount: 1000000n,
        targetNetwork: 'arbitrum',
        currentBalances: { [WETH_ARBITRUM]: 1000000000000000000n },
        availableTokens: [WETH_ARBITRUM],
      }

      expect(await strategy.canExecute(params)).toBe(true)
    })

    it('should return false when wdk cannot swap', async () => {
      const strategy = createSwapStrategy({
        wdk: createMockWdk({ canSwap: vi.fn().mockReturnValue(false) }),
      })
      const params: DefiStrategyParams = {
        targetToken: '0xusdt0',
        targetAmount: 1000000n,
        targetNetwork: 'arbitrum',
        currentBalances: { [WETH_ARBITRUM]: 1000000000000000000n },
        availableTokens: [WETH_ARBITRUM],
      }

      expect(await strategy.canExecute(params)).toBe(false)
    })

    it('should return false when no supported tokens on chain', async () => {
      const strategy = createSwapStrategy({ wdk: createMockWdk() })
      const params: DefiStrategyParams = {
        targetToken: '0xusdt0',
        targetAmount: 1000000n,
        targetNetwork: 'unsupported-chain',
        currentBalances: {},
        availableTokens: [],
      }

      expect(await strategy.canExecute(params)).toBe(false)
    })

    it('should return false when user has zero balance', async () => {
      const strategy = createSwapStrategy({ wdk: createMockWdk() })
      const params: DefiStrategyParams = {
        targetToken: '0xusdt0',
        targetAmount: 1000000n,
        targetNetwork: 'arbitrum',
        currentBalances: { [WETH_ARBITRUM]: 0n },
        availableTokens: [WETH_ARBITRUM],
      }

      expect(await strategy.canExecute(params)).toBe(false)
    })
  })

  describe('estimate', () => {
    it('should return estimate for valid params', async () => {
      const wdk = createMockWdk()
      const strategy = createSwapStrategy({ wdk })
      const params: DefiStrategyParams = {
        targetToken: '0xusdt0',
        targetAmount: 1000000n,
        targetNetwork: 'arbitrum',
        currentBalances: { [WETH_ARBITRUM]: 1000000000000000000n },
        availableTokens: [WETH_ARBITRUM],
      }

      const estimate = await strategy.estimate(params)
      expect(estimate.outputAmount).toBe(2000000n)
      expect(estimate.totalFees).toBe(1000n)
      expect(estimate.steps).toHaveLength(1)
      expect(estimate.steps[0].type).toBe('swap')
      expect(estimate.steps[0].protocol).toBe('velora')
    })

    it('should throw when no wdk configured', async () => {
      const strategy = createSwapStrategy()
      const params: DefiStrategyParams = {
        targetToken: '0xusdt0',
        targetAmount: 1000000n,
        targetNetwork: 'arbitrum',
        currentBalances: {},
        availableTokens: [],
      }

      await expect(strategy.estimate(params)).rejects.toThrow('WDK not configured')
    })
  })

  describe('execute', () => {
    it('should execute swap and return result', async () => {
      const wdk = createMockWdk()
      const strategy = createSwapStrategy({ wdk })
      const params: DefiStrategyParams = {
        targetToken: '0xusdt0',
        targetAmount: 1000000n,
        targetNetwork: 'arbitrum',
        currentBalances: { [WETH_ARBITRUM]: 1000000000000000000n },
        availableTokens: [WETH_ARBITRUM],
      }

      const result = await strategy.execute(params)
      expect(result.txHashes).toEqual(['0xswap123'])
      expect(result.outputAmount).toBe(2000000n)
      expect(result.steps).toHaveLength(1)
      expect(result.steps[0].txHash).toBe('0xswap123')
    })
  })

  describe('factory', () => {
    it('should create strategy via factory function', () => {
      const strategy = createSwapStrategy()
      expect(strategy).toBeInstanceOf(SwapStrategy)
      expect(strategy.name).toBe('swap')
    })
  })
})
