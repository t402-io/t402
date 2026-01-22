/**
 * TTL Cache implementation for balance caching
 *
 * Provides a generic cache with configurable TTL (Time To Live) for
 * reducing RPC calls and improving performance.
 */

/**
 * Cache entry with value and expiration time
 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Cache configuration options
 */
export interface CacheConfig {
  /** Default TTL in milliseconds (default: 30000 = 30 seconds) */
  defaultTTL: number;
  /** Maximum number of entries (default: 1000) */
  maxSize: number;
  /** Whether to refresh TTL on access (default: false) */
  refreshOnAccess: boolean;
}

/**
 * Default cache configuration
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  defaultTTL: 30000, // 30 seconds
  maxSize: 1000,
  refreshOnAccess: false,
};

/**
 * Generic TTL cache implementation
 *
 * @example
 * ```typescript
 * const cache = new TTLCache<bigint>({ defaultTTL: 60000 });
 *
 * // Set with default TTL
 * cache.set('balance:arbitrum:0x123', 1000000n);
 *
 * // Set with custom TTL
 * cache.set('balance:ethereum:0x456', 2000000n, 120000);
 *
 * // Get value (returns undefined if expired)
 * const balance = cache.get('balance:arbitrum:0x123');
 *
 * // Check if key exists and is not expired
 * if (cache.has('balance:arbitrum:0x123')) {
 *   // Use cached value
 * }
 * ```
 */
export class TTLCache<T> {
  private _cache: Map<string, CacheEntry<T>> = new Map();
  private _config: CacheConfig;
  private _cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    this._config = { ...DEFAULT_CACHE_CONFIG, ...config };

    // Start periodic cleanup if maxSize is set
    if (this._config.maxSize > 0) {
      this._startCleanup();
    }
  }

  /**
   * Get a value from the cache
   *
   * @param key - Cache key
   * @returns The cached value or undefined if not found/expired
   */
  get(key: string): T | undefined {
    const entry = this._cache.get(key);

    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this._cache.delete(key);
      return undefined;
    }

    // Optionally refresh TTL on access
    if (this._config.refreshOnAccess) {
      entry.expiresAt = Date.now() + this._config.defaultTTL;
    }

    return entry.value;
  }

  /**
   * Set a value in the cache
   *
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - TTL in milliseconds (optional, uses default if not provided)
   */
  set(key: string, value: T, ttl?: number): void {
    // Enforce max size by removing oldest entries
    if (this._cache.size >= this._config.maxSize) {
      this._evictOldest();
    }

    const expiresAt = Date.now() + (ttl ?? this._config.defaultTTL);
    this._cache.set(key, { value, expiresAt });
  }

  /**
   * Check if a key exists and is not expired
   *
   * @param key - Cache key
   * @returns true if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this._cache.get(key);

    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expiresAt) {
      this._cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a key from the cache
   *
   * @param key - Cache key
   * @returns true if key was deleted
   */
  delete(key: string): boolean {
    return this._cache.delete(key);
  }

  /**
   * Delete all keys matching a prefix
   *
   * @param prefix - Key prefix to match
   * @returns Number of keys deleted
   */
  deleteByPrefix(prefix: string): number {
    let count = 0;
    for (const key of this._cache.keys()) {
      if (key.startsWith(prefix)) {
        this._cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this._cache.clear();
  }

  /**
   * Get the number of entries in the cache (including expired)
   */
  get size(): number {
    return this._cache.size;
  }

  /**
   * Get the number of valid (non-expired) entries
   */
  get validSize(): number {
    const now = Date.now();
    let count = 0;
    for (const entry of this._cache.values()) {
      if (now <= entry.expiresAt) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get all valid keys
   */
  keys(): string[] {
    const now = Date.now();
    const validKeys: string[] = [];
    for (const [key, entry] of this._cache.entries()) {
      if (now <= entry.expiresAt) {
        validKeys.push(key);
      }
    }
    return validKeys;
  }

  /**
   * Get remaining TTL for a key in milliseconds
   *
   * @param key - Cache key
   * @returns Remaining TTL in ms, or -1 if not found/expired
   */
  getTTL(key: string): number {
    const entry = this._cache.get(key);

    if (!entry) {
      return -1;
    }

    const remaining = entry.expiresAt - Date.now();
    if (remaining <= 0) {
      this._cache.delete(key);
      return -1;
    }

    return remaining;
  }

  /**
   * Update TTL for an existing key
   *
   * @param key - Cache key
   * @param ttl - New TTL in milliseconds
   * @returns true if key exists and TTL was updated
   */
  touch(key: string, ttl?: number): boolean {
    const entry = this._cache.get(key);

    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expiresAt) {
      this._cache.delete(key);
      return false;
    }

    entry.expiresAt = Date.now() + (ttl ?? this._config.defaultTTL);
    return true;
  }

  /**
   * Get or set a value using a factory function
   *
   * @param key - Cache key
   * @param factory - Function to create value if not cached
   * @param ttl - TTL in milliseconds (optional)
   * @returns The cached or newly created value
   */
  async getOrSet(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, ttl);
    return value;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const now = Date.now();
    let validCount = 0;
    let expiredCount = 0;
    let oldestExpiry = Infinity;
    let newestExpiry = 0;

    for (const entry of this._cache.values()) {
      if (now <= entry.expiresAt) {
        validCount++;
        if (entry.expiresAt < oldestExpiry) oldestExpiry = entry.expiresAt;
        if (entry.expiresAt > newestExpiry) newestExpiry = entry.expiresAt;
      } else {
        expiredCount++;
      }
    }

    return {
      totalSize: this._cache.size,
      validSize: validCount,
      expiredSize: expiredCount,
      maxSize: this._config.maxSize,
      defaultTTL: this._config.defaultTTL,
      oldestExpiryMs: oldestExpiry === Infinity ? 0 : oldestExpiry - now,
      newestExpiryMs: newestExpiry === 0 ? 0 : newestExpiry - now,
    };
  }

  /**
   * Stop the cleanup interval
   */
  dispose(): void {
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
      this._cleanupInterval = null;
    }
    this._cache.clear();
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private _startCleanup(): void {
    // Run cleanup every minute
    this._cleanupInterval = setInterval(() => {
      this._removeExpired();
    }, 60000);

    // Don't prevent process from exiting
    if (this._cleanupInterval.unref) {
      this._cleanupInterval.unref();
    }
  }

  /**
   * Remove all expired entries
   */
  private _removeExpired(): number {
    const now = Date.now();
    let count = 0;

    for (const [key, entry] of this._cache.entries()) {
      if (now > entry.expiresAt) {
        this._cache.delete(key);
        count++;
      }
    }

    return count;
  }

  /**
   * Evict oldest entries to make room
   */
  private _evictOldest(): void {
    // First remove expired entries
    this._removeExpired();

    // If still at max, remove oldest by expiry time
    if (this._cache.size >= this._config.maxSize) {
      let oldestKey: string | null = null;
      let oldestExpiry = Infinity;

      for (const [key, entry] of this._cache.entries()) {
        if (entry.expiresAt < oldestExpiry) {
          oldestExpiry = entry.expiresAt;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        this._cache.delete(oldestKey);
      }
    }
  }
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /** Total entries including expired */
  totalSize: number;
  /** Valid (non-expired) entries */
  validSize: number;
  /** Expired entries pending cleanup */
  expiredSize: number;
  /** Maximum cache size */
  maxSize: number;
  /** Default TTL in milliseconds */
  defaultTTL: number;
  /** Time until oldest entry expires (ms) */
  oldestExpiryMs: number;
  /** Time until newest entry expires (ms) */
  newestExpiryMs: number;
}

/**
 * Balance cache configuration
 */
export interface BalanceCacheConfig {
  /** Whether caching is enabled (default: true) */
  enabled: boolean;
  /** TTL for native balance in milliseconds (default: 15000 = 15 seconds) */
  nativeBalanceTTL: number;
  /** TTL for token balance in milliseconds (default: 30000 = 30 seconds) */
  tokenBalanceTTL: number;
  /** TTL for aggregated balances in milliseconds (default: 60000 = 60 seconds) */
  aggregatedBalanceTTL: number;
  /** Maximum cache entries (default: 500) */
  maxSize: number;
}

/**
 * Default balance cache configuration
 */
export const DEFAULT_BALANCE_CACHE_CONFIG: BalanceCacheConfig = {
  enabled: true,
  nativeBalanceTTL: 15000, // 15 seconds
  tokenBalanceTTL: 30000, // 30 seconds
  aggregatedBalanceTTL: 60000, // 60 seconds
  maxSize: 500,
};

/**
 * Specialized balance cache for WDK
 *
 * Provides separate TTL settings for different balance types
 * and convenient methods for balance-specific caching.
 *
 * @example
 * ```typescript
 * const cache = new BalanceCache({
 *   tokenBalanceTTL: 60000, // 1 minute for token balances
 * });
 *
 * // Cache token balance
 * cache.setTokenBalance('arbitrum', '0xUSDT', '0xWallet', 1000000n);
 *
 * // Get cached balance (returns undefined if expired)
 * const balance = cache.getTokenBalance('arbitrum', '0xUSDT', '0xWallet');
 *
 * // Or use getOrFetch pattern
 * const balance = await cache.getOrFetchTokenBalance(
 *   'arbitrum',
 *   '0xUSDT',
 *   '0xWallet',
 *   async () => await signer.getTokenBalance('0xUSDT')
 * );
 * ```
 */
export class BalanceCache {
  private _cache: TTLCache<bigint>;
  private _aggregatedCache: TTLCache<unknown>;
  private _config: BalanceCacheConfig;

  constructor(config: Partial<BalanceCacheConfig> = {}) {
    this._config = { ...DEFAULT_BALANCE_CACHE_CONFIG, ...config };

    this._cache = new TTLCache<bigint>({
      defaultTTL: this._config.tokenBalanceTTL,
      maxSize: this._config.maxSize,
    });

    this._aggregatedCache = new TTLCache<unknown>({
      defaultTTL: this._config.aggregatedBalanceTTL,
      maxSize: 100, // Fewer aggregated balance entries
    });
  }

  /**
   * Check if caching is enabled
   */
  get enabled(): boolean {
    return this._config.enabled;
  }

  /**
   * Get cache configuration
   */
  get config(): BalanceCacheConfig {
    return { ...this._config };
  }

  // ========== Native Balance Methods ==========

  /**
   * Get cached native balance
   */
  getNativeBalance(chain: string, address: string): bigint | undefined {
    if (!this._config.enabled) return undefined;
    return this._cache.get(this._nativeKey(chain, address));
  }

  /**
   * Set native balance in cache
   */
  setNativeBalance(chain: string, address: string, balance: bigint): void {
    if (!this._config.enabled) return;
    this._cache.set(this._nativeKey(chain, address), balance, this._config.nativeBalanceTTL);
  }

  /**
   * Get or fetch native balance
   */
  async getOrFetchNativeBalance(
    chain: string,
    address: string,
    fetcher: () => Promise<bigint>,
  ): Promise<bigint> {
    if (!this._config.enabled) {
      return fetcher();
    }

    return this._cache.getOrSet(
      this._nativeKey(chain, address),
      fetcher,
      this._config.nativeBalanceTTL,
    );
  }

  // ========== Token Balance Methods ==========

  /**
   * Get cached token balance
   */
  getTokenBalance(chain: string, token: string, address: string): bigint | undefined {
    if (!this._config.enabled) return undefined;
    return this._cache.get(this._tokenKey(chain, token, address));
  }

  /**
   * Set token balance in cache
   */
  setTokenBalance(chain: string, token: string, address: string, balance: bigint): void {
    if (!this._config.enabled) return;
    this._cache.set(this._tokenKey(chain, token, address), balance, this._config.tokenBalanceTTL);
  }

  /**
   * Get or fetch token balance
   */
  async getOrFetchTokenBalance(
    chain: string,
    token: string,
    address: string,
    fetcher: () => Promise<bigint>,
  ): Promise<bigint> {
    if (!this._config.enabled) {
      return fetcher();
    }

    return this._cache.getOrSet(
      this._tokenKey(chain, token, address),
      fetcher,
      this._config.tokenBalanceTTL,
    );
  }

  // ========== Aggregated Balance Methods ==========

  /**
   * Get cached aggregated balance
   */
  getAggregatedBalance<T>(key: string): T | undefined {
    if (!this._config.enabled) return undefined;
    return this._aggregatedCache.get(this._aggregatedKey(key)) as T | undefined;
  }

  /**
   * Set aggregated balance in cache
   */
  setAggregatedBalance<T>(key: string, value: T): void {
    if (!this._config.enabled) return;
    this._aggregatedCache.set(this._aggregatedKey(key), value, this._config.aggregatedBalanceTTL);
  }

  /**
   * Get or fetch aggregated balance
   */
  async getOrFetchAggregatedBalance<T>(
    key: string,
    fetcher: () => Promise<T>,
  ): Promise<T> {
    if (!this._config.enabled) {
      return fetcher();
    }

    return this._aggregatedCache.getOrSet(
      this._aggregatedKey(key),
      fetcher,
      this._config.aggregatedBalanceTTL,
    ) as Promise<T>;
  }

  // ========== Cache Management ==========

  /**
   * Invalidate all balances for a chain
   */
  invalidateChain(chain: string): number {
    const count1 = this._cache.deleteByPrefix(`native:${chain}:`);
    const count2 = this._cache.deleteByPrefix(`token:${chain}:`);
    const count3 = this._aggregatedCache.deleteByPrefix(`agg:`);
    return count1 + count2 + count3;
  }

  /**
   * Invalidate all balances for an address
   */
  invalidateAddress(address: string): number {
    let count = 0;
    const lowerAddress = address.toLowerCase();

    for (const key of this._cache.keys()) {
      if (key.toLowerCase().includes(lowerAddress)) {
        this._cache.delete(key);
        count++;
      }
    }

    // Also clear aggregated cache
    this._aggregatedCache.clear();

    return count;
  }

  /**
   * Invalidate specific token balance
   */
  invalidateTokenBalance(chain: string, token: string, address: string): boolean {
    return this._cache.delete(this._tokenKey(chain, token, address));
  }

  /**
   * Clear all caches
   */
  clear(): void {
    this._cache.clear();
    this._aggregatedCache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): BalanceCacheStats {
    return {
      balanceCache: this._cache.getStats(),
      aggregatedCache: this._aggregatedCache.getStats(),
      config: this.config,
    };
  }

  /**
   * Dispose of cache resources
   */
  dispose(): void {
    this._cache.dispose();
    this._aggregatedCache.dispose();
  }

  // ========== Private Key Generators ==========

  private _nativeKey(chain: string, address: string): string {
    return `native:${chain}:${address.toLowerCase()}`;
  }

  private _tokenKey(chain: string, token: string, address: string): string {
    return `token:${chain}:${token.toLowerCase()}:${address.toLowerCase()}`;
  }

  private _aggregatedKey(key: string): string {
    return `agg:${key}`;
  }
}

/**
 * Balance cache statistics
 */
export interface BalanceCacheStats {
  balanceCache: CacheStats;
  aggregatedCache: CacheStats;
  config: BalanceCacheConfig;
}
