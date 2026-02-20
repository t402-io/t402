/**
 * Idempotent Payment Protection
 *
 * Prevents duplicate payments through idempotency key tracking
 * and nonce management for EVM permits and other chain-specific operations.
 */

import type { EnrichedReceipt } from './receipts.js'

/**
 * Idempotency manager interface for preventing duplicate payments
 */
export interface IdempotencyManager {
  /** Check if a payment with this key has already been processed */
  checkDuplicate(key: string): Promise<boolean>
  /** Record a completed payment */
  recordPayment(key: string, receipt: EnrichedReceipt): Promise<void>
  /** Get the current nonce for an address on a chain */
  getNonce(address: string, chain: string): Promise<bigint>
  /** Increment and return the next nonce for an address on a chain */
  incrementNonce(address: string, chain: string): Promise<bigint>
}

/**
 * In-memory idempotency manager
 *
 * Tracks payment keys and nonces in memory. Suitable for single-process
 * applications. For distributed systems, implement IdempotencyManager
 * with a shared store (Redis, database, etc.).
 */
export class InMemoryIdempotencyManager implements IdempotencyManager {
  private _payments = new Map<string, EnrichedReceipt>()
  private _nonces = new Map<string, bigint>()
  private _recentTxHashes: Set<string>
  private _maxRecentTxHashes: number

  /**
   * @param maxRecentTxHashes - Maximum number of recent tx hashes to track for dedup (default: 1000)
   */
  constructor(maxRecentTxHashes = 1000) {
    this._recentTxHashes = new Set()
    this._maxRecentTxHashes = maxRecentTxHashes
  }

  async checkDuplicate(key: string): Promise<boolean> {
    return this._payments.has(key)
  }

  async recordPayment(key: string, receipt: EnrichedReceipt): Promise<void> {
    this._payments.set(key, receipt)

    // Also track the tx hash if available
    if (receipt.txHash) {
      this._addTxHash(receipt.txHash)
    }
  }

  async getNonce(address: string, chain: string): Promise<bigint> {
    const key = this._nonceKey(address, chain)
    return this._nonces.get(key) ?? 0n
  }

  async incrementNonce(address: string, chain: string): Promise<bigint> {
    const key = this._nonceKey(address, chain)
    const current = this._nonces.get(key) ?? 0n
    const next = current + 1n
    this._nonces.set(key, next)
    return next
  }

  /**
   * Check if a transaction hash has been seen recently
   */
  hasTxHash(txHash: string): boolean {
    return this._recentTxHashes.has(txHash.toLowerCase())
  }

  /**
   * Get a recorded payment by its idempotency key
   */
  getPayment(key: string): EnrichedReceipt | undefined {
    return this._payments.get(key)
  }

  /**
   * Get the number of recorded payments
   */
  get size(): number {
    return this._payments.size
  }

  /**
   * Clear all recorded payments and nonces
   */
  clear(): void {
    this._payments.clear()
    this._nonces.clear()
    this._recentTxHashes.clear()
  }

  private _nonceKey(address: string, chain: string): string {
    return `${chain}:${address.toLowerCase()}`
  }

  private _addTxHash(txHash: string): void {
    const normalized = txHash.toLowerCase()

    // Evict oldest entries if at capacity
    if (this._recentTxHashes.size >= this._maxRecentTxHashes) {
      const first = this._recentTxHashes.values().next().value
      if (first !== undefined) {
        this._recentTxHashes.delete(first)
      }
    }

    this._recentTxHashes.add(normalized)
  }
}

/**
 * Nonce manager for EVM permit signatures
 *
 * Caches on-chain nonces locally and increments after each use.
 * Supports querying the on-chain nonce to resync.
 */
export class NonceManager {
  private _nonces = new Map<string, bigint>()

  /**
   * Get the current nonce for an address on a chain.
   * If no cached value exists, uses the provided fetcher to query on-chain.
   *
   * @param address - Wallet address
   * @param chain - Chain identifier
   * @param fetchOnChainNonce - Optional function to query the on-chain nonce
   */
  async getNonce(
    address: string,
    chain: string,
    fetchOnChainNonce?: () => Promise<bigint>,
  ): Promise<bigint> {
    const key = this._key(address, chain)
    const cached = this._nonces.get(key)
    if (cached !== undefined) {
      return cached
    }

    if (fetchOnChainNonce) {
      const onChainNonce = await fetchOnChainNonce()
      this._nonces.set(key, onChainNonce)
      return onChainNonce
    }

    return 0n
  }

  /**
   * Increment the nonce after a successful signature/transaction
   */
  increment(address: string, chain: string): bigint {
    const key = this._key(address, chain)
    const current = this._nonces.get(key) ?? 0n
    const next = current + 1n
    this._nonces.set(key, next)
    return next
  }

  /**
   * Set the nonce to a specific value (e.g., after querying on-chain)
   */
  set(address: string, chain: string, nonce: bigint): void {
    const key = this._key(address, chain)
    this._nonces.set(key, nonce)
  }

  /**
   * Reset the nonce for an address on a chain (forces re-fetch on next use)
   */
  reset(address: string, chain: string): void {
    const key = this._key(address, chain)
    this._nonces.delete(key)
  }

  /**
   * Clear all cached nonces
   */
  clear(): void {
    this._nonces.clear()
  }

  private _key(address: string, chain: string): string {
    return `${chain}:${address.toLowerCase()}`
  }
}

/**
 * Generate an idempotency key from payment parameters
 *
 * Creates a deterministic key based on the payment details to
 * prevent the same logical payment from being processed twice.
 */
export function generateIdempotencyKey(params: {
  url: string
  network: string
  amount: string
  payTo: string
  from: string
}): string {
  return `${params.from.toLowerCase()}:${params.payTo.toLowerCase()}:${params.network}:${params.amount}:${params.url}`
}
