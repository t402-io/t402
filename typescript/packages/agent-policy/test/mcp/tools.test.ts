import { describe, it, expect, beforeEach } from 'vitest';
import {
  executeAuthorizePayment,
  formatAuthorizePaymentResult,
  executeGetRemainingBudget,
  formatGetRemainingBudgetResult,
  executeGetPolicy,
  formatGetPolicyResult,
  executeSetPolicy,
  formatSetPolicyResult,
  executeListPolicies,
  formatListPoliciesResult,
  executeConfirmPayment,
  formatConfirmPaymentResult,
  executeReleasePayment,
  formatReleasePaymentResult,
  InMemoryPolicyStore,
  InMemoryLimitStore,
} from '../../src/mcp/index.js';
import { SimplePolicyEngine } from '../../src/mcp/SimplePolicyEngine.js';
import { SpendingLimiter } from '../../src/limits/SpendingLimiter.js';
import type { AgentPolicy } from '../../src/types.js';

describe('MCP Tools', () => {
  let policyStore: InMemoryPolicyStore;
  let limitStore: InMemoryLimitStore;
  let spendingLimiter: SpendingLimiter;
  let policyEngine: SimplePolicyEngine;

  beforeEach(() => {
    policyStore = new InMemoryPolicyStore();
    limitStore = new InMemoryLimitStore();
    spendingLimiter = new SpendingLimiter({ store: limitStore });
    policyEngine = new SimplePolicyEngine({ spendingLimiter });
  });

  describe('executeSetPolicy', () => {
    it('should set a basic policy', async () => {
      const result = await executeSetPolicy(
        {
          agentId: 'agent-123',
          policy: {
            enabled: true,
          },
        },
        { policyStore }
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('agentId', 'agent-123');

      const stored = await policyStore.getPolicy('agent-123');
      expect(stored?.enabled).toBe(true);
    });

    it('should set policy with limits', async () => {
      const result = await executeSetPolicy(
        {
          agentId: 'agent-123',
          policy: {
            limits: {
              perTransaction: { value: '100000000', decimals: 6, symbol: 'USDT' },
              daily: { value: '1000000000' },
            },
            enabled: true,
          },
        },
        { policyStore }
      );

      expect(result.success).toBe(true);

      const stored = await policyStore.getPolicy('agent-123');
      expect(stored?.limits?.perTransaction?.value).toBe('100000000');
      expect(stored?.limits?.daily?.value).toBe('1000000000');
    });

    it('should set policy with all rules', async () => {
      const result = await executeSetPolicy(
        {
          agentId: 'agent-123',
          policy: {
            limits: {
              daily: { value: '1000000000' },
            },
            timeRules: {
              allowedWindows: [
                { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 17 },
              ],
            },
            merchantRules: {
              whitelist: ['0xaddr1'],
              requireWhitelist: true,
            },
            networkRules: {
              allowedNetworks: ['eip155:8453'],
            },
            enabled: true,
          },
        },
        { policyStore }
      );

      expect(result.success).toBe(true);

      const stored = await policyStore.getPolicy('agent-123');
      expect(stored?.timeRules?.allowedWindows).toHaveLength(1);
      expect(stored?.merchantRules?.whitelist).toContain('0xaddr1');
      expect(stored?.networkRules?.allowedNetworks).toContain('eip155:8453');
    });

    it('should save policy even in demo mode (for in-memory testing)', async () => {
      const result = await executeSetPolicy(
        {
          agentId: 'agent-123',
          policy: { enabled: true },
        },
        { policyStore, demoMode: true }
      );

      expect(result.success).toBe(true);
      expect((result.data as { demoMode?: boolean }).demoMode).toBe(true);

      // Policy should still be stored (for in-memory testing)
      const stored = await policyStore.getPolicy('agent-123');
      expect(stored).not.toBeNull();
      expect(stored?.enabled).toBe(true);
    });
  });

  describe('executeGetPolicy', () => {
    it('should get existing policy', async () => {
      const policy: AgentPolicy = {
        enabled: true,
        limits: { daily: { value: '1000000000', decimals: 6, symbol: 'USDT' } },
      };
      await policyStore.setPolicy('agent-123', policy);

      const result = await executeGetPolicy(
        { agentId: 'agent-123' },
        { policyStore }
      );

      expect(result.success).toBe(true);
      expect((result.data as { policy: AgentPolicy }).policy.enabled).toBe(true);
    });

    it('should return error for non-existent policy', async () => {
      const result = await executeGetPolicy(
        { agentId: 'non-existent' },
        { policyStore }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('No policy found');
    });
  });

  describe('executeListPolicies', () => {
    it('should list all policies', async () => {
      await policyStore.setPolicy('agent-1', { enabled: true });
      await policyStore.setPolicy('agent-2', { enabled: false });

      const result = await executeListPolicies({}, { policyStore });

      expect(result.success).toBe(true);
      expect((result.data as { count: number }).count).toBe(2);
    });

    it('should filter by orgId', async () => {
      await policyStore.setPolicy('org1:agent-1', { enabled: true });
      await policyStore.setPolicy('org2:agent-2', { enabled: true });

      const result = await executeListPolicies(
        { orgId: 'org1' },
        { policyStore }
      );

      expect(result.success).toBe(true);
      expect((result.data as { count: number }).count).toBe(1);
    });
  });

  describe('executeAuthorizePayment', () => {
    beforeEach(async () => {
      await policyStore.setPolicy('agent-123', {
        enabled: true,
        limits: {
          perTransaction: { value: '100000000', decimals: 6, symbol: 'USDT' },
          daily: { value: '1000000000', decimals: 6, symbol: 'USDT' },
        },
        networkRules: {
          allowedNetworks: ['eip155:8453'],
        },
      });
    });

    it('should authorize valid payment', async () => {
      const result = await executeAuthorizePayment(
        {
          agentId: 'agent-123',
          amount: '50000000',
          decimals: 6,
          symbol: 'USDT',
          recipient: '0xrecipient',
          network: 'eip155:8453',
        },
        { policyEngine, policyStore }
      );

      expect(result.success).toBe(true);
      expect((result.data as { allowed: boolean }).allowed).toBe(true);
    });

    it('should reject payment exceeding limit', async () => {
      const result = await executeAuthorizePayment(
        {
          agentId: 'agent-123',
          amount: '150000000', // 150 > 100 limit
          decimals: 6,
          symbol: 'USDT',
          recipient: '0xrecipient',
          network: 'eip155:8453',
        },
        { policyEngine, policyStore }
      );

      expect(result.success).toBe(true);
      expect((result.data as { allowed: boolean }).allowed).toBe(false);
    });

    it('should reject payment on blocked network', async () => {
      const result = await executeAuthorizePayment(
        {
          agentId: 'agent-123',
          amount: '50000000',
          decimals: 6,
          symbol: 'USDT',
          recipient: '0xrecipient',
          network: 'eip155:1', // Not allowed
        },
        { policyEngine, policyStore }
      );

      expect(result.success).toBe(true);
      expect((result.data as { allowed: boolean }).allowed).toBe(false);
    });

    it('should return error for non-existent agent', async () => {
      const result = await executeAuthorizePayment(
        {
          agentId: 'non-existent',
          amount: '50000000',
          decimals: 6,
          symbol: 'USDT',
          recipient: '0xrecipient',
          network: 'eip155:8453',
        },
        { policyEngine, policyStore }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('No policy found');
    });

    it('should return error for disabled agent', async () => {
      await policyStore.setPolicy('disabled-agent', { enabled: false });

      const result = await executeAuthorizePayment(
        {
          agentId: 'disabled-agent',
          amount: '50000000',
          decimals: 6,
          symbol: 'USDT',
          recipient: '0xrecipient',
          network: 'eip155:8453',
        },
        { policyEngine, policyStore }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('disabled');
    });
  });

  describe('executeGetRemainingBudget', () => {
    beforeEach(async () => {
      await policyStore.setPolicy('agent-123', {
        enabled: true,
        limits: {
          daily: { value: '1000000000', decimals: 6, symbol: 'USDT' },
        },
      });
    });

    it('should return budget info', async () => {
      const result = await executeGetRemainingBudget(
        { agentId: 'agent-123', period: 'daily' },
        { spendingLimiter, policyStore }
      );

      expect(result.success).toBe(true);
      const data = result.data as { limit: string; spent: string; remaining: string };
      expect(data.limit).toBe('1000000000');
      expect(data.spent).toBe('0');
      expect(data.remaining).toBe('1000000000');
    });

    it('should return unlimited for undefined period', async () => {
      const result = await executeGetRemainingBudget(
        { agentId: 'agent-123', period: 'weekly' },
        { spendingLimiter, policyStore }
      );

      expect(result.success).toBe(true);
      const data = result.data as { limit: string; remaining: string };
      expect(data.limit).toBe('unlimited');
      expect(data.remaining).toBe('unlimited');
    });

    it('should return error for non-existent agent', async () => {
      const result = await executeGetRemainingBudget(
        { agentId: 'non-existent', period: 'daily' },
        { spendingLimiter, policyStore }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('No policy found');
    });
  });

  describe('executeConfirmPayment', () => {
    it('should fail for unknown reservation', async () => {
      const result = await executeConfirmPayment(
        { reservationId: 'unknown' },
        { spendingLimiter }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should work in demo mode', async () => {
      const result = await executeConfirmPayment(
        { reservationId: 'any-id' },
        { spendingLimiter, demoMode: true }
      );

      expect(result.success).toBe(true);
      expect((result.data as { demoMode?: boolean }).demoMode).toBe(true);
    });
  });

  describe('executeReleasePayment', () => {
    it('should fail for unknown reservation', async () => {
      const result = await executeReleasePayment(
        { reservationId: 'unknown' },
        { spendingLimiter }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should work in demo mode', async () => {
      const result = await executeReleasePayment(
        { reservationId: 'any-id' },
        { spendingLimiter, demoMode: true }
      );

      expect(result.success).toBe(true);
      expect((result.data as { demoMode?: boolean }).demoMode).toBe(true);
    });
  });

  describe('Format Functions', () => {
    it('formatAuthorizePaymentResult - success', () => {
      const result = formatAuthorizePaymentResult({
        success: true,
        data: { allowed: true, reservationId: 'res-123' },
      });

      expect(result).toContain('Authorized');
      expect(result).toContain('res-123');
    });

    it('formatAuthorizePaymentResult - denied', () => {
      const result = formatAuthorizePaymentResult({
        success: true,
        data: { allowed: false, reason: 'Exceeds limit' },
      });

      expect(result).toContain('Denied');
      expect(result).toContain('Exceeds limit');
    });

    it('formatAuthorizePaymentResult - error', () => {
      const result = formatAuthorizePaymentResult({
        success: false,
        error: 'Agent not found',
      });

      expect(result).toContain('Failed');
      expect(result).toContain('Agent not found');
    });

    it('formatGetRemainingBudgetResult - with limit', () => {
      const result = formatGetRemainingBudgetResult({
        success: true,
        data: {
          agentId: 'agent-123',
          period: 'daily',
          limit: '1000000000',
          spent: '300000000',
          remaining: '700000000',
        },
      });

      expect(result).toContain('Budget Status');
      expect(result).toContain('agent-123');
      expect(result).toContain('daily');
      expect(result).toContain('300'); // Spent
      expect(result).toContain('700'); // Remaining
    });

    it('formatGetRemainingBudgetResult - unlimited', () => {
      const result = formatGetRemainingBudgetResult({
        success: true,
        data: {
          agentId: 'agent-123',
          period: 'weekly',
          limit: 'unlimited',
          spent: '0',
          remaining: 'unlimited',
        },
      });

      expect(result).toContain('Unlimited');
    });

    it('formatGetPolicyResult - full policy', () => {
      const result = formatGetPolicyResult({
        success: true,
        data: {
          agentId: 'agent-123',
          policy: {
            enabled: true,
            limits: {
              daily: { value: '1000000000', decimals: 6, symbol: 'USDT' },
            },
            timeRules: {
              allowedWindows: [
                { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 17 },
              ],
              timezone: 'UTC',
            },
            merchantRules: {
              whitelist: ['0xaddr1', '0xaddr2'],
              requireWhitelist: true,
            },
            networkRules: {
              allowedNetworks: ['eip155:8453'],
            },
          },
        },
      });

      expect(result).toContain('Agent Policy');
      expect(result).toContain('Enabled');
      expect(result).toContain('Spending Limits');
      expect(result).toContain('Time Rules');
      expect(result).toContain('Merchant Rules');
      expect(result).toContain('Network Rules');
    });

    it('formatSetPolicyResult - success', () => {
      const result = formatSetPolicyResult({
        success: true,
        data: {
          agentId: 'agent-123',
          policy: { enabled: true },
          message: 'Policy updated successfully',
        },
      });

      expect(result).toContain('Policy Updated');
      expect(result).toContain('agent-123');
    });

    it('formatListPoliciesResult - with policies', () => {
      const result = formatListPoliciesResult({
        success: true,
        data: {
          count: 2,
          policies: [
            { agentId: 'agent-1', policy: { enabled: true } },
            { agentId: 'agent-2', policy: { enabled: false } },
          ],
        },
      });

      expect(result).toContain('Agent Policies');
      expect(result).toContain('2 agent');
      expect(result).toContain('agent-1');
      expect(result).toContain('agent-2');
    });

    it('formatConfirmPaymentResult - success', () => {
      const result = formatConfirmPaymentResult({
        success: true,
        data: {
          reservationId: 'res-123',
          status: 'confirmed',
        },
      });

      expect(result).toContain('Payment Confirmed');
      expect(result).toContain('res-123');
    });

    it('formatReleasePaymentResult - success', () => {
      const result = formatReleasePaymentResult({
        success: true,
        data: {
          reservationId: 'res-123',
          status: 'released',
        },
      });

      expect(result).toContain('Payment Released');
      expect(result).toContain('res-123');
    });
  });
});
