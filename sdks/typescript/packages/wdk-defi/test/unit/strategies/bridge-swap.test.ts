import { describe, it, expect, vi } from 'vitest'
import {
  BridgeSwapStrategy,
  createBridgeSwapStrategy,
} from '../../../src/strategies/bridge-swap.js'
import type { DefiStrategyParams } from '../../../src/types.js'
import { USDT0_ADDRESSES } from '../../../src/constants.js'

function createMockBridge(overrides: Record<string, unknown> = {}) {
  return {
    canBridge: vi.fn().mockReturnValue(true),
    getBridgeFee: vi.fn().mockResolvedValue({
      nativeFee: 100000000000000n,
      estimatedTime: 300,
    }),
    executeBridge: vi.fn().mockResolvedValue({
      txHash: '0xbridge123',
      amountReceived: 1000000n,
    }),
    ...overrides,
  }
}

describe('BridgeSwapStrategy', () => {
  const ethereumUsdt0Key = `ethereum:${USDT0_ADDRESSES.ethereum}`

  describe('canExecute', () => {
    it('should return true when bridge is available and source has balance', async () => {
      const strategy = createBridgeSwapStrategy({
        bridge: createMockBridge(),
        sourceChains: ['ethereum'],
      })
      const params: DefiStrategyParams = {
        targetToken: '0xusdt0_arb',
        targetAmount: 1000000n,
        targetNetwork: 'arbitrum',
        currentBalances: { [ethereumUsdt0Key]: 5000000n },
        availableTokens: [ethereumUsdt0Key],
      }

      expect(await strategy.canExecute(params)).toBe(true)
    })

    it('should return false when bridge not configured', async () => {
      const strategy = createBridgeSwapStrategy()
      const params: DefiStrategyParams = {
        targetToken: '0xusdt0',
        targetAmount: 1000000n,
        targetNetwork: 'arbitrum',
        currentBalances: {},
        availableTokens: [],
      }

      expect(await strategy.canExecute(params)).toBe(false)
    })

    it('should return false when no source chains configured', async () => {
      const strategy = createBridgeSwapStrategy({
        bridge: createMockBridge(),
        sourceChains: [],
      })
      const params: DefiStrategyParams = {
        targetToken: '0xusdt0',
        targetAmount: 1000000n,
        targetNetwork: 'arbitrum',
        currentBalances: {},
        availableTokens: [],
      }

      expect(await strategy.canExecute(params)).toBe(false)
    })

    it('should skip source chain that matches target', async () => {
      const strategy = createBridgeSwapStrategy({
        bridge: createMockBridge(),
        sourceChains: ['arbitrum'],
      })
      const params: DefiStrategyParams = {
        targetToken: '0xusdt0',
        targetAmount: 1000000n,
        targetNetwork: 'arbitrum',
        currentBalances: {},
        availableTokens: [],
      }

      expect(await strategy.canExecute(params)).toBe(false)
    })

    it('should return false when insufficient balance on source', async () => {
      const strategy = createBridgeSwapStrategy({
        bridge: createMockBridge(),
        sourceChains: ['ethereum'],
      })
      const params: DefiStrategyParams = {
        targetToken: '0xusdt0',
        targetAmount: 5000000n,
        targetNetwork: 'arbitrum',
        currentBalances: { [ethereumUsdt0Key]: 1000000n },
        availableTokens: [ethereumUsdt0Key],
      }

      expect(await strategy.canExecute(params)).toBe(false)
    })
  })

  describe('estimate', () => {
    it('should return estimate with bridge step', async () => {
      const strategy = createBridgeSwapStrategy({
        bridge: createMockBridge(),
        sourceChains: ['ethereum'],
      })
      const params: DefiStrategyParams = {
        targetToken: '0xusdt0_arb',
        targetAmount: 1000000n,
        targetNetwork: 'arbitrum',
        currentBalances: { [ethereumUsdt0Key]: 5000000n },
        availableTokens: [ethereumUsdt0Key],
      }

      const estimate = await strategy.estimate(params)
      expect(estimate.outputAmount).toBe(1000000n)
      expect(estimate.totalFees).toBe(100000000000000n)
      expect(estimate.estimatedTime).toBe(300)
      expect(estimate.steps).toHaveLength(1)
      expect(estimate.steps[0].type).toBe('bridge')
      expect(estimate.steps[0].protocol).toBe('layerzero')
    })

    it('should throw when no viable route', async () => {
      const strategy = createBridgeSwapStrategy({
        bridge: createMockBridge({ canBridge: vi.fn().mockReturnValue(false) }),
        sourceChains: ['ethereum'],
      })
      const params: DefiStrategyParams = {
        targetToken: '0xusdt0',
        targetAmount: 1000000n,
        targetNetwork: 'arbitrum',
        currentBalances: { [ethereumUsdt0Key]: 5000000n },
        availableTokens: [ethereumUsdt0Key],
      }

      await expect(strategy.estimate(params)).rejects.toThrow('No viable bridge route')
    })
  })

  describe('execute', () => {
    it('should execute bridge and return result', async () => {
      const bridge = createMockBridge()
      const strategy = createBridgeSwapStrategy({
        bridge,
        sourceChains: ['ethereum'],
      })
      const params: DefiStrategyParams = {
        targetToken: '0xusdt0_arb',
        targetAmount: 1000000n,
        targetNetwork: 'arbitrum',
        currentBalances: { [ethereumUsdt0Key]: 5000000n },
        availableTokens: [ethereumUsdt0Key],
      }

      const result = await strategy.execute(params)
      expect(result.txHashes).toEqual(['0xbridge123'])
      expect(result.outputAmount).toBe(1000000n)
      expect(result.steps[0].type).toBe('bridge')
      expect(result.steps[0].txHash).toBe('0xbridge123')
    })
  })

  describe('factory', () => {
    it('should create strategy via factory function', () => {
      const strategy = createBridgeSwapStrategy()
      expect(strategy).toBeInstanceOf(BridgeSwapStrategy)
      expect(strategy.name).toBe('bridge-swap')
    })
  })
})
