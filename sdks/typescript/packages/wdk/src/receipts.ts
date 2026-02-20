/**
 * Payment Receipt History
 *
 * Provides in-memory storage and querying of enriched payment receipts.
 * Custom backends can be plugged in by implementing PaymentReceiptStore.
 */

export interface EnrichedReceipt {
  id: string
  timestamp: string // ISO 8601
  url: string
  network: string
  scheme: string
  amount: string
  payTo: string
  success: boolean
  txHash?: string
  chainFamily: string // 'evm', 'ton', 'svm', etc.
  error?: string
}

export interface ReceiptFilter {
  network?: string
  chainFamily?: string
  success?: boolean
  fromDate?: string
  toDate?: string
  minAmount?: string
  maxAmount?: string
  limit?: number
  offset?: number
}

export interface PaymentReceiptStore {
  save(receipt: EnrichedReceipt): Promise<void>
  getById(id: string): Promise<EnrichedReceipt | null>
  query(filter?: ReceiptFilter): Promise<EnrichedReceipt[]>
  getAll(): Promise<EnrichedReceipt[]>
  count(filter?: ReceiptFilter): Promise<number>
  clear(): Promise<void>
  exportJSON(): Promise<string>
}

export class InMemoryReceiptStore implements PaymentReceiptStore {
  private receipts = new Map<string, EnrichedReceipt>()

  async save(receipt: EnrichedReceipt): Promise<void> {
    this.receipts.set(receipt.id, receipt)
  }

  async getById(id: string): Promise<EnrichedReceipt | null> {
    return this.receipts.get(id) ?? null
  }

  async query(filter?: ReceiptFilter): Promise<EnrichedReceipt[]> {
    let results = Array.from(this.receipts.values())
    results = applyFilter(results, filter)
    return results
  }

  async getAll(): Promise<EnrichedReceipt[]> {
    return Array.from(this.receipts.values())
  }

  async count(filter?: ReceiptFilter): Promise<number> {
    if (!filter) {
      return this.receipts.size
    }
    const filtered = applyFilter(Array.from(this.receipts.values()), filter)
    return filtered.length
  }

  async clear(): Promise<void> {
    this.receipts.clear()
  }

  async exportJSON(): Promise<string> {
    return JSON.stringify(Array.from(this.receipts.values()), null, 2)
  }
}

function applyFilter(receipts: EnrichedReceipt[], filter?: ReceiptFilter): EnrichedReceipt[] {
  if (!filter) return receipts

  let results = receipts

  if (filter.network !== undefined) {
    results = results.filter((r) => r.network === filter.network)
  }

  if (filter.chainFamily !== undefined) {
    results = results.filter((r) => r.chainFamily === filter.chainFamily)
  }

  if (filter.success !== undefined) {
    results = results.filter((r) => r.success === filter.success)
  }

  if (filter.fromDate !== undefined) {
    const from = filter.fromDate
    results = results.filter((r) => r.timestamp >= from)
  }

  if (filter.toDate !== undefined) {
    const to = filter.toDate
    results = results.filter((r) => r.timestamp <= to)
  }

  if (filter.minAmount !== undefined) {
    const min = BigInt(filter.minAmount)
    results = results.filter((r) => BigInt(r.amount) >= min)
  }

  if (filter.maxAmount !== undefined) {
    const max = BigInt(filter.maxAmount)
    results = results.filter((r) => BigInt(r.amount) <= max)
  }

  // Sort by timestamp descending (newest first)
  results.sort((a, b) => (a.timestamp > b.timestamp ? -1 : a.timestamp < b.timestamp ? 1 : 0))

  if (filter.offset !== undefined && filter.offset > 0) {
    results = results.slice(filter.offset)
  }

  if (filter.limit !== undefined && filter.limit > 0) {
    results = results.slice(0, filter.limit)
  }

  return results
}
