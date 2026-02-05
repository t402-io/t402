import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WDKTonSignerAdapter, createWDKTonSigner } from '../../src/adapters/ton-adapter'
import { WDKSvmSignerAdapter, createWDKSvmSigner } from '../../src/adapters/svm-adapter'
import { WDKTronSignerAdapter } from '../../src/adapters/tron-adapter'
import type { WDKTonAccount, WDKSolanaAccount, WDKTronAccount } from '../../src/types'

// ============================================================
// Mock Accounts
// ============================================================

function createMockTonAccount(): WDKTonAccount {
  return {
    getAddress: vi.fn().mockResolvedValue('EQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkEUe'),
    getBalance: vi.fn().mockResolvedValue(5000000000n), // 5 TON
    getJettonBalance: vi.fn().mockResolvedValue(1000000n), // 1 USDT
    signMessage: vi.fn().mockResolvedValue(new Uint8Array(64).fill(0xab)),
    sendTransaction: vi.fn().mockResolvedValue('tx-hash-ton'),
    getSeqno: vi.fn().mockResolvedValue(42),
  }
}

function createMockSolanaAccount(): WDKSolanaAccount {
  return {
    getAddress: vi.fn().mockResolvedValue('8GGtWHRQ1wz5gDKE2KXZLktqzcfV1CBqSbeUZjA7hoWL'),
    getBalance: vi.fn().mockResolvedValue(1000000000n), // 1 SOL
    getTokenBalance: vi.fn().mockResolvedValue(1000000n),
    sign: vi.fn().mockResolvedValue(new Uint8Array(64).fill(0xcd)),
    signTransaction: vi.fn().mockResolvedValue(new Uint8Array(100).fill(0xef)),
    sendTransaction: vi.fn().mockResolvedValue('tx-sig-solana'),
    transfer: vi.fn().mockResolvedValue('tx-sig-transfer'),
  }
}

function createMockTronAccount(): WDKTronAccount {
  return {
    getAddress: vi.fn().mockResolvedValue('TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5'),
    getBalance: vi.fn().mockResolvedValue(100000000n), // 100 TRX
    getTrc20Balance: vi.fn().mockResolvedValue(5000000n),
    signTransaction: vi.fn().mockResolvedValue({
      txID: 'mock-tx-id',
      raw_data: {
        contract: [],
        ref_block_bytes: '1234',
        ref_block_hash: '56789abc',
        expiration: Date.now() + 60000,
        timestamp: Date.now(),
      },
      raw_data_hex: 'deadbeef',
      signature: ['aabbccdd'],
    }),
    sendTransaction: vi.fn().mockResolvedValue('tx-hash-tron'),
  }
}

// ============================================================
// TON Adapter Tests
// ============================================================

describe('WDKTonSignerAdapter', () => {
  let account: WDKTonAccount
  let adapter: WDKTonSignerAdapter

  beforeEach(() => {
    account = createMockTonAccount()
    adapter = new WDKTonSignerAdapter(account)
  })

  it('should throw if constructed with null account', () => {
    expect(() => new WDKTonSignerAdapter(null as unknown as WDKTonAccount)).toThrow(
      'WDK TON account is required',
    )
  })

  it('should not be initialized before initialize()', () => {
    expect(adapter.isInitialized).toBe(false)
  })

  it('should throw when accessing address before init', () => {
    expect(() => adapter.address).toThrow('not initialized')
  })

  it('should initialize and set address', async () => {
    await adapter.initialize()
    expect(adapter.isInitialized).toBe(true)
    expect(adapter.address.toString()).toBe('EQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkEUe')
  })

  it('should not re-initialize', async () => {
    await adapter.initialize()
    await adapter.initialize() // second call is a no-op
    expect(account.getAddress).toHaveBeenCalledTimes(1)
  })

  it('should sign message using account.signMessage', async () => {
    await adapter.initialize()

    const mockBody = {
      hash: () => new Uint8Array(32).fill(0x01),
      toBoc: () => new Uint8Array(64).fill(0x02),
    }

    const result = await adapter.signMessage({
      to: { toString: () => 'EQAddr', toRawString: () => 'EQAddr' },
      value: 50000000n,
      body: mockBody,
    })

    expect(result).toBeDefined()
    expect(result.hash()).toEqual(new Uint8Array(32).fill(0x01))
    expect(account.signMessage).toHaveBeenCalledWith(new Uint8Array(32).fill(0x01))
  })

  it('should get seqno', async () => {
    const seqno = await adapter.getSeqno()
    expect(seqno).toBe(42)
  })

  it('should get balance', async () => {
    const balance = await adapter.getBalance()
    expect(balance).toBe(5000000000n)
  })

  it('should get Jetton balance', async () => {
    const balance = await adapter.getJettonBalance(
      'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
    )
    expect(balance).toBe(1000000n)
  })

  it('should expose underlying account', () => {
    expect(adapter.getWDKAccount()).toBe(account)
  })
})

describe('createWDKTonSigner', () => {
  it('should return initialized adapter', async () => {
    const account = createMockTonAccount()
    const signer = await createWDKTonSigner(account)
    expect(signer.isInitialized).toBe(true)
    expect(signer.address.toString()).toBe('EQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkEUe')
  })
})

// ============================================================
// SVM Adapter Tests
// ============================================================

describe('WDKSvmSignerAdapter', () => {
  let account: WDKSolanaAccount
  let adapter: WDKSvmSignerAdapter

  beforeEach(() => {
    account = createMockSolanaAccount()
    adapter = new WDKSvmSignerAdapter(account)
  })

  it('should throw if constructed with null account', () => {
    expect(() => new WDKSvmSignerAdapter(null as unknown as WDKSolanaAccount)).toThrow(
      'WDK Solana account is required',
    )
  })

  it('should not be initialized before initialize()', () => {
    expect(adapter.isInitialized).toBe(false)
  })

  it('should throw when accessing address before init', () => {
    expect(() => adapter.address).toThrow('not initialized')
  })

  it('should initialize and set address', async () => {
    await adapter.initialize()
    expect(adapter.isInitialized).toBe(true)
    expect(adapter.address).toBe('8GGtWHRQ1wz5gDKE2KXZLktqzcfV1CBqSbeUZjA7hoWL')
  })

  it('should sign transactions', async () => {
    await adapter.initialize()

    const txs = [
      { messageBytes: new Uint8Array(100).fill(0x01), signatures: {} },
      { messageBytes: new Uint8Array(100).fill(0x02), signatures: {} },
    ]

    const results = await adapter.signTransactions(txs)
    expect(results).toHaveLength(2)
    expect(results[0]!['8GGtWHRQ1wz5gDKE2KXZLktqzcfV1CBqSbeUZjA7hoWL']).toEqual(
      new Uint8Array(64).fill(0xcd),
    )
    expect(account.sign).toHaveBeenCalledTimes(2)
  })

  it('should return empty array for empty transactions', async () => {
    await adapter.initialize()
    const results = await adapter.signTransactions([])
    expect(results).toHaveLength(0)
  })

  it('should reject empty messageBytes', async () => {
    await adapter.initialize()
    const txs = [{ messageBytes: new Uint8Array(0), signatures: {} }]
    await expect(adapter.signTransactions(txs)).rejects.toThrow('messageBytes must not be empty')
  })

  it('should sign single message', async () => {
    await adapter.initialize()
    const sig = await adapter.sign(new Uint8Array(32).fill(0x01))
    expect(sig).toEqual(new Uint8Array(64).fill(0xcd))
  })

  it('should get balance', async () => {
    const balance = await adapter.getBalance()
    expect(balance).toBe(1000000000n)
  })

  it('should get token balance', async () => {
    const balance = await adapter.getTokenBalance('MintAddr123')
    expect(balance).toBe(1000000n)
  })

  it('should transfer tokens', async () => {
    const txSig = await adapter.transfer({
      token: 'MintAddr',
      recipient: 'RecipAddr',
      amount: 500000n,
    })
    expect(txSig).toBe('tx-sig-transfer')
  })
})

describe('createWDKSvmSigner', () => {
  it('should return initialized adapter', async () => {
    const account = createMockSolanaAccount()
    const signer = await createWDKSvmSigner(account)
    expect(signer.isInitialized).toBe(true)
    expect(signer.address).toBe('8GGtWHRQ1wz5gDKE2KXZLktqzcfV1CBqSbeUZjA7hoWL')
  })
})

// ============================================================
// TRON Adapter Tests
// ============================================================

describe('WDKTronSignerAdapter', () => {
  let account: WDKTronAccount

  it('should throw if constructed with null account', () => {
    expect(() => new WDKTronSignerAdapter(null as unknown as WDKTronAccount)).toThrow(
      'WDK TRON account is required',
    )
  })

  it('should not be initialized before initialize()', () => {
    account = createMockTronAccount()
    const adapter = new WDKTronSignerAdapter(account)
    expect(adapter.isInitialized).toBe(false)
  })

  it('should throw when accessing address before init', () => {
    account = createMockTronAccount()
    const adapter = new WDKTronSignerAdapter(account)
    expect(() => adapter.address).toThrow('not initialized')
  })

  it('should initialize and set address', async () => {
    account = createMockTronAccount()
    const adapter = new WDKTronSignerAdapter(account)
    await adapter.initialize()
    expect(adapter.isInitialized).toBe(true)
    expect(adapter.address).toBe('TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5')
  })

  it('should reject signTransaction with empty contractAddress', async () => {
    account = createMockTronAccount()
    const adapter = new WDKTronSignerAdapter(account)
    await adapter.initialize()

    await expect(
      adapter.signTransaction({
        contractAddress: '',
        to: 'TRecipient',
        amount: '1000000',
      }),
    ).rejects.toThrow('contractAddress is required')
  })

  it('should reject signTransaction with empty to address', async () => {
    account = createMockTronAccount()
    const adapter = new WDKTronSignerAdapter(account)
    await adapter.initialize()

    await expect(
      adapter.signTransaction({
        contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        to: '',
        amount: '1000000',
      }),
    ).rejects.toThrow('recipient address (to) is required')
  })

  it('should reject signTransaction with zero amount', async () => {
    account = createMockTronAccount()
    const adapter = new WDKTronSignerAdapter(account)
    await adapter.initialize()

    await expect(
      adapter.signTransaction({
        contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        to: 'TRecipient',
        amount: '0',
      }),
    ).rejects.toThrow('amount must be a positive value')
  })

  it('should get balance', async () => {
    account = createMockTronAccount()
    const adapter = new WDKTronSignerAdapter(account)
    const balance = await adapter.getBalance()
    expect(balance).toBe(100000000n)
  })

  it('should get TRC20 balance', async () => {
    account = createMockTronAccount()
    const adapter = new WDKTronSignerAdapter(account)
    const balance = await adapter.getTrc20Balance('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t')
    expect(balance).toBe(5000000n)
  })
})
