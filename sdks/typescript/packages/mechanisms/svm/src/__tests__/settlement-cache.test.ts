import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SettlementCache } from "../settlement-cache";

describe("SettlementCache", () => {
  let cache: SettlementCache;

  beforeEach(() => {
    cache = new SettlementCache();
  });

  describe("isDuplicate", () => {
    it("returns false for a new key and records it", () => {
      expect(cache.isDuplicate("key1")).toBe(false);
      expect(cache.size).toBe(1);
    });

    it("returns true for a duplicate key", () => {
      expect(cache.isDuplicate("key1")).toBe(false);
      expect(cache.isDuplicate("key1")).toBe(true);
    });

    it("returns false for different keys", () => {
      expect(cache.isDuplicate("key1")).toBe(false);
      expect(cache.isDuplicate("key2")).toBe(false);
      expect(cache.size).toBe(2);
    });
  });

  describe("remove", () => {
    it("removes an entry allowing the same key to be used again", () => {
      expect(cache.isDuplicate("key1")).toBe(false);
      cache.remove("key1");
      expect(cache.size).toBe(0);
      expect(cache.isDuplicate("key1")).toBe(false);
    });

    it("does not throw when removing a non-existent key", () => {
      expect(() => cache.remove("nonexistent")).not.toThrow();
    });
  });

  describe("TTL expiry", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("expires entries after the TTL", () => {
      const shortCache = new SettlementCache({ ttl: 100 });

      expect(shortCache.isDuplicate("key1")).toBe(false);
      expect(shortCache.isDuplicate("key1")).toBe(true);

      // Advance past TTL
      vi.advanceTimersByTime(150);

      // Entry should be expired and pruned on next isDuplicate call
      expect(shortCache.isDuplicate("key1")).toBe(false);
    });

    it("does not expire entries before the TTL", () => {
      const shortCache = new SettlementCache({ ttl: 200 });

      expect(shortCache.isDuplicate("key1")).toBe(false);

      // Advance but not past TTL
      vi.advanceTimersByTime(100);

      expect(shortCache.isDuplicate("key1")).toBe(true);
    });

    it("uses default TTL of 60 seconds", () => {
      expect(cache.isDuplicate("key1")).toBe(false);

      vi.advanceTimersByTime(59_000);
      expect(cache.isDuplicate("key1")).toBe(true);

      vi.advanceTimersByTime(2_000);
      expect(cache.isDuplicate("key1")).toBe(false);
    });
  });

  describe("cross-version deduplication", () => {
    it("shared cache prevents duplicate settlement across V1 and V2 facilitators", () => {
      const sharedCache = new SettlementCache();

      // Simulate V1 facilitator checking
      expect(sharedCache.isDuplicate("tx-abc")).toBe(false);

      // Simulate V2 facilitator checking same transaction
      expect(sharedCache.isDuplicate("tx-abc")).toBe(true);

      // After V1 completes, remove
      sharedCache.remove("tx-abc");

      // Now it can be used again
      expect(sharedCache.isDuplicate("tx-abc")).toBe(false);
    });
  });

  describe("transactionKey", () => {
    it("produces a deterministic hex string from Uint8Array", () => {
      const txBytes = new Uint8Array([1, 2, 3, 4, 5]);
      const key1 = SettlementCache.transactionKey(txBytes);
      const key2 = SettlementCache.transactionKey(txBytes);

      expect(key1).toBe(key2);
      expect(key1).toMatch(/^[0-9a-f]{64}$/);
    });

    it("produces a deterministic hex string from base64 string", () => {
      const txBytes = new Uint8Array([1, 2, 3, 4, 5]);
      const base64 = Buffer.from(txBytes).toString("base64");

      const keyFromBytes = SettlementCache.transactionKey(txBytes);
      const keyFromString = SettlementCache.transactionKey(base64);

      expect(keyFromBytes).toBe(keyFromString);
    });

    it("produces different keys for different transactions", () => {
      const key1 = SettlementCache.transactionKey(new Uint8Array([1, 2, 3]));
      const key2 = SettlementCache.transactionKey(new Uint8Array([4, 5, 6]));

      expect(key1).not.toBe(key2);
    });
  });
});
