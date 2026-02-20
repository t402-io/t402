import { describe, it, expect, beforeEach, vi } from 'vitest'
import { T402WDK } from '../../src/t402wdk'
import type { WDKConstructor, WDKInstance, WDKAccount } from '../../src/types'

function createMockAccount(address: string): WDKAccount {
  return {
    getAddress: vi.fn().mockResolvedValue(address),
    getBalance: vi.fn().mockResolvedValue(1000000000000000000n),
    getTokenBalance: vi.fn().mockResolvedValue(1000000n),
    signMessage: vi.fn().mockResolvedValue('0xsignature'),
    signTypedData: vi.fn().mockResolvedValue('0xtypedSignature'),
    sendTransaction: vi.fn().mockResolvedValue('0xtxhash'),
    estimateGas: vi.fn().mockResolvedValue(21000n),
  }
}

function createMockWDKWithPathSupport(): WDKInstance {
  const defaultAccount = createMockAccount('0x1234567890123456789012345678901234567890')
  const pathAccount = createMockAccount('0xAAAABBBBCCCCDDDDEEEEFFFF0000111122223333')

  const wdk = {
    registerWallet: vi.fn().mockReturnThis(),
    registerProtocol: vi.fn().mockReturnThis(),
    getAccount: vi.fn().mockResolvedValue(defaultAccount),
    executeProtocol: vi.fn().mockResolvedValue({ txHash: '0xhash' }),
    getAccountByPath: vi.fn().mockResolvedValue(pathAccount),
  }

  return wdk as unknown as WDKInstance
}

function createMockWDKWithoutPathSupport(): WDKInstance {
  const defaultAccount = createMockAccount('0x1234567890123456789012345678901234567890')

  return {
    registerWallet: vi.fn().mockReturnThis(),
    registerProtocol: vi.fn().mockReturnThis(),
    getAccount: vi.fn().mockResolvedValue(defaultAccount),
    executeProtocol: vi.fn().mockResolvedValue({ txHash: '0xhash' }),
  }
}

const MockWDKConstructor: WDKConstructor = class MockWDK {
  constructor(_seedPhrase: string) {
    return createMockWDKWithPathSupport() as unknown as WDKInstance
  }
  static getRandomSeedPhrase(): string {
    return 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
  }
} as unknown as WDKConstructor

const MockWalletManagerEvm = {}
const VALID_SEED =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

describe('HD Derivation Paths', () => {
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
  })

  describe('getSignerByPath', () => {
    it('should return a signer for a valid derivation path', async () => {
      const mockWdk = createMockWDKWithPathSupport()
      const wdk = T402WDK.fromWDK(mockWdk, {
        arbitrum: 'https://arb1.arbitrum.io/rpc',
      })

      const signer = await wdk.getSignerByPath('arbitrum', "m/44'/60'/1'/0/0")
      expect(signer).toBeDefined()
    })

    it('should return a signer with the path-derived address', async () => {
      const mockWdk = createMockWDKWithPathSupport()
      const wdk = T402WDK.fromWDK(mockWdk, {
        arbitrum: 'https://arb1.arbitrum.io/rpc',
      })

      const signer = await wdk.getSignerByPath('arbitrum', "m/44'/60'/1'/0/0")
      expect(signer).toBeDefined()
      // The mock getAccountByPath returns a specific address
      expect((mockWdk as any).getAccountByPath).toHaveBeenCalledWith('arbitrum', "m/44'/60'/1'/0/0")
    })

    it('should cache signers for the same chain+path combination', async () => {
      const mockWdk = createMockWDKWithPathSupport()
      const wdk = T402WDK.fromWDK(mockWdk, {
        arbitrum: 'https://arb1.arbitrum.io/rpc',
      })

      const signer1 = await wdk.getSignerByPath('arbitrum', "m/44'/60'/1'/0/0")
      const signer2 = await wdk.getSignerByPath('arbitrum', "m/44'/60'/1'/0/0")
      expect(signer1).toBe(signer2)
      // getAccountByPath should only be called once due to caching
      expect((mockWdk as any).getAccountByPath).toHaveBeenCalledTimes(1)
    })

    it('should return different signers for different paths', async () => {
      const pathAccount1 = createMockAccount('0xAAAABBBBCCCCDDDDEEEEFFFF0000111122223333')
      const pathAccount2 = createMockAccount('0x5555666677778888999900001111222233334444')

      const mockWdk = createMockWDKWithPathSupport()
      ;(mockWdk as any).getAccountByPath = vi
        .fn()
        .mockResolvedValueOnce(pathAccount1)
        .mockResolvedValueOnce(pathAccount2)

      const wdk = T402WDK.fromWDK(mockWdk, {
        arbitrum: 'https://arb1.arbitrum.io/rpc',
      })

      const signer1 = await wdk.getSignerByPath('arbitrum', "m/44'/60'/0'/0/0")
      const signer2 = await wdk.getSignerByPath('arbitrum', "m/44'/60'/1'/0/0")
      expect(signer1).not.toBe(signer2)
    })

    it('should return different signers for different chains with same path', async () => {
      const mockWdk = createMockWDKWithPathSupport()
      const wdk = T402WDK.fromWDK(mockWdk, {
        arbitrum: 'https://arb1.arbitrum.io/rpc',
        base: 'https://mainnet.base.org',
      })

      const signer1 = await wdk.getSignerByPath('arbitrum', "m/44'/60'/0'/0/0")
      const signer2 = await wdk.getSignerByPath('base', "m/44'/60'/0'/0/0")
      expect(signer1).not.toBe(signer2)
    })

    it('should throw when WDK does not support getAccountByPath', async () => {
      const mockWdk = createMockWDKWithoutPathSupport()
      const wdk = T402WDK.fromWDK(mockWdk, {
        arbitrum: 'https://arb1.arbitrum.io/rpc',
      })

      await expect(wdk.getSignerByPath('arbitrum', "m/44'/60'/1'/0/0")).rejects.toThrow(
        /getAccountByPath/,
      )
    })

    it('should throw when WDK is not initialized', async () => {
      // Create instance without registering WDK
      const wdk = new T402WDK(VALID_SEED)

      await expect(wdk.getSignerByPath('arbitrum', "m/44'/60'/0'/0/0")).rejects.toThrow()
    })

    it('should support BIP-44 standard paths', async () => {
      const mockWdk = createMockWDKWithPathSupport()
      const wdk = T402WDK.fromWDK(mockWdk, {
        arbitrum: 'https://arb1.arbitrum.io/rpc',
      })

      // Standard Ethereum BIP-44 path
      await wdk.getSignerByPath('arbitrum', "m/44'/60'/0'/0/0")
      expect((mockWdk as any).getAccountByPath).toHaveBeenCalledWith('arbitrum', "m/44'/60'/0'/0/0")
    })
  })
})
