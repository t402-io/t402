import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Redis, Pipeline, ChainableCommander } from 'ioredis';
import { RedisPolicyStore } from '../../src/mcp/RedisPolicyStore.js';
import type { AgentPolicy } from '../../src/types.js';

// Mock Redis client
class MockRedis {
  private data = new Map<string, string>();
  private sets = new Map<string, Set<string>>();

  async get(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<'OK'> {
    this.data.set(key, value);
    return 'OK';
  }

  async setex(key: string, _ttl: number, value: string): Promise<'OK'> {
    this.data.set(key, value);
    return 'OK';
  }

  async del(key: string): Promise<number> {
    const existedData = this.data.has(key);
    const existedSet = this.sets.has(key);
    this.data.delete(key);
    this.sets.delete(key);
    return existedData || existedSet ? 1 : 0;
  }

  async exists(key: string): Promise<number> {
    return this.data.has(key) ? 1 : 0;
  }

  async mget(...keys: string[]): Promise<(string | null)[]> {
    return keys.map((key) => this.data.get(key) ?? null);
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    let set = this.sets.get(key);
    if (!set) {
      set = new Set();
      this.sets.set(key, set);
    }
    let added = 0;
    for (const member of members) {
      if (!set.has(member)) {
        set.add(member);
        added++;
      }
    }
    return added;
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    const set = this.sets.get(key);
    if (!set) return 0;
    let removed = 0;
    for (const member of members) {
      if (set.delete(member)) {
        removed++;
      }
    }
    return removed;
  }

  async smembers(key: string): Promise<string[]> {
    const set = this.sets.get(key);
    return set ? Array.from(set) : [];
  }

  async scard(key: string): Promise<number> {
    const set = this.sets.get(key);
    return set ? set.size : 0;
  }

  pipeline(): MockPipeline {
    return new MockPipeline(this);
  }

  // Test helpers
  clear(): void {
    this.data.clear();
    this.sets.clear();
  }
}

class MockPipeline {
  private commands: Array<() => void> = [];

  constructor(private redis: MockRedis) {}

  set(key: string, value: string): this {
    this.commands.push(() => this.redis.set(key, value));
    return this;
  }

  setex(key: string, ttl: number, value: string): this {
    this.commands.push(() => this.redis.setex(key, ttl, value));
    return this;
  }

  del(key: string): this {
    this.commands.push(() => this.redis.del(key));
    return this;
  }

  sadd(key: string, ...members: string[]): this {
    this.commands.push(() => this.redis.sadd(key, ...members));
    return this;
  }

  srem(key: string, ...members: string[]): this {
    this.commands.push(() => this.redis.srem(key, ...members));
    return this;
  }

  async exec(): Promise<Array<[Error | null, unknown]>> {
    const results: Array<[Error | null, unknown]> = [];
    for (const cmd of this.commands) {
      try {
        const result = await cmd();
        results.push([null, result]);
      } catch (err) {
        results.push([err as Error, null]);
      }
    }
    return results;
  }
}

describe('RedisPolicyStore', () => {
  let redis: MockRedis;
  let store: RedisPolicyStore;

  const createPolicy = (overrides: Partial<AgentPolicy> = {}): AgentPolicy => ({
    enabled: true,
    limits: {
      daily: { value: '1000000000', decimals: 6, symbol: 'USDT' },
    },
    ...overrides,
  });

  beforeEach(() => {
    redis = new MockRedis();
    store = new RedisPolicyStore({ redis: redis as unknown as Redis });
  });

  describe('getPolicy', () => {
    it('should return null for non-existent policy', async () => {
      const result = await store.getPolicy('agent-123');
      expect(result).toBeNull();
    });

    it('should return policy when exists', async () => {
      const policy = createPolicy();
      await store.setPolicy('agent-123', policy);

      const result = await store.getPolicy('agent-123');
      expect(result).toEqual(policy);
    });

    it('should return null for invalid JSON', async () => {
      // Directly set invalid JSON
      await redis.set('agent-policy:policy:agent-123', 'not-valid-json');

      const result = await store.getPolicy('agent-123');
      expect(result).toBeNull();
    });
  });

  describe('setPolicy', () => {
    it('should store policy successfully', async () => {
      const policy = createPolicy();
      await store.setPolicy('agent-123', policy);

      const stored = await redis.get('agent-policy:policy:agent-123');
      expect(stored).toBe(JSON.stringify(policy));
    });

    it('should add to agents index', async () => {
      await store.setPolicy('agent-123', createPolicy());

      const members = await redis.smembers('agent-policy:agents');
      expect(members).toContain('agent-123');
    });

    it('should add to org index when agentId has org prefix', async () => {
      await store.setPolicy('org-1:agent-123', createPolicy());

      const members = await redis.smembers('agent-policy:org:org-1');
      expect(members).toContain('org-1:agent-123');
    });

    it('should not add to org index when agentId has no org prefix', async () => {
      await store.setPolicy('agent-123', createPolicy());

      const members = await redis.smembers('agent-policy:org:agent-123');
      expect(members).not.toContain('agent-123');
    });

    it('should use custom key prefix', async () => {
      const customStore = new RedisPolicyStore({
        redis: redis as unknown as Redis,
        keyPrefix: 'custom:',
      });

      await customStore.setPolicy('agent-123', createPolicy());

      const stored = await redis.get('custom:policy:agent-123');
      expect(stored).toBeDefined();
    });

    it('should overwrite existing policy', async () => {
      const policy1 = createPolicy({ enabled: true });
      const policy2 = createPolicy({ enabled: false });

      await store.setPolicy('agent-123', policy1);
      await store.setPolicy('agent-123', policy2);

      const result = await store.getPolicy('agent-123');
      expect(result?.enabled).toBe(false);
    });
  });

  describe('deletePolicy', () => {
    it('should return false for non-existent policy', async () => {
      const result = await store.deletePolicy('agent-123');
      expect(result).toBe(false);
    });

    it('should delete policy and return true', async () => {
      await store.setPolicy('agent-123', createPolicy());

      const result = await store.deletePolicy('agent-123');
      expect(result).toBe(true);

      const policy = await store.getPolicy('agent-123');
      expect(policy).toBeNull();
    });

    it('should remove from agents index', async () => {
      await store.setPolicy('agent-123', createPolicy());
      await store.deletePolicy('agent-123');

      const members = await redis.smembers('agent-policy:agents');
      expect(members).not.toContain('agent-123');
    });

    it('should remove from org index', async () => {
      await store.setPolicy('org-1:agent-123', createPolicy());
      await store.deletePolicy('org-1:agent-123');

      const members = await redis.smembers('agent-policy:org:org-1');
      expect(members).not.toContain('org-1:agent-123');
    });
  });

  describe('listPolicies', () => {
    it('should return empty array when no policies', async () => {
      const result = await store.listPolicies();
      expect(result).toEqual([]);
    });

    it('should return all policies', async () => {
      const policy1 = createPolicy({ enabled: true });
      const policy2 = createPolicy({ enabled: false });

      await store.setPolicy('agent-1', policy1);
      await store.setPolicy('agent-2', policy2);

      const result = await store.listPolicies();
      expect(result).toHaveLength(2);

      const agentIds = result.map((r) => r.agentId);
      expect(agentIds).toContain('agent-1');
      expect(agentIds).toContain('agent-2');
    });

    it('should filter by organization', async () => {
      await store.setPolicy('org-1:agent-1', createPolicy());
      await store.setPolicy('org-1:agent-2', createPolicy());
      await store.setPolicy('org-2:agent-3', createPolicy());

      const result = await store.listPolicies('org-1');
      expect(result).toHaveLength(2);

      const agentIds = result.map((r) => r.agentId);
      expect(agentIds).toContain('org-1:agent-1');
      expect(agentIds).toContain('org-1:agent-2');
      expect(agentIds).not.toContain('org-2:agent-3');
    });

    it('should skip invalid JSON entries', async () => {
      await store.setPolicy('agent-1', createPolicy());
      // Directly set invalid JSON
      await redis.set('agent-policy:policy:agent-2', 'invalid-json');
      await redis.sadd('agent-policy:agents', 'agent-2');

      const result = await store.listPolicies();
      expect(result).toHaveLength(1);
      expect(result[0].agentId).toBe('agent-1');
    });
  });

  describe('hasPolicy', () => {
    it('should return false for non-existent policy', async () => {
      const result = await store.hasPolicy('agent-123');
      expect(result).toBe(false);
    });

    it('should return true for existing policy', async () => {
      await store.setPolicy('agent-123', createPolicy());

      const result = await store.hasPolicy('agent-123');
      expect(result).toBe(true);
    });
  });

  describe('getPolicies', () => {
    it('should return empty map for empty input', async () => {
      const result = await store.getPolicies([]);
      expect(result.size).toBe(0);
    });

    it('should return map with policies and nulls', async () => {
      await store.setPolicy('agent-1', createPolicy({ enabled: true }));
      await store.setPolicy('agent-2', createPolicy({ enabled: false }));

      const result = await store.getPolicies(['agent-1', 'agent-2', 'agent-3']);

      expect(result.size).toBe(3);
      expect(result.get('agent-1')?.enabled).toBe(true);
      expect(result.get('agent-2')?.enabled).toBe(false);
      expect(result.get('agent-3')).toBeNull();
    });

    it('should handle invalid JSON in batch', async () => {
      await store.setPolicy('agent-1', createPolicy());
      await redis.set('agent-policy:policy:agent-2', 'not-json');

      const result = await store.getPolicies(['agent-1', 'agent-2']);

      expect(result.get('agent-1')).toBeDefined();
      expect(result.get('agent-2')).toBeNull();
    });
  });

  describe('setPolicies', () => {
    it('should handle empty input', async () => {
      await expect(store.setPolicies([])).resolves.not.toThrow();
    });

    it('should set multiple policies', async () => {
      const policies = [
        { agentId: 'agent-1', policy: createPolicy({ enabled: true }) },
        { agentId: 'agent-2', policy: createPolicy({ enabled: false }) },
      ];

      await store.setPolicies(policies);

      const result1 = await store.getPolicy('agent-1');
      const result2 = await store.getPolicy('agent-2');

      expect(result1?.enabled).toBe(true);
      expect(result2?.enabled).toBe(false);
    });

    it('should add all to indexes', async () => {
      const policies = [
        { agentId: 'org-1:agent-1', policy: createPolicy() },
        { agentId: 'org-1:agent-2', policy: createPolicy() },
        { agentId: 'agent-3', policy: createPolicy() },
      ];

      await store.setPolicies(policies);

      const allAgents = await redis.smembers('agent-policy:agents');
      expect(allAgents).toHaveLength(3);

      const orgAgents = await redis.smembers('agent-policy:org:org-1');
      expect(orgAgents).toHaveLength(2);
    });
  });

  describe('clear', () => {
    it('should handle empty store', async () => {
      await expect(store.clear()).resolves.not.toThrow();
    });

    it('should delete all policies', async () => {
      await store.setPolicy('agent-1', createPolicy());
      await store.setPolicy('agent-2', createPolicy());

      await store.clear();

      const result1 = await store.getPolicy('agent-1');
      const result2 = await store.getPolicy('agent-2');

      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });

    it('should delete all indexes', async () => {
      await store.setPolicy('org-1:agent-1', createPolicy());
      await store.setPolicy('org-1:agent-2', createPolicy());

      await store.clear();

      const agents = await redis.smembers('agent-policy:agents');
      const orgAgents = await redis.smembers('agent-policy:org:org-1');

      expect(agents).toHaveLength(0);
      expect(orgAgents).toHaveLength(0);
    });
  });

  describe('count', () => {
    it('should return 0 for empty store', async () => {
      const result = await store.count();
      expect(result).toBe(0);
    });

    it('should return correct count', async () => {
      await store.setPolicy('agent-1', createPolicy());
      await store.setPolicy('agent-2', createPolicy());
      await store.setPolicy('agent-3', createPolicy());

      const result = await store.count();
      expect(result).toBe(3);
    });
  });

  describe('countByOrg', () => {
    it('should return 0 for org with no policies', async () => {
      const result = await store.countByOrg('org-1');
      expect(result).toBe(0);
    });

    it('should return correct count for org', async () => {
      await store.setPolicy('org-1:agent-1', createPolicy());
      await store.setPolicy('org-1:agent-2', createPolicy());
      await store.setPolicy('org-2:agent-3', createPolicy());

      const result = await store.countByOrg('org-1');
      expect(result).toBe(2);
    });
  });

  describe('with TTL', () => {
    it('should set policies with TTL', async () => {
      const storeWithTtl = new RedisPolicyStore({
        redis: redis as unknown as Redis,
        ttl: 3600,
      });

      // Just verify it doesn't throw - actual TTL behavior is handled by Redis
      await expect(
        storeWithTtl.setPolicy('agent-123', createPolicy())
      ).resolves.not.toThrow();

      const result = await storeWithTtl.getPolicy('agent-123');
      expect(result).toBeDefined();
    });
  });

  describe('organization ID extraction', () => {
    it('should extract org from orgId:agentName format', async () => {
      await store.setPolicy('my-org:my-agent', createPolicy());

      const orgAgents = await redis.smembers('agent-policy:org:my-org');
      expect(orgAgents).toContain('my-org:my-agent');
    });

    it('should handle multiple colons', async () => {
      // First colon is the separator
      await store.setPolicy('org:agent:v1', createPolicy());

      const orgAgents = await redis.smembers('agent-policy:org:org');
      expect(orgAgents).toContain('org:agent:v1');
    });

    it('should not extract org from simple agent name', async () => {
      await store.setPolicy('simple-agent', createPolicy());

      // Should not create any org index for this
      const allSets = Array.from((redis as any).sets.keys());
      const orgSets = allSets.filter((k: string) =>
        k.startsWith('agent-policy:org:')
      );
      expect(orgSets).toHaveLength(0);
    });
  });
});
