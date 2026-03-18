/**
 * In-memory settlement cache to prevent duplicate concurrent settlement requests.
 * Thread-safe via JavaScript's single-threaded event loop.
 * Can be shared across V1/V2 facilitator instances.
 */

import { createHash } from "crypto";

export interface SettlementCacheOptions {
  /** Time-to-live in milliseconds (default: 60000) */
  ttl?: number;
}

interface CacheEntry {
  createdAt: number;
}

const DEFAULT_TTL = 60_000;

export class SettlementCache {
  private entries = new Map<string, CacheEntry>();
  private ttl: number;

  constructor(options?: SettlementCacheOptions) {
    this.ttl = options?.ttl ?? DEFAULT_TTL;
  }

  /** Compute a cache key from transaction bytes. */
  static transactionKey(txBytes: Uint8Array | string): string {
    const data = typeof txBytes === "string" ? Buffer.from(txBytes, "base64") : txBytes;
    return createHash("sha256").update(data).digest("hex");
  }

  /**
   * Check if a transaction is already being settled.
   * Returns true if duplicate, false if new (and records it).
   */
  isDuplicate(key: string): boolean {
    this.pruneExpired();

    if (this.entries.has(key)) {
      return true;
    }

    this.entries.set(key, { createdAt: Date.now() });
    return false;
  }

  /** Remove a key from the cache (called after settlement completes). */
  remove(key: string): void {
    this.entries.delete(key);
  }

  /** Current number of entries (for testing). */
  get size(): number {
    return this.entries.size;
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (now - entry.createdAt > this.ttl) {
        this.entries.delete(key);
      }
    }
  }
}
