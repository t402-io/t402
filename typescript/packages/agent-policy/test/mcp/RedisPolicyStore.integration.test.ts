/**
 * Integration tests for RedisPolicyStore with real Redis
 *
 * These tests require a running Redis instance.
 * Set REDIS_URL environment variable to run these tests.
 *
 * Example:
 *   REDIS_URL=redis://localhost:6379 npm run test:integration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Redis from 'ioredis';
import { RedisPolicyStore } from '../../src/mcp/RedisPolicyStore.js';
import { RedisApprovalStore } from '../../src/mcp/RedisApprovalStore.js';
import { ApprovalManager } from '../../src/mcp/ApprovalManager.js';
import { RedisLimitStore } from '../../src/limits/RedisLimitStore.js';
import { SpendingLimiter } from '../../src/limits/SpendingLimiter.js';
import type { AgentPolicy, Amount, SpendingLimits, PaymentRequest, ApprovalConfig } from '../../src/types.js';

const REDIS_URL = process.env.REDIS_URL;

// Skip all tests if Redis URL is not provided
const describeWithRedis = REDIS_URL ? describe : describe.skip;

describeWithRedis('RedisPolicyStore Integration', () => {
  let redis: Redis;
  let store: RedisPolicyStore;
  const testPrefix = `test-${Date.now()}:`;

  const createPolicy = (overrides: Partial<AgentPolicy> = {}): AgentPolicy => ({
    enabled: true,
    limits: {
      daily: { value: '1000000000', decimals: 6, symbol: 'USDT' },
    },
    ...overrides,
  });

  beforeAll(async () => {
    redis = new Redis(REDIS_URL!);
    // Wait for connection
    await redis.ping();
  });

  afterAll(async () => {
    // Clean up all test keys
    const keys = await redis.keys(`${testPrefix}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    await redis.quit();
  });

  beforeEach(async () => {
    // Create a fresh store with unique prefix for each test
    store = new RedisPolicyStore({
      redis,
      keyPrefix: testPrefix,
    });

    // Clean up previous test data
    const keys = await redis.keys(`${testPrefix}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  describe('basic operations', () => {
    it('should store and retrieve a policy', async () => {
      const policy = createPolicy({ enabled: true });

      await store.setPolicy('agent-1', policy);
      const retrieved = await store.getPolicy('agent-1');

      expect(retrieved).toEqual(policy);
    });

    it('should return null for non-existent policy', async () => {
      const result = await store.getPolicy('non-existent');
      expect(result).toBeNull();
    });

    it('should delete a policy', async () => {
      await store.setPolicy('agent-1', createPolicy());

      const deleted = await store.deletePolicy('agent-1');
      expect(deleted).toBe(true);

      const retrieved = await store.getPolicy('agent-1');
      expect(retrieved).toBeNull();
    });

    it('should return false when deleting non-existent policy', async () => {
      const result = await store.deletePolicy('non-existent');
      expect(result).toBe(false);
    });

    it('should check if policy exists', async () => {
      await store.setPolicy('agent-1', createPolicy());

      expect(await store.hasPolicy('agent-1')).toBe(true);
      expect(await store.hasPolicy('agent-2')).toBe(false);
    });
  });

  describe('listing and counting', () => {
    it('should list all policies', async () => {
      await store.setPolicy('agent-1', createPolicy({ enabled: true }));
      await store.setPolicy('agent-2', createPolicy({ enabled: false }));
      await store.setPolicy('agent-3', createPolicy({ enabled: true }));

      const policies = await store.listPolicies();

      expect(policies).toHaveLength(3);
      const agentIds = policies.map((p) => p.agentId).sort();
      expect(agentIds).toEqual(['agent-1', 'agent-2', 'agent-3']);
    });

    it('should filter policies by organization', async () => {
      await store.setPolicy('org-a:agent-1', createPolicy());
      await store.setPolicy('org-a:agent-2', createPolicy());
      await store.setPolicy('org-b:agent-3', createPolicy());

      const orgAPolicies = await store.listPolicies('org-a');
      expect(orgAPolicies).toHaveLength(2);

      const orgBPolicies = await store.listPolicies('org-b');
      expect(orgBPolicies).toHaveLength(1);
    });

    it('should count policies', async () => {
      expect(await store.count()).toBe(0);

      await store.setPolicy('agent-1', createPolicy());
      await store.setPolicy('agent-2', createPolicy());

      expect(await store.count()).toBe(2);
    });

    it('should count policies by organization', async () => {
      await store.setPolicy('org-a:agent-1', createPolicy());
      await store.setPolicy('org-a:agent-2', createPolicy());
      await store.setPolicy('org-b:agent-3', createPolicy());

      expect(await store.countByOrg('org-a')).toBe(2);
      expect(await store.countByOrg('org-b')).toBe(1);
      expect(await store.countByOrg('org-c')).toBe(0);
    });
  });

  describe('batch operations', () => {
    it('should get multiple policies at once', async () => {
      await store.setPolicy('agent-1', createPolicy({ enabled: true }));
      await store.setPolicy('agent-2', createPolicy({ enabled: false }));

      const result = await store.getPolicies(['agent-1', 'agent-2', 'agent-3']);

      expect(result.size).toBe(3);
      expect(result.get('agent-1')?.enabled).toBe(true);
      expect(result.get('agent-2')?.enabled).toBe(false);
      expect(result.get('agent-3')).toBeNull();
    });

    it('should set multiple policies at once', async () => {
      await store.setPolicies([
        { agentId: 'agent-1', policy: createPolicy({ enabled: true }) },
        { agentId: 'agent-2', policy: createPolicy({ enabled: false }) },
        { agentId: 'org-x:agent-3', policy: createPolicy() },
      ]);

      expect(await store.count()).toBe(3);
      expect(await store.countByOrg('org-x')).toBe(1);

      const p1 = await store.getPolicy('agent-1');
      const p2 = await store.getPolicy('agent-2');

      expect(p1?.enabled).toBe(true);
      expect(p2?.enabled).toBe(false);
    });
  });

  describe('clear operation', () => {
    it('should clear all policies', async () => {
      await store.setPolicy('org-a:agent-1', createPolicy());
      await store.setPolicy('org-a:agent-2', createPolicy());
      await store.setPolicy('org-b:agent-3', createPolicy());

      expect(await store.count()).toBe(3);

      await store.clear();

      expect(await store.count()).toBe(0);
      expect(await store.countByOrg('org-a')).toBe(0);
      expect(await store.countByOrg('org-b')).toBe(0);
    });
  });

  describe('TTL support', () => {
    it('should set policies with TTL', async () => {
      const storeWithTtl = new RedisPolicyStore({
        redis,
        keyPrefix: testPrefix,
        ttl: 2, // 2 seconds
      });

      await storeWithTtl.setPolicy('agent-ttl', createPolicy());

      // Should exist immediately
      const policy = await storeWithTtl.getPolicy('agent-ttl');
      expect(policy).not.toBeNull();

      // Check that TTL is set
      const ttl = await redis.ttl(`${testPrefix}policy:agent-ttl`);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(2);
    });
  });

  describe('complex policy data', () => {
    it('should handle full policy with all fields', async () => {
      const fullPolicy: AgentPolicy = {
        enabled: true,
        requireApproval: true,
        limits: {
          perTransaction: { value: '100000000', decimals: 6, symbol: 'USDT' },
          hourly: { value: '500000000', decimals: 6, symbol: 'USDT' },
          daily: { value: '1000000000', decimals: 6, symbol: 'USDT' },
          weekly: { value: '5000000000', decimals: 6, symbol: 'USDT' },
          monthly: { value: '10000000000', decimals: 6, symbol: 'USDT' },
        },
        timeRules: {
          allowedWindows: [
            { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 17 },
          ],
          timezone: 'UTC',
        },
        merchantRules: {
          whitelist: ['0x1111', '0x2222', '0x3333'],
          blacklist: ['0xbad1'],
          requireWhitelist: true,
        },
        networkRules: {
          allowedNetworks: ['eip155:1', 'eip155:8453'],
          blockedNetworks: ['eip155:56'],
        },
      };

      await store.setPolicy('agent-full', fullPolicy);
      const retrieved = await store.getPolicy('agent-full');

      expect(retrieved).toEqual(fullPolicy);
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent writes', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        store.setPolicy(`agent-${i}`, createPolicy({ enabled: i % 2 === 0 }))
      );

      await Promise.all(promises);

      expect(await store.count()).toBe(10);

      const policies = await store.listPolicies();
      const enabledCount = policies.filter((p) => p.policy.enabled).length;
      expect(enabledCount).toBe(5);
    });

    it('should handle concurrent reads', async () => {
      // Set up data
      await store.setPolicies(
        Array.from({ length: 10 }, (_, i) => ({
          agentId: `agent-${i}`,
          policy: createPolicy(),
        }))
      );

      // Concurrent reads
      const promises = Array.from({ length: 10 }, (_, i) =>
        store.getPolicy(`agent-${i}`)
      );

      const results = await Promise.all(promises);

      expect(results.every((r) => r !== null)).toBe(true);
    });
  });
});

describeWithRedis('RedisLimitStore Integration', () => {
  let redis: Redis;
  let limitStore: RedisLimitStore;
  let limiter: SpendingLimiter;
  // Use unique agent prefix for test isolation
  const testAgentPrefix = `test-agent-${Date.now()}`;

  const createAmount = (value: string, decimals = 6): Amount => ({
    value,
    decimals,
    symbol: 'USDT',
  });

  beforeAll(async () => {
    redis = new Redis(REDIS_URL!);
    await redis.ping();
  });

  afterAll(async () => {
    // Clean up SpendingLimiter keys (uses t402:limits: prefix)
    const keys = await redis.keys(`t402:limits:${testAgentPrefix}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    await redis.quit();
  });

  beforeEach(async () => {
    limitStore = new RedisLimitStore(redis);
    limiter = new SpendingLimiter({
      store: limitStore,
    });

    // Clean up any existing test data (SpendingLimiter uses t402:limits: prefix)
    const keys = await redis.keys(`t402:limits:${testAgentPrefix}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  describe('spending limits', () => {
    it('should track spending across requests', async () => {
      const agentId = `${testAgentPrefix}-track-1`;
      const limits: SpendingLimits = {
        daily: createAmount('1000000000'), // 1000 USDT
      };

      // First payment - 300 USDT
      const result1 = await limiter.checkAndReserve(
        agentId,
        createAmount('300000000'),
        limits
      );
      expect(result1.allowed).toBe(true);

      // Second payment - 400 USDT (total 700)
      const result2 = await limiter.checkAndReserve(
        agentId,
        createAmount('400000000'),
        limits
      );
      expect(result2.allowed).toBe(true);

      // Third payment - 400 USDT (would be 1100, exceeds limit)
      const result3 = await limiter.checkAndReserve(
        agentId,
        createAmount('400000000'),
        limits
      );
      expect(result3.allowed).toBe(false);
      expect(result3.reason).toContain('daily');
    });

    it('should release reservations correctly', async () => {
      const agentId = `${testAgentPrefix}-release-1`;
      const limits: SpendingLimits = {
        daily: createAmount('100000000'), // 100 USDT
      };

      // Reserve 80 USDT
      const result1 = await limiter.checkAndReserve(
        agentId,
        createAmount('80000000'),
        limits
      );
      expect(result1.allowed).toBe(true);

      // Try to reserve 30 more (would exceed)
      const result2 = await limiter.checkAndReserve(
        agentId,
        createAmount('30000000'),
        limits
      );
      expect(result2.allowed).toBe(false);

      // Release the first reservation
      await limiter.release(result1.reservationId!);

      // Now 30 USDT should work
      const result3 = await limiter.checkAndReserve(
        agentId,
        createAmount('30000000'),
        limits
      );
      expect(result3.allowed).toBe(true);
    });

    it('should track budget correctly', async () => {
      const agentId = `${testAgentPrefix}-budget-1`;
      const limits: SpendingLimits = {
        daily: createAmount('1000000000'), // 1000 USDT
      };

      // Spend 300 USDT
      await limiter.checkAndReserve(
        agentId,
        createAmount('300000000'),
        limits
      );

      const budget = await limiter.getRemainingBudget(agentId, 'daily', limits);

      expect(budget.limit).toBe('1000000000');
      expect(budget.spent).toBe('300000000');
      expect(budget.remaining).toBe('700000000');
    });

    it('should isolate spending between agents', async () => {
      const agentId1 = `${testAgentPrefix}-isolate-1`;
      const agentId2 = `${testAgentPrefix}-isolate-2`;
      const limits: SpendingLimits = {
        daily: createAmount('100000000'), // 100 USDT
      };

      // Agent 1 spends 90 USDT
      await limiter.checkAndReserve(
        agentId1,
        createAmount('90000000'),
        limits
      );

      // Agent 2 should have full budget
      const result = await limiter.checkAndReserve(
        agentId2,
        createAmount('90000000'),
        limits
      );
      expect(result.allowed).toBe(true);

      // Agent 1 can't spend more
      const result2 = await limiter.checkAndReserve(
        agentId1,
        createAmount('20000000'),
        limits
      );
      expect(result2.allowed).toBe(false);
    });
  });
});

describeWithRedis('RedisApprovalStore Integration', () => {
  let redis: Redis;
  let store: RedisApprovalStore;
  let manager: ApprovalManager;
  const testPrefix = `test-approval-${Date.now()}:`;

  const createRequest = (amount: string = '100000000', agentId: string = 'test-agent'): PaymentRequest => ({
    agentId,
    amount: { value: amount, decimals: 6, symbol: 'USDT' },
    recipient: '0x1234567890abcdef',
    network: 'eip155:8453',
    category: 'api_usage',
  });

  const createConfig = (): ApprovalConfig => ({
    thresholds: [
      {
        amount: { value: '50000000', decimals: 6, symbol: 'USDT' }, // 50 USDT
        requiredApprovers: 1,
        approvers: ['admin@example.com', 'manager@example.com'],
      },
      {
        amount: { value: '500000000', decimals: 6, symbol: 'USDT' }, // 500 USDT
        requiredApprovers: 2,
        approvers: ['admin@example.com', 'manager@example.com', 'cfo@example.com'],
      },
    ],
    timeout: 3600000,
  });

  beforeAll(async () => {
    redis = new Redis(REDIS_URL!);
    await redis.ping();
  });

  afterAll(async () => {
    const keys = await redis.keys(`${testPrefix}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    await redis.quit();
  });

  beforeEach(async () => {
    store = new RedisApprovalStore({
      redis,
      keyPrefix: testPrefix,
      resolvedTtl: 3600, // 1 hour for testing
    });
    manager = new ApprovalManager({ store });

    // Clean up previous test data
    const keys = await redis.keys(`${testPrefix}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  describe('basic approval operations', () => {
    it('should create and retrieve approval', async () => {
      const request = createRequest('100000000');
      const config = createConfig();

      const approval = await manager.createApproval(request, config);
      const retrieved = await manager.getApproval(approval.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(approval.id);
      expect(retrieved?.agentId).toBe('test-agent');
      expect(retrieved?.status).toBe('pending');
    });

    it('should store approval data correctly in Redis', async () => {
      const request = createRequest('100000000');
      const config = createConfig();

      const approval = await manager.createApproval(request, config);

      // Verify the data is in Redis
      const rawData = await redis.get(`${testPrefix}approval:${approval.id}`);
      expect(rawData).not.toBeNull();

      const parsed = JSON.parse(rawData!);
      expect(parsed.agentId).toBe('test-agent');
      expect(parsed.status).toBe('pending');
    });

    it('should update approval status on decision', async () => {
      const request = createRequest('100000000');
      const config = createConfig();

      const approval = await manager.createApproval(request, config);

      const result = await manager.submitDecision(approval.id, {
        approver: 'admin@example.com',
        timestamp: new Date(),
        decision: 'approve',
      });

      expect(result.approved).toBe(true);
      expect(result.status).toBe('approved');

      const updated = await manager.getApproval(approval.id);
      expect(updated?.status).toBe('approved');
      expect(updated?.resolvedAt).toBeDefined();
    });
  });

  describe('index operations', () => {
    it('should track pending approvals in index', async () => {
      const config = createConfig();

      await manager.createApproval(createRequest('100000000', 'agent-1'), config);
      await manager.createApproval(createRequest('200000000', 'agent-2'), config);
      await manager.createApproval(createRequest('300000000', 'agent-1'), config);

      const allPending = await manager.listPendingApprovals();
      expect(allPending).toHaveLength(3);

      const agent1Pending = await manager.listPendingApprovals('agent-1');
      expect(agent1Pending).toHaveLength(2);
    });

    it('should remove from pending index when resolved', async () => {
      const request = createRequest('100000000');
      const config = createConfig();

      const approval = await manager.createApproval(request, config);

      let pending = await manager.listPendingApprovals();
      expect(pending).toHaveLength(1);

      await manager.submitDecision(approval.id, {
        approver: 'admin@example.com',
        timestamp: new Date(),
        decision: 'approve',
      });

      pending = await manager.listPendingApprovals();
      expect(pending).toHaveLength(0);
    });

    it('should track approvals by agent', async () => {
      const config = createConfig();

      const approval1 = await manager.createApproval(createRequest('100000000', 'agent-1'), config);
      await manager.createApproval(createRequest('200000000', 'agent-2'), config);

      // Approve one
      await manager.submitDecision(approval1.id, {
        approver: 'admin@example.com',
        timestamp: new Date(),
        decision: 'approve',
      });

      // Agent 1 has 1 pending (none, it was approved), agent 2 has 1 pending
      const agent1Pending = await manager.listPendingApprovals('agent-1');
      const agent2Pending = await manager.listPendingApprovals('agent-2');

      expect(agent1Pending).toHaveLength(0);
      expect(agent2Pending).toHaveLength(1);
    });
  });

  describe('multi-approver workflow', () => {
    it('should require multiple approvers for high-value payments', async () => {
      const request = createRequest('1000000000'); // 1000 USDT - needs 2 approvers
      const config = createConfig();

      const approval = await manager.createApproval(request, config);

      // First approval
      const result1 = await manager.submitDecision(approval.id, {
        approver: 'admin@example.com',
        timestamp: new Date(),
        decision: 'approve',
      });

      expect(result1.approved).toBe(false);
      expect(result1.status).toBe('pending');

      // Still pending in Redis
      const stillPending = await manager.listPendingApprovals();
      expect(stillPending).toHaveLength(1);

      // Second approval
      const result2 = await manager.submitDecision(approval.id, {
        approver: 'manager@example.com',
        timestamp: new Date(),
        decision: 'approve',
      });

      expect(result2.approved).toBe(true);
      expect(result2.status).toBe('approved');

      // No longer pending
      const noPending = await manager.listPendingApprovals();
      expect(noPending).toHaveLength(0);
    });

    it('should persist approval decisions across requests', async () => {
      const request = createRequest('1000000000');
      const config = createConfig();

      const approval = await manager.createApproval(request, config);

      // First approval
      await manager.submitDecision(approval.id, {
        approver: 'admin@example.com',
        timestamp: new Date(),
        decision: 'approve',
        comment: 'Looks good',
      });

      // Create a new manager instance to simulate a new request
      const newManager = new ApprovalManager({ store });

      // Verify the first approval is persisted
      const fetched = await newManager.getApproval(approval.id);
      expect(fetched?.currentApprovals).toHaveLength(1);
      expect(fetched?.currentApprovals[0].approver).toBe('admin@example.com');
      expect(fetched?.currentApprovals[0].comment).toBe('Looks good');

      // Complete with second approval
      const result = await newManager.submitDecision(approval.id, {
        approver: 'manager@example.com',
        timestamp: new Date(),
        decision: 'approve',
      });

      expect(result.approved).toBe(true);
    });
  });

  describe('denial workflow', () => {
    it('should immediately deny on any denial', async () => {
      const request = createRequest('1000000000');
      const config = createConfig();

      const approval = await manager.createApproval(request, config);

      const result = await manager.submitDecision(approval.id, {
        approver: 'admin@example.com',
        timestamp: new Date(),
        decision: 'deny',
        comment: 'Budget concerns',
      });

      expect(result.approved).toBe(false);
      expect(result.status).toBe('denied');

      const fetched = await manager.getApproval(approval.id);
      expect(fetched?.status).toBe('denied');
    });
  });

  describe('cleanup operations', () => {
    it('should clean up expired approvals', async () => {
      // Create approval with very short timeout
      const request = createRequest('100000000');
      const shortConfig: ApprovalConfig = {
        thresholds: [
          {
            amount: { value: '50000000', decimals: 6 },
            requiredApprovers: 1,
            approvers: ['admin@example.com'],
          },
        ],
        timeout: 1, // 1ms
      };

      await manager.createApproval(request, shortConfig);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 50));

      const cleaned = await store.cleanupExpired();
      expect(cleaned).toBe(1);

      const pending = await manager.listPendingApprovals();
      expect(pending).toHaveLength(0);
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent approval creations', async () => {
      const config = createConfig();

      const promises = Array.from({ length: 10 }, (_, i) =>
        manager.createApproval(createRequest(`${(i + 1) * 100}000000`, `agent-${i}`), config)
      );

      const approvals = await Promise.all(promises);

      expect(approvals).toHaveLength(10);
      expect(new Set(approvals.map((a) => a.id)).size).toBe(10); // All unique IDs

      const pending = await manager.listPendingApprovals();
      expect(pending).toHaveLength(10);
    });

    it('should handle sequential decisions from different approvers', async () => {
      const request = createRequest('1000000000'); // Needs 2 approvers
      const config = createConfig();

      const approval = await manager.createApproval(request, config);

      // First approver - should not complete approval
      const result1 = await manager.submitDecision(approval.id, {
        approver: 'admin@example.com',
        timestamp: new Date(),
        decision: 'approve',
      });
      expect(result1.status).toBe('pending');

      // Second approver - should complete approval
      const result2 = await manager.submitDecision(approval.id, {
        approver: 'manager@example.com',
        timestamp: new Date(),
        decision: 'approve',
      });
      expect(result2.status).toBe('approved');

      // Verify the approval is now approved
      const finalApproval = await manager.getApproval(approval.id);
      expect(finalApproval?.status).toBe('approved');
      expect(finalApproval?.currentApprovals.length).toBe(2);
    });
  });
});

describeWithRedis('Full Server Integration', () => {
  let redis: Redis;
  const testPrefix = `test-server-${Date.now()}:`;

  beforeAll(async () => {
    redis = new Redis(REDIS_URL!);
    await redis.ping();
  });

  afterAll(async () => {
    const keys = await redis.keys(`${testPrefix}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    await redis.quit();
  });

  it('should create server with Redis stores', async () => {
    const { AgentPolicyMcpServer, RedisPolicyStore } = await import(
      '../../src/mcp/index.js'
    );
    const { RedisLimitStore } = await import('../../src/limits/index.js');

    const policyStore = new RedisPolicyStore({
      redis,
      keyPrefix: testPrefix,
    });

    const limitStore = new RedisLimitStore(redis);

    const server = new AgentPolicyMcpServer(
      { demoMode: false },
      { policyStore, limitStore }
    );

    // Set a policy
    const setResult = await server.handleToolCall('agent-policy/set', {
      agentId: 'integration-agent',
      policy: {
        enabled: true,
        limits: {
          daily: { value: '1000000000' },
        },
        networkRules: {
          allowedNetworks: ['eip155:8453'],
        },
      },
    });

    expect(setResult.isError).toBe(false);

    // Get the policy
    const getResult = await server.handleToolCall('agent-policy/get', {
      agentId: 'integration-agent',
    });

    expect(getResult.isError).toBe(false);
    expect(getResult.content[0].text).toContain('integration-agent');

    // Authorize a payment
    const authResult = await server.handleToolCall('agent-policy/authorize', {
      agentId: 'integration-agent',
      amount: '100000000',
      recipient: '0x1234567890abcdef',
      network: 'eip155:8453',
    });

    expect(authResult.isError).toBe(false);
    expect(authResult.content[0].text).toContain('Authorized');

    // Check budget
    const budgetResult = await server.handleToolCall('agent-policy/budget', {
      agentId: 'integration-agent',
      period: 'daily',
    });

    expect(budgetResult.isError).toBe(false);
    expect(budgetResult.content[0].text).toContain('100');
  });
});
