/**
 * @t402/wdk-bridge Signer Tests
 *
 * Tests for WdkBridgeSigner which adapts WDK accounts to the BridgeSigner interface.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WdkAccount } from './types.js'

// Mock viem before importing the signer
vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem')
  return {
    ...actual,
    createPublicClient: vi.fn(() => mockPublicClient),
    http: vi.fn(() => 'mock-transport'),
    encodeFunctionData: vi.fn(() => '0xencodeddata'),
  }
})

vi.mock('viem/chains', () => ({
  mainnet: { id: 1, name: 'Ethereum', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['https://eth.example.com'] } } },
  arbitrum: { id: 42161, name: 'Arbitrum One', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['https://arb.example.com'] } } },
}))

/**
 * Mock public client used by the signer for on-chain reads and tx receipts
 */
const mockPublicClient = {
  readContract: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
}

/**
 * Create a mock WDK account with sensible defaults
 */
function createMockWdkAccount(overrides?: Partial<WdkAccount>): WdkAccount {
  return {
    getAddress: vi.fn().mockResolvedValue('0xABCDEF1234567890ABCDEF1234567890ABCDEF12'),
    getBalance: vi.fn().mockResolvedValue(2_000000000000000000n), // 2 ETH
    getTokenBalance: vi.fn().mockResolvedValue(500_000000n), // 500 USDT0
    signMessage: vi.fn().mockResolvedValue('0xsignature'),
    signTypedData: vi.fn().mockResolvedValue('0xsignature'),
    sendTransaction: vi.fn().mockResolvedValue('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'),
    ...overrides,
  }
}

// Import after mocks are set up
import { WdkBridgeSigner, createWdkBridgeSigner } from './signer.js'

describe('WdkBridgeSigner', () => {
  let mockAccount: WdkAccount

  beforeEach(() => {
    mockAccount = createMockWdkAccount()
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('should create a signer with the given chain name', () => {
      const signer = new WdkBridgeSigner(mockAccount, 'ethereum')
      expect(signer).toBeInstanceOf(WdkBridgeSigner)
    })

    it('should normalize chain name to lowercase', () => {
      const signer = new WdkBridgeSigner(mockAccount, 'ETHEREUM')
      // The signer should work without errors when initialized
      expect(signer).toBeDefined()
    })

    it('should set initial address to zero address before initialization', () => {
      const signer = new WdkBridgeSigner(mockAccount, 'ethereum')
      expect(signer.address).toBe('0x0000000000000000000000000000000000000000')
    })

    it('should accept an optional RPC URL', () => {
      const signer = new WdkBridgeSigner(mockAccount, 'ethereum', 'https://custom-rpc.example.com')
      expect(signer).toBeDefined()
    })

    it('should handle unknown chain names gracefully', () => {
      // Unknown chains should still create a signer with a fallback config
      const signer = new WdkBridgeSigner(mockAccount, 'ink')
      expect(signer).toBeDefined()
    })
  })

  describe('initialize', () => {
    it('should fetch address from WDK account', async () => {
      const signer = new WdkBridgeSigner(mockAccount, 'ethereum')
      await signer.initialize()

      expect(mockAccount.getAddress).toHaveBeenCalledOnce()
    })

    it('should set the address property after initialization', async () => {
      const signer = new WdkBridgeSigner(mockAccount, 'ethereum')
      await signer.initialize()

      expect(signer.address).toBe('0xABCDEF1234567890ABCDEF1234567890ABCDEF12')
    })

    it('should cache the address and not fetch again on second call', async () => {
      const signer = new WdkBridgeSigner(mockAccount, 'ethereum')
      await signer.initialize()
      await signer.initialize()

      expect(mockAccount.getAddress).toHaveBeenCalledOnce()
    })

    it('should propagate errors from getAddress', async () => {
      const failingAccount = createMockWdkAccount({
        getAddress: vi.fn().mockRejectedValue(new Error('WDK account not ready')),
      })
      const signer = new WdkBridgeSigner(failingAccount, 'ethereum')

      await expect(signer.initialize()).rejects.toThrow('WDK account not ready')
    })
  })

  describe('getAddress', () => {
    it('should return the WDK account address', async () => {
      const signer = new WdkBridgeSigner(mockAccount, 'ethereum')
      const address = await signer.getAddress()

      expect(address).toBe('0xABCDEF1234567890ABCDEF1234567890ABCDEF12')
    })

    it('should initialize if not already initialized', async () => {
      const signer = new WdkBridgeSigner(mockAccount, 'ethereum')
      // Not calling initialize() explicitly
      const address = await signer.getAddress()

      expect(mockAccount.getAddress).toHaveBeenCalled()
      expect(address).toBe('0xABCDEF1234567890ABCDEF1234567890ABCDEF12')
    })
  })

  describe('readContract', () => {
    it('should delegate to the public client', async () => {
      const signer = new WdkBridgeSigner(mockAccount, 'ethereum')
      const expectedResult = 42n

      mockPublicClient.readContract.mockResolvedValue(expectedResult)

      const result = await signer.readContract({
        address: '0x1234567890123456789012345678901234567890',
        abi: [{ name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] }],
        functionName: 'balanceOf',
        args: ['0xABCDEF1234567890ABCDEF1234567890ABCDEF12'],
      })

      expect(result).toBe(expectedResult)
      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: '0x1234567890123456789012345678901234567890',
        abi: expect.any(Array),
        functionName: 'balanceOf',
        args: ['0xABCDEF1234567890ABCDEF1234567890ABCDEF12'],
      })
    })

    it('should handle readContract without args', async () => {
      const signer = new WdkBridgeSigner(mockAccount, 'ethereum')
      mockPublicClient.readContract.mockResolvedValue('USDT0')

      const result = await signer.readContract({
        address: '0x1234567890123456789012345678901234567890',
        abi: [{ name: 'name', type: 'function', inputs: [], outputs: [{ type: 'string' }] }],
        functionName: 'name',
      })

      expect(result).toBe('USDT0')
    })

    it('should propagate read errors from the public client', async () => {
      const signer = new WdkBridgeSigner(mockAccount, 'ethereum')
      mockPublicClient.readContract.mockRejectedValue(new Error('Contract call reverted'))

      await expect(
        signer.readContract({
          address: '0x1234567890123456789012345678901234567890',
          abi: [],
          functionName: 'someFunction',
        }),
      ).rejects.toThrow('Contract call reverted')
    })
  })

  describe('writeContract', () => {
    it('should encode function data and send via WDK account', async () => {
      const signer = new WdkBridgeSigner(mockAccount, 'ethereum')
      await signer.initialize()

      const txHash = await signer.writeContract({
        address: '0x1234567890123456789012345678901234567890',
        abi: [{ name: 'transfer', type: 'function', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] }],
        functionName: 'transfer',
        args: ['0xABCDEF1234567890ABCDEF1234567890ABCDEF12', 100n],
      })

      expect(txHash).toBe('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890')
      expect(mockAccount.sendTransaction).toHaveBeenCalledWith({
        to: '0x1234567890123456789012345678901234567890',
        value: undefined,
        data: '0xencodeddata',
      })
    })

    it('should pass value for payable transactions', async () => {
      const signer = new WdkBridgeSigner(mockAccount, 'ethereum')
      await signer.initialize()

      await signer.writeContract({
        address: '0x1234567890123456789012345678901234567890',
        abi: [{ name: 'send', type: 'function' }],
        functionName: 'send',
        args: [],
        value: 1_000000000000000000n, // 1 ETH
      })

      expect(mockAccount.sendTransaction).toHaveBeenCalledWith({
        to: '0x1234567890123456789012345678901234567890',
        value: 1_000000000000000000n,
        data: '0xencodeddata',
      })
    })

    it('should auto-initialize if not already initialized', async () => {
      const signer = new WdkBridgeSigner(mockAccount, 'ethereum')
      // Not calling initialize() first

      await signer.writeContract({
        address: '0x1234567890123456789012345678901234567890',
        abi: [],
        functionName: 'test',
        args: [],
      })

      // initialize() should have been called internally
      expect(mockAccount.getAddress).toHaveBeenCalled()
      expect(mockAccount.sendTransaction).toHaveBeenCalled()
    })

    it('should propagate errors from sendTransaction', async () => {
      const failingAccount = createMockWdkAccount({
        sendTransaction: vi.fn().mockRejectedValue(new Error('Insufficient gas')),
      })
      const signer = new WdkBridgeSigner(failingAccount, 'ethereum')

      await expect(
        signer.writeContract({
          address: '0x1234567890123456789012345678901234567890',
          abi: [],
          functionName: 'transfer',
          args: [],
        }),
      ).rejects.toThrow('Insufficient gas')
    })
  })

  describe('waitForTransactionReceipt', () => {
    it('should delegate to the public client and convert the receipt', async () => {
      const signer = new WdkBridgeSigner(mockAccount, 'ethereum')

      const mockReceipt = {
        status: 'success' as const,
        transactionHash: '0xabcdef' as `0x${string}`,
        logs: [
          {
            address: '0x1234567890123456789012345678901234567890' as `0x${string}`,
            topics: ['0xtopic1' as `0x${string}`, '0xtopic2' as `0x${string}`] as readonly `0x${string}`[],
            data: '0xdata' as `0x${string}`,
          },
        ],
      }

      mockPublicClient.waitForTransactionReceipt.mockResolvedValue(mockReceipt)

      const result = await signer.waitForTransactionReceipt({
        hash: '0xabcdef' as `0x${string}`,
      })

      expect(result.status).toBe('success')
      expect(result.transactionHash).toBe('0xabcdef')
      expect(result.logs).toHaveLength(1)
      expect(result.logs[0].address).toBe('0x1234567890123456789012345678901234567890')
      expect(result.logs[0].topics).toEqual(['0xtopic1', '0xtopic2'])
      expect(result.logs[0].data).toBe('0xdata')
    })

    it('should return reverted status for failed transactions', async () => {
      const signer = new WdkBridgeSigner(mockAccount, 'ethereum')

      mockPublicClient.waitForTransactionReceipt.mockResolvedValue({
        status: 'reverted' as const,
        transactionHash: '0xfailed' as `0x${string}`,
        logs: [],
      })

      const result = await signer.waitForTransactionReceipt({
        hash: '0xfailed' as `0x${string}`,
      })

      expect(result.status).toBe('reverted')
      expect(result.logs).toHaveLength(0)
    })

    it('should handle receipts with multiple logs', async () => {
      const signer = new WdkBridgeSigner(mockAccount, 'ethereum')

      mockPublicClient.waitForTransactionReceipt.mockResolvedValue({
        status: 'success' as const,
        transactionHash: '0xmultilog' as `0x${string}`,
        logs: [
          { address: '0x1111111111111111111111111111111111111111' as `0x${string}`, topics: ['0xa' as `0x${string}`] as readonly `0x${string}`[], data: '0x01' as `0x${string}` },
          { address: '0x2222222222222222222222222222222222222222' as `0x${string}`, topics: ['0xb' as `0x${string}`] as readonly `0x${string}`[], data: '0x02' as `0x${string}` },
          { address: '0x3333333333333333333333333333333333333333' as `0x${string}`, topics: ['0xc' as `0x${string}`] as readonly `0x${string}`[], data: '0x03' as `0x${string}` },
        ],
      })

      const result = await signer.waitForTransactionReceipt({
        hash: '0xmultilog' as `0x${string}`,
      })

      expect(result.logs).toHaveLength(3)
      expect(result.logs[0].address).toBe('0x1111111111111111111111111111111111111111')
      expect(result.logs[2].address).toBe('0x3333333333333333333333333333333333333333')
    })

    it('should propagate timeout errors from the public client', async () => {
      const signer = new WdkBridgeSigner(mockAccount, 'ethereum')

      mockPublicClient.waitForTransactionReceipt.mockRejectedValue(
        new Error('Transaction not found after timeout'),
      )

      await expect(
        signer.waitForTransactionReceipt({ hash: '0xnotfound' as `0x${string}` }),
      ).rejects.toThrow('Transaction not found after timeout')
    })
  })

  describe('getNativeBalance', () => {
    it('should delegate to the WDK account getBalance', async () => {
      const signer = new WdkBridgeSigner(mockAccount, 'ethereum')
      const balance = await signer.getNativeBalance()

      expect(balance).toBe(2_000000000000000000n)
      expect(mockAccount.getBalance).toHaveBeenCalledOnce()
    })

    it('should return zero balance', async () => {
      const zeroAccount = createMockWdkAccount({
        getBalance: vi.fn().mockResolvedValue(0n),
      })
      const signer = new WdkBridgeSigner(zeroAccount, 'ethereum')
      const balance = await signer.getNativeBalance()

      expect(balance).toBe(0n)
    })

    it('should propagate errors from getBalance', async () => {
      const failingAccount = createMockWdkAccount({
        getBalance: vi.fn().mockRejectedValue(new Error('RPC connection failed')),
      })
      const signer = new WdkBridgeSigner(failingAccount, 'ethereum')

      await expect(signer.getNativeBalance()).rejects.toThrow('RPC connection failed')
    })
  })

  describe('getTokenBalance', () => {
    it('should delegate to the WDK account getTokenBalance', async () => {
      const signer = new WdkBridgeSigner(mockAccount, 'ethereum')
      const tokenAddress = '0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee'
      const balance = await signer.getTokenBalance(tokenAddress as `0x${string}`)

      expect(balance).toBe(500_000000n)
      expect(mockAccount.getTokenBalance).toHaveBeenCalledWith(tokenAddress)
    })

    it('should return zero for empty token balance', async () => {
      const emptyAccount = createMockWdkAccount({
        getTokenBalance: vi.fn().mockResolvedValue(0n),
      })
      const signer = new WdkBridgeSigner(emptyAccount, 'ethereum')
      const balance = await signer.getTokenBalance('0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee' as `0x${string}`)

      expect(balance).toBe(0n)
    })

    it('should propagate errors from getTokenBalance', async () => {
      const failingAccount = createMockWdkAccount({
        getTokenBalance: vi.fn().mockRejectedValue(new Error('Token contract not found')),
      })
      const signer = new WdkBridgeSigner(failingAccount, 'ethereum')

      await expect(
        signer.getTokenBalance('0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee' as `0x${string}`),
      ).rejects.toThrow('Token contract not found')
    })
  })
})

describe('createWdkBridgeSigner', () => {
  let mockAccount: WdkAccount

  beforeEach(() => {
    mockAccount = createMockWdkAccount()
    vi.clearAllMocks()
  })

  it('should create and initialize a signer', async () => {
    const signer = await createWdkBridgeSigner(mockAccount, 'ethereum')

    expect(signer).toBeInstanceOf(WdkBridgeSigner)
    expect(signer.address).toBe('0xABCDEF1234567890ABCDEF1234567890ABCDEF12')
    expect(mockAccount.getAddress).toHaveBeenCalledOnce()
  })

  it('should pass custom RPC URL to the signer', async () => {
    const signer = await createWdkBridgeSigner(mockAccount, 'arbitrum', 'https://custom-rpc.example.com')

    expect(signer).toBeInstanceOf(WdkBridgeSigner)
    expect(signer.address).toBe('0xABCDEF1234567890ABCDEF1234567890ABCDEF12')
  })

  it('should propagate initialization errors', async () => {
    const failingAccount = createMockWdkAccount({
      getAddress: vi.fn().mockRejectedValue(new Error('Account locked')),
    })

    await expect(createWdkBridgeSigner(failingAccount, 'ethereum')).rejects.toThrow('Account locked')
  })
})
