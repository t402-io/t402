import { describe, it, expect, vi } from 'vitest'
import { BorrowStrategy, createBorrowStrategy } from '../../../src/strategies/borrow.js'
import type { DefiStrategyParams } from '../../../src/types.js'

function createMockAave(overrides: Record<string, unknown> = {}) {
  return {
    getAvailableBorrowAmount: vi.fn().mockResolvedValue({
      borrowable: 5000000n,
      healthFactor: 2.0,
    }),
    borrow: vi.fn().mockResolvedValue({
      txHash: '0xborrow123',
      borrowedAmount: 1000000n,
    }),
    ...overrides,
  }
}

describe('BorrowStrategy', () => {
  describe('canExecute', () => {
    it('should return true when Aave is available and user has collateral', async () => {
      const strategy = createBorrowStrategy({ aaveProtocol: createMockAave() })
      const params: DefiStrategyParams = {
        targetToken: '0xusdt0',
        targetAmount: 1000000n,
        targetNetwork: 'arbitrum',
        currentBalances: { '0xcollateral': 5000000000000000000n },
        availableTokens: ['0xcollateral'],
      }

      expect(await strategy.canExecute(params)).toBe(true)
    })

    it('should return false when Aave protocol not configured', async () => {
      const strategy = createBorrowStrategy()
      const params: DefiStrategyParams = {
        targetToken: '0xusdt0',
        targetAmount: 1000000n,
        targetNetwork: 'arbitrum',
        currentBalances: { '0xcollateral': 5000000n },
        availableTokens: ['0xcollateral'],
      }

      expect(await strategy.canExecute(params)).toBe(false)
    })

    it('should return false when chain not supported by Aave', async () => {
      const strategy = createBorrowStrategy({ aaveProtocol: createMockAave() })
      const params: DefiStrategyParams = {
        targetToken: '0xusdt0',
        targetAmount: 1000000n,
        targetNetwork: 'unsupported-chain',
        currentBalances: { '0xcollateral': 5000000n },
        availableTokens: ['0xcollateral'],
      }

      expect(await strategy.canExecute(params)).toBe(false)
    })

    it('should return false when no collateral available', async () => {
      const strategy = createBorrowStrategy({ aaveProtocol: createMockAave() })
      const params: DefiStrategyParams = {
        targetToken: '0xusdt0',
        targetAmount: 1000000n,
        targetNetwork: 'arbitrum',
        currentBalances: {},
        availableTokens: [],
      }

      expect(await strategy.canExecute(params)).toBe(false)
    })
  })

  describe('estimate', () => {
    it('should return estimate with approve + borrow steps', async () => {
      const strategy = createBorrowStrategy({ aaveProtocol: createMockAave() })
      const params: DefiStrategyParams = {
        targetToken: '0xusdt0',
        targetAmount: 1000000n,
        targetNetwork: 'arbitrum',
        currentBalances: { '0xcollateral': 5000000000000000000n },
        availableTokens: ['0xcollateral'],
      }

      const estimate = await strategy.estimate(params)
      expect(estimate.outputAmount).toBe(1000000n)
      expect(estimate.steps).toHaveLength(2)
      expect(estimate.steps[0].type).toBe('approve')
      expect(estimate.steps[1].type).toBe('borrow')
      expect(estimate.steps[1].protocol).toBe('aave-v3')
    })

    it('should throw when Aave not configured', async () => {
      const strategy = createBorrowStrategy()
      const params: DefiStrategyParams = {
        targetToken: '0xusdt0',
        targetAmount: 1000000n,
        targetNetwork: 'arbitrum',
        currentBalances: {},
        availableTokens: [],
      }

      await expect(strategy.estimate(params)).rejects.toThrow('Aave protocol not configured')
    })

    it('should respect minimum health factor', async () => {
      const aave = createMockAave({
        getAvailableBorrowAmount: vi.fn().mockResolvedValue({
          borrowable: 5000000n,
          healthFactor: 1.2, // Below min default of 1.5
        }),
      })
      const strategy = createBorrowStrategy({ aaveProtocol: aave })
      const params: DefiStrategyParams = {
        targetToken: '0xusdt0',
        targetAmount: 1000000n,
        targetNetwork: 'arbitrum',
        currentBalances: { '0xcollateral': 5000000000000000000n },
        availableTokens: ['0xcollateral'],
      }

      await expect(strategy.estimate(params)).rejects.toThrow('No suitable collateral')
    })
  })

  describe('execute', () => {
    it('should execute borrow and return result', async () => {
      const aave = createMockAave()
      const strategy = createBorrowStrategy({ aaveProtocol: aave })
      const params: DefiStrategyParams = {
        targetToken: '0xusdt0',
        targetAmount: 1000000n,
        targetNetwork: 'arbitrum',
        currentBalances: { '0xcollateral': 5000000000000000000n },
        availableTokens: ['0xcollateral'],
      }

      const result = await strategy.execute(params)
      expect(result.txHashes).toEqual(['0xborrow123'])
      expect(result.outputAmount).toBe(1000000n)
      expect(result.steps[0].type).toBe('borrow')
      expect(result.steps[0].protocol).toBe('aave-v3')
    })
  })

  describe('factory', () => {
    it('should create strategy via factory function', () => {
      const strategy = createBorrowStrategy()
      expect(strategy).toBeInstanceOf(BorrowStrategy)
      expect(strategy.name).toBe('borrow')
    })
  })
})
