import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  TTLCache,
  BalanceCache,
  DEFAULT_CACHE_CONFIG,
  DEFAULT_BALANCE_CACHE_CONFIG,
} from "../../src/cache";

describe("TTLCache", () => {
  let cache: TTLCache<string>;

  beforeEach(() => {
    cache = new TTLCache<string>({ defaultTTL: 1000, maxSize: 100 });
  });

  afterEach(() => {
    cache.dispose();
  });

  describe("Basic operations", () => {
    it("should set and get values", () => {
      cache.set("key1", "value1");
      expect(cache.get("key1")).toBe("value1");
    });

    it("should return undefined for non-existent key", () => {
      expect(cache.get("nonexistent")).toBeUndefined();
    });

    it("should check if key exists", () => {
      cache.set("key1", "value1");
      expect(cache.has("key1")).toBe(true);
      expect(cache.has("nonexistent")).toBe(false);
    });

    it("should delete a key", () => {
      cache.set("key1", "value1");
      expect(cache.delete("key1")).toBe(true);
      expect(cache.get("key1")).toBeUndefined();
    });

    it("should delete keys by prefix", () => {
      cache.set("user:1:name", "Alice");
      cache.set("user:1:email", "alice@example.com");
      cache.set("user:2:name", "Bob");
      cache.set("other:key", "value");

      const deleted = cache.deleteByPrefix("user:1:");
      expect(deleted).toBe(2);
      expect(cache.has("user:1:name")).toBe(false);
      expect(cache.has("user:1:email")).toBe(false);
      expect(cache.has("user:2:name")).toBe(true);
      expect(cache.has("other:key")).toBe(true);
    });

    it("should clear all entries", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.clear();
      expect(cache.size).toBe(0);
    });
  });

  describe("TTL behavior", () => {
    it("should expire values after TTL", async () => {
      vi.useFakeTimers();
      cache.set("key1", "value1", 100); // 100ms TTL

      expect(cache.get("key1")).toBe("value1");

      vi.advanceTimersByTime(150);
      expect(cache.get("key1")).toBeUndefined();

      vi.useRealTimers();
    });

    it("should report correct TTL", () => {
      vi.useFakeTimers();
      cache.set("key1", "value1", 1000);

      const ttl = cache.getTTL("key1");
      expect(ttl).toBeGreaterThan(900);
      expect(ttl).toBeLessThanOrEqual(1000);

      vi.advanceTimersByTime(500);
      const ttl2 = cache.getTTL("key1");
      expect(ttl2).toBeGreaterThan(400);
      expect(ttl2).toBeLessThanOrEqual(500);

      vi.useRealTimers();
    });

    it("should return -1 for expired key TTL", () => {
      vi.useFakeTimers();
      cache.set("key1", "value1", 100);

      vi.advanceTimersByTime(150);
      expect(cache.getTTL("key1")).toBe(-1);

      vi.useRealTimers();
    });

    it("should update TTL with touch", () => {
      vi.useFakeTimers();
      cache.set("key1", "value1", 100);

      vi.advanceTimersByTime(50);
      expect(cache.touch("key1", 200)).toBe(true);

      const ttl = cache.getTTL("key1");
      expect(ttl).toBeGreaterThan(150);

      vi.useRealTimers();
    });

    it("should refresh TTL on access when configured", () => {
      vi.useFakeTimers();
      const refreshCache = new TTLCache<string>({
        defaultTTL: 100,
        maxSize: 100,
        refreshOnAccess: true,
      });

      refreshCache.set("key1", "value1");

      vi.advanceTimersByTime(80);
      expect(refreshCache.get("key1")).toBe("value1"); // Refreshes TTL

      vi.advanceTimersByTime(80);
      expect(refreshCache.get("key1")).toBe("value1"); // Still valid due to refresh

      refreshCache.dispose();
      vi.useRealTimers();
    });
  });

  describe("Size management", () => {
    it("should track size correctly", () => {
      expect(cache.size).toBe(0);
      cache.set("key1", "value1");
      expect(cache.size).toBe(1);
      cache.set("key2", "value2");
      expect(cache.size).toBe(2);
    });

    it("should track valid size (excluding expired)", () => {
      vi.useFakeTimers();
      cache.set("key1", "value1", 100);
      cache.set("key2", "value2", 1000);

      expect(cache.validSize).toBe(2);

      vi.advanceTimersByTime(150);
      expect(cache.validSize).toBe(1);

      vi.useRealTimers();
    });

    it("should evict oldest entries when at max size", () => {
      const smallCache = new TTLCache<string>({ defaultTTL: 1000, maxSize: 3 });

      smallCache.set("key1", "value1");
      smallCache.set("key2", "value2");
      smallCache.set("key3", "value3");
      smallCache.set("key4", "value4");

      expect(smallCache.size).toBe(3);
      // key1 should have been evicted
      expect(smallCache.has("key1")).toBe(false);
      expect(smallCache.has("key4")).toBe(true);

      smallCache.dispose();
    });

    it("should return valid keys", () => {
      vi.useFakeTimers();
      cache.set("key1", "value1", 100);
      cache.set("key2", "value2", 1000);

      const keys = cache.keys();
      expect(keys).toContain("key1");
      expect(keys).toContain("key2");

      vi.advanceTimersByTime(150);
      const keysAfterExpiry = cache.keys();
      expect(keysAfterExpiry).not.toContain("key1");
      expect(keysAfterExpiry).toContain("key2");

      vi.useRealTimers();
    });
  });

  describe("getOrSet", () => {
    it("should return cached value if present", async () => {
      cache.set("key1", "cachedValue");

      const factory = vi.fn().mockResolvedValue("newValue");
      const result = await cache.getOrSet("key1", factory);

      expect(result).toBe("cachedValue");
      expect(factory).not.toHaveBeenCalled();
    });

    it("should call factory and cache result if not present", async () => {
      const factory = vi.fn().mockResolvedValue("newValue");
      const result = await cache.getOrSet("key1", factory);

      expect(result).toBe("newValue");
      expect(factory).toHaveBeenCalledTimes(1);
      expect(cache.get("key1")).toBe("newValue");
    });

    it("should call factory after TTL expires", async () => {
      vi.useFakeTimers();
      cache.set("key1", "oldValue", 100);

      vi.advanceTimersByTime(150);

      const factory = vi.fn().mockResolvedValue("newValue");
      const result = await cache.getOrSet("key1", factory);

      expect(result).toBe("newValue");
      expect(factory).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });

  describe("Statistics", () => {
    it("should return correct stats", () => {
      vi.useFakeTimers();
      cache.set("key1", "value1", 100);
      cache.set("key2", "value2", 1000);

      vi.advanceTimersByTime(150);

      const stats = cache.getStats();
      expect(stats.totalSize).toBe(2);
      expect(stats.validSize).toBe(1);
      expect(stats.expiredSize).toBe(1);
      expect(stats.maxSize).toBe(100);

      vi.useRealTimers();
    });
  });

  describe("Default config", () => {
    it("should use default config values", () => {
      expect(DEFAULT_CACHE_CONFIG.defaultTTL).toBe(30000);
      expect(DEFAULT_CACHE_CONFIG.maxSize).toBe(1000);
      expect(DEFAULT_CACHE_CONFIG.refreshOnAccess).toBe(false);
    });
  });
});

describe("BalanceCache", () => {
  let cache: BalanceCache;

  beforeEach(() => {
    cache = new BalanceCache({
      enabled: true,
      nativeBalanceTTL: 100,
      tokenBalanceTTL: 200,
      aggregatedBalanceTTL: 300,
      maxSize: 50,
    });
  });

  afterEach(() => {
    cache.dispose();
  });

  describe("Configuration", () => {
    it("should report enabled status", () => {
      expect(cache.enabled).toBe(true);

      const disabledCache = new BalanceCache({ enabled: false });
      expect(disabledCache.enabled).toBe(false);
      disabledCache.dispose();
    });

    it("should return config", () => {
      const config = cache.config;
      expect(config.enabled).toBe(true);
      expect(config.nativeBalanceTTL).toBe(100);
      expect(config.tokenBalanceTTL).toBe(200);
    });

    it("should use default config", () => {
      expect(DEFAULT_BALANCE_CACHE_CONFIG.enabled).toBe(true);
      expect(DEFAULT_BALANCE_CACHE_CONFIG.nativeBalanceTTL).toBe(15000);
      expect(DEFAULT_BALANCE_CACHE_CONFIG.tokenBalanceTTL).toBe(30000);
      expect(DEFAULT_BALANCE_CACHE_CONFIG.aggregatedBalanceTTL).toBe(60000);
      expect(DEFAULT_BALANCE_CACHE_CONFIG.maxSize).toBe(500);
    });
  });

  describe("Native balance caching", () => {
    it("should set and get native balance", () => {
      cache.setNativeBalance("arbitrum", "0x1234", 1000000n);
      expect(cache.getNativeBalance("arbitrum", "0x1234")).toBe(1000000n);
    });

    it("should expire native balance after TTL", () => {
      vi.useFakeTimers();
      cache.setNativeBalance("arbitrum", "0x1234", 1000000n);

      vi.advanceTimersByTime(150);
      expect(cache.getNativeBalance("arbitrum", "0x1234")).toBeUndefined();

      vi.useRealTimers();
    });

    it("should get or fetch native balance", async () => {
      const fetcher = vi.fn().mockResolvedValue(5000000n);

      const result1 = await cache.getOrFetchNativeBalance("arbitrum", "0x1234", fetcher);
      expect(result1).toBe(5000000n);
      expect(fetcher).toHaveBeenCalledTimes(1);

      const result2 = await cache.getOrFetchNativeBalance("arbitrum", "0x1234", fetcher);
      expect(result2).toBe(5000000n);
      expect(fetcher).toHaveBeenCalledTimes(1); // Not called again
    });
  });

  describe("Token balance caching", () => {
    it("should set and get token balance", () => {
      cache.setTokenBalance("arbitrum", "0xUSDT", "0x1234", 1000000n);
      expect(cache.getTokenBalance("arbitrum", "0xUSDT", "0x1234")).toBe(1000000n);
    });

    it("should expire token balance after TTL", () => {
      vi.useFakeTimers();
      cache.setTokenBalance("arbitrum", "0xUSDT", "0x1234", 1000000n);

      vi.advanceTimersByTime(250);
      expect(cache.getTokenBalance("arbitrum", "0xUSDT", "0x1234")).toBeUndefined();

      vi.useRealTimers();
    });

    it("should get or fetch token balance", async () => {
      const fetcher = vi.fn().mockResolvedValue(2000000n);

      const result1 = await cache.getOrFetchTokenBalance(
        "arbitrum",
        "0xUSDT",
        "0x1234",
        fetcher,
      );
      expect(result1).toBe(2000000n);
      expect(fetcher).toHaveBeenCalledTimes(1);

      const result2 = await cache.getOrFetchTokenBalance(
        "arbitrum",
        "0xUSDT",
        "0x1234",
        fetcher,
      );
      expect(result2).toBe(2000000n);
      expect(fetcher).toHaveBeenCalledTimes(1);
    });
  });

  describe("Aggregated balance caching", () => {
    interface AggBalance {
      total: bigint;
      chains: string[];
    }

    it("should set and get aggregated balance", () => {
      const aggBalance: AggBalance = { total: 5000000n, chains: ["arbitrum", "base"] };
      cache.setAggregatedBalance("all", aggBalance);
      expect(cache.getAggregatedBalance<AggBalance>("all")).toEqual(aggBalance);
    });

    it("should expire aggregated balance after TTL", () => {
      vi.useFakeTimers();
      cache.setAggregatedBalance("all", { total: 5000000n });

      vi.advanceTimersByTime(350);
      expect(cache.getAggregatedBalance("all")).toBeUndefined();

      vi.useRealTimers();
    });

    it("should get or fetch aggregated balance", async () => {
      const fetcher = vi.fn().mockResolvedValue({ total: 10000000n });

      const result1 = await cache.getOrFetchAggregatedBalance("all", fetcher);
      expect(result1).toEqual({ total: 10000000n });
      expect(fetcher).toHaveBeenCalledTimes(1);

      const result2 = await cache.getOrFetchAggregatedBalance("all", fetcher);
      expect(result2).toEqual({ total: 10000000n });
      expect(fetcher).toHaveBeenCalledTimes(1);
    });
  });

  describe("Disabled cache", () => {
    let disabledCache: BalanceCache;

    beforeEach(() => {
      disabledCache = new BalanceCache({ enabled: false });
    });

    afterEach(() => {
      disabledCache.dispose();
    });

    it("should return undefined for native balance when disabled", () => {
      disabledCache.setNativeBalance("arbitrum", "0x1234", 1000000n);
      expect(disabledCache.getNativeBalance("arbitrum", "0x1234")).toBeUndefined();
    });

    it("should return undefined for token balance when disabled", () => {
      disabledCache.setTokenBalance("arbitrum", "0xUSDT", "0x1234", 1000000n);
      expect(disabledCache.getTokenBalance("arbitrum", "0xUSDT", "0x1234")).toBeUndefined();
    });

    it("should always call fetcher when disabled", async () => {
      const fetcher = vi.fn().mockResolvedValue(1000000n);

      await disabledCache.getOrFetchNativeBalance("arbitrum", "0x1234", fetcher);
      await disabledCache.getOrFetchNativeBalance("arbitrum", "0x1234", fetcher);

      expect(fetcher).toHaveBeenCalledTimes(2);
    });
  });

  describe("Cache invalidation", () => {
    beforeEach(() => {
      cache.setNativeBalance("arbitrum", "0x1234", 1000000n);
      cache.setTokenBalance("arbitrum", "0xUSDT", "0x1234", 2000000n);
      cache.setTokenBalance("arbitrum", "0xUSDC", "0x1234", 3000000n);
      cache.setNativeBalance("base", "0x1234", 4000000n);
      cache.setTokenBalance("base", "0xUSDC", "0x1234", 5000000n);
    });

    it("should invalidate chain", () => {
      const deleted = cache.invalidateChain("arbitrum");
      expect(deleted).toBeGreaterThan(0);
      expect(cache.getNativeBalance("arbitrum", "0x1234")).toBeUndefined();
      expect(cache.getTokenBalance("arbitrum", "0xUSDT", "0x1234")).toBeUndefined();
      expect(cache.getNativeBalance("base", "0x1234")).toBe(4000000n);
    });

    it("should invalidate address", () => {
      cache.setNativeBalance("arbitrum", "0x5678", 100n);

      const deleted = cache.invalidateAddress("0x1234");
      expect(deleted).toBeGreaterThan(0);
      expect(cache.getNativeBalance("arbitrum", "0x1234")).toBeUndefined();
      expect(cache.getNativeBalance("arbitrum", "0x5678")).toBe(100n);
    });

    it("should invalidate specific token balance", () => {
      const deleted = cache.invalidateTokenBalance("arbitrum", "0xUSDT", "0x1234");
      expect(deleted).toBe(true);
      expect(cache.getTokenBalance("arbitrum", "0xUSDT", "0x1234")).toBeUndefined();
      expect(cache.getTokenBalance("arbitrum", "0xUSDC", "0x1234")).toBe(3000000n);
    });

    it("should clear all caches", () => {
      cache.clear();
      expect(cache.getNativeBalance("arbitrum", "0x1234")).toBeUndefined();
      expect(cache.getNativeBalance("base", "0x1234")).toBeUndefined();
    });
  });

  describe("Statistics", () => {
    it("should return cache stats", () => {
      cache.setNativeBalance("arbitrum", "0x1234", 1000000n);
      cache.setTokenBalance("arbitrum", "0xUSDT", "0x1234", 2000000n);
      cache.setAggregatedBalance("all", { total: 3000000n });

      const stats = cache.getStats();
      expect(stats.balanceCache.validSize).toBe(2);
      expect(stats.aggregatedCache.validSize).toBe(1);
      expect(stats.config.enabled).toBe(true);
    });
  });

  describe("Case insensitivity", () => {
    it("should handle addresses case-insensitively", () => {
      cache.setNativeBalance("arbitrum", "0xABCD", 1000000n);
      expect(cache.getNativeBalance("arbitrum", "0xabcd")).toBe(1000000n);
    });

    it("should handle tokens case-insensitively", () => {
      cache.setTokenBalance("arbitrum", "0xUSDT", "0x1234", 1000000n);
      expect(cache.getTokenBalance("arbitrum", "0xusdt", "0x1234")).toBe(1000000n);
    });
  });
});
