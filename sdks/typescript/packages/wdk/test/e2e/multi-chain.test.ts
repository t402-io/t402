/**
 * E2E Multi-Chain Test
 *
 * Tests that the same seed phrase generates signers for multiple chain
 * families (EVM, TON, Solana, TRON) via T402WDK.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { T402WDK } from '../../src/t402wdk'
import type {
  WDKConstructor,
  WDKInstance,
  WDKAccount,
  WDKTonAccount,
  WDKSolanaAccount,
  WDKTronAccount,
} from '../../src/types'

const VALID_SEED =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

const MOCK_EVM_ADDRESS = '0x1234567890123456789012345678901234567890'
const MOCK_TON_ADDRESS = 'EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF76ksvv'
const MOCK_SVM_ADDRESS = '7MJZnQ2M7MJKkGf1JfRYdH4L3dFXhjxr42Y8xKLQZv4G'
const MOCK_TRON_ADDRESS = 'TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9'

function createMockEvmAccount(): WDKAccount {
  return {
    getAddress: vi.fn().mockResolvedValue(MOCK_EVM_ADDRESS),
    getBalance: vi.fn().mockResolvedValue(1000000000000000000n),
    getTokenBalance: vi.fn().mockResolvedValue(5_000_000n),
    signMessage: vi.fn().mockResolvedValue('0x' + 'ab'.repeat(65)),
    signTypedData: vi.fn().mockResolvedValue('0x' + 'cd'.repeat(65)),
    sendTransaction: vi.fn().mockResolvedValue('0x' + 'ef'.repeat(32)),
  }
}

function createMockTonAccount(): WDKTonAccount {
  return {
    getAddress: vi.fn().mockResolvedValue(MOCK_TON_ADDRESS),
    getBalance: vi.fn().mockResolvedValue(2000000000n), // 2 TON
    getJettonBalance: vi.fn().mockResolvedValue(10_000_000n),
    signMessage: vi.fn().mockResolvedValue(new Uint8Array(64)),
    sendTransaction: vi.fn().mockResolvedValue('abc123'),
    getSeqno: vi.fn().mockResolvedValue(5),
  }
}

function createMockSolanaAccount(): WDKSolanaAccount {
  return {
    getAddress: vi.fn().mockResolvedValue(MOCK_SVM_ADDRESS),
    getBalance: vi.fn().mockResolvedValue(5000000000n), // 5 SOL
    getTokenBalance: vi.fn().mockResolvedValue(15_000_000n),
    sign: vi.fn().mockResolvedValue(new Uint8Array(64)),
    signTransaction: vi.fn().mockResolvedValue(new Uint8Array(100)),
    sendTransaction: vi.fn().mockResolvedValue('5abc123'),
    transfer: vi.fn().mockResolvedValue('5def456'),
  }
}

function createMockTronAccount(): WDKTronAccount {
  return {
    getAddress: vi.fn().mockResolvedValue(MOCK_TRON_ADDRESS),
    getBalance: vi.fn().mockResolvedValue(100_000_000n), // 100 TRX
    getTrc20Balance: vi.fn().mockResolvedValue(20_000_000n),
    signTransaction: vi.fn().mockResolvedValue({ signature: ['0xabc'] }),
    sendTransaction: vi.fn().mockResolvedValue('txid123'),
  }
}

function createMultiChainWDKInstance(): WDKInstance {
  const evmAccount = createMockEvmAccount()
  const tonAccount = createMockTonAccount()
  const svm = createMockSolanaAccount()
  const tron = createMockTronAccount()

  const instance: WDKInstance = {
    registerWallet: vi.fn().mockReturnThis(),
    registerProtocol: vi.fn().mockReturnThis(),
    getAccount: vi.fn().mockImplementation(async (chain: string) => {
      switch (chain) {
        case 'ton':
          return tonAccount as unknown as WDKAccount
        case 'solana':
          return svm as unknown as WDKAccount
        case 'tron':
          return tron as unknown as WDKAccount
        default:
          return evmAccount
      }
    }),
    executeProtocol: vi.fn().mockResolvedValue({ txHash: '0xbridge' }),
  }
  return instance
}

describe('E2E: Multi-Chain Signer Generation', () => {
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

  it('should generate EVM signers for multiple chains from same seed', async () => {
    const mockInstance = createMultiChainWDKInstance()

    const MockWDK: WDKConstructor = class {
      constructor() {
        return mockInstance as unknown as WDKInstance
      }
      static getRandomSeedPhrase(): string {
        return VALID_SEED
      }
    } as unknown as WDKConstructor

    T402WDK.registerWDK(MockWDK, {})

    const wdk = new T402WDK(VALID_SEED, {
      arbitrum: 'https://arb1.arbitrum.io/rpc',
      base: 'https://mainnet.base.org',
    })

    const arbSigner = await wdk.getSigner('arbitrum')
    const baseSigner = await wdk.getSigner('base')

    // Both should have valid addresses (same underlying mock in this case)
    expect(arbSigner.address).toBe(MOCK_EVM_ADDRESS)
    expect(baseSigner.address).toBe(MOCK_EVM_ADDRESS)

    // getAccount should have been called with the right chain names
    expect(mockInstance.getAccount).toHaveBeenCalledWith('arbitrum', 0)
    expect(mockInstance.getAccount).toHaveBeenCalledWith('base', 0)
  })

  it('should register and get signers for TON, Solana, and TRON', async () => {
    const mockInstance = createMultiChainWDKInstance()

    const MockWDK: WDKConstructor = class {
      constructor() {
        return mockInstance as unknown as WDKInstance
      }
      static getRandomSeedPhrase(): string {
        return VALID_SEED
      }
    } as unknown as WDKConstructor

    // Register multi-chain modules
    T402WDK.registerWDK(MockWDK, {
      wallets: {
        evm: {},
        ton: {},
        solana: {},
        tron: {},
      },
    })

    const wdk = new T402WDK(VALID_SEED, {
      arbitrum: 'https://arb1.arbitrum.io/rpc',
    })

    // Get TON signer
    const tonSigner = await wdk.getTonSigner()
    expect(tonSigner.address.toString()).toBe(MOCK_TON_ADDRESS)

    // Get Solana signer
    const svmSigner = await wdk.getSvmSigner()
    expect(svmSigner.address.toString()).toBe(MOCK_SVM_ADDRESS)

    // Get TRON signer
    const tronSigner = await wdk.getTronSigner()
    expect(tronSigner.address).toBe(MOCK_TRON_ADDRESS)
  })

  it('should get all signers across all chain families', async () => {
    const mockInstance = createMultiChainWDKInstance()

    const MockWDK: WDKConstructor = class {
      constructor() {
        return mockInstance as unknown as WDKInstance
      }
      static getRandomSeedPhrase(): string {
        return VALID_SEED
      }
    } as unknown as WDKConstructor

    T402WDK.registerWDK(MockWDK, {
      wallets: {
        evm: {},
        ton: {},
        solana: {},
        tron: {},
      },
    })

    const wdk = new T402WDK(VALID_SEED, {
      arbitrum: 'https://arb1.arbitrum.io/rpc',
    })

    const allSigners = await wdk.getAllSigners({ includeNonEvm: true })

    // Should have EVM + TON + Solana + TRON signers
    expect(allSigners.length).toBeGreaterThanOrEqual(4)

    const families = new Set(allSigners.map((s) => s.family))
    expect(families.has('evm')).toBe(true)
    expect(families.has('ton')).toBe(true)
    expect(families.has('svm')).toBe(true)
    expect(families.has('tron')).toBe(true)
  })

  it('should use getSignerByFamily for cross-chain access', async () => {
    const mockInstance = createMultiChainWDKInstance()

    const MockWDK: WDKConstructor = class {
      constructor() {
        return mockInstance as unknown as WDKInstance
      }
      static getRandomSeedPhrase(): string {
        return VALID_SEED
      }
    } as unknown as WDKConstructor

    T402WDK.registerWDK(MockWDK, {
      wallets: {
        evm: {},
        ton: {},
        solana: {},
        tron: {},
      },
    })

    const wdk = new T402WDK(VALID_SEED, {
      arbitrum: 'https://arb1.arbitrum.io/rpc',
    })

    // Access via getSignerByFamily
    const evmSigner = await wdk.getSignerByFamily('evm', 'arbitrum')
    expect(evmSigner).toBeDefined()

    const tonSigner = await wdk.getSignerByFamily('ton')
    expect(tonSigner).toBeDefined()

    const svmSigner = await wdk.getSignerByFamily('svm')
    expect(svmSigner).toBeDefined()

    const tronSigner = await wdk.getSignerByFamily('tron')
    expect(tronSigner).toBeDefined()
  })
})
