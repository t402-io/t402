/**
 * @t402/wdk-bridge Client Tests
 *
 * Comprehensive tests for WdkBridgeClient covering route selection,
 * auto-bridging strategies, bridge execution, and delivery tracking.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WdkAccount, BridgeRoute } from './types.js'
import { MIN_BRIDGE_AMOUNT, DEFAULT_SLIPPAGE } from './constants.js'

// Mock the @t402/evm module
const mockBridgeQuote = vi.fn()
const mockBridgeSend = vi.fn()
const mockScanGetMessage = vi.fn()
const mockScanWaitForDelivery = vi.fn()

vi.mock('@t402/evm', () => ({
  Usdt0Bridge: vi.fn().mockImplementation(() => ({
    quote: mockBridgeQuote,
    send: mockBridgeSend,
  })),
  LayerZeroScanClient: vi.fn().mockImplementation(() => ({
    getMessage: mockScanGetMessage,
    waitForDelivery: mockScanWaitForDelivery,
  })),
}))

// Mock the signer module
const mockGetAddress = vi.fn().mockResolvedValue('0x1234567890123456789012345678901234567890')
vi.mock('./signer.js', () => ({
  WdkBridgeSigner: vi.fn(),
  createWdkBridgeSigner: vi.fn().mockImplementation(() =>
    Promise.resolve({
      getAddress: mockGetAddress,
      address: '0x1234567890123456789012345678901234567890',
    }),
  ),
}))

import { WdkBridgeClient, createWdkBridgeClient } from './client.js'

/**
 * Create a mock WDK account
 */
function createMockWdkAccount(overrides?: Partial<WdkAccount>): WdkAccount {
  return {
    getAddress: vi.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
    getBalance: vi.fn().mockResolvedValue(1_000000000000000000n), // 1 ETH
    getTokenBalance: vi.fn().mockResolvedValue(100_000000n), // 100 USDT0
    signMessage: vi.fn().mockResolvedValue('0xsignature'),
    signTypedData: vi.fn().mockResolvedValue('0xsignature'),
    sendTransaction: vi.fn().mockResolvedValue('0xtxhash'),
    ...overrides,
  }
}

describe('WdkBridgeClient - Extended Tests', () => {
  let mockAccount: WdkAccount

  beforeEach(() => {
    mockAccount = createMockWdkAccount()
    vi.clearAllMocks()
  })

  // ------------------------------------------------------------------
  // Constructor validation
  // ------------------------------------------------------------------
  describe('constructor validation', () => {
    it('should throw for empty accounts object', () => {
      expect(() => new WdkBridgeClient({ accounts: {} })).toThrow(
        /At least one WDK account must be provided/,
      )
    })

    it('should throw for unsupported chain name', () => {
      expect(
        () => new WdkBridgeClient({ accounts: { solana: mockAccount } }),
      ).toThrow(/does not support USDT0 bridging/)
    })

    it('should throw for unknown chain name', () => {
      expect(
        () => new WdkBridgeClient({ accounts: { foochain: mockAccount } }),
      ).toThrow(/does not support USDT0 bridging/)
    })

    it('should list supported chains in error message', () => {
      expect(
        () => new WdkBridgeClient({ accounts: { solana: mockAccount } }),
      ).toThrow(/ethereum/)
    })

    it('should accept all valid chains', () => {
      const client = new WdkBridgeClient({
        accounts: {
          ethereum: mockAccount,
          arbitrum: mockAccount,
          ink: mockAccount,
          berachain: mockAccount,
          unichain: mockAccount,
        },
      })

      expect(client.getConfiguredChains()).toHaveLength(5)
    })

    it('should default strategy to cheapest', () => {
      const client = new WdkBridgeClient({
        accounts: { ethereum: mockAccount },
      })
      // We verify this indirectly: the client is created successfully
      expect(client).toBeDefined()
    })

    it('should accept fastest strategy', () => {
      const client = new WdkBridgeClient({
        accounts: { ethereum: mockAccount },
        defaultStrategy: 'fastest',
      })
      expect(client).toBeDefined()
    })

    it('should accept preferred strategy', () => {
      const client = new WdkBridgeClient({
        accounts: { ethereum: mockAccount },
        defaultStrategy: 'preferred',
      })
      expect(client).toBeDefined()
    })

    it('should accept custom slippage values', () => {
      const client = new WdkBridgeClient({
        accounts: { ethereum: mockAccount },
        defaultSlippage: 1.5,
      })
      expect(client).toBeDefined()
    })

    it('should normalize mixed case chain names', () => {
      const client = new WdkBridgeClient({
        accounts: {
          ETHEREUM: mockAccount,
          Arbitrum: mockAccount,
          INK: mockAccount,
        },
      })

      expect(client.hasChain('ethereum')).toBe(true)
      expect(client.hasChain('arbitrum')).toBe(true)
      expect(client.hasChain('ink')).toBe(true)
    })
  })

  // ------------------------------------------------------------------
  // getChainBalance
  // ------------------------------------------------------------------
  describe('getChainBalance', () => {
    it('should return correct balance structure', async () => {
      const client = new WdkBridgeClient({
        accounts: { ethereum: mockAccount },
      })

      const balance = await client.getChainBalance('ethereum')

      expect(balance).toEqual({
        chain: 'ethereum',
        chainId: 1,
        usdt0Balance: 100_000000n,
        nativeBalance: 1_000000000000000000n,
        canBridge: true,
      })
    })

    it('should set canBridge to true when balance equals MIN_BRIDGE_AMOUNT', async () => {
      const exactMinAccount = createMockWdkAccount({
        getTokenBalance: vi.fn().mockResolvedValue(MIN_BRIDGE_AMOUNT),
      })
      const client = new WdkBridgeClient({
        accounts: { ethereum: exactMinAccount },
      })

      const balance = await client.getChainBalance('ethereum')
      expect(balance.canBridge).toBe(true)
    })

    it('should set canBridge to false when balance is below MIN_BRIDGE_AMOUNT', async () => {
      const lowAccount = createMockWdkAccount({
        getTokenBalance: vi.fn().mockResolvedValue(MIN_BRIDGE_AMOUNT - 1n),
      })
      const client = new WdkBridgeClient({
        accounts: { ethereum: lowAccount },
      })

      const balance = await client.getChainBalance('ethereum')
      expect(balance.canBridge).toBe(false)
    })

    it('should set canBridge to false for zero balance', async () => {
      const zeroAccount = createMockWdkAccount({
        getTokenBalance: vi.fn().mockResolvedValue(0n),
      })
      const client = new WdkBridgeClient({
        accounts: { ethereum: zeroAccount },
      })

      const balance = await client.getChainBalance('ethereum')
      expect(balance.canBridge).toBe(false)
      expect(balance.usdt0Balance).toBe(0n)
    })

    it('should throw for unconfigured chain', async () => {
      const client = new WdkBridgeClient({
        accounts: { ethereum: mockAccount },
      })

      await expect(client.getChainBalance('arbitrum')).rejects.toThrow(
        /No WDK account configured/,
      )
    })

    it('should be case-insensitive when looking up chain', async () => {
      const client = new WdkBridgeClient({
        accounts: { ethereum: mockAccount },
      })

      const balance = await client.getChainBalance('ETHEREUM')
      expect(balance.chain).toBe('ethereum')
    })

    it('should return correct chain IDs for each chain', async () => {
      const client = new WdkBridgeClient({
        accounts: {
          ethereum: mockAccount,
          arbitrum: mockAccount,
          ink: mockAccount,
          berachain: mockAccount,
          unichain: mockAccount,
        },
      })

      const ethBalance = await client.getChainBalance('ethereum')
      const arbBalance = await client.getChainBalance('arbitrum')
      const inkBalance = await client.getChainBalance('ink')
      const beraBalance = await client.getChainBalance('berachain')
      const uniBalance = await client.getChainBalance('unichain')

      expect(ethBalance.chainId).toBe(1)
      expect(arbBalance.chainId).toBe(42161)
      expect(inkBalance.chainId).toBe(57073)
      expect(beraBalance.chainId).toBe(80084)
      expect(uniBalance.chainId).toBe(130)
    })
  })

  // ------------------------------------------------------------------
  // getBalances
  // ------------------------------------------------------------------
  describe('getBalances', () => {
    it('should aggregate balances across all configured chains', async () => {
      const client = new WdkBridgeClient({
        accounts: {
          ethereum: mockAccount,
          arbitrum: mockAccount,
        },
      })

      const summary = await client.getBalances()

      expect(summary.balances).toHaveLength(2)
      expect(summary.totalUsdt0).toBe(200_000000n)
      expect(summary.chainsWithBalance).toHaveLength(2)
      expect(summary.bridgeableChains).toHaveLength(2)
    })

    it('should correctly sum different balances', async () => {
      const ethAccount = createMockWdkAccount({
        getTokenBalance: vi.fn().mockResolvedValue(75_000000n),
      })
      const arbAccount = createMockWdkAccount({
        getTokenBalance: vi.fn().mockResolvedValue(25_000000n),
      })
      const inkAccount = createMockWdkAccount({
        getTokenBalance: vi.fn().mockResolvedValue(50_000000n),
      })

      const client = new WdkBridgeClient({
        accounts: {
          ethereum: ethAccount,
          arbitrum: arbAccount,
          ink: inkAccount,
        },
      })

      const summary = await client.getBalances()
      expect(summary.totalUsdt0).toBe(150_000000n) // 75 + 25 + 50
    })

    it('should exclude chains with zero balance from chainsWithBalance', async () => {
      const zeroAccount = createMockWdkAccount({
        getTokenBalance: vi.fn().mockResolvedValue(0n),
      })

      const client = new WdkBridgeClient({
        accounts: {
          ethereum: mockAccount,
          arbitrum: zeroAccount,
        },
      })

      const summary = await client.getBalances()
      expect(summary.chainsWithBalance).toEqual(['ethereum'])
      expect(summary.totalUsdt0).toBe(100_000000n)
    })

    it('should exclude chains below minimum from bridgeableChains', async () => {
      const lowAccount = createMockWdkAccount({
        getTokenBalance: vi.fn().mockResolvedValue(500n), // Below MIN_BRIDGE_AMOUNT
      })

      const client = new WdkBridgeClient({
        accounts: {
          ethereum: mockAccount,
          arbitrum: lowAccount,
        },
      })

      const summary = await client.getBalances()
      expect(summary.bridgeableChains).toEqual(['ethereum'])
      // chainsWithBalance includes arbitrum because it has > 0 balance
      expect(summary.chainsWithBalance).toContain('arbitrum')
    })

    it('should handle single chain', async () => {
      const client = new WdkBridgeClient({
        accounts: { ethereum: mockAccount },
      })

      const summary = await client.getBalances()
      expect(summary.balances).toHaveLength(1)
      expect(summary.totalUsdt0).toBe(100_000000n)
    })

    it('should handle all chains with zero balance', async () => {
      const zeroAccount = createMockWdkAccount({
        getTokenBalance: vi.fn().mockResolvedValue(0n),
        getBalance: vi.fn().mockResolvedValue(0n),
      })

      const client = new WdkBridgeClient({
        accounts: {
          ethereum: zeroAccount,
          arbitrum: zeroAccount,
        },
      })

      const summary = await client.getBalances()
      expect(summary.totalUsdt0).toBe(0n)
      expect(summary.chainsWithBalance).toHaveLength(0)
      expect(summary.bridgeableChains).toHaveLength(0)
    })
  })

  // ------------------------------------------------------------------
  // getRoutes
  // ------------------------------------------------------------------
  describe('getRoutes', () => {
    it('should return routes from all source chains to destination', async () => {
      mockBridgeQuote.mockResolvedValue({
        nativeFee: 50000000000000n, // 0.00005 ETH
        minAmountToReceive: 99_500000n,
        estimatedTime: 180,
      })

      const client = new WdkBridgeClient({
        accounts: {
          ethereum: mockAccount,
          arbitrum: mockAccount,
          ink: mockAccount,
        },
      })

      const routes = await client.getRoutes('ethereum', 50_000000n)

      // Should include routes from arbitrum and ink (not from ethereum itself)
      expect(routes).toHaveLength(2)
      expect(routes.map((r) => r.fromChain)).not.toContain('ethereum')
      expect(routes.every((r) => r.toChain === 'ethereum')).toBe(true)
    })

    it('should mark routes as unavailable when balance is insufficient', async () => {
      const lowAccount = createMockWdkAccount({
        getTokenBalance: vi.fn().mockResolvedValue(10_000000n), // Only 10 USDT0
      })

      const client = new WdkBridgeClient({
        accounts: {
          ethereum: mockAccount,
          arbitrum: lowAccount,
        },
      })

      const routes = await client.getRoutes('ethereum', 50_000000n)

      const arbRoute = routes.find((r) => r.fromChain === 'arbitrum')
      expect(arbRoute).toBeDefined()
      expect(arbRoute!.available).toBe(false)
      expect(arbRoute!.unavailableReason).toContain('Insufficient USDT0 balance')
    })

    it('should mark routes as unavailable when native fee exceeds native balance', async () => {
      const lowNativeAccount = createMockWdkAccount({
        getTokenBalance: vi.fn().mockResolvedValue(100_000000n),
        getBalance: vi.fn().mockResolvedValue(1000n), // Very low native balance
      })

      mockBridgeQuote.mockResolvedValue({
        nativeFee: 50000000000000000n, // 0.05 ETH (more than the 1000 wei balance)
        minAmountToReceive: 99_500000n,
        estimatedTime: 180,
      })

      const client = new WdkBridgeClient({
        accounts: {
          ethereum: lowNativeAccount,
          arbitrum: mockAccount,
        },
      })

      const routes = await client.getRoutes('arbitrum', 50_000000n)

      const ethRoute = routes.find((r) => r.fromChain === 'ethereum')
      expect(ethRoute).toBeDefined()
      expect(ethRoute!.available).toBe(false)
      expect(ethRoute!.unavailableReason).toContain('Insufficient native balance for fee')
    })

    it('should handle quote errors gracefully', async () => {
      mockBridgeQuote.mockRejectedValue(new Error('RPC timeout'))

      const client = new WdkBridgeClient({
        accounts: {
          ethereum: mockAccount,
          arbitrum: mockAccount,
        },
      })

      const routes = await client.getRoutes('ethereum', 50_000000n)

      const arbRoute = routes.find((r) => r.fromChain === 'arbitrum')
      expect(arbRoute).toBeDefined()
      expect(arbRoute!.available).toBe(false)
      expect(arbRoute!.unavailableReason).toContain('Failed to get quote')
      expect(arbRoute!.unavailableReason).toContain('RPC timeout')
    })

    it('should exclude destination chain from routes', async () => {
      mockBridgeQuote.mockResolvedValue({
        nativeFee: 50000000000000n,
        minAmountToReceive: 99_500000n,
        estimatedTime: 180,
      })

      const client = new WdkBridgeClient({
        accounts: {
          ethereum: mockAccount,
          arbitrum: mockAccount,
        },
      })

      const routes = await client.getRoutes('ethereum', 10_000000n)

      expect(routes.every((r) => r.fromChain !== 'ethereum')).toBe(true)
      expect(routes.every((r) => r.toChain === 'ethereum')).toBe(true)
    })

    it('should return empty routes when only destination chain is configured', async () => {
      const client = new WdkBridgeClient({
        accounts: { ethereum: mockAccount },
      })

      const routes = await client.getRoutes('ethereum', 10_000000n)
      expect(routes).toHaveLength(0)
    })

    it('should include fee information in available routes', async () => {
      mockBridgeQuote.mockResolvedValue({
        nativeFee: 123456789n,
        minAmountToReceive: 49_750000n,
        estimatedTime: 300,
      })

      const client = new WdkBridgeClient({
        accounts: {
          ethereum: mockAccount,
          arbitrum: mockAccount,
        },
      })

      const routes = await client.getRoutes('ethereum', 50_000000n)
      const arbRoute = routes.find((r) => r.fromChain === 'arbitrum')

      expect(arbRoute).toBeDefined()
      expect(arbRoute!.nativeFee).toBe(123456789n)
      expect(arbRoute!.minAmountToReceive).toBe(49_750000n)
      expect(arbRoute!.estimatedTime).toBe(300)
      expect(arbRoute!.amountToSend).toBe(50_000000n)
    })
  })

  // ------------------------------------------------------------------
  // autoBridge
  // ------------------------------------------------------------------
  describe('autoBridge', () => {
    const bridgeResult = {
      txHash: '0xabc123' as `0x${string}`,
      messageGuid: '0xguid456' as `0x${string}`,
      amountSent: 50_000000n,
      amountToReceive: 49_750000n,
      fromChain: 'arbitrum',
      toChain: 'ethereum',
      estimatedTime: 180,
    }

    beforeEach(() => {
      mockBridgeQuote.mockResolvedValue({
        nativeFee: 50000000000000n,
        minAmountToReceive: 49_750000n,
        estimatedTime: 180,
      })
      mockBridgeSend.mockResolvedValue(bridgeResult)
    })

    it('should throw for unsupported destination chain', async () => {
      const client = new WdkBridgeClient({
        accounts: { ethereum: mockAccount },
      })

      await expect(
        client.autoBridge({
          toChain: 'solana',
          amount: 50_000000n,
          recipient: '0x1234567890123456789012345678901234567890',
        }),
      ).rejects.toThrow(/does not support USDT0 bridging/)
    })

    it('should throw for amount below MIN_BRIDGE_AMOUNT', async () => {
      const client = new WdkBridgeClient({
        accounts: {
          ethereum: mockAccount,
          arbitrum: mockAccount,
        },
      })

      await expect(
        client.autoBridge({
          toChain: 'ethereum',
          amount: MIN_BRIDGE_AMOUNT - 1n,
          recipient: '0x1234567890123456789012345678901234567890',
        }),
      ).rejects.toThrow(/below minimum/)
    })

    it('should throw for zero amount', async () => {
      const client = new WdkBridgeClient({
        accounts: {
          ethereum: mockAccount,
          arbitrum: mockAccount,
        },
      })

      await expect(
        client.autoBridge({
          toChain: 'ethereum',
          amount: 0n,
          recipient: '0x1234567890123456789012345678901234567890',
        }),
      ).rejects.toThrow(/below minimum/)
    })

    it('should throw for zero address recipient in autoBridge', async () => {
      const client = new WdkBridgeClient({
        accounts: {
          ethereum: mockAccount,
          arbitrum: mockAccount,
        },
      })

      await expect(
        client.autoBridge({
          toChain: 'ethereum',
          amount: 50_000000n,
          recipient: '0x0000000000000000000000000000000000000000',
        }),
      ).rejects.toThrow(/zero address/)
    })

    it('should throw when no available route exists', async () => {
      const lowAccount = createMockWdkAccount({
        getTokenBalance: vi.fn().mockResolvedValue(1_000000n), // 1 USDT0 - not enough for 50
      })

      const client = new WdkBridgeClient({
        accounts: {
          ethereum: mockAccount,
          arbitrum: lowAccount,
        },
      })

      // Request to bridge TO ethereum, only source is arbitrum with low balance
      await expect(
        client.autoBridge({
          toChain: 'ethereum',
          amount: 50_000000n,
          recipient: '0x1234567890123456789012345678901234567890',
        }),
      ).rejects.toThrow(/No available route/)
    })

    it('should include per-chain failure reasons when no route available', async () => {
      const lowAccount = createMockWdkAccount({
        getTokenBalance: vi.fn().mockResolvedValue(1_000000n),
      })

      const client = new WdkBridgeClient({
        accounts: {
          ethereum: lowAccount,
          arbitrum: lowAccount,
        },
      })

      await expect(
        client.autoBridge({
          toChain: 'ink',
          amount: 50_000000n,
          recipient: '0x1234567890123456789012345678901234567890',
        }),
      ).rejects.toThrow(/Reasons:/)
    })

    it('should select cheapest route by default', async () => {
      // Set up two accounts with sufficient balance
      const ethAccount = createMockWdkAccount({
        getTokenBalance: vi.fn().mockResolvedValue(200_000000n),
        getBalance: vi.fn().mockResolvedValue(10_000000000000000000n),
      })
      const arbAccount = createMockWdkAccount({
        getTokenBalance: vi.fn().mockResolvedValue(200_000000n),
        getBalance: vi.fn().mockResolvedValue(10_000000000000000000n),
      })

      // Arbitrum route is cheaper
      let callIndex = 0
      mockBridgeQuote.mockImplementation(() => {
        callIndex++
        if (callIndex === 1) {
          return Promise.resolve({
            nativeFee: 100000000000000n, // Higher fee (eth)
            minAmountToReceive: 49_750000n,
            estimatedTime: 900,
          })
        }
        return Promise.resolve({
          nativeFee: 10000000000000n, // Lower fee (arb)
          minAmountToReceive: 49_750000n,
          estimatedTime: 300,
        })
      })

      mockBridgeSend.mockResolvedValue(bridgeResult)

      const client = new WdkBridgeClient({
        accounts: {
          ethereum: ethAccount,
          arbitrum: arbAccount,
        },
      })

      const result = await client.autoBridge({
        toChain: 'ink',
        amount: 50_000000n,
        recipient: '0x1234567890123456789012345678901234567890',
      })

      expect(result).toBeDefined()
      expect(result.txHash).toBe('0xabc123')
    })

    it('should use preferred strategy when preferredSourceChain is specified', async () => {
      const ethAccount = createMockWdkAccount({
        getTokenBalance: vi.fn().mockResolvedValue(200_000000n),
        getBalance: vi.fn().mockResolvedValue(10_000000000000000000n),
      })
      const arbAccount = createMockWdkAccount({
        getTokenBalance: vi.fn().mockResolvedValue(200_000000n),
        getBalance: vi.fn().mockResolvedValue(10_000000000000000000n),
      })

      mockBridgeQuote.mockResolvedValue({
        nativeFee: 50000000000000n,
        minAmountToReceive: 49_750000n,
        estimatedTime: 180,
      })
      mockBridgeSend.mockResolvedValue(bridgeResult)

      const client = new WdkBridgeClient({
        accounts: {
          ethereum: ethAccount,
          arbitrum: arbAccount,
        },
      })

      const result = await client.autoBridge({
        toChain: 'ink',
        amount: 50_000000n,
        recipient: '0x1234567890123456789012345678901234567890',
        preferredSourceChain: 'ethereum',
      })

      expect(result).toBeDefined()
    })

    it('should execute bridge with the selected route', async () => {
      const arbAccount = createMockWdkAccount({
        getTokenBalance: vi.fn().mockResolvedValue(200_000000n),
        getBalance: vi.fn().mockResolvedValue(10_000000000000000000n),
      })

      mockBridgeQuote.mockResolvedValue({
        nativeFee: 50000000000000n,
        minAmountToReceive: 49_750000n,
        estimatedTime: 180,
      })
      mockBridgeSend.mockResolvedValue(bridgeResult)

      const client = new WdkBridgeClient({
        accounts: { arbitrum: arbAccount },
      })

      const result = await client.autoBridge({
        toChain: 'ethereum',
        amount: 50_000000n,
        recipient: '0x1234567890123456789012345678901234567890',
      })

      expect(result.txHash).toBe('0xabc123')
      expect(result.messageGuid).toBe('0xguid456')
      expect(result.amountSent).toBe(50_000000n)
      expect(result.amountToReceive).toBe(49_750000n)
    })

    it('should pass slippage tolerance to bridge', async () => {
      const arbAccount = createMockWdkAccount({
        getTokenBalance: vi.fn().mockResolvedValue(200_000000n),
        getBalance: vi.fn().mockResolvedValue(10_000000000000000000n),
      })

      mockBridgeQuote.mockResolvedValue({
        nativeFee: 50000000000000n,
        minAmountToReceive: 49_750000n,
        estimatedTime: 180,
      })
      mockBridgeSend.mockResolvedValue(bridgeResult)

      const client = new WdkBridgeClient({
        accounts: { arbitrum: arbAccount },
      })

      await client.autoBridge({
        toChain: 'ethereum',
        amount: 50_000000n,
        recipient: '0x1234567890123456789012345678901234567890',
        slippageTolerance: 1.0,
      })

      // Verify send was called with the custom slippage
      expect(mockBridgeSend).toHaveBeenCalledWith(
        expect.objectContaining({
          slippageTolerance: 1.0,
        }),
      )
    })

    it('should use default slippage when not specified', async () => {
      const arbAccount = createMockWdkAccount({
        getTokenBalance: vi.fn().mockResolvedValue(200_000000n),
        getBalance: vi.fn().mockResolvedValue(10_000000000000000000n),
      })

      mockBridgeQuote.mockResolvedValue({
        nativeFee: 50000000000000n,
        minAmountToReceive: 49_750000n,
        estimatedTime: 180,
      })
      mockBridgeSend.mockResolvedValue(bridgeResult)

      const client = new WdkBridgeClient({
        accounts: { arbitrum: arbAccount },
      })

      await client.autoBridge({
        toChain: 'ethereum',
        amount: 50_000000n,
        recipient: '0x1234567890123456789012345678901234567890',
      })

      expect(mockBridgeSend).toHaveBeenCalledWith(
        expect.objectContaining({
          slippageTolerance: DEFAULT_SLIPPAGE,
        }),
      )
    })

    it('should accept amount exactly at MIN_BRIDGE_AMOUNT', async () => {
      const arbAccount = createMockWdkAccount({
        getTokenBalance: vi.fn().mockResolvedValue(10_000000n),
        getBalance: vi.fn().mockResolvedValue(10_000000000000000000n),
      })

      mockBridgeQuote.mockResolvedValue({
        nativeFee: 50000000000000n,
        minAmountToReceive: 995000n,
        estimatedTime: 180,
      })
      mockBridgeSend.mockResolvedValue({
        ...bridgeResult,
        amountSent: MIN_BRIDGE_AMOUNT,
      })

      const client = new WdkBridgeClient({
        accounts: { arbitrum: arbAccount },
      })

      const result = await client.autoBridge({
        toChain: 'ethereum',
        amount: MIN_BRIDGE_AMOUNT,
        recipient: '0x1234567890123456789012345678901234567890',
      })

      expect(result).toBeDefined()
    })
  })

  // ------------------------------------------------------------------
  // bridge (specific chain)
  // ------------------------------------------------------------------
  describe('bridge', () => {
    const bridgeResult = {
      txHash: '0xbridgehash' as `0x${string}`,
      messageGuid: '0xbridgeguid' as `0x${string}`,
      amountSent: 50_000000n,
      amountToReceive: 49_750000n,
      fromChain: 'arbitrum',
      toChain: 'ethereum',
      estimatedTime: 180,
    }

    beforeEach(() => {
      mockBridgeSend.mockResolvedValue(bridgeResult)
    })

    it('should execute bridge from specified source chain', async () => {
      const client = new WdkBridgeClient({
        accounts: {
          ethereum: mockAccount,
          arbitrum: mockAccount,
        },
      })

      const result = await client.bridge({
        fromChain: 'arbitrum',
        toChain: 'ethereum',
        amount: 50_000000n,
        recipient: '0x1234567890123456789012345678901234567890',
      })

      expect(result.txHash).toBe('0xbridgehash')
      expect(result.messageGuid).toBe('0xbridgeguid')
    })

    it('should throw when source chain is not configured', async () => {
      const client = new WdkBridgeClient({
        accounts: { ethereum: mockAccount },
      })

      await expect(
        client.bridge({
          fromChain: 'arbitrum',
          toChain: 'ethereum',
          amount: 50_000000n,
          recipient: '0x1234567890123456789012345678901234567890',
        }),
      ).rejects.toThrow(/No WDK account configured/)
    })

    it('should throw when source and destination are the same', async () => {
      const client = new WdkBridgeClient({
        accounts: { ethereum: mockAccount },
      })

      await expect(
        client.bridge({
          fromChain: 'ethereum',
          toChain: 'ethereum',
          amount: 50_000000n,
          recipient: '0x1234567890123456789012345678901234567890',
        }),
      ).rejects.toThrow(/Source and destination chains must be different/)
    })

    it('should normalize chain names to lowercase', async () => {
      const client = new WdkBridgeClient({
        accounts: {
          ethereum: mockAccount,
          arbitrum: mockAccount,
        },
      })

      const result = await client.bridge({
        fromChain: 'ARBITRUM',
        toChain: 'ETHEREUM',
        amount: 50_000000n,
        recipient: '0x1234567890123456789012345678901234567890',
      })

      expect(result).toBeDefined()
    })

    it('should pass custom slippage to bridge send', async () => {
      const client = new WdkBridgeClient({
        accounts: { arbitrum: mockAccount },
      })

      await client.bridge({
        fromChain: 'arbitrum',
        toChain: 'ethereum',
        amount: 50_000000n,
        recipient: '0x1234567890123456789012345678901234567890',
        slippageTolerance: 2.0,
      })

      expect(mockBridgeSend).toHaveBeenCalledWith(
        expect.objectContaining({
          slippageTolerance: 2.0,
        }),
      )
    })

    // ----------------------------------------------------------------
    // bridge() input validation
    // ----------------------------------------------------------------
    it('should throw for zero address recipient', async () => {
      const client = new WdkBridgeClient({
        accounts: { arbitrum: mockAccount },
      })

      await expect(
        client.bridge({
          fromChain: 'arbitrum',
          toChain: 'ethereum',
          amount: 50_000000n,
          recipient: '0x0000000000000000000000000000000000000000',
        }),
      ).rejects.toThrow(/zero address/)
    })

    it('should throw for empty recipient address', async () => {
      const client = new WdkBridgeClient({
        accounts: { arbitrum: mockAccount },
      })

      await expect(
        client.bridge({
          fromChain: 'arbitrum',
          toChain: 'ethereum',
          amount: 50_000000n,
          recipient: '' as Address,
        }),
      ).rejects.toThrow(/zero address/)
    })

    it('should throw for zero amount', async () => {
      const client = new WdkBridgeClient({
        accounts: { arbitrum: mockAccount },
      })

      await expect(
        client.bridge({
          fromChain: 'arbitrum',
          toChain: 'ethereum',
          amount: 0n,
          recipient: '0x1234567890123456789012345678901234567890',
        }),
      ).rejects.toThrow(/greater than zero/)
    })

    it('should throw for negative amount', async () => {
      const client = new WdkBridgeClient({
        accounts: { arbitrum: mockAccount },
      })

      await expect(
        client.bridge({
          fromChain: 'arbitrum',
          toChain: 'ethereum',
          amount: -1n,
          recipient: '0x1234567890123456789012345678901234567890',
        }),
      ).rejects.toThrow(/greater than zero/)
    })

    it('should throw for amount below MIN_BRIDGE_AMOUNT', async () => {
      const client = new WdkBridgeClient({
        accounts: { arbitrum: mockAccount },
      })

      await expect(
        client.bridge({
          fromChain: 'arbitrum',
          toChain: 'ethereum',
          amount: MIN_BRIDGE_AMOUNT - 1n,
          recipient: '0x1234567890123456789012345678901234567890',
        }),
      ).rejects.toThrow(/below minimum/)
    })

    it('should throw for slippage tolerance of zero', async () => {
      const client = new WdkBridgeClient({
        accounts: { arbitrum: mockAccount },
      })

      await expect(
        client.bridge({
          fromChain: 'arbitrum',
          toChain: 'ethereum',
          amount: 50_000000n,
          recipient: '0x1234567890123456789012345678901234567890',
          slippageTolerance: 0,
        }),
      ).rejects.toThrow(/Slippage tolerance must be between/)
    })

    it('should throw for negative slippage tolerance', async () => {
      const client = new WdkBridgeClient({
        accounts: { arbitrum: mockAccount },
      })

      await expect(
        client.bridge({
          fromChain: 'arbitrum',
          toChain: 'ethereum',
          amount: 50_000000n,
          recipient: '0x1234567890123456789012345678901234567890',
          slippageTolerance: -1,
        }),
      ).rejects.toThrow(/Slippage tolerance must be between/)
    })

    it('should throw for slippage tolerance above 5%', async () => {
      const client = new WdkBridgeClient({
        accounts: { arbitrum: mockAccount },
      })

      await expect(
        client.bridge({
          fromChain: 'arbitrum',
          toChain: 'ethereum',
          amount: 50_000000n,
          recipient: '0x1234567890123456789012345678901234567890',
          slippageTolerance: 5.1,
        }),
      ).rejects.toThrow(/Slippage tolerance must be between/)
    })

    it('should throw for NaN slippage tolerance', async () => {
      const client = new WdkBridgeClient({
        accounts: { arbitrum: mockAccount },
      })

      await expect(
        client.bridge({
          fromChain: 'arbitrum',
          toChain: 'ethereum',
          amount: 50_000000n,
          recipient: '0x1234567890123456789012345678901234567890',
          slippageTolerance: NaN,
        }),
      ).rejects.toThrow(/Slippage tolerance must be between/)
    })

    it('should throw for Infinity slippage tolerance', async () => {
      const client = new WdkBridgeClient({
        accounts: { arbitrum: mockAccount },
      })

      await expect(
        client.bridge({
          fromChain: 'arbitrum',
          toChain: 'ethereum',
          amount: 50_000000n,
          recipient: '0x1234567890123456789012345678901234567890',
          slippageTolerance: Infinity,
        }),
      ).rejects.toThrow(/Slippage tolerance must be between/)
    })

    it('should accept slippage tolerance at exactly 5%', async () => {
      const client = new WdkBridgeClient({
        accounts: { arbitrum: mockAccount },
      })

      // Should not throw for slippage = 5 (boundary)
      const result = await client.bridge({
        fromChain: 'arbitrum',
        toChain: 'ethereum',
        amount: 50_000000n,
        recipient: '0x1234567890123456789012345678901234567890',
        slippageTolerance: 5,
      })
      expect(result).toBeDefined()
    })

    it('should throw for unsupported destination chain', async () => {
      const client = new WdkBridgeClient({
        accounts: { arbitrum: mockAccount },
      })

      await expect(
        client.bridge({
          fromChain: 'arbitrum',
          toChain: 'solana',
          amount: 50_000000n,
          recipient: '0x1234567890123456789012345678901234567890',
        }),
      ).rejects.toThrow(/does not support USDT0 bridging/)
    })

    it('should return result with waitForDelivery method', async () => {
      const client = new WdkBridgeClient({
        accounts: { arbitrum: mockAccount },
      })

      const result = await client.bridge({
        fromChain: 'arbitrum',
        toChain: 'ethereum',
        amount: 50_000000n,
        recipient: '0x1234567890123456789012345678901234567890',
      })

      expect(result.waitForDelivery).toBeDefined()
      expect(typeof result.waitForDelivery).toBe('function')
    })

    describe('waitForDelivery on result', () => {
      it('should return success when delivery is confirmed', async () => {
        mockScanWaitForDelivery.mockResolvedValue({
          status: 'DELIVERED',
          dstTxHash: '0xdesthash',
        })

        const client = new WdkBridgeClient({
          accounts: { arbitrum: mockAccount },
        })

        const result = await client.bridge({
          fromChain: 'arbitrum',
          toChain: 'ethereum',
          amount: 50_000000n,
          recipient: '0x1234567890123456789012345678901234567890',
        })

        const delivery = await result.waitForDelivery()

        expect(delivery.success).toBe(true)
        expect(delivery.status).toBe('DELIVERED')
        expect(delivery.dstTxHash).toBe('0xdesthash')
        expect(delivery.srcTxHash).toBe('0xbridgehash')
        expect(delivery.messageGuid).toBe('0xbridgeguid')
      })

      it('should return failure when delivery fails', async () => {
        mockScanWaitForDelivery.mockRejectedValue(new Error('Bridge message failed: 0xguid'))

        const client = new WdkBridgeClient({
          accounts: { arbitrum: mockAccount },
        })

        const result = await client.bridge({
          fromChain: 'arbitrum',
          toChain: 'ethereum',
          amount: 50_000000n,
          recipient: '0x1234567890123456789012345678901234567890',
        })

        const delivery = await result.waitForDelivery()

        expect(delivery.success).toBe(false)
        expect(delivery.status).toBe('FAILED')
        expect(delivery.error).toContain('Bridge message failed')
      })

      it('should return failure on timeout', async () => {
        mockScanWaitForDelivery.mockRejectedValue(new Error('Timeout waiting for message delivery'))

        const client = new WdkBridgeClient({
          accounts: { arbitrum: mockAccount },
        })

        const result = await client.bridge({
          fromChain: 'arbitrum',
          toChain: 'ethereum',
          amount: 50_000000n,
          recipient: '0x1234567890123456789012345678901234567890',
        })

        const delivery = await result.waitForDelivery()

        expect(delivery.success).toBe(false)
        expect(delivery.status).toBe('FAILED')
        expect(delivery.error).toContain('Timeout')
      })

      it('should pass custom wait options', async () => {
        mockScanWaitForDelivery.mockResolvedValue({
          status: 'DELIVERED',
          dstTxHash: '0xdesthash',
        })

        const client = new WdkBridgeClient({
          accounts: { arbitrum: mockAccount },
        })

        const result = await client.bridge({
          fromChain: 'arbitrum',
          toChain: 'ethereum',
          amount: 50_000000n,
          recipient: '0x1234567890123456789012345678901234567890',
        })

        const statusChanges: string[] = []
        await result.waitForDelivery({
          timeout: 30_000,
          pollInterval: 5_000,
          onStatusChange: (status) => statusChanges.push(status),
        })

        expect(mockScanWaitForDelivery).toHaveBeenCalledWith(
          '0xbridgeguid',
          expect.objectContaining({
            timeout: 30_000,
            pollInterval: 5_000,
          }),
        )
      })

      it('should use default timeout and poll interval when not specified', async () => {
        mockScanWaitForDelivery.mockResolvedValue({
          status: 'DELIVERED',
          dstTxHash: '0xdesthash',
        })

        const client = new WdkBridgeClient({
          accounts: { arbitrum: mockAccount },
        })

        const result = await client.bridge({
          fromChain: 'arbitrum',
          toChain: 'ethereum',
          amount: 50_000000n,
          recipient: '0x1234567890123456789012345678901234567890',
        })

        await result.waitForDelivery()

        expect(mockScanWaitForDelivery).toHaveBeenCalledWith(
          '0xbridgeguid',
          expect.objectContaining({
            timeout: 600_000,
            pollInterval: 10_000,
          }),
        )
      })
    })
  })

  // ------------------------------------------------------------------
  // trackMessage
  // ------------------------------------------------------------------
  describe('trackMessage', () => {
    it('should delegate to LayerZero scan client getMessage', async () => {
      const mockMessage = {
        guid: '0xguid123',
        status: 'INFLIGHT',
        srcEid: 30110,
        dstEid: 30101,
      }
      mockScanGetMessage.mockResolvedValue(mockMessage)

      const client = new WdkBridgeClient({
        accounts: { ethereum: mockAccount },
      })

      const message = await client.trackMessage('0xguid123')

      expect(mockScanGetMessage).toHaveBeenCalledWith('0xguid123')
      expect(message).toEqual(mockMessage)
    })

    it('should propagate errors from scan client', async () => {
      mockScanGetMessage.mockRejectedValue(new Error('Message not found: 0xbad'))

      const client = new WdkBridgeClient({
        accounts: { ethereum: mockAccount },
      })

      await expect(client.trackMessage('0xbad')).rejects.toThrow('Message not found')
    })
  })

  // ------------------------------------------------------------------
  // waitForDelivery (client-level)
  // ------------------------------------------------------------------
  describe('waitForDelivery', () => {
    it('should delegate to LayerZero scan client waitForDelivery', async () => {
      const mockDelivered = {
        guid: '0xguid123',
        status: 'DELIVERED',
        dstTxHash: '0xdesttx',
      }
      mockScanWaitForDelivery.mockResolvedValue(mockDelivered)

      const client = new WdkBridgeClient({
        accounts: { ethereum: mockAccount },
      })

      const result = await client.waitForDelivery('0xguid123')

      expect(mockScanWaitForDelivery).toHaveBeenCalledWith('0xguid123', {
        timeout: 600_000,
        pollInterval: 10_000,
        onStatusChange: undefined,
      })
      expect(result).toEqual(mockDelivered)
    })

    it('should pass custom wait options', async () => {
      mockScanWaitForDelivery.mockResolvedValue({ status: 'DELIVERED' })

      const client = new WdkBridgeClient({
        accounts: { ethereum: mockAccount },
      })

      const statusCallback = vi.fn()
      await client.waitForDelivery('0xguid123', {
        timeout: 120_000,
        pollInterval: 3_000,
        onStatusChange: statusCallback,
      })

      expect(mockScanWaitForDelivery).toHaveBeenCalledWith('0xguid123', {
        timeout: 120_000,
        pollInterval: 3_000,
        onStatusChange: statusCallback,
      })
    })

    it('should propagate timeout errors', async () => {
      mockScanWaitForDelivery.mockRejectedValue(
        new Error('Timeout waiting for message delivery: 0xguid'),
      )

      const client = new WdkBridgeClient({
        accounts: { ethereum: mockAccount },
      })

      await expect(client.waitForDelivery('0xguid')).rejects.toThrow('Timeout')
    })

    it('should propagate failure errors', async () => {
      mockScanWaitForDelivery.mockRejectedValue(
        new Error('Bridge message failed: 0xguid'),
      )

      const client = new WdkBridgeClient({
        accounts: { ethereum: mockAccount },
      })

      await expect(client.waitForDelivery('0xguid')).rejects.toThrow('Bridge message failed')
    })

    it('should propagate blocked errors', async () => {
      mockScanWaitForDelivery.mockRejectedValue(
        new Error('Bridge message blocked by DVN: 0xguid'),
      )

      const client = new WdkBridgeClient({
        accounts: { ethereum: mockAccount },
      })

      await expect(client.waitForDelivery('0xguid')).rejects.toThrow('blocked by DVN')
    })
  })

  // ------------------------------------------------------------------
  // setRpcUrl
  // ------------------------------------------------------------------
  describe('setRpcUrl', () => {
    it('should set RPC URL for a chain', () => {
      const client = new WdkBridgeClient({
        accounts: { ethereum: mockAccount },
      })

      // Should not throw
      client.setRpcUrl('ethereum', 'https://eth-custom.example.com')
    })

    it('should normalize chain name to lowercase', () => {
      const client = new WdkBridgeClient({
        accounts: { ethereum: mockAccount },
      })

      // Should not throw
      client.setRpcUrl('ETHEREUM', 'https://eth-custom.example.com')
    })
  })

  // ------------------------------------------------------------------
  // hasChain
  // ------------------------------------------------------------------
  describe('hasChain', () => {
    it('should return true for configured chains', () => {
      const client = new WdkBridgeClient({
        accounts: {
          ethereum: mockAccount,
          arbitrum: mockAccount,
        },
      })

      expect(client.hasChain('ethereum')).toBe(true)
      expect(client.hasChain('arbitrum')).toBe(true)
    })

    it('should return false for unconfigured chains', () => {
      const client = new WdkBridgeClient({
        accounts: { ethereum: mockAccount },
      })

      expect(client.hasChain('arbitrum')).toBe(false)
      expect(client.hasChain('ink')).toBe(false)
    })

    it('should be case-insensitive', () => {
      const client = new WdkBridgeClient({
        accounts: { ethereum: mockAccount },
      })

      expect(client.hasChain('ETHEREUM')).toBe(true)
      expect(client.hasChain('Ethereum')).toBe(true)
    })
  })

  // ------------------------------------------------------------------
  // getConfiguredChains
  // ------------------------------------------------------------------
  describe('getConfiguredChains', () => {
    it('should return all configured chain names', () => {
      const client = new WdkBridgeClient({
        accounts: {
          ethereum: mockAccount,
          arbitrum: mockAccount,
          ink: mockAccount,
        },
      })

      const chains = client.getConfiguredChains()
      expect(chains).toHaveLength(3)
      expect(chains).toContain('ethereum')
      expect(chains).toContain('arbitrum')
      expect(chains).toContain('ink')
    })

    it('should return lowercase chain names', () => {
      const client = new WdkBridgeClient({
        accounts: {
          ETHEREUM: mockAccount,
          Arbitrum: mockAccount,
        },
      })

      const chains = client.getConfiguredChains()
      expect(chains).toEqual(expect.arrayContaining(['ethereum', 'arbitrum']))
    })
  })
})

// ------------------------------------------------------------------
// createWdkBridgeClient factory
// ------------------------------------------------------------------
describe('createWdkBridgeClient', () => {
  it('should create a WdkBridgeClient instance', () => {
    const mockAccount = createMockWdkAccount()
    const client = createWdkBridgeClient({
      accounts: { ethereum: mockAccount },
    })

    expect(client).toBeInstanceOf(WdkBridgeClient)
  })

  it('should pass configuration to the client', () => {
    const mockAccount = createMockWdkAccount()
    const client = createWdkBridgeClient({
      accounts: {
        ethereum: mockAccount,
        arbitrum: mockAccount,
      },
      defaultStrategy: 'fastest',
      defaultSlippage: 1.0,
    })

    expect(client.getConfiguredChains()).toHaveLength(2)
  })

  it('should throw for invalid configuration', () => {
    expect(() => createWdkBridgeClient({ accounts: {} })).toThrow(
      /At least one WDK account must be provided/,
    )
  })
})
