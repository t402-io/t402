import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PolicyEngine, type PolicyStore } from '../../src/policy/PolicyEngine.js';
import { SpendingLimiter } from '../../src/limits/SpendingLimiter.js';
import { RuleEvaluator } from '../../src/rules/RuleEvaluator.js';
import type { LimitStore } from '../../src/limits/types.js';
import type { Policy, Amount, AuthorizationRequest } from '../../src/types.js';

// Mock LimitStore
class MockLimitStore implements LimitStore {
  private data = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.data.get(key) || null;
  }

  async set(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }

  async increment(key: string, amount: number): Promise<number> {
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

  clear(): void {
    this.data.clear();
  }
}

// Mock PolicyStore
class MockPolicyStore implements PolicyStore {
  private policies = new Map<string, Policy>();
  private agentPolicies = new Map<string, string[]>();

  async getPolicy(id: string): Promise<Policy | null> {
    return this.policies.get(id) || null;
  }

  async getPoliciesForAgent(agentId: string): Promise<Policy[]> {
    const policyIds = this.agentPolicies.get(agentId) || [];
    const policies: Policy[] = [];
    for (const id of policyIds) {
      const policy = this.policies.get(id);
      if (policy) policies.push(policy);
    }
    return policies;
  }

  async getPolicyChain(policyId: string): Promise<Policy[]> {
    const chain: Policy[] = [];
    let currentId: string | undefined = policyId;

    while (currentId) {
      const policy = this.policies.get(currentId);
      if (!policy) break;
      chain.unshift(policy);
      currentId = policy.parentId;
    }

    return chain;
  }

  // Test helpers
  addPolicy(policy: Policy): void {
    this.policies.set(policy.id, policy);
  }

  assignPolicyToAgent(agentId: string, policyId: string): void {
    const current = this.agentPolicies.get(agentId) || [];
    current.push(policyId);
    this.agentPolicies.set(agentId, current);
  }

  clear(): void {
    this.policies.clear();
    this.agentPolicies.clear();
  }
}

describe('PolicyEngine', () => {
  let engine: PolicyEngine;
  let policyStore: MockPolicyStore;
  let limitStore: MockLimitStore;

  beforeEach(() => {
    policyStore = new MockPolicyStore();
    limitStore = new MockLimitStore();

    const spendingLimiter = new SpendingLimiter({ store: limitStore });
    const ruleEvaluator = new RuleEvaluator();

    engine = new PolicyEngine({
      policyStore,
      spendingLimiter,
      ruleEvaluator,
    });
  });

  const createPolicy = (overrides: Partial<Policy> = {}): Policy => ({
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test Policy',
    version: '1.0.0',
    priority: 0,
    status: 'active',
    limits: {},
    rules: {},
    createdAt: new Date('2026-01-19'),
    updatedAt: new Date('2026-01-19'),
    createdBy: 'admin',
    ...overrides,
  });

  const createAmount = (value: string, decimals = 6): Amount => ({
    value,
    decimals,
    symbol: 'USDT',
  });

  const createRequest = (overrides: Partial<AuthorizationRequest> = {}): AuthorizationRequest => ({
    agentId: 'agent-123',
    amount: createAmount('100000000'),
    recipient: '0x1234567890abcdef1234567890abcdef12345678',
    network: 'eip155:8453',
    ...overrides,
  });

  describe('authorize', () => {
    it('should reject when no policy found', async () => {
      const request = createRequest();

      const result = await engine.authorize(request);

      expect(result.decision).toBe('rejected');
      expect(result.reason).toContain('No policy found');
    });

    it('should approve valid payment within limits', async () => {
      const policy = createPolicy({
        limits: {
          perTransaction: createAmount('500000000'), // 500 USDT
          daily: createAmount('1000000000'), // 1000 USDT
        },
      });

      policyStore.addPolicy(policy);
      policyStore.assignPolicyToAgent('agent-123', policy.id);

      const request = createRequest({
        amount: createAmount('100000000'), // 100 USDT
      });

      const result = await engine.authorize(request);

      expect(result.decision).toBe('approved');
      expect(result.reservationId).toBeDefined();
    });

    it('should reject payment exceeding per-transaction limit', async () => {
      const policy = createPolicy({
        limits: {
          perTransaction: createAmount('100000000'), // 100 USDT
        },
      });

      policyStore.addPolicy(policy);
      policyStore.assignPolicyToAgent('agent-123', policy.id);

      const request = createRequest({
        amount: createAmount('150000000'), // 150 USDT
      });

      const result = await engine.authorize(request);

      expect(result.decision).toBe('rejected');
      expect(result.evaluations).toContainEqual(
        expect.objectContaining({
          rule: 'spending_limits',
          passed: false,
        })
      );
    });

    it('should reject payment outside allowed time window', async () => {
      const policy = createPolicy({
        limits: {
          daily: createAmount('1000000000'),
        },
        rules: {
          time: {
            allowedWindows: [
              { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 17 },
            ],
            timezone: 'UTC',
          },
        },
      });

      policyStore.addPolicy(policy);
      policyStore.assignPolicyToAgent('agent-123', policy.id);

      // Mock time to be Saturday
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-24T12:00:00Z')); // Saturday

      const request = createRequest();

      const result = await engine.authorize(request);

      expect(result.decision).toBe('rejected');
      expect(result.evaluations).toContainEqual(
        expect.objectContaining({
          rule: 'time_rules',
          passed: false,
        })
      );

      vi.useRealTimers();
    });

    it('should reject payment to blacklisted merchant', async () => {
      const policy = createPolicy({
        limits: {
          daily: createAmount('1000000000'),
        },
        rules: {
          merchant: {
            blacklist: ['0xbadaddress123456789012345678901234567890'],
          },
        },
      });

      policyStore.addPolicy(policy);
      policyStore.assignPolicyToAgent('agent-123', policy.id);

      const request = createRequest({
        recipient: '0xbadaddress123456789012345678901234567890',
      });

      const result = await engine.authorize(request);

      expect(result.decision).toBe('rejected');
      expect(result.evaluations).toContainEqual(
        expect.objectContaining({
          rule: 'merchant_rules',
          passed: false,
        })
      );
    });

    it('should reject payment to non-whitelisted merchant when whitelist required', async () => {
      const policy = createPolicy({
        limits: {
          daily: createAmount('1000000000'),
        },
        rules: {
          merchant: {
            whitelist: ['0xgoodaddress12345678901234567890123456789a'],
            requireWhitelist: true,
          },
        },
      });

      policyStore.addPolicy(policy);
      policyStore.assignPolicyToAgent('agent-123', policy.id);

      const request = createRequest({
        recipient: '0xunknownaddress1234567890123456789012345',
      });

      const result = await engine.authorize(request);

      expect(result.decision).toBe('rejected');
    });

    it('should reject payment on blocked network', async () => {
      const policy = createPolicy({
        limits: {
          daily: createAmount('1000000000'),
        },
        rules: {
          network: {
            blockedNetworks: ['eip155:56'], // BSC blocked
          },
        },
      });

      policyStore.addPolicy(policy);
      policyStore.assignPolicyToAgent('agent-123', policy.id);

      const request = createRequest({
        network: 'eip155:56',
      });

      const result = await engine.authorize(request);

      expect(result.decision).toBe('rejected');
      expect(result.evaluations).toContainEqual(
        expect.objectContaining({
          rule: 'network_rules',
          passed: false,
        })
      );
    });

    it('should return pending_approval when amount exceeds threshold', async () => {
      const policy = createPolicy({
        limits: {
          daily: createAmount('10000000000'), // 10000 USDT
        },
        approval: {
          thresholds: [
            {
              amount: createAmount('500000000'), // 500 USDT
              requiredApprovers: 2,
              approvers: ['0xapprover1', '0xapprover2'],
            },
          ],
          timeout: 3600000,
        },
      });

      policyStore.addPolicy(policy);
      policyStore.assignPolicyToAgent('agent-123', policy.id);

      const request = createRequest({
        amount: createAmount('600000000'), // 600 USDT - above threshold
      });

      const result = await engine.authorize(request);

      expect(result.decision).toBe('pending_approval');
      expect(result.reason).toContain('approval threshold');
    });

    it('should approve when amount below approval threshold', async () => {
      const policy = createPolicy({
        limits: {
          daily: createAmount('10000000000'),
        },
        approval: {
          thresholds: [
            {
              amount: createAmount('500000000'), // 500 USDT
              requiredApprovers: 2,
              approvers: ['0xapprover1', '0xapprover2'],
            },
          ],
          timeout: 3600000,
        },
      });

      policyStore.addPolicy(policy);
      policyStore.assignPolicyToAgent('agent-123', policy.id);

      const request = createRequest({
        amount: createAmount('400000000'), // 400 USDT - below threshold
      });

      const result = await engine.authorize(request);

      expect(result.decision).toBe('approved');
    });

    it('should include all evaluations in result', async () => {
      const policy = createPolicy({
        limits: {
          daily: createAmount('1000000000'),
        },
        rules: {
          time: {
            allowedWindows: [{ days: [0, 1, 2, 3, 4, 5, 6], startHour: 0, endHour: 23 }],
          },
          merchant: {
            blacklist: ['0xbadaddr'],
          },
          network: {
            allowedNetworks: ['eip155:8453'],
          },
        },
      });

      policyStore.addPolicy(policy);
      policyStore.assignPolicyToAgent('agent-123', policy.id);

      const request = createRequest();

      const result = await engine.authorize(request);

      expect(result.evaluations.length).toBeGreaterThanOrEqual(3);
      expect(result.evaluations.map((e) => e.rule)).toContain('time_rules');
      expect(result.evaluations.map((e) => e.rule)).toContain('merchant_rules');
      expect(result.evaluations.map((e) => e.rule)).toContain('network_rules');
    });

    it('should include effective policy in result', async () => {
      const policy = createPolicy({
        name: 'My Policy',
        limits: {
          daily: createAmount('1000000000'),
        },
      });

      policyStore.addPolicy(policy);
      policyStore.assignPolicyToAgent('agent-123', policy.id);

      const request = createRequest();

      const result = await engine.authorize(request);

      expect(result.effectivePolicy).toBeDefined();
      expect(result.effectivePolicy.name).toBe('My Policy');
    });
  });

  describe('confirmReservation', () => {
    it('should confirm reservation successfully', async () => {
      const policy = createPolicy({
        limits: {
          daily: createAmount('1000000000'),
        },
      });

      policyStore.addPolicy(policy);
      policyStore.assignPolicyToAgent('agent-123', policy.id);

      const request = createRequest();
      const authResult = await engine.authorize(request);

      expect(authResult.decision).toBe('approved');
      expect(authResult.reservationId).toBeDefined();

      await expect(
        engine.confirmReservation(authResult.reservationId!)
      ).resolves.not.toThrow();
    });
  });

  describe('releaseReservation', () => {
    it('should release reservation and restore budget', async () => {
      const policy = createPolicy({
        limits: {
          daily: createAmount('100000000'), // 100 USDT
        },
      });

      policyStore.addPolicy(policy);
      policyStore.assignPolicyToAgent('agent-123', policy.id);

      // First request uses 60 USDT
      const request1 = createRequest({ amount: createAmount('60000000') });
      const result1 = await engine.authorize(request1);
      expect(result1.decision).toBe('approved');

      // Second request for 50 USDT should fail
      const request2 = createRequest({ amount: createAmount('50000000') });
      const result2 = await engine.authorize(request2);
      expect(result2.decision).toBe('rejected');

      // Release first reservation
      await engine.releaseReservation(result1.reservationId!);

      // Now 50 USDT should work
      const result3 = await engine.authorize(request2);
      expect(result3.decision).toBe('approved');
    });
  });

  describe('getRemainingBudget', () => {
    it('should return remaining budget', async () => {
      const policy = createPolicy({
        limits: {
          daily: createAmount('1000000000'), // 1000 USDT
        },
      });

      policyStore.addPolicy(policy);
      policyStore.assignPolicyToAgent('agent-123', policy.id);

      // Spend 300 USDT
      const request = createRequest({ amount: createAmount('300000000') });
      await engine.authorize(request);

      const budget = await engine.getRemainingBudget('agent-123', 'daily');

      expect(budget.limit).toBe('1000000000');
      expect(budget.spent).toBe('300000000');
      expect(budget.remaining).toBe('700000000');
    });
  });

  describe('policy inheritance', () => {
    it('should merge parent and child policies', async () => {
      const parentPolicy = createPolicy({
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Organization Policy',
        limits: {
          monthly: createAmount('100000000000'), // 100k USDT
        },
        rules: {
          merchant: {
            blacklist: ['0xbadorg'],
          },
        },
      });

      const childPolicy = createPolicy({
        id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Agent Policy',
        parentId: parentPolicy.id,
        limits: {
          daily: createAmount('1000000000'), // 1000 USDT
        },
        rules: {
          merchant: {
            blacklist: ['0xbadagent'],
          },
        },
      });

      policyStore.addPolicy(parentPolicy);
      policyStore.addPolicy(childPolicy);
      policyStore.assignPolicyToAgent('agent-123', parentPolicy.id);
      policyStore.assignPolicyToAgent('agent-123', childPolicy.id);

      // Should be rejected due to parent's blacklist
      const request1 = createRequest({ recipient: '0xbadorg' });
      const result1 = await engine.authorize(request1);
      expect(result1.decision).toBe('rejected');

      // Should be rejected due to child's blacklist
      const request2 = createRequest({ recipient: '0xbadagent' });
      const result2 = await engine.authorize(request2);
      expect(result2.decision).toBe('rejected');
    });
  });
});
