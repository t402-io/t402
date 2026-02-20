import { describe, it, expect, beforeEach } from 'vitest'
import {
  InMemoryIdempotencyManager,
  NonceManager,
  generateIdempotencyKey,
} from '../../src/idempotency'
import type { EnrichedReceipt } from '../../src/receipts'

function makeReceipt(overrides: Partial<EnrichedReceipt> = {}): EnrichedReceipt {
  return {
    id: 'receipt-1',
    timestamp: new Date().toISOString(),
    url: 'https://api.example.com/resource',
    network: 'eip155:42161',
    scheme: 'exact',
    amount: '1000000',
    payTo: '0xrecipient',
    success: true,
    txHash: '0xtxhash123',
    chainFamily: 'evm',
    ...overrides,
  }
}

describe('InMemoryIdempotencyManager', () => {
  let manager: InMemoryIdempotencyManager

  beforeEach(() => {
    manager = new InMemoryIdempotencyManager()
  })

  it('should report no duplicate for new key', async () => {
    expect(await manager.checkDuplicate('key-1')).toBe(false)
  })

  it('should report duplicate after recording payment', async () => {
    const receipt = makeReceipt()
    await manager.recordPayment('key-1', receipt)
    expect(await manager.checkDuplicate('key-1')).toBe(true)
  })

  it('should not confuse different keys', async () => {
    await manager.recordPayment('key-1', makeReceipt())
    expect(await manager.checkDuplicate('key-1')).toBe(true)
    expect(await manager.checkDuplicate('key-2')).toBe(false)
  })

  it('should retrieve recorded payment', async () => {
    const receipt = makeReceipt({ id: 'my-receipt' })
    await manager.recordPayment('key-1', receipt)
    expect(manager.getPayment('key-1')).toEqual(receipt)
  })

  it('should return undefined for unknown key', () => {
    expect(manager.getPayment('unknown')).toBeUndefined()
  })

  it('should track tx hashes for dedup', async () => {
    const receipt = makeReceipt({ txHash: '0xABC123' })
    await manager.recordPayment('key-1', receipt)
    expect(manager.hasTxHash('0xabc123')).toBe(true) // case-insensitive
    expect(manager.hasTxHash('0xother')).toBe(false)
  })

  it('should evict oldest tx hashes when at capacity', async () => {
    const smallManager = new InMemoryIdempotencyManager(3)

    for (let i = 0; i < 5; i++) {
      await smallManager.recordPayment(`key-${i}`, makeReceipt({ txHash: `0xhash${i}` }))
    }

    // First two should have been evicted
    expect(smallManager.hasTxHash('0xhash0')).toBe(false)
    expect(smallManager.hasTxHash('0xhash1')).toBe(false)
    // Later ones should remain
    expect(smallManager.hasTxHash('0xhash2')).toBe(true)
    expect(smallManager.hasTxHash('0xhash3')).toBe(true)
    expect(smallManager.hasTxHash('0xhash4')).toBe(true)
  })

  it('should not track tx hash if receipt has no txHash', async () => {
    await manager.recordPayment('key-1', makeReceipt({ txHash: undefined }))
    expect(manager.size).toBe(1)
  })

  describe('nonce management', () => {
    it('should return 0 for unknown address', async () => {
      expect(await manager.getNonce('0xaddr', 'eip155:42161')).toBe(0n)
    })

    it('should increment nonce', async () => {
      const next = await manager.incrementNonce('0xaddr', 'eip155:42161')
      expect(next).toBe(1n)
      expect(await manager.getNonce('0xaddr', 'eip155:42161')).toBe(1n)
    })

    it('should increment nonce multiple times', async () => {
      await manager.incrementNonce('0xaddr', 'chain-a')
      await manager.incrementNonce('0xaddr', 'chain-a')
      const third = await manager.incrementNonce('0xaddr', 'chain-a')
      expect(third).toBe(3n)
    })

    it('should track nonces separately per chain', async () => {
      await manager.incrementNonce('0xaddr', 'chain-a')
      await manager.incrementNonce('0xaddr', 'chain-a')
      await manager.incrementNonce('0xaddr', 'chain-b')

      expect(await manager.getNonce('0xaddr', 'chain-a')).toBe(2n)
      expect(await manager.getNonce('0xaddr', 'chain-b')).toBe(1n)
    })
  })

  it('should clear all state', async () => {
    await manager.recordPayment('key-1', makeReceipt({ txHash: '0xhash' }))
    await manager.incrementNonce('0xaddr', 'chain')

    manager.clear()

    expect(manager.size).toBe(0)
    expect(await manager.checkDuplicate('key-1')).toBe(false)
    expect(manager.hasTxHash('0xhash')).toBe(false)
    expect(await manager.getNonce('0xaddr', 'chain')).toBe(0n)
  })
})

describe('NonceManager', () => {
  let nonces: NonceManager

  beforeEach(() => {
    nonces = new NonceManager()
  })

  it('should return 0 for unknown address without fetcher', async () => {
    expect(await nonces.getNonce('0xaddr', 'chain')).toBe(0n)
  })

  it('should fetch on-chain nonce when provided', async () => {
    const fetcher = async () => 42n
    expect(await nonces.getNonce('0xaddr', 'chain', fetcher)).toBe(42n)
  })

  it('should cache the on-chain nonce after first fetch', async () => {
    let calls = 0
    const fetcher = async () => {
      calls++
      return 10n
    }

    await nonces.getNonce('0xaddr', 'chain', fetcher)
    await nonces.getNonce('0xaddr', 'chain', fetcher)

    expect(calls).toBe(1)
  })

  it('should increment nonce', () => {
    nonces.set('0xaddr', 'chain', 5n)
    const next = nonces.increment('0xaddr', 'chain')
    expect(next).toBe(6n)
  })

  it('should increment from 0 if not set', () => {
    const next = nonces.increment('0xaddr', 'chain')
    expect(next).toBe(1n)
  })

  it('should reset nonce for an address', async () => {
    nonces.set('0xaddr', 'chain', 10n)
    nonces.reset('0xaddr', 'chain')

    // Should re-fetch since cache was cleared
    const fetcher = async () => 20n
    expect(await nonces.getNonce('0xaddr', 'chain', fetcher)).toBe(20n)
  })

  it('should clear all nonces', async () => {
    nonces.set('0xaddr1', 'chain', 5n)
    nonces.set('0xaddr2', 'chain', 10n)
    nonces.clear()

    expect(await nonces.getNonce('0xaddr1', 'chain')).toBe(0n)
    expect(await nonces.getNonce('0xaddr2', 'chain')).toBe(0n)
  })

  it('should handle case-insensitive addresses', async () => {
    nonces.set('0xABCD', 'chain', 5n)
    expect(await nonces.getNonce('0xabcd', 'chain')).toBe(5n)
  })
})

describe('generateIdempotencyKey', () => {
  it('should generate deterministic keys', () => {
    const params = {
      url: 'https://api.example.com/resource',
      network: 'eip155:42161',
      amount: '1000000',
      payTo: '0xRecipient',
      from: '0xSender',
    }

    const key1 = generateIdempotencyKey(params)
    const key2 = generateIdempotencyKey(params)
    expect(key1).toBe(key2)
  })

  it('should normalize addresses to lowercase', () => {
    const key1 = generateIdempotencyKey({
      url: 'https://api.example.com',
      network: 'eip155:42161',
      amount: '1000000',
      payTo: '0xAAAA',
      from: '0xBBBB',
    })

    const key2 = generateIdempotencyKey({
      url: 'https://api.example.com',
      network: 'eip155:42161',
      amount: '1000000',
      payTo: '0xaaaa',
      from: '0xbbbb',
    })

    expect(key1).toBe(key2)
  })

  it('should produce different keys for different parameters', () => {
    const base = {
      url: 'https://api.example.com',
      network: 'eip155:42161',
      amount: '1000000',
      payTo: '0xrecipient',
      from: '0xsender',
    }

    const key1 = generateIdempotencyKey(base)
    const key2 = generateIdempotencyKey({ ...base, amount: '2000000' })
    const key3 = generateIdempotencyKey({ ...base, network: 'eip155:8453' })

    expect(key1).not.toBe(key2)
    expect(key1).not.toBe(key3)
  })
})
