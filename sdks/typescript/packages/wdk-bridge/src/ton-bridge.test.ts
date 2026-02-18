import { describe, it, expect, vi } from 'vitest'
import { T402TonBridge } from './ton-bridge'
import type { TonBridgeConfig } from './ton-bridge'

describe('T402TonBridge', () => {
  function createMockTonWallet() {
    return {
      getAddress: vi.fn().mockResolvedValue('UQTestAddress1234567890123456789012345678901234'),
      getBalance: vi.fn().mockResolvedValue(5000000000n),
      getJettonBalance: vi.fn().mockResolvedValue(10000000n),
      sendTransaction: vi.fn().mockResolvedValue('ton-tx-hash-123'),
      signMessage: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    }
  }

  function createMockEvmAccount() {
    return {
      getAddress: vi.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
      sendTransaction: vi.fn().mockResolvedValue('evm-tx-hash-456'),
    }
  }

  function createConfig(overrides?: Partial<TonBridgeConfig>): TonBridgeConfig {
    return {
      tonWallet: createMockTonWallet(),
      evmAccounts: {
        ethereum: createMockEvmAccount(),
        arbitrum: createMockEvmAccount(),
      },
      ...overrides,
    }
  }

  describe('constructor', () => {
    it('should create a bridge instance', () => {
      const bridge = new T402TonBridge(createConfig())
      expect(bridge).toBeInstanceOf(T402TonBridge)
    })

    it('should throw without TON wallet', () => {
      expect(() => new T402TonBridge({ tonWallet: null as unknown })).toThrow(
        'TON wallet is required',
      )
    })
  })

  describe('bridgeToEvm', () => {
    it('should bridge from TON to EVM', async () => {
      const bridge = new T402TonBridge(createConfig())

      const result = await bridge.bridgeToEvm({
        toChain: 'ethereum',
        amount: 1000000n,
        recipient: '0x1234567890123456789012345678901234567890',
      })

      expect(result.txHash).toBe('ton-tx-hash-123')
      expect(result.fromNetwork).toBe('ton:mainnet')
      expect(result.toNetwork).toBe('eip155:1')
      expect(result.estimatedTime).toBeGreaterThan(0)
    })

    it('should throw for missing destination chain', async () => {
      const bridge = new T402TonBridge(createConfig())

      await expect(
        bridge.bridgeToEvm({
          toChain: '',
          amount: 1000000n,
          recipient: '0x1234',
        }),
      ).rejects.toThrow('Destination chain is required')
    })

    it('should throw for zero amount', async () => {
      const bridge = new T402TonBridge(createConfig())

      await expect(
        bridge.bridgeToEvm({
          toChain: 'ethereum',
          amount: 0n,
          recipient: '0x1234',
        }),
      ).rejects.toThrow('Bridge amount must be greater than zero')
    })

    it('should throw for missing recipient', async () => {
      const bridge = new T402TonBridge(createConfig())

      await expect(
        bridge.bridgeToEvm({
          toChain: 'ethereum',
          amount: 1000000n,
          recipient: '',
        }),
      ).rejects.toThrow('Recipient address is required')
    })
  })

  describe('bridgeFromEvm', () => {
    it('should bridge from EVM to TON', async () => {
      const bridge = new T402TonBridge(createConfig())

      const result = await bridge.bridgeFromEvm({
        fromChain: 'ethereum',
        amount: 1000000n,
        recipient: 'UQTestAddress1234567890123456789012345678901234',
      })

      expect(result.txHash).toBe('evm-tx-hash-456')
      expect(result.fromNetwork).toBe('eip155:1')
      expect(result.toNetwork).toBe('ton:mainnet')
      expect(result.estimatedTime).toBeGreaterThan(0)
    })

    it('should throw for missing source chain', async () => {
      const bridge = new T402TonBridge(createConfig())

      await expect(
        bridge.bridgeFromEvm({
          fromChain: '',
          amount: 1000000n,
          recipient: 'UQTest',
        }),
      ).rejects.toThrow('Source chain is required')
    })

    it('should throw for unconfigured EVM chain', async () => {
      const bridge = new T402TonBridge(createConfig({ evmAccounts: {} }))

      await expect(
        bridge.bridgeFromEvm({
          fromChain: 'polygon',
          amount: 1000000n,
          recipient: 'UQTest',
        }),
      ).rejects.toThrow('No EVM account configured for chain: polygon')
    })
  })

  describe('getTonUsdt0Balance', () => {
    it('should return USDT0 balance', async () => {
      const bridge = new T402TonBridge(createConfig())

      const balance = await bridge.getTonUsdt0Balance()

      expect(balance).toBe(10000000n)
    })
  })

  describe('quote', () => {
    it('should return a fee quote for TON to EVM', async () => {
      const bridge = new T402TonBridge(createConfig())

      const quote = await bridge.quote({
        direction: 'ton-to-evm',
        evmChain: 'ethereum',
        amount: 1000000n,
      })

      expect(quote.nativeFee).toBeGreaterThan(0n)
      expect(quote.estimatedTime).toBeGreaterThan(0)
      expect(quote.minAmountToReceive).toBe(1000000n)
    })

    it('should return a fee quote for EVM to TON', async () => {
      const bridge = new T402TonBridge(createConfig())

      const quote = await bridge.quote({
        direction: 'evm-to-ton',
        evmChain: 'arbitrum',
        amount: 5000000n,
      })

      expect(quote.nativeFee).toBeGreaterThan(0n)
      expect(quote.estimatedTime).toBeGreaterThan(0)
      expect(quote.minAmountToReceive).toBe(5000000n)
    })

    it('should throw for zero amount', async () => {
      const bridge = new T402TonBridge(createConfig())

      await expect(
        bridge.quote({
          direction: 'ton-to-evm',
          evmChain: 'ethereum',
          amount: 0n,
        }),
      ).rejects.toThrow('Quote amount must be greater than zero')
    })
  })
})
