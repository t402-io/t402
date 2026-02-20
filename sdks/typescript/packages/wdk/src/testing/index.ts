/**
 * Shared test harness for @t402/wdk
 *
 * Provides mock factories for WDK accounts, instances, and T402WDK
 * to simplify testing across the T402 ecosystem.
 */

import type {
  WDKAccount,
  WDKInstance,
  WDKTonAccount,
  WDKSolanaAccount,
  WDKTronAccount,
} from '../types.js'

/**
 * Create a mock WDK EVM account with sensible defaults.
 */
export function createMockWDKAccount(overrides?: Partial<WDKAccount>): WDKAccount {
  return {
    getAddress: async () => '0x1234567890123456789012345678901234567890',
    getBalance: async () => 1000000000000000000n,
    getTokenBalance: async () => 1000000n,
    signMessage: async () => '0xmocksignature',
    signTypedData: async () => '0xmocktypedsignature',
    sendTransaction: async () => '0xmocktxhash',
    estimateGas: async () => 21000n,
    ...overrides,
  }
}

/**
 * Create a mock WDK instance that returns the given accounts.
 */
export function createMockWDKInstance(accounts?: Record<string, WDKAccount>): WDKInstance {
  const defaultAccount = createMockWDKAccount()
  return {
    registerWallet: function () {
      return this as WDKInstance
    },
    registerProtocol: function () {
      return this as WDKInstance
    },
    getAccount: async (chain: string, _index: number) => {
      return accounts?.[chain] ?? defaultAccount
    },
    executeProtocol: async () => ({ txHash: '0xmockprotocoltxhash' }),
  }
}

/**
 * Create a mock TON account.
 */
export function createMockTonAccount(overrides?: Partial<WDKTonAccount>): WDKTonAccount {
  return {
    getAddress: async () => 'UQBMock_TON_Address_For_Testing_Purposes_Only_12345',
    getBalance: async () => 5000000000n,
    getJettonBalance: async () => 1000000n,
    signMessage: async () => new Uint8Array(64),
    sendTransaction: async () => 'mock_ton_tx_hash',
    getSeqno: async () => 1,
    transferJetton: async () => 'mock_jetton_tx_hash',
    ...overrides,
  }
}

/**
 * Create a mock Solana account.
 */
export function createMockSolanaAccount(overrides?: Partial<WDKSolanaAccount>): WDKSolanaAccount {
  return {
    getAddress: async () => '11111111111111111111111111111112',
    getBalance: async () => 2000000000n,
    getTokenBalance: async () => 1000000n,
    sign: async () => new Uint8Array(64),
    signTransaction: async () => new Uint8Array(128),
    sendTransaction: async () => 'mock_sol_tx_hash',
    transfer: async () => 'mock_spl_tx_hash',
    ...overrides,
  }
}

/**
 * Create a mock TRON account.
 */
export function createMockTronAccount(overrides?: Partial<WDKTronAccount>): WDKTronAccount {
  return {
    getAddress: async () => 'TJMockTronAddress1234567890ABCDEF',
    getBalance: async () => 10000000n,
    getTrc20Balance: async () => 1000000n,
    signTransaction: async (tx: unknown) => tx,
    sendTransaction: async () => 'mock_tron_tx_hash',
    transferTrc20: async () => 'mock_trc20_tx_hash',
    ...overrides,
  }
}

/**
 * Configuration for createMockT402WDK.
 */
export interface MockT402WDKConfig {
  /** Chains to configure (default: ['arbitrum']) */
  chains?: string[]
  /** Custom EVM account overrides */
  evmAccount?: Partial<WDKAccount>
  /** Custom TON account overrides */
  tonAccount?: Partial<WDKTonAccount>
  /** Custom Solana account overrides */
  solanaAccount?: Partial<WDKSolanaAccount>
  /** Custom TRON account overrides */
  tronAccount?: Partial<WDKTronAccount>
}

/**
 * Create a mock T402WDK-like object for testing, returning
 * the underlying WDK instance and chain configuration.
 *
 * This is useful when you need to test code that depends on
 * T402WDK without importing the full class.
 */
export function createMockT402WDK(config?: MockT402WDKConfig) {
  const chains = config?.chains ?? ['arbitrum']
  const evmAccount = createMockWDKAccount(config?.evmAccount)
  const tonAccount = createMockTonAccount(config?.tonAccount)
  const solanaAccount = createMockSolanaAccount(config?.solanaAccount)
  const tronAccount = createMockTronAccount(config?.tronAccount)

  const accountMap: Record<string, WDKAccount> = {}
  for (const chain of chains) {
    accountMap[chain] = evmAccount
  }
  // Non-EVM accounts returned as WDKAccount (runtime cast in T402WDK)
  accountMap['ton'] = tonAccount as unknown as WDKAccount
  accountMap['solana'] = solanaAccount as unknown as WDKAccount
  accountMap['tron'] = tronAccount as unknown as WDKAccount

  const wdkInstance = createMockWDKInstance(accountMap)

  const chainConfig: Record<string, string> = {}
  for (const chain of chains) {
    chainConfig[chain] = `https://mock-rpc.${chain}.test`
  }

  return {
    wdkInstance,
    chainConfig,
    evmAccount,
    tonAccount,
    solanaAccount,
    tronAccount,
  }
}
