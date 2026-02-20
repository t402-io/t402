import { describe, it, expect, beforeEach, vi } from 'vitest'
import { T402WDK } from '../../src/t402wdk'
import { WDKInitializationError } from '../../src/errors'
import type {
  WDKConstructor,
  WDKInstance,
  WDKAccount,
} from '../../src/types'

// Mock WDK Account
function createMockAccount(address: string): WDKAccount {
  return {
    getAddress: vi.fn().mockResolvedValue(address),
    getBalance: vi.fn().mockResolvedValue(1000000000000000000n),
    getTokenBalance: vi.fn().mockResolvedValue(1000000n),
    signMessage: vi.fn().mockResolvedValue('0xsignature'),
    signTypedData: vi.fn().mockResolvedValue('0xtypedSignature'),
    sendTransaction: vi.fn().mockResolvedValue('0xtxhash'),
  }
}

// Mock WDK Instance
function createMockWDK(): WDKInstance {
  const mockAccount = createMockAccount('0x1234567890123456789012345678901234567890')
  return {
    registerWallet: vi.fn().mockReturnThis(),
    registerProtocol: vi.fn().mockReturnThis(),
    getAccount: vi.fn().mockResolvedValue(mockAccount),
    executeProtocol: vi.fn().mockResolvedValue({ txHash: '0xbridgehash' }),
  }
}

// Mock WDK Constructor
const MockWDKConstructor: WDKConstructor = class MockWDK {
  constructor(_seedPhrase: string) {
    return createMockWDK() as unknown as WDKInstance
  }
  static getRandomSeedPhrase(): string {
    return 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
  }
} as unknown as WDKConstructor

const MockWalletManagerEvm = { __mock: 'evm' }
const MockWalletManagerTon = { __mock: 'ton' }
const MockBridgeUsdt0Evm = { __mock: 'bridge' }

const VALID_SEED_PHRASE =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

// Known packages that autoDiscover should probe
const KNOWN_WALLET_PACKAGES = [
  '@tetherto/wdk-wallet-evm',
  '@tetherto/wdk-wallet-solana',
  '@tetherto/wdk-wallet-ton',
  '@tetherto/wdk-wallet-tron',
  '@tetherto/wdk-wallet-btc',
  '@tetherto/wdk-wallet-evm-erc-4337',
  '@tetherto/wdk-wallet-ton-gasless',
  '@tetherto/wdk-wallet-tron-gasfree',
]

const KNOWN_PROTOCOL_PACKAGES = [
  '@tetherto/wdk-protocol-bridge-usdt0-evm',
  '@tetherto/wdk-protocol-bridge-usdt0-ton',
  '@tetherto/wdk-protocol-swap-velora-evm',
  '@tetherto/wdk-protocol-lending-aave-evm',
]

const ALL_KNOWN_PACKAGES = [...KNOWN_WALLET_PACKAGES, ...KNOWN_PROTOCOL_PACKAGES]

function resetWDKState() {
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
}

describe('T402WDK.autoDiscover()', () => {
  beforeEach(() => {
    resetWDKState()
    vi.restoreAllMocks()
  })

  it('should return a valid WDKAutoDiscoveryResult', async () => {
    const result = await T402WDK.autoDiscover()

    expect(result).toHaveProperty('discovered')
    expect(result).toHaveProperty('available')
    expect(result).toHaveProperty('unavailable')
    expect(result.discovered).toHaveProperty('wallets')
    expect(result.discovered).toHaveProperty('protocols')
    expect(Array.isArray(result.available)).toBe(true)
    expect(Array.isArray(result.unavailable)).toBe(true)
  })

  it('should cover all known wallet packages', async () => {
    const result = await T402WDK.autoDiscover()

    const allPackages = [...result.available, ...result.unavailable]
    for (const pkg of KNOWN_WALLET_PACKAGES) {
      expect(allPackages).toContain(pkg)
    }
  })

  it('should cover all known protocol packages', async () => {
    const result = await T402WDK.autoDiscover()

    const allPackages = [...result.available, ...result.unavailable]
    for (const pkg of KNOWN_PROTOCOL_PACKAGES) {
      expect(allPackages).toContain(pkg)
    }
  })

  it('should not have duplicate package names across available/unavailable', async () => {
    const result = await T402WDK.autoDiscover()

    const allPackages = [...result.available, ...result.unavailable]
    const uniquePackages = new Set(allPackages)
    expect(allPackages.length).toBe(uniquePackages.size)
  })

  it('should have total packages equal to all known packages', async () => {
    const result = await T402WDK.autoDiscover()

    const totalCount = result.available.length + result.unavailable.length
    expect(totalCount).toBe(ALL_KNOWN_PACKAGES.length)
  })

  it('should populate discovered.wallets for available wallet packages', async () => {
    const result = await T402WDK.autoDiscover()

    // Each available wallet package should have a corresponding key in discovered.wallets
    const walletKeys = Object.keys(result.discovered.wallets ?? {})
    // The number of wallet module entries should match wallet packages in available list
    const availableWallets = result.available.filter((pkg) => pkg.includes('wdk-wallet-'))
    expect(walletKeys.length).toBe(availableWallets.length)
  })

  it('should populate discovered.protocols for available protocol packages', async () => {
    const result = await T402WDK.autoDiscover()

    const protocolKeys = Object.keys(result.discovered.protocols ?? {})
    const availableProtocols = result.available.filter((pkg) => pkg.includes('wdk-protocol-'))
    expect(protocolKeys.length).toBe(availableProtocols.length)
  })

  it('should not mutate static T402WDK registration state', async () => {
    // Pre-register some modules
    T402WDK.registerWDK(MockWDKConstructor, {
      wallets: { evm: MockWalletManagerEvm },
    })

    expect(T402WDK.isWDKRegistered()).toBe(true)
    expect(T402WDK.isWalletManagerRegistered()).toBe(true)

    // autoDiscover should not change the registered state
    await T402WDK.autoDiscover()

    expect(T402WDK.isWDKRegistered()).toBe(true)
    expect(T402WDK.isWalletManagerRegistered()).toBe(true)
  })
})

describe('T402WDK.autoCreate()', () => {
  beforeEach(() => {
    resetWDKState()
    vi.restoreAllMocks()
  })

  it('should accept config with modules (explicit overrides)', async () => {
    // autoCreate may succeed or fail depending on whether @tetherto/wdk is installed.
    // This test just validates that the config shape with modules is accepted.
    const config = {
      seedPhrase: VALID_SEED_PHRASE,
      chains: { arbitrum: 'https://arb1.arbitrum.io/rpc' },
      modules: {
        wallets: { evm: MockWalletManagerEvm },
        protocols: { bridgeUsdt0Evm: MockBridgeUsdt0Evm },
      },
    }

    // Try autoCreate — if @tetherto/wdk is installed, it will succeed (or have init errors)
    // If not installed, it will throw WDKInitializationError
    try {
      const wdk = await T402WDK.autoCreate(config)
      // If it succeeds, it should be a T402WDK instance
      expect(wdk).toBeInstanceOf(T402WDK)
    } catch (error) {
      expect(error).toBeInstanceOf(WDKInitializationError)
    }
  })

  it('should accept config without modules (fully auto)', async () => {
    const config = {
      seedPhrase: VALID_SEED_PHRASE,
      chains: { arbitrum: 'https://arb1.arbitrum.io/rpc' },
    }

    try {
      const wdk = await T402WDK.autoCreate(config)
      expect(wdk).toBeInstanceOf(T402WDK)
    } catch (error) {
      expect(error).toBeInstanceOf(WDKInitializationError)
    }
  })

  it('should accept config with options', async () => {
    const config = {
      seedPhrase: VALID_SEED_PHRASE,
      chains: { arbitrum: 'https://arb1.arbitrum.io/rpc' },
      options: { cache: { enabled: false } },
    }

    try {
      const wdk = await T402WDK.autoCreate(config)
      expect(wdk).toBeInstanceOf(T402WDK)
      expect(wdk.isCacheEnabled).toBe(false)
    } catch (error) {
      expect(error).toBeInstanceOf(WDKInitializationError)
    }
  })

  it('should merge discovered modules with explicit modules', async () => {
    // When explicit modules are provided, they should override discovered ones
    const customEvmModule = { __custom: true }
    const config = {
      seedPhrase: VALID_SEED_PHRASE,
      chains: { arbitrum: 'https://arb1.arbitrum.io/rpc' },
      modules: {
        wallets: { evm: customEvmModule },
      },
    }

    try {
      await T402WDK.autoCreate(config)
      // If autoCreate succeeds, the evm module should be our custom one
      // (verified via the WDK registration state)
      // @ts-expect-error - accessing private static for testing
      expect(T402WDK._WalletModules.evm).toBe(customEvmModule)
    } catch (error) {
      expect(error).toBeInstanceOf(WDKInitializationError)
    }
  })
})

describe('Backward compatibility', () => {
  beforeEach(() => {
    resetWDKState()
  })

  it('create() still works unchanged after adding autoDiscover/autoCreate', () => {
    const wdk = T402WDK.create(MockWDKConstructor, {
      seedPhrase: VALID_SEED_PHRASE,
      chains: { arbitrum: 'https://arb1.arbitrum.io/rpc' },
      modules: {
        wallets: { evm: MockWalletManagerEvm },
        protocols: { bridgeUsdt0Evm: MockBridgeUsdt0Evm },
      },
    })

    expect(wdk).toBeDefined()
    expect(wdk.isInitialized).toBe(true)
    expect(wdk.getConfiguredChains()).toContain('arbitrum')
    expect(T402WDK.isBridgeRegistered()).toBe(true)
  })

  it('registerWDK legacy pattern still works', () => {
    T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm, MockBridgeUsdt0Evm)

    expect(T402WDK.isWDKRegistered()).toBe(true)
    expect(T402WDK.isWalletManagerRegistered()).toBe(true)
    expect(T402WDK.isBridgeRegistered()).toBe(true)

    const wdk = new T402WDK(VALID_SEED_PHRASE, {
      arbitrum: 'https://arb1.arbitrum.io/rpc',
    })
    expect(wdk.isInitialized).toBe(true)
  })

  it('registerWDK unified pattern still works', () => {
    T402WDK.registerWDK(MockWDKConstructor, {
      wallets: { evm: MockWalletManagerEvm, ton: MockWalletManagerTon },
      protocols: { bridgeUsdt0Evm: MockBridgeUsdt0Evm },
    })

    expect(T402WDK.isWDKRegistered()).toBe(true)
    expect(T402WDK.isWalletManagerRegistered()).toBe(true)
    expect(T402WDK.isTonRegistered()).toBe(true)
    expect(T402WDK.isBridgeRegistered()).toBe(true)
  })

  it('manual registerWDK works after autoDiscover', async () => {
    await T402WDK.autoDiscover()

    // Manual registration should still work
    T402WDK.registerWDK(MockWDKConstructor, {
      wallets: { evm: MockWalletManagerEvm, ton: MockWalletManagerTon },
      protocols: { bridgeUsdt0Evm: MockBridgeUsdt0Evm },
    })

    expect(T402WDK.isWDKRegistered()).toBe(true)
    expect(T402WDK.isWalletManagerRegistered()).toBe(true)
    expect(T402WDK.isTonRegistered()).toBe(true)
    expect(T402WDK.isBridgeRegistered()).toBe(true)
  })

  it('fromWDK still works', () => {
    const mockWdk = createMockWDK()
    const wdk = T402WDK.fromWDK(mockWdk, {
      arbitrum: 'https://arb1.arbitrum.io/rpc',
    })

    expect(wdk).toBeDefined()
    expect(wdk.isInitialized).toBe(true)
    expect(wdk.wdk).toBe(mockWdk)
  })
})
