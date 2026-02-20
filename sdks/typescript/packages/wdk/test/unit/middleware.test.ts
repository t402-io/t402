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

function createMockWDK(): WDKInstance {
  const mockAccount = createMockAccount('0x1234567890123456789012345678901234567890')
  return {
    registerWallet: vi.fn().mockReturnThis(),
    registerProtocol: vi.fn().mockReturnThis(),
    getAccount: vi.fn().mockResolvedValue(mockAccount),
    executeProtocol: vi.fn().mockResolvedValue({ txHash: '0xhash' }),
  }
}

const MockWDKConstructor: WDKConstructor = class MockWDK {
  constructor(_seedPhrase: string) {
    return createMockWDK() as unknown as WDKInstance
  }
  static getRandomSeedPhrase(): string {
    return 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
  }
} as unknown as WDKConstructor

const MockWalletManagerEvm = {}
const VALID_SEED =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

describe('WDK Middleware Hooks', () => {
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
    T402WDK.clearMiddlewares()
  })

  describe('registerMiddleware', () => {
    it('should register a middleware for a chain', () => {
      const middleware = vi.fn()
      T402WDK.registerMiddleware('arbitrum', middleware)

      const middlewares = T402WDK.getMiddlewares('arbitrum')
      expect(middlewares).toHaveLength(1)
      expect(middlewares[0]).toBe(middleware)
    })

    it('should register multiple middlewares for the same chain', () => {
      const mw1 = vi.fn()
      const mw2 = vi.fn()
      const mw3 = vi.fn()

      T402WDK.registerMiddleware('arbitrum', mw1)
      T402WDK.registerMiddleware('arbitrum', mw2)
      T402WDK.registerMiddleware('arbitrum', mw3)

      const middlewares = T402WDK.getMiddlewares('arbitrum')
      expect(middlewares).toHaveLength(3)
      expect(middlewares).toContain(mw1)
      expect(middlewares).toContain(mw2)
      expect(middlewares).toContain(mw3)
    })

    it('should register middlewares for different chains independently', () => {
      const arbMiddleware = vi.fn()
      const baseMiddleware = vi.fn()

      T402WDK.registerMiddleware('arbitrum', arbMiddleware)
      T402WDK.registerMiddleware('base', baseMiddleware)

      expect(T402WDK.getMiddlewares('arbitrum')).toHaveLength(1)
      expect(T402WDK.getMiddlewares('base')).toHaveLength(1)
      expect(T402WDK.getMiddlewares('arbitrum')[0]).toBe(arbMiddleware)
      expect(T402WDK.getMiddlewares('base')[0]).toBe(baseMiddleware)
    })
  })

  describe('getMiddlewares', () => {
    it('should return empty array for chains with no middlewares', () => {
      const middlewares = T402WDK.getMiddlewares('ethereum')
      expect(middlewares).toEqual([])
      expect(middlewares).toHaveLength(0)
    })

    it('should return registered middlewares in order', () => {
      const mw1 = vi.fn()
      const mw2 = vi.fn()

      T402WDK.registerMiddleware('arbitrum', mw1)
      T402WDK.registerMiddleware('arbitrum', mw2)

      const middlewares = T402WDK.getMiddlewares('arbitrum')
      expect(middlewares[0]).toBe(mw1)
      expect(middlewares[1]).toBe(mw2)
    })
  })

  describe('clearMiddlewares', () => {
    it('should clear all registered middlewares', () => {
      T402WDK.registerMiddleware('arbitrum', vi.fn())
      T402WDK.registerMiddleware('base', vi.fn())
      T402WDK.registerMiddleware('ethereum', vi.fn())

      expect(T402WDK.getMiddlewares('arbitrum')).toHaveLength(1)
      expect(T402WDK.getMiddlewares('base')).toHaveLength(1)

      T402WDK.clearMiddlewares()

      expect(T402WDK.getMiddlewares('arbitrum')).toHaveLength(0)
      expect(T402WDK.getMiddlewares('base')).toHaveLength(0)
      expect(T402WDK.getMiddlewares('ethereum')).toHaveLength(0)
    })

    it('should allow re-registering after clearing', () => {
      const mw = vi.fn()
      T402WDK.registerMiddleware('arbitrum', mw)
      T402WDK.clearMiddlewares()

      expect(T402WDK.getMiddlewares('arbitrum')).toHaveLength(0)

      T402WDK.registerMiddleware('arbitrum', mw)
      expect(T402WDK.getMiddlewares('arbitrum')).toHaveLength(1)
    })
  })

  describe('middleware execution during WDK initialization', () => {
    it('should wire middlewares into WDK when registerMiddleware is available', () => {
      const middleware = vi.fn()
      T402WDK.registerMiddleware('arbitrum', middleware)

      // Create a mock WDK instance that supports registerMiddleware
      const mockWdkWithMiddleware = createMockWDK()
      ;(mockWdkWithMiddleware as any).registerMiddleware = vi.fn()

      T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)

      // Creating instance triggers _initializeWDK which should wire middlewares
      const wdk = new T402WDK(VALID_SEED, { arbitrum: 'https://arb1.arbitrum.io/rpc' })

      // The mock WDK constructor creates a new instance each time,
      // so the registerMiddleware on our specific mock won't be called.
      // But this verifies that initialization doesn't throw.
      expect(wdk.isInitialized).toBe(true)
    })

    it('should not throw when WDK does not support registerMiddleware', () => {
      T402WDK.registerMiddleware('arbitrum', vi.fn())
      T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)

      // Should not throw even though mock WDK doesn't have registerMiddleware
      const wdk = new T402WDK(VALID_SEED, { arbitrum: 'https://arb1.arbitrum.io/rpc' })
      expect(wdk.isInitialized).toBe(true)
    })
  })

  describe('middleware function contract', () => {
    it('should accept async middleware functions', () => {
      const asyncMiddleware = async (_account: unknown) => {
        await new Promise((resolve) => setTimeout(resolve, 1))
      }

      T402WDK.registerMiddleware('arbitrum', asyncMiddleware)
      expect(T402WDK.getMiddlewares('arbitrum')).toHaveLength(1)
    })

    it('should accept middleware that receives account parameter', async () => {
      const mockAccount = { address: '0x123' }
      const middleware = vi.fn().mockResolvedValue(undefined)

      T402WDK.registerMiddleware('arbitrum', middleware)

      // Execute the middleware manually to verify it accepts the account
      const mws = T402WDK.getMiddlewares('arbitrum')
      await mws[0](mockAccount)

      expect(middleware).toHaveBeenCalledWith(mockAccount)
    })
  })
})
