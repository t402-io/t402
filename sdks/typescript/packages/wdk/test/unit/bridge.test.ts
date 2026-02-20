import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WdkBridge, createDirectBridge } from '../../src/bridge'

// Mock @t402/evm module
vi.mock('@t402/evm', () => ({
  Usdt0Bridge: vi.fn().mockImplementation((signer, chain) => ({
    signer,
    chain,
    quote: vi.fn(),
    send: vi.fn(),
  })),
  supportsBridging: vi.fn((chain: string) => {
    const supported = ['ethereum', 'arbitrum', 'base', 'ink', 'berachain', 'unichain']
    return supported.includes(chain)
  }),
  getBridgeableChains: vi.fn(() => [
    'ethereum',
    'arbitrum',
    'base',
    'ink',
    'berachain',
    'unichain',
  ]),
}))

// Mock bridge-tracker (may be added by another agent)
vi.mock('../../src/bridge-tracker', () => ({
  BridgeTracker: vi.fn().mockImplementation(() => ({
    track: vi.fn(),
    getStatus: vi.fn(),
    getHistory: vi.fn().mockReturnValue([]),
  })),
}))

// Helper to create a mock WDKSigner
function createMockSigner(address = '0x1234567890123456789012345678901234567890') {
  return {
    address: address as `0x${string}`,
    signTypedData: vi.fn().mockResolvedValue('0xmocksig'),
    signMessage: vi.fn().mockResolvedValue('0xmocksig'),
    sendTransaction: vi
      .fn()
      .mockResolvedValue({
        hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as `0x${string}`,
      }),
    getChain: vi.fn().mockReturnValue('arbitrum'),
    getChainId: vi.fn().mockReturnValue(42161),
    isInitialized: true,
    initialize: vi.fn(),
  }
}

describe('WdkBridge', () => {
  describe('supportsBridging', () => {
    it('should return true for supported chains', () => {
      expect(WdkBridge.supportsBridging('ethereum')).toBe(true)
      expect(WdkBridge.supportsBridging('arbitrum')).toBe(true)
      expect(WdkBridge.supportsBridging('base')).toBe(true)
    })

    it('should return false for unsupported chains', () => {
      expect(WdkBridge.supportsBridging('polygon')).toBe(false)
      expect(WdkBridge.supportsBridging('unknown')).toBe(false)
    })
  })

  describe('getBridgeableChains', () => {
    it('should return all bridgeable chains', () => {
      const chains = WdkBridge.getBridgeableChains()
      expect(chains).toContain('ethereum')
      expect(chains).toContain('arbitrum')
      expect(chains).toContain('base')
      expect(chains.length).toBeGreaterThan(0)
    })
  })

  describe('getSupportedDestinations', () => {
    it('should return destinations excluding source chain', () => {
      const destinations = WdkBridge.getSupportedDestinations('arbitrum')
      expect(destinations).toContain('ethereum')
      expect(destinations).toContain('base')
      expect(destinations).not.toContain('arbitrum')
    })

    it('should return all bridgeable chains when source not in list', () => {
      const destinations = WdkBridge.getSupportedDestinations('polygon')
      expect(destinations).toContain('ethereum')
      expect(destinations).toContain('arbitrum')
    })
  })

  describe('getBridge', () => {
    it('should create a bridge instance with rpcUrl', () => {
      const bridge = new WdkBridge()
      const signer = createMockSigner()
      const result = bridge.getBridge('arbitrum', signer as never, 'https://arb1.arbitrum.io/rpc')
      expect(result).toBeDefined()
    })

    it('should cache bridge instances', () => {
      const bridge = new WdkBridge()
      const signer = createMockSigner()
      const first = bridge.getBridge('arbitrum', signer as never, 'https://arb1.arbitrum.io/rpc')
      const second = bridge.getBridge('arbitrum', signer as never, 'https://arb1.arbitrum.io/rpc')
      expect(first).toBe(second)
    })

    it('should create separate instances for different chains', () => {
      const bridge = new WdkBridge()
      const signer = createMockSigner()
      const arb = bridge.getBridge('arbitrum', signer as never, 'https://arb1.arbitrum.io/rpc')
      const eth = bridge.getBridge('ethereum', signer as never, 'https://eth.drpc.org')
      expect(arb).not.toBe(eth)
    })
  })

  describe('createBridgeSigner (via getBridge)', () => {
    let originalFetch: typeof globalThis.fetch
    let mockFetch: ReturnType<typeof vi.fn>

    beforeEach(() => {
      originalFetch = globalThis.fetch
      mockFetch = vi.fn()
      globalThis.fetch = mockFetch
    })

    afterEach(() => {
      globalThis.fetch = originalFetch
    })

    it('readContract should call eth_call via JSON-RPC', async () => {
      // balanceOf returns a uint256
      const balanceHex = '0x' + '00'.repeat(31) + '0a' // 10n
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jsonrpc: '2.0', id: 1, result: balanceHex }),
      })

      const bridge = new WdkBridge()
      const signer = createMockSigner()
      bridge.getBridge('arbitrum', signer as never, 'https://arb1.arbitrum.io/rpc')

      // Access the bridge signer through the created Usdt0Bridge
      const { Usdt0Bridge: MockBridge } = await import('@t402/evm')
      const bridgeSignerArg = (MockBridge as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => c[1] === 'arbitrum',
      )?.[0]

      expect(bridgeSignerArg).toBeDefined()
      expect(bridgeSignerArg.address).toBe('0x1234567890123456789012345678901234567890')

      const result = await bridgeSignerArg.readContract({
        address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
        abi: [],
        functionName: 'balanceOf',
        args: ['0x1234567890123456789012345678901234567890'],
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://arb1.arbitrum.io/rpc',
        expect.objectContaining({
          method: 'POST',
        }),
      )
      expect(result).toBe(10n)
    })

    it('readContract should handle allowance calls', async () => {
      const allowanceHex = '0x' + BigInt(1000000).toString(16).padStart(64, '0')
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jsonrpc: '2.0', id: 1, result: allowanceHex }),
      })

      const bridge = new WdkBridge()
      const signer = createMockSigner()
      bridge.getBridge('arbitrum', signer as never, 'https://arb1.arbitrum.io/rpc')

      const { Usdt0Bridge: MockBridge } = await import('@t402/evm')
      const bridgeSigner = (MockBridge as unknown as ReturnType<typeof vi.fn>).mock.calls.at(
        -1,
      )?.[0]

      const result = await bridgeSigner.readContract({
        address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
        abi: [],
        functionName: 'allowance',
        args: [
          '0x1234567890123456789012345678901234567890',
          '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        ],
      })

      expect(result).toBe(1000000n)
    })

    it('writeContract should call signer.sendTransaction', async () => {
      const signer = createMockSigner()
      const bridge = new WdkBridge()
      bridge.getBridge('arbitrum', signer as never, 'https://arb1.arbitrum.io/rpc')

      const { Usdt0Bridge: MockBridge } = await import('@t402/evm')
      const bridgeSigner = (MockBridge as unknown as ReturnType<typeof vi.fn>).mock.calls.at(
        -1,
      )?.[0]

      const hash = await bridgeSigner.writeContract({
        address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9' as `0x${string}`,
        abi: [],
        functionName: 'approve',
        args: ['0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', 1000000n],
      })

      expect(signer.sendTransaction).toHaveBeenCalled()
      expect(hash).toBe('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890')
    })

    it('waitForTransactionReceipt should poll until receipt is found', async () => {
      // First call returns null, second returns receipt
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ jsonrpc: '2.0', id: 1, result: null }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              jsonrpc: '2.0',
              id: 2,
              result: {
                status: '0x1',
                transactionHash: '0xabc123',
                logs: [],
              },
            }),
        })

      const signer = createMockSigner()
      const bridge = new WdkBridge()
      bridge.getBridge('arbitrum', signer as never, 'https://arb1.arbitrum.io/rpc')

      const { Usdt0Bridge: MockBridge } = await import('@t402/evm')
      const bridgeSigner = (MockBridge as unknown as ReturnType<typeof vi.fn>).mock.calls.at(
        -1,
      )?.[0]

      const receipt = await bridgeSigner.waitForTransactionReceipt({
        hash: '0xabc123' as `0x${string}`,
      })

      expect(receipt.status).toBe('success')
      expect(receipt.transactionHash).toBe('0xabc123')
    })

    it('readContract should throw on JSON-RPC error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            id: 1,
            error: { code: -32000, message: 'execution reverted' },
          }),
      })

      const signer = createMockSigner()
      const bridge = new WdkBridge()
      bridge.getBridge('arbitrum', signer as never, 'https://arb1.arbitrum.io/rpc')

      const { Usdt0Bridge: MockBridge } = await import('@t402/evm')
      const bridgeSigner = (MockBridge as unknown as ReturnType<typeof vi.fn>).mock.calls.at(
        -1,
      )?.[0]

      await expect(
        bridgeSigner.readContract({
          address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
          abi: [],
          functionName: 'balanceOf',
          args: ['0x1234567890123456789012345678901234567890'],
        }),
      ).rejects.toThrow('JSON-RPC error -32000: execution reverted')
    })

    it('readContract should throw on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      })

      const signer = createMockSigner()
      const bridge = new WdkBridge()
      bridge.getBridge('arbitrum', signer as never, 'https://arb1.arbitrum.io/rpc')

      const { Usdt0Bridge: MockBridge } = await import('@t402/evm')
      const bridgeSigner = (MockBridge as unknown as ReturnType<typeof vi.fn>).mock.calls.at(
        -1,
      )?.[0]

      await expect(
        bridgeSigner.readContract({
          address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
          abi: [],
          functionName: 'balanceOf',
          args: ['0x1234567890123456789012345678901234567890'],
        }),
      ).rejects.toThrow('JSON-RPC request failed: 503 Service Unavailable')
    })

    it('readContract should throw for unknown function names', async () => {
      const signer = createMockSigner()
      const bridge = new WdkBridge()
      bridge.getBridge('arbitrum', signer as never, 'https://arb1.arbitrum.io/rpc')

      const { Usdt0Bridge: MockBridge } = await import('@t402/evm')
      const bridgeSigner = (MockBridge as unknown as ReturnType<typeof vi.fn>).mock.calls.at(
        -1,
      )?.[0]

      await expect(
        bridgeSigner.readContract({
          address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
          abi: [],
          functionName: 'unknownFunction',
          args: [],
        }),
      ).rejects.toThrow('Unknown function: unknownFunction')
    })
  })
})

describe('createDirectBridge', () => {
  it('should create a Usdt0Bridge instance', () => {
    const mockSigner = {
      address: '0x1234567890123456789012345678901234567890' as `0x${string}`,
      readContract: vi.fn(),
      writeContract: vi.fn(),
      waitForTransactionReceipt: vi.fn(),
    }

    const bridge = createDirectBridge(mockSigner, 'arbitrum')
    expect(bridge).toBeDefined()
  })
})
