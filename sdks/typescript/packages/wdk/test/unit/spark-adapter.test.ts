import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  WDKSparkSignerAdapter,
  createWDKSparkSigner,
  type SparkWalletAccount,
} from '../../src/adapters/spark-adapter'

function createMockSparkAccount(): SparkWalletAccount {
  return {
    getAddress: vi.fn().mockResolvedValue('sp1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'),
    getBalance: vi.fn().mockResolvedValue(100000000n), // 1 BTC in satoshis
    sendTransaction: vi.fn().mockResolvedValue({ hash: 'spark-tx-hash-abc123' }),
    signMessage: vi.fn().mockResolvedValue('spark-signature-xyz'),
  }
}

describe('WDKSparkSignerAdapter', () => {
  let account: SparkWalletAccount
  let adapter: WDKSparkSignerAdapter

  beforeEach(() => {
    account = createMockSparkAccount()
    adapter = new WDKSparkSignerAdapter(account)
  })

  it('should create adapter from mock account', () => {
    expect(adapter).toBeDefined()
    expect(adapter).toBeInstanceOf(WDKSparkSignerAdapter)
  })

  it('should initialize and fetch address', async () => {
    await adapter.initialize()
    expect(adapter.isInitialized).toBe(true)
    expect(adapter.address).toBe('sp1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx')
    expect(account.getAddress).toHaveBeenCalledOnce()
  })

  it('should throw when accessing address before init', () => {
    expect(() => adapter.address).toThrow(
      'Spark signer not initialized. Call initialize() first or use createWDKSparkSigner().',
    )
  })

  it('should not be initialized before initialize()', () => {
    expect(adapter.isInitialized).toBe(false)
  })

  it('should delegate signMessage to account', async () => {
    await adapter.initialize()
    const sig = await adapter.signMessage('hello spark')
    expect(sig).toBe('spark-signature-xyz')
    expect(account.signMessage).toHaveBeenCalledWith('hello spark')
  })

  it('should delegate signMessage with Uint8Array', async () => {
    await adapter.initialize()
    const msgBytes = new Uint8Array([1, 2, 3])
    await adapter.signMessage(msgBytes)
    expect(account.signMessage).toHaveBeenCalledWith(msgBytes)
  })

  it('should delegate getBalance to account', async () => {
    const balance = await adapter.getBalance()
    expect(balance).toBe(100000000n)
    expect(account.getBalance).toHaveBeenCalledOnce()
  })

  it('should delegate sendTransaction to account', async () => {
    const result = await adapter.sendTransaction({ to: 'sp1recipient', amount: 50000n })
    expect(result).toEqual({ hash: 'spark-tx-hash-abc123' })
    expect(account.sendTransaction).toHaveBeenCalledWith({ to: 'sp1recipient', amount: 50000n })
  })

  it('should throw if constructed with null account', () => {
    expect(() => new WDKSparkSignerAdapter(null as unknown as SparkWalletAccount)).toThrow(
      'Spark wallet account is required',
    )
  })

  it('should not re-initialize on double init (no-op)', async () => {
    await adapter.initialize()
    await adapter.initialize()
    expect(account.getAddress).toHaveBeenCalledTimes(1)
  })

  it('should handle concurrent init safely', async () => {
    const [r1, r2] = await Promise.all([adapter.initialize(), adapter.initialize()])
    expect(r1).toBeUndefined()
    expect(r2).toBeUndefined()
    expect(adapter.isInitialized).toBe(true)
    // getAddress may be called once or twice depending on race, but adapter should be consistent
    expect(adapter.address).toBe('sp1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx')
  })
})

describe('createWDKSparkSigner', () => {
  it('should create an initialized adapter via factory', async () => {
    const account = createMockSparkAccount()
    const signer = await createWDKSparkSigner(account)
    expect(signer).toBeInstanceOf(WDKSparkSignerAdapter)
    expect(signer.isInitialized).toBe(true)
    expect(signer.address).toBe('sp1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx')
  })

  it('should throw if factory receives null account', async () => {
    await expect(createWDKSparkSigner(null as unknown as SparkWalletAccount)).rejects.toThrow(
      'Spark wallet account is required',
    )
  })
})
