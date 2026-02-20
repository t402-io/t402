import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryReceiptStore, type EnrichedReceipt } from '../../src/receipts'

function makeReceipt(overrides: Partial<EnrichedReceipt> = {}): EnrichedReceipt {
  return {
    id: 'r-1',
    timestamp: '2026-02-20T10:00:00.000Z',
    url: 'https://api.example.com/data',
    network: 'eip155:42161',
    scheme: 'exact',
    amount: '1000000',
    payTo: '0xabc',
    success: true,
    chainFamily: 'evm',
    ...overrides,
  }
}

describe('InMemoryReceiptStore', () => {
  let store: InMemoryReceiptStore

  beforeEach(() => {
    store = new InMemoryReceiptStore()
  })

  describe('save / getById', () => {
    it('should save and retrieve a receipt by id', async () => {
      const receipt = makeReceipt()
      await store.save(receipt)
      const result = await store.getById('r-1')
      expect(result).toEqual(receipt)
    })

    it('should return null for non-existent id', async () => {
      const result = await store.getById('does-not-exist')
      expect(result).toBeNull()
    })

    it('should overwrite receipt with same id', async () => {
      await store.save(makeReceipt({ amount: '100' }))
      await store.save(makeReceipt({ amount: '200' }))
      const result = await store.getById('r-1')
      expect(result?.amount).toBe('200')
    })
  })

  describe('getAll', () => {
    it('should return all saved receipts', async () => {
      await store.save(makeReceipt({ id: 'a' }))
      await store.save(makeReceipt({ id: 'b' }))
      await store.save(makeReceipt({ id: 'c' }))
      const all = await store.getAll()
      expect(all).toHaveLength(3)
    })

    it('should return empty array when no receipts exist', async () => {
      const all = await store.getAll()
      expect(all).toEqual([])
    })
  })

  describe('count', () => {
    it('should return total count when no filter provided', async () => {
      await store.save(makeReceipt({ id: 'a' }))
      await store.save(makeReceipt({ id: 'b' }))
      expect(await store.count()).toBe(2)
    })

    it('should return filtered count', async () => {
      await store.save(makeReceipt({ id: 'a', success: true }))
      await store.save(makeReceipt({ id: 'b', success: false }))
      await store.save(makeReceipt({ id: 'c', success: true }))
      expect(await store.count({ success: true })).toBe(2)
      expect(await store.count({ success: false })).toBe(1)
    })
  })

  describe('clear', () => {
    it('should remove all receipts', async () => {
      await store.save(makeReceipt({ id: 'a' }))
      await store.save(makeReceipt({ id: 'b' }))
      await store.clear()
      expect(await store.count()).toBe(0)
      expect(await store.getAll()).toEqual([])
    })
  })

  describe('exportJSON', () => {
    it('should export all receipts as a JSON string', async () => {
      const r = makeReceipt()
      await store.save(r)
      const json = await store.exportJSON()
      const parsed = JSON.parse(json)
      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].id).toBe('r-1')
    })

    it('should export empty array when no receipts', async () => {
      const json = await store.exportJSON()
      expect(JSON.parse(json)).toEqual([])
    })
  })

  describe('query with filters', () => {
    beforeEach(async () => {
      await store.save(
        makeReceipt({
          id: 'r-evm-1',
          network: 'eip155:42161',
          chainFamily: 'evm',
          success: true,
          amount: '1000000',
          timestamp: '2026-02-20T08:00:00.000Z',
        }),
      )
      await store.save(
        makeReceipt({
          id: 'r-evm-2',
          network: 'eip155:8453',
          chainFamily: 'evm',
          success: false,
          amount: '5000000',
          timestamp: '2026-02-20T09:00:00.000Z',
          error: 'insufficient funds',
        }),
      )
      await store.save(
        makeReceipt({
          id: 'r-ton-1',
          network: 'ton:mainnet',
          chainFamily: 'ton',
          success: true,
          amount: '2000000',
          timestamp: '2026-02-20T10:00:00.000Z',
        }),
      )
      await store.save(
        makeReceipt({
          id: 'r-svm-1',
          network: 'solana:mainnet',
          chainFamily: 'svm',
          success: true,
          amount: '500000',
          timestamp: '2026-02-20T11:00:00.000Z',
        }),
      )
    })

    it('should filter by network', async () => {
      const results = await store.query({ network: 'eip155:42161' })
      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('r-evm-1')
    })

    it('should filter by chainFamily', async () => {
      const results = await store.query({ chainFamily: 'evm' })
      expect(results).toHaveLength(2)
    })

    it('should filter by success', async () => {
      const results = await store.query({ success: false })
      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('r-evm-2')
    })

    it('should filter by date range', async () => {
      const results = await store.query({
        fromDate: '2026-02-20T09:00:00.000Z',
        toDate: '2026-02-20T10:00:00.000Z',
      })
      expect(results).toHaveLength(2)
    })

    it('should filter by amount range', async () => {
      const results = await store.query({
        minAmount: '1000000',
        maxAmount: '3000000',
      })
      expect(results).toHaveLength(2) // r-evm-1 (1M), r-ton-1 (2M)
    })

    it('should apply limit and offset', async () => {
      const all = await store.query({})
      // Sorted by timestamp descending: r-svm-1, r-ton-1, r-evm-2, r-evm-1
      expect(all[0].id).toBe('r-svm-1')

      const page = await store.query({ limit: 2, offset: 1 })
      expect(page).toHaveLength(2)
      expect(page[0].id).toBe('r-ton-1')
      expect(page[1].id).toBe('r-evm-2')
    })

    it('should combine multiple filters', async () => {
      const results = await store.query({
        chainFamily: 'evm',
        success: true,
      })
      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('r-evm-1')
    })
  })
})
