import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpendingLimiter } from '../../src/limits/SpendingLimiter.js';
import type { LimitStore } from '../../src/limits/types.js';
import type { SpendingLimits, Amount } from '../../src/types.js';

// Mock LimitStore implementation
class MockLimitStore implements LimitStore {
  private data = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.data.get(key) || null;
  }

  async set(key: string, value: string, _ttl?: number): Promise<void> {
    this.data.set(key, value);
  }

  async increment(key: string, amount: number, _ttl?: number): Promise<number> {
    const current = this.data.get(key);
    const newValue = (current ? parseFloat(current) : 0) + amount;
    this.data.set(key, String(newValue));
    return newValue;
  }

  async decrement(key: string, amount: number): Promise<number> {
    const current = this.data.get(key);
    const newValue = (current ? parseFloat(current) : 0) - amount;
    this.data.set(key, String(newValue));
    return newValue;
  }

  // Test helper
  clear(): void {
    this.data.clear();
  }

  // Test helper
  setSpending(key: string, value: number): void {
    this.data.set(key, String(value));
  }
}

describe('SpendingLimiter', () => {
  let limiter: SpendingLimiter;
  let store: MockLimitStore;

  beforeEach(() => {
    store = new MockLimitStore();
    limiter = new SpendingLimiter({ store });
  });

  const createAmount = (value: string, decimals = 6): Amount => ({
    value,
    decimals,
    symbol: 'USDT',
  });

  describe('checkAndReserve', () => {
    it('should allow payment within all limits', async () => {
      const limits: SpendingLimits = {
        perTransaction: createAmount('100000000'), // 100 USDT
        daily: createAmount('1000000000'), // 1000 USDT
      };

      const result = await limiter.checkAndReserve(
        'agent-123',
        createAmount('50000000'), // 50 USDT
        limits
      );

      expect(result.allowed).toBe(true);
      expect(result.reservationId).toBeDefined();
    });

    it('should reject payment exceeding per-transaction limit', async () => {
      const limits: SpendingLimits = {
        perTransaction: createAmount('100000000'), // 100 USDT
        daily: createAmount('1000000000'), // 1000 USDT
      };

      const result = await limiter.checkAndReserve(
        'agent-123',
        createAmount('150000000'), // 150 USDT - exceeds per-tx
        limits
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('per-transaction limit');
    });

    it('should reject payment exceeding daily limit', async () => {
      const limits: SpendingLimits = {
        perTransaction: createAmount('700000000'), // 700 USDT per tx
        daily: createAmount('1000000000'), // 1000 USDT daily
      };

      // First payment succeeds (600 < 700 per-tx, 600 < 1000 daily)
      const result1 = await limiter.checkAndReserve(
        'agent-123',
        createAmount('600000000'), // 600 USDT
        limits
      );
      expect(result1.allowed).toBe(true);

      // Second payment should fail (600 + 500 = 1100 > 1000 daily)
      const result2 = await limiter.checkAndReserve(
        'agent-123',
        createAmount('500000000'), // 500 USDT
        limits
      );

      expect(result2.allowed).toBe(false);
      expect(result2.reason).toContain('daily');
    });

    it('should track spending across multiple periods', async () => {
      const limits: SpendingLimits = {
        hourly: createAmount('100000000'), // 100 USDT
        daily: createAmount('500000000'), // 500 USDT
        weekly: createAmount('2000000000'), // 2000 USDT
      };

      // Make several payments
      for (let i = 0; i < 4; i++) {
        const result = await limiter.checkAndReserve(
          'agent-123',
          createAmount('20000000'), // 20 USDT each
          limits
        );
        expect(result.allowed).toBe(true);
      }

      // 5th payment should fail (80 + 20 = 100, but 80 + 25 > 100)
      const result = await limiter.checkAndReserve(
        'agent-123',
        createAmount('25000000'), // 25 USDT
        limits
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('hourly');
    });

    it('should allow payment when no limits defined', async () => {
      const limits: SpendingLimits = {};

      const result = await limiter.checkAndReserve(
        'agent-123',
        createAmount('999999999999'), // Very large amount
        limits
      );

      expect(result.allowed).toBe(true);
    });

    it('should isolate spending between different agents', async () => {
      const limits: SpendingLimits = {
        daily: createAmount('100000000'), // 100 USDT
      };

      // Agent 1 spends
      await limiter.checkAndReserve(
        'agent-1',
        createAmount('80000000'), // 80 USDT
        limits
      );

      // Agent 2 should have their own limit
      const result = await limiter.checkAndReserve(
        'agent-2',
        createAmount('80000000'), // 80 USDT
        limits
      );

      expect(result.allowed).toBe(true);
    });
  });

  describe('confirm', () => {
    it('should confirm reservation successfully', async () => {
      const limits: SpendingLimits = {
        daily: createAmount('1000000000'),
      };

      const result = await limiter.checkAndReserve(
        'agent-123',
        createAmount('100000000'),
        limits
      );

      expect(result.reservationId).toBeDefined();

      // Should not throw
      await expect(
        limiter.confirm(result.reservationId!)
      ).resolves.not.toThrow();
    });

    it('should throw for unknown reservation', async () => {
      await expect(limiter.confirm('unknown-reservation')).rejects.toThrow(
        'not found'
      );
    });
  });

  describe('release', () => {
    it('should release reservation and restore budget', async () => {
      const limits: SpendingLimits = {
        daily: createAmount('100000000'), // 100 USDT
      };

      // Use 60 USDT
      const result1 = await limiter.checkAndReserve(
        'agent-123',
        createAmount('60000000'),
        limits
      );
      expect(result1.allowed).toBe(true);

      // Try to use 50 more (should fail: 60 + 50 > 100)
      const result2 = await limiter.checkAndReserve(
        'agent-123',
        createAmount('50000000'),
        limits
      );
      expect(result2.allowed).toBe(false);

      // Release the first reservation
      await limiter.release(result1.reservationId!);

      // Now 50 USDT should work
      const result3 = await limiter.checkAndReserve(
        'agent-123',
        createAmount('50000000'),
        limits
      );
      expect(result3.allowed).toBe(true);
    });

    it('should throw for unknown reservation', async () => {
      await expect(limiter.release('unknown-reservation')).rejects.toThrow(
        'not found'
      );
    });
  });

  describe('getRemainingBudget', () => {
    it('should return remaining budget for period', async () => {
      const limits: SpendingLimits = {
        daily: createAmount('1000000000'), // 1000 USDT
      };

      // Spend 300 USDT
      await limiter.checkAndReserve(
        'agent-123',
        createAmount('300000000'),
        limits
      );

      const budget = await limiter.getRemainingBudget(
        'agent-123',
        'daily',
        limits
      );

      expect(budget.limit).toBe('1000000000');
      expect(budget.spent).toBe('300000000');
      expect(budget.remaining).toBe('700000000');
    });

    it('should return unlimited when no limit defined', async () => {
      const limits: SpendingLimits = {
        // No daily limit
        weekly: createAmount('5000000000'),
      };

      const budget = await limiter.getRemainingBudget(
        'agent-123',
        'daily',
        limits
      );

      expect(budget.limit).toBe('unlimited');
      expect(budget.remaining).toBe('unlimited');
    });

    it('should return zero spent when no spending', async () => {
      const limits: SpendingLimits = {
        daily: createAmount('1000000000'),
      };

      const budget = await limiter.getRemainingBudget(
        'agent-123',
        'daily',
        limits
      );

      expect(budget.spent).toBe('0');
      expect(budget.remaining).toBe('1000000000');
    });

    it('should return zero remaining when fully spent', async () => {
      const limits: SpendingLimits = {
        daily: createAmount('100000000'), // 100 USDT
      };

      // Spend exactly the limit
      await limiter.checkAndReserve(
        'agent-123',
        createAmount('100000000'),
        limits
      );

      const budget = await limiter.getRemainingBudget(
        'agent-123',
        'daily',
        limits
      );

      expect(budget.remaining).toBe('0');
    });
  });

  describe('sequential requests', () => {
    it('should enforce limits across sequential requests', async () => {
      const limits: SpendingLimits = {
        daily: createAmount('100000000'), // 100 USDT
      };

      // Make 5 sequential requests of 30 USDT each
      // First 3 should succeed (90 USDT), remaining 2 should fail
      const results: Awaited<ReturnType<typeof limiter.checkAndReserve>>[] = [];

      for (let i = 0; i < 5; i++) {
        const result = await limiter.checkAndReserve(
          'agent-123',
          createAmount('30000000'),
          limits
        );
        results.push(result);
      }

      const allowed = results.filter((r) => r.allowed).length;
      const rejected = results.filter((r) => !r.allowed).length;

      // First 3 pass (90 USDT), then 4th would be 120 > 100, so 2 rejected
      expect(allowed).toBe(3);
      expect(rejected).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('should handle zero amount', async () => {
      const limits: SpendingLimits = {
        perTransaction: createAmount('100000000'),
      };

      const result = await limiter.checkAndReserve(
        'agent-123',
        createAmount('0'),
        limits
      );

      expect(result.allowed).toBe(true);
    });

    it('should handle exact limit amount', async () => {
      const limits: SpendingLimits = {
        perTransaction: createAmount('100000000'),
        daily: createAmount('100000000'),
      };

      const result = await limiter.checkAndReserve(
        'agent-123',
        createAmount('100000000'), // Exactly at limit
        limits
      );

      expect(result.allowed).toBe(true);
    });

    it('should handle very small amounts', async () => {
      const limits: SpendingLimits = {
        daily: createAmount('1000000000'),
      };

      // 0.000001 USDT
      const result = await limiter.checkAndReserve(
        'agent-123',
        createAmount('1'),
        limits
      );

      expect(result.allowed).toBe(true);
    });
  });
});
