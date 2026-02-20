import { describe, it, expect } from 'vitest'
import {
  createMockWDKAccount,
  createMockWDKInstance,
  createMockTonAccount,
  createMockSolanaAccount,
  createMockTronAccount,
  createMockT402WDK,
} from '../../src/testing/index'

describe('WDK Test Harness', () => {
  describe('createMockWDKAccount', () => {
    it('should create account with default values', async () => {
      const account = createMockWDKAccount()
      expect(await account.getAddress()).toBe('0x1234567890123456789012345678901234567890')
      expect(await account.getBalance()).toBe(1000000000000000000n)
      expect(await account.getTokenBalance('0xtoken')).toBe(1000000n)
      expect(await account.signMessage('hello')).toBe('0xmocksignature')
      expect(
        await account.signTypedData({ domain: {}, types: {}, primaryType: '', message: {} }),
      ).toBe('0xmocktypedsignature')
      expect(await account.sendTransaction({ to: '0x', value: 1n })).toBe('0xmocktxhash')
      expect(await account.estimateGas!({ to: '0x' })).toBe(21000n)
    })

    it('should allow overriding specific methods', async () => {
      const account = createMockWDKAccount({
        getAddress: async () => '0xCAFE',
        getBalance: async () => 42n,
      })
      expect(await account.getAddress()).toBe('0xCAFE')
      expect(await account.getBalance()).toBe(42n)
      // Non-overridden methods keep defaults
      expect(await account.getTokenBalance('x')).toBe(1000000n)
    })
  })

  describe('createMockWDKInstance', () => {
    it('should return default account for any chain', async () => {
      const instance = createMockWDKInstance()
      const account = await instance.getAccount('arbitrum', 0)
      expect(await account.getAddress()).toBe('0x1234567890123456789012345678901234567890')
    })

    it('should return chain-specific accounts when provided', async () => {
      const customAccount = createMockWDKAccount({ getAddress: async () => '0xBEEF' })
      const instance = createMockWDKInstance({ ethereum: customAccount })

      const ethAccount = await instance.getAccount('ethereum', 0)
      expect(await ethAccount.getAddress()).toBe('0xBEEF')

      // Unknown chain falls back to default
      const arbAccount = await instance.getAccount('arbitrum', 0)
      expect(await arbAccount.getAddress()).toBe('0x1234567890123456789012345678901234567890')
    })

    it('should support registerWallet chaining', () => {
      const instance = createMockWDKInstance()
      const result = instance.registerWallet('test', {}, {})
      expect(result).toBe(instance)
    })

    it('should support registerProtocol chaining', () => {
      const instance = createMockWDKInstance()
      const result = instance.registerProtocol('test', {})
      expect(result).toBe(instance)
    })

    it('should return mock executeProtocol result', async () => {
      const instance = createMockWDKInstance()
      const result = await instance.executeProtocol('bridge', {})
      expect(result.txHash).toBe('0xmockprotocoltxhash')
    })
  })

  describe('createMockTonAccount', () => {
    it('should create TON account with defaults', async () => {
      const account = createMockTonAccount()
      expect(await account.getAddress()).toContain('UQBMock')
      expect(await account.getBalance()).toBe(5000000000n)
      expect(await account.getJettonBalance('master')).toBe(1000000n)
      expect(await account.getSeqno()).toBe(1)
      const sig = await account.signMessage(new Uint8Array(32))
      expect(sig).toBeInstanceOf(Uint8Array)
    })

    it('should allow overriding', async () => {
      const account = createMockTonAccount({ getBalance: async () => 999n })
      expect(await account.getBalance()).toBe(999n)
    })
  })

  describe('createMockSolanaAccount', () => {
    it('should create Solana account with defaults', async () => {
      const account = createMockSolanaAccount()
      const address = await account.getAddress()
      expect(address).toBeTruthy()
      expect(await account.getBalance()).toBe(2000000000n)
      expect(await account.getTokenBalance('mint')).toBe(1000000n)
      const sig = await account.sign(new Uint8Array(32))
      expect(sig).toBeInstanceOf(Uint8Array)
    })
  })

  describe('createMockTronAccount', () => {
    it('should create TRON account with defaults', async () => {
      const account = createMockTronAccount()
      const address = await account.getAddress()
      expect(address).toContain('TJMock')
      expect(await account.getBalance()).toBe(10000000n)
      expect(await account.getTrc20Balance('contract')).toBe(1000000n)
    })
  })

  describe('createMockT402WDK', () => {
    it('should create complete mock with defaults', async () => {
      const mock = createMockT402WDK()
      expect(mock.wdkInstance).toBeDefined()
      expect(mock.chainConfig).toHaveProperty('arbitrum')
      expect(mock.evmAccount).toBeDefined()
      expect(mock.tonAccount).toBeDefined()
      expect(mock.solanaAccount).toBeDefined()
      expect(mock.tronAccount).toBeDefined()
    })

    it('should configure custom chains', async () => {
      const mock = createMockT402WDK({ chains: ['ethereum', 'base'] })
      expect(mock.chainConfig).toHaveProperty('ethereum')
      expect(mock.chainConfig).toHaveProperty('base')
      expect(mock.chainConfig).not.toHaveProperty('arbitrum')
    })

    it('should allow overriding account properties', async () => {
      const mock = createMockT402WDK({
        evmAccount: { getBalance: async () => 555n },
      })
      expect(await mock.evmAccount.getBalance()).toBe(555n)
    })

    it('should return chain-specific accounts from WDK instance', async () => {
      const mock = createMockT402WDK({ chains: ['arbitrum'] })
      const account = await mock.wdkInstance.getAccount('arbitrum', 0)
      expect(await account.getAddress()).toBe('0x1234567890123456789012345678901234567890')
    })
  })
})
