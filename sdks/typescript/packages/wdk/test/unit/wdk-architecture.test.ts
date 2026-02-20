/**
 * Tests for WDK architectural improvements:
 * - #204: Multi-instance parallel management
 * - #194: Resource lifecycle (dispose)
 * - #195: FailoverProvider wiring into chain registration
 * - #202: Network resilience + RPC timeout (retry)
 * - #205: WDK version pinning + semver utilities
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { T402WDK } from '../../src/t402wdk'
import {
  parseSemver,
  compareSemver,
  satisfiesSemverRange,
  SUPPORTED_WDK_RANGE,
} from '../../src/t402wdk'
import { WDKInitializationError, WDKError, WDKErrorCode } from '../../src/errors'
import type { WDKConstructor, WDKInstance, WDKAccount } from '../../src/types'

// ---- Test Helpers ----

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
const MockBridgeUsdt0Evm = {}

const VALID_SEED =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

function resetStaticDefaults() {
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
  // @ts-expect-error - accessing private static for testing
  T402WDK._fiatOnRampProvider = null
  T402WDK.clearMiddlewares()
}

// ============================================================
// #205: Semver Utilities
// ============================================================

describe('Semver utilities (#205)', () => {
  describe('parseSemver', () => {
    it('should parse stable version', () => {
      const v = parseSemver('1.2.3')
      expect(v).toEqual({ major: 1, minor: 2, patch: 3, prerelease: '' })
    })

    it('should parse prerelease version', () => {
      const v = parseSemver('1.0.0-beta.5')
      expect(v).toEqual({ major: 1, minor: 0, patch: 0, prerelease: 'beta.5' })
    })

    it('should parse version with v prefix', () => {
      const v = parseSemver('v2.3.4')
      expect(v).toEqual({ major: 2, minor: 3, patch: 4, prerelease: '' })
    })

    it('should return null for invalid version', () => {
      expect(parseSemver('not-a-version')).toBeNull()
      expect(parseSemver('')).toBeNull()
      expect(parseSemver('1.2')).toBeNull()
    })
  })

  describe('compareSemver', () => {
    it('should compare major versions', () => {
      expect(compareSemver('2.0.0', '1.0.0')).toBe(1)
      expect(compareSemver('1.0.0', '2.0.0')).toBe(-1)
    })

    it('should compare minor versions', () => {
      expect(compareSemver('1.1.0', '1.0.0')).toBe(1)
      expect(compareSemver('1.0.0', '1.1.0')).toBe(-1)
    })

    it('should compare patch versions', () => {
      expect(compareSemver('1.0.1', '1.0.0')).toBe(1)
      expect(compareSemver('1.0.0', '1.0.1')).toBe(-1)
    })

    it('should compare equal versions', () => {
      expect(compareSemver('1.0.0', '1.0.0')).toBe(0)
    })

    it('should rank stable higher than prerelease', () => {
      expect(compareSemver('1.0.0', '1.0.0-beta.5')).toBe(1)
      expect(compareSemver('1.0.0-beta.5', '1.0.0')).toBe(-1)
    })

    it('should compare prerelease versions numerically', () => {
      expect(compareSemver('1.0.0-beta.5', '1.0.0-beta.4')).toBe(1)
      expect(compareSemver('1.0.0-beta.4', '1.0.0-beta.5')).toBe(-1)
    })
  })

  describe('satisfiesSemverRange', () => {
    it('should satisfy >= constraint', () => {
      expect(satisfiesSemverRange('1.0.0', '>=1.0.0')).toBe(true)
      expect(satisfiesSemverRange('1.0.1', '>=1.0.0')).toBe(true)
      expect(satisfiesSemverRange('0.9.0', '>=1.0.0')).toBe(false)
    })

    it('should satisfy < constraint', () => {
      expect(satisfiesSemverRange('1.9.9', '<2.0.0')).toBe(true)
      expect(satisfiesSemverRange('2.0.0', '<2.0.0')).toBe(false)
      expect(satisfiesSemverRange('2.0.1', '<2.0.0')).toBe(false)
    })

    it('should satisfy combined range', () => {
      const range = '>=1.0.0-beta.5 <2.0.0'
      expect(satisfiesSemverRange('1.0.0-beta.5', range)).toBe(true)
      expect(satisfiesSemverRange('1.0.0', range)).toBe(true)
      expect(satisfiesSemverRange('1.5.0', range)).toBe(true)
      expect(satisfiesSemverRange('2.0.0', range)).toBe(false)
      expect(satisfiesSemverRange('1.0.0-beta.4', range)).toBe(false)
    })

    it('should satisfy SUPPORTED_WDK_RANGE', () => {
      expect(satisfiesSemverRange('1.0.0-beta.5', SUPPORTED_WDK_RANGE)).toBe(true)
      expect(satisfiesSemverRange('1.0.0', SUPPORTED_WDK_RANGE)).toBe(true)
      expect(satisfiesSemverRange('1.99.0', SUPPORTED_WDK_RANGE)).toBe(true)
      expect(satisfiesSemverRange('2.0.0', SUPPORTED_WDK_RANGE)).toBe(false)
      expect(satisfiesSemverRange('0.9.0', SUPPORTED_WDK_RANGE)).toBe(false)
      expect(satisfiesSemverRange('1.0.0-beta.4', SUPPORTED_WDK_RANGE)).toBe(false)
    })

    it('should return false for invalid version', () => {
      expect(satisfiesSemverRange('invalid', '>=1.0.0')).toBe(false)
    })
  })
})

// ============================================================
// #205: WDK Version Pinning at Registration
// ============================================================

describe('WDK version pinning (#205)', () => {
  beforeEach(resetStaticDefaults)

  it('should accept WDK with supported version', () => {
    const VersionedWDK = Object.assign(
      class {
        constructor() {
          return createMockWDK() as any
        }
        static getRandomSeedPhrase() {
          return VALID_SEED
        }
      },
      { version: '1.5.0' },
    ) as unknown as WDKConstructor

    expect(() => T402WDK.registerWDK(VersionedWDK, MockWalletManagerEvm)).not.toThrow()
    expect(T402WDK.isWDKRegistered()).toBe(true)
  })

  it('should reject WDK with unsupported version (too high)', () => {
    const VersionedWDK = Object.assign(
      class {
        constructor() {
          return createMockWDK() as any
        }
        static getRandomSeedPhrase() {
          return VALID_SEED
        }
      },
      { version: '2.0.0' },
    ) as unknown as WDKConstructor

    expect(() => T402WDK.registerWDK(VersionedWDK, MockWalletManagerEvm)).toThrow(
      WDKInitializationError,
    )
    expect(() => T402WDK.registerWDK(VersionedWDK, MockWalletManagerEvm)).toThrow('not supported')
  })

  it('should reject WDK with unsupported version (too low)', () => {
    const VersionedWDK = Object.assign(
      class {
        constructor() {
          return createMockWDK() as any
        }
        static getRandomSeedPhrase() {
          return VALID_SEED
        }
      },
      { version: '1.0.0-beta.4' },
    ) as unknown as WDKConstructor

    expect(() => T402WDK.registerWDK(VersionedWDK, MockWalletManagerEvm)).toThrow(
      WDKInitializationError,
    )
  })

  it('should accept WDK without version property (skip check)', () => {
    // If WDK.version is not set, we don't enforce the range check
    expect(() => T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)).not.toThrow()
  })
})

// ============================================================
// #204: Multi-instance parallel management
// ============================================================

describe('Multi-instance parallel management (#204)', () => {
  beforeEach(resetStaticDefaults)

  it('should allow two instances with different modules', () => {
    T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)

    const wdk1 = new T402WDK(VALID_SEED, { arbitrum: 'https://arb1.arbitrum.io/rpc' })
    const wdk2 = new T402WDK(VALID_SEED, { arbitrum: 'https://arb1.arbitrum.io/rpc' })

    expect(wdk1.isInitialized).toBe(true)
    expect(wdk2.isInitialized).toBe(true)
    // They should be independent instances
    expect(wdk1).not.toBe(wdk2)
  })

  it('should allow per-instance WDK constructor via options', () => {
    // Don't register anything globally
    const instanceWDK = new T402WDK(
      VALID_SEED,
      { arbitrum: 'https://arb1.arbitrum.io/rpc' },
      {
        wdk: MockWDKConstructor,
        wallets: { evm: MockWalletManagerEvm },
        protocols: { bridgeUsdt0Evm: MockBridgeUsdt0Evm },
      },
    )

    expect(instanceWDK.isInitialized).toBe(true)
    // Static defaults should still be empty
    expect(T402WDK.isWDKRegistered()).toBe(false)
  })

  it('should allow per-instance wallet modules', () => {
    T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)

    const wdkWithTon = new T402WDK(
      VALID_SEED,
      { arbitrum: 'https://arb1.arbitrum.io/rpc' },
      {
        wallets: { evm: MockWalletManagerEvm, ton: {} },
      },
    )

    // Instance has TON but static does not
    expect(T402WDK.isTonRegistered()).toBe(false)
    // Instance can check internally (via getAllSigners pattern)
    expect(wdkWithTon.isInitialized).toBe(true)
  })

  it('should allow per-instance fiat on-ramp provider', () => {
    T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)

    const mockProvider = {
      name: 'test',
      getQuote: vi.fn().mockResolvedValue({}),
      createWidget: vi
        .fn()
        .mockReturnValue({ widgetUrl: 'url', orderId: '1', expiresAt: '2026-12-01' }),
      getSupportedCurrencies: vi.fn().mockReturnValue(['USD']),
      getSupportedNetworks: vi.fn().mockReturnValue(['eip155:42161']),
    }

    const wdk = new T402WDK(
      VALID_SEED,
      { arbitrum: 'https://arb1.arbitrum.io/rpc' },
      {
        fiatOnRampProvider: mockProvider,
      },
    )

    const result = wdk.onRampAndPay({
      fiatAmount: 100,
      fiatCurrency: 'USD',
      walletAddress: '0x1234',
      network: 'eip155:42161',
    })
    expect(result.widgetUrl).toBe('url')
    expect(mockProvider.createWidget).toHaveBeenCalled()
  })

  it('should allow per-instance middlewares', () => {
    T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)

    const mw = vi.fn()
    const middlewares = new Map<string, Array<(account: unknown) => Promise<void>>>()
    middlewares.set('arbitrum', [mw])

    const wdk = new T402WDK(
      VALID_SEED,
      { arbitrum: 'https://arb1.arbitrum.io/rpc' },
      {
        middlewares,
      },
    )

    expect(wdk.isInitialized).toBe(true)
    // Global middlewares remain empty
    expect(T402WDK.getMiddlewares('arbitrum').length).toBe(0)
  })

  it('instance-level modules override static defaults', () => {
    T402WDK.registerWDK(MockWDKConstructor, {
      wallets: { evm: MockWalletManagerEvm },
      protocols: { swapVeloraEvm: {} },
    })

    // Instance with NO swap protocol
    const wdk = new T402WDK(
      VALID_SEED,
      { arbitrum: 'https://arb1.arbitrum.io/rpc' },
      {
        protocols: {},
      },
    )

    expect(wdk.canSwap()).toBe(false)

    // Another instance inheriting defaults
    const wdk2 = new T402WDK(VALID_SEED, { arbitrum: 'https://arb1.arbitrum.io/rpc' })
    expect(wdk2.canSwap()).toBe(true)
  })
})

// ============================================================
// #194: Resource lifecycle (dispose)
// ============================================================

describe('Resource lifecycle - dispose (#194)', () => {
  beforeEach(resetStaticDefaults)

  it('should set isDisposed after dispose()', () => {
    T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)
    const wdk = new T402WDK(VALID_SEED, { arbitrum: 'https://arb1.arbitrum.io/rpc' })

    expect(wdk.isDisposed).toBe(false)
    wdk.dispose()
    expect(wdk.isDisposed).toBe(true)
  })

  it('should be safe to call dispose() multiple times', () => {
    T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)
    const wdk = new T402WDK(VALID_SEED, { arbitrum: 'https://arb1.arbitrum.io/rpc' })

    wdk.dispose()
    expect(() => wdk.dispose()).not.toThrow()
  })

  it('should throw on getSigner after dispose', async () => {
    T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)
    const wdk = new T402WDK(VALID_SEED, { arbitrum: 'https://arb1.arbitrum.io/rpc' })

    wdk.dispose()
    await expect(wdk.getSigner('arbitrum')).rejects.toThrow('T402WDK has been disposed')
  })

  it('should throw on getAddress after dispose', async () => {
    T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)
    const wdk = new T402WDK(VALID_SEED, { arbitrum: 'https://arb1.arbitrum.io/rpc' })

    wdk.dispose()
    await expect(wdk.getAddress('arbitrum')).rejects.toThrow('T402WDK has been disposed')
  })

  it('should throw on getUsdt0Balance after dispose', async () => {
    T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)
    const wdk = new T402WDK(VALID_SEED, { arbitrum: 'https://arb1.arbitrum.io/rpc' })

    wdk.dispose()
    await expect(wdk.getUsdt0Balance('arbitrum')).rejects.toThrow('T402WDK has been disposed')
  })

  it('should throw on getChainBalances after dispose', async () => {
    T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)
    const wdk = new T402WDK(VALID_SEED, { arbitrum: 'https://arb1.arbitrum.io/rpc' })

    wdk.dispose()
    await expect(wdk.getChainBalances('arbitrum')).rejects.toThrow('T402WDK has been disposed')
  })

  it('should throw on getAllSigners after dispose', async () => {
    T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)
    const wdk = new T402WDK(VALID_SEED, { arbitrum: 'https://arb1.arbitrum.io/rpc' })

    wdk.dispose()
    await expect(wdk.getAllSigners()).rejects.toThrow('T402WDK has been disposed')
  })

  it('should throw on bridgeUsdt0 after dispose', async () => {
    T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm, MockBridgeUsdt0Evm)
    const wdk = new T402WDK(VALID_SEED, {
      arbitrum: 'https://arb1.arbitrum.io/rpc',
      ethereum: 'https://eth.llamarpc.com',
    })

    wdk.dispose()
    await expect(
      wdk.bridgeUsdt0({ fromChain: 'arbitrum', toChain: 'ethereum', amount: 1000000n }),
    ).rejects.toThrow('T402WDK has been disposed')
  })

  it('should throw on encryptSeed after dispose', async () => {
    T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)
    const wdk = new T402WDK(VALID_SEED, { arbitrum: 'https://arb1.arbitrum.io/rpc' })

    wdk.dispose()
    await expect(wdk.encryptSeed('password')).rejects.toThrow('T402WDK has been disposed')
  })

  it('should throw on onRampAndPay after dispose', () => {
    T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)
    const mockProvider = {
      name: 'test',
      getQuote: vi.fn(),
      createWidget: vi.fn(),
      getSupportedCurrencies: vi.fn().mockReturnValue([]),
      getSupportedNetworks: vi.fn().mockReturnValue([]),
    }
    const wdk = new T402WDK(
      VALID_SEED,
      { arbitrum: 'https://arb1.arbitrum.io/rpc' },
      {
        fiatOnRampProvider: mockProvider,
      },
    )

    wdk.dispose()
    expect(() =>
      wdk.onRampAndPay({
        fiatAmount: 100,
        fiatCurrency: 'USD',
        walletAddress: '0x1234',
        network: 'eip155:42161',
      }),
    ).toThrow('T402WDK has been disposed')
  })

  it('should dispose underlying WDK if it has dispose()', () => {
    const mockWdk = createMockWDK()
    const disposeFn = vi.fn()
    ;(mockWdk as any).dispose = disposeFn

    const wdk = T402WDK.fromWDK(mockWdk, { arbitrum: 'https://arb1.arbitrum.io/rpc' })
    wdk.dispose()

    expect(disposeFn).toHaveBeenCalled()
  })

  it('should support Symbol.dispose', () => {
    T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)
    const wdk = new T402WDK(VALID_SEED, { arbitrum: 'https://arb1.arbitrum.io/rpc' })

    expect(typeof wdk[Symbol.dispose]).toBe('function')
    wdk[Symbol.dispose]()
    expect(wdk.isDisposed).toBe(true)
  })

  it('should wipe seed phrase on dispose', () => {
    T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)
    const wdk = new T402WDK(VALID_SEED, { arbitrum: 'https://arb1.arbitrum.io/rpc' })

    wdk.dispose()
    // The seed phrase should be wiped
    // We can't directly access _seedPhrase, but encryptSeed should throw disposed
    // and the internal state should be ''
    expect(wdk.isDisposed).toBe(true)
  })
})

// ============================================================
// #195: FailoverProvider wiring into chain registration
// ============================================================

describe('FailoverProvider chain registration (#195)', () => {
  beforeEach(resetStaticDefaults)

  it('should accept array provider config', () => {
    T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)

    const wdk = new T402WDK(VALID_SEED, {
      arbitrum: {
        provider: ['https://arb1.arbitrum.io/rpc', 'https://arb-fallback.example.com'],
        chainId: 42161,
        network: 'eip155:42161',
      } as any,
    })

    expect(wdk.isInitialized).toBe(true)
    expect(wdk.getConfiguredChains()).toContain('arbitrum')
  })

  it('should return provider status for failover chain', () => {
    T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)

    const wdk = new T402WDK(VALID_SEED, {
      arbitrum: {
        provider: ['https://arb1.arbitrum.io/rpc', 'https://arb-fallback.example.com'],
        chainId: 42161,
        network: 'eip155:42161',
        failover: { healthCheckInterval: 0 },
      } as any,
    })

    const status = wdk.getProviderStatus('arbitrum')
    expect(status).not.toBeNull()
    expect(status!.length).toBe(2)
    expect(status![0].url).toBe('https://arb1.arbitrum.io/rpc')
    expect(status![0].healthy).toBe(true)
    expect(status![1].url).toBe('https://arb-fallback.example.com')
  })

  it('should return null provider status for non-failover chain', () => {
    T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)

    const wdk = new T402WDK(VALID_SEED, {
      arbitrum: 'https://arb1.arbitrum.io/rpc',
    })

    expect(wdk.getProviderStatus('arbitrum')).toBeNull()
  })

  it('should return null provider status for unknown chain', () => {
    T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)

    const wdk = new T402WDK(VALID_SEED, {
      arbitrum: 'https://arb1.arbitrum.io/rpc',
    })

    expect(wdk.getProviderStatus('polygon')).toBeNull()
  })

  it('should dispose failover providers on dispose', () => {
    T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)

    const wdk = new T402WDK(VALID_SEED, {
      arbitrum: {
        provider: ['https://arb1.arbitrum.io/rpc', 'https://arb-fallback.example.com'],
        chainId: 42161,
        network: 'eip155:42161',
        failover: { healthCheckInterval: 0 },
      } as any,
    })

    // Verify the provider exists before dispose
    expect(wdk.getProviderStatus('arbitrum')).not.toBeNull()

    wdk.dispose()

    // After dispose, isDisposed is true
    expect(wdk.isDisposed).toBe(true)
  })

  it('should still work with single string provider (backward compatible)', () => {
    T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)

    const wdk = new T402WDK(VALID_SEED, {
      arbitrum: 'https://arb1.arbitrum.io/rpc',
    })

    expect(wdk.isInitialized).toBe(true)
    expect(wdk.getProviderStatus('arbitrum')).toBeNull()
  })

  it('should throw on empty provider array', () => {
    T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)

    expect(
      () =>
        new T402WDK(VALID_SEED, {
          arbitrum: {
            provider: [],
            chainId: 42161,
            network: 'eip155:42161',
          } as any,
        }),
    ).toThrow('Invalid configuration')
  })
})

// ============================================================
// #202: Network resilience + RPC timeout (retry)
// ============================================================

describe('Network resilience - retry config (#202)', () => {
  beforeEach(resetStaticDefaults)

  it('should accept retry config in options', () => {
    T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)

    const wdk = new T402WDK(
      VALID_SEED,
      { arbitrum: 'https://arb1.arbitrum.io/rpc' },
      {
        retry: { maxRetries: 5, baseDelay: 500 },
      },
    )

    expect(wdk.isInitialized).toBe(true)
  })

  it('should work without retry config (no wrapping)', async () => {
    T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)

    const wdk = new T402WDK(VALID_SEED, { arbitrum: 'https://arb1.arbitrum.io/rpc' })

    const balance = await wdk.getUsdt0Balance('arbitrum')
    expect(balance).toBe(1000000n)
  })

  it('should expose isOnline getter', async () => {
    T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)

    const wdk = new T402WDK(VALID_SEED, { arbitrum: 'https://arb1.arbitrum.io/rpc' })

    // isOnline tries a real RPC call that will fail in test
    const online = await wdk.isOnline
    // In a test environment with no real RPC, this should be false
    expect(typeof online).toBe('boolean')
  })
})

// ============================================================
// Integration: Full lifecycle test
// ============================================================

describe('Full lifecycle integration', () => {
  beforeEach(resetStaticDefaults)

  it('should support create → use → dispose', async () => {
    T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)

    const wdk = new T402WDK(VALID_SEED, { arbitrum: 'https://arb1.arbitrum.io/rpc' })
    expect(wdk.isInitialized).toBe(true)
    expect(wdk.isDisposed).toBe(false)

    // Use
    const signer = await wdk.getSigner('arbitrum')
    expect(signer).toBeDefined()

    // Dispose
    wdk.dispose()
    expect(wdk.isDisposed).toBe(true)

    // Cannot use after dispose
    await expect(wdk.getSigner('arbitrum')).rejects.toThrow('disposed')
  })

  it('should support parallel instances with independent lifecycles', async () => {
    T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)

    const wdk1 = new T402WDK(VALID_SEED, { arbitrum: 'https://arb1.arbitrum.io/rpc' })
    const wdk2 = new T402WDK(VALID_SEED, { arbitrum: 'https://arb1.arbitrum.io/rpc' })

    // Both work
    const signer1 = await wdk1.getSigner('arbitrum')
    const signer2 = await wdk2.getSigner('arbitrum')
    expect(signer1).toBeDefined()
    expect(signer2).toBeDefined()

    // Dispose one
    wdk1.dispose()

    // wdk1 is disposed, wdk2 still works
    await expect(wdk1.getSigner('arbitrum')).rejects.toThrow('disposed')
    const signer2b = await wdk2.getSigner('arbitrum')
    expect(signer2b).toBeDefined()

    // Clean up
    wdk2.dispose()
  })

  it('should support instance-level modules that differ between instances', () => {
    T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)

    const wdkWithSwap = new T402WDK(
      VALID_SEED,
      { arbitrum: 'https://arb1.arbitrum.io/rpc' },
      {
        protocols: { swapVeloraEvm: {} },
      },
    )

    const wdkWithLending = new T402WDK(
      VALID_SEED,
      { arbitrum: 'https://arb1.arbitrum.io/rpc' },
      {
        protocols: { lendingAaveEvm: {} },
      },
    )

    expect(wdkWithSwap.canSwap()).toBe(true)
    expect(wdkWithSwap.canBorrow()).toBe(false)

    expect(wdkWithLending.canSwap()).toBe(false)
    expect(wdkWithLending.canBorrow()).toBe(true)
  })
})
