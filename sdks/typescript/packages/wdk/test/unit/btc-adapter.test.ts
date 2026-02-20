import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  WDKBtcSignerAdapter,
  createWDKBtcSigner,
  type WDKBtcAccount,
} from '../../src/adapters/btc-adapter'

function createMockBtcAccount(): WDKBtcAccount {
  return {
    getAddress: vi.fn().mockResolvedValue('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'),
    getBalance: vi.fn().mockResolvedValue(250000000n), // 2.5 BTC in satoshis
    sendTransaction: vi.fn().mockResolvedValue('btc-tx-hash-def456'),
    signMessage: vi.fn().mockResolvedValue('btc-signature-abc'),
    signPsbt: vi.fn().mockResolvedValue(new Uint8Array(128).fill(0xaa)),
  }
}

describe('WDKBtcSignerAdapter', () => {
  let account: WDKBtcAccount
  let adapter: WDKBtcSignerAdapter

  beforeEach(() => {
    account = createMockBtcAccount()
    adapter = new WDKBtcSignerAdapter(account)
  })

  it('should create adapter from mock account', () => {
    expect(adapter).toBeDefined()
    expect(adapter).toBeInstanceOf(WDKBtcSignerAdapter)
  })

  it('should initialize and fetch address', async () => {
    await adapter.initialize()
    expect(adapter.isInitialized).toBe(true)
    expect(adapter.address).toBe('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')
    expect(account.getAddress).toHaveBeenCalledOnce()
  })

  it('should throw when accessing address before init', () => {
    expect(() => adapter.address).toThrow(
      'Bitcoin signer not initialized. Call initialize() first or use createWDKBtcSigner().',
    )
  })

  it('should not be initialized before initialize()', () => {
    expect(adapter.isInitialized).toBe(false)
  })

  it('should delegate signMessage to account', async () => {
    await adapter.initialize()
    const sig = await adapter.signMessage('hello bitcoin')
    expect(sig).toBe('btc-signature-abc')
    expect(account.signMessage).toHaveBeenCalledWith('hello bitcoin')
  })

  it('should delegate signPsbt to account', async () => {
    await adapter.initialize()
    const psbtBytes = new Uint8Array(64).fill(0x01)
    const signed = await adapter.signPsbt(psbtBytes)
    expect(signed).toEqual(new Uint8Array(128).fill(0xaa))
    expect(account.signPsbt).toHaveBeenCalledWith(psbtBytes)
  })

  it('should delegate getBalance to account', async () => {
    const balance = await adapter.getBalance()
    expect(balance).toBe(250000000n)
    expect(account.getBalance).toHaveBeenCalledOnce()
  })

  it('should delegate sendTransaction to account', async () => {
    const txHash = await adapter.sendTransaction({
      to: 'bc1qrecipient',
      amount: 100000n,
    })
    expect(txHash).toBe('btc-tx-hash-def456')
    expect(account.sendTransaction).toHaveBeenCalledWith({
      to: 'bc1qrecipient',
      amount: 100000n,
    })
  })

  it('should delegate sendTransaction with fee to account', async () => {
    const txHash = await adapter.sendTransaction({
      to: 'bc1qrecipient',
      amount: 100000n,
      fee: 5000n,
    })
    expect(txHash).toBe('btc-tx-hash-def456')
    expect(account.sendTransaction).toHaveBeenCalledWith({
      to: 'bc1qrecipient',
      amount: 100000n,
      fee: 5000n,
    })
  })

  it('should throw if constructed with null account', () => {
    expect(() => new WDKBtcSignerAdapter(null as unknown as WDKBtcAccount)).toThrow(
      'WDK Bitcoin account is required',
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
    expect(adapter.address).toBe('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')
  })
})

describe('createWDKBtcSigner', () => {
  it('should create an initialized adapter via factory', async () => {
    const account = createMockBtcAccount()
    const signer = await createWDKBtcSigner(account)
    expect(signer).toBeInstanceOf(WDKBtcSignerAdapter)
    expect(signer.isInitialized).toBe(true)
    expect(signer.address).toBe('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')
  })

  it('should throw if factory receives null account', async () => {
    await expect(createWDKBtcSigner(null as unknown as WDKBtcAccount)).rejects.toThrow(
      'WDK Bitcoin account is required',
    )
  })
})
