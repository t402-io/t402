import { describe, it, expect, beforeEach } from 'vitest';
import { SimplePolicyEngine } from '../../src/mcp/SimplePolicyEngine.js';
import { ApprovalManager, InMemoryApprovalStore } from '../../src/mcp/ApprovalManager.js';
import { SpendingLimiter } from '../../src/limits/SpendingLimiter.js';
import type { AgentPolicy, PaymentRequest, ApprovalConfig } from '../../src/types.js';
import type { LimitStore } from '../../src/limits/types.js';

class MockLimitStore implements LimitStore {
  private data = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
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

describe('SimplePolicyEngine with ApprovalManager', () => {
  let engine: SimplePolicyEngine;
  let approvalManager: ApprovalManager;
  let approvalStore: InMemoryApprovalStore;
  let limiter: SpendingLimiter;
  let limitStore: MockLimitStore;

  beforeEach(() => {
    limitStore = new MockLimitStore();
    limiter = new SpendingLimiter({ store: limitStore });
    approvalStore = new InMemoryApprovalStore();
    approvalManager = new ApprovalManager({ store: approvalStore });
    engine = new SimplePolicyEngine({
      spendingLimiter: limiter,
      approvalManager,
    });
  });

  const createPolicy = (approvalConfig?: ApprovalConfig): AgentPolicy => ({
    enabled: true,
    limits: {
      daily: { value: '10000000000', decimals: 6 }, // 10,000 USDT
    },
    approvalConfig,
  });

  const createRequest = (amount: string): PaymentRequest => ({
    agentId: 'test-agent',
    amount: { value: amount, decimals: 6, symbol: 'USDT' },
    recipient: '0x1234567890abcdef',
    network: 'eip155:8453',
  });

  it('should approve payment below threshold', async () => {
    const policy = createPolicy({
      thresholds: [
        {
          amount: { value: '100000000', decimals: 6 }, // 100 USDT
          requiredApprovers: 1,
          approvers: ['admin@example.com'],
        },
      ],
      timeout: 3600000,
    });
    const request = createRequest('50000000'); // 50 USDT

    const result = await engine.authorize(request, policy);

    expect(result.allowed).toBe(true);
    expect(result.requiresApproval).toBeUndefined();
    expect(result.reservationId).toBeDefined();
  });

  it('should require approval for payment at threshold', async () => {
    const policy = createPolicy({
      thresholds: [
        {
          amount: { value: '100000000', decimals: 6 }, // 100 USDT
          requiredApprovers: 1,
          approvers: ['admin@example.com'],
        },
      ],
      timeout: 3600000,
    });
    const request = createRequest('100000000'); // 100 USDT

    const result = await engine.authorize(request, policy);

    expect(result.allowed).toBe(false);
    expect(result.requiresApproval).toBe(true);
    expect(result.approvalId).toBeDefined();
    expect(result.reservationId).toBeDefined();
  });

  it('should require approval for payment above threshold', async () => {
    const policy = createPolicy({
      thresholds: [
        {
          amount: { value: '100000000', decimals: 6 }, // 100 USDT
          requiredApprovers: 1,
          approvers: ['admin@example.com'],
        },
      ],
      timeout: 3600000,
    });
    const request = createRequest('500000000'); // 500 USDT

    const result = await engine.authorize(request, policy);

    expect(result.allowed).toBe(false);
    expect(result.requiresApproval).toBe(true);
    expect(result.approvalId).toBeDefined();
  });

  it('should create pending approval that can be approved', async () => {
    const policy = createPolicy({
      thresholds: [
        {
          amount: { value: '100000000', decimals: 6 },
          requiredApprovers: 1,
          approvers: ['admin@example.com'],
        },
      ],
      timeout: 3600000,
    });
    const request = createRequest('200000000'); // 200 USDT

    const authResult = await engine.authorize(request, policy);

    expect(authResult.approvalId).toBeDefined();

    // Now approve the payment
    const approvalResult = await approvalManager.submitDecision(authResult.approvalId!, {
      approver: 'admin@example.com',
      timestamp: new Date(),
      decision: 'approve',
    });

    expect(approvalResult.approved).toBe(true);
    expect(approvalResult.status).toBe('approved');
    expect(approvalResult.reservationId).toBeDefined();
  });

  it('should use highest applicable threshold', async () => {
    const policy = createPolicy({
      thresholds: [
        {
          amount: { value: '100000000', decimals: 6 }, // 100 USDT - 1 approver
          requiredApprovers: 1,
          approvers: ['admin@example.com'],
        },
        {
          amount: { value: '1000000000', decimals: 6 }, // 1000 USDT - 2 approvers
          requiredApprovers: 2,
          approvers: ['admin@example.com', 'cfo@example.com'],
        },
      ],
      timeout: 3600000,
    });

    // 500 USDT - should use first threshold (1 approver)
    const request1 = createRequest('500000000');
    const result1 = await engine.authorize(request1, policy);
    expect(result1.requiresApproval).toBe(true);

    // Verify 1 approver is enough
    const approval1 = await approvalManager.getApproval(result1.approvalId!);
    expect(approval1?.requiredApprovers).toBe(1);

    // 2000 USDT - should use second threshold (2 approvers)
    const request2 = createRequest('2000000000');
    const result2 = await engine.authorize(request2, policy);
    expect(result2.requiresApproval).toBe(true);

    const approval2 = await approvalManager.getApproval(result2.approvalId!);
    expect(approval2?.requiredApprovers).toBe(2);
  });

  it('should work without limits but with approval config', async () => {
    const policy: AgentPolicy = {
      enabled: true,
      approvalConfig: {
        thresholds: [
          {
            amount: { value: '100000000', decimals: 6 },
            requiredApprovers: 1,
            approvers: ['admin@example.com'],
          },
        ],
        timeout: 3600000,
      },
    };
    const request = createRequest('200000000'); // 200 USDT

    const result = await engine.authorize(request, policy);

    expect(result.allowed).toBe(false);
    expect(result.requiresApproval).toBe(true);
    expect(result.approvalId).toBeDefined();
    // No reservation ID since no limits
    expect(result.reservationId).toBeUndefined();
  });

  it('should include approval threshold in evaluations', async () => {
    const policy = createPolicy({
      thresholds: [
        {
          amount: { value: '100000000', decimals: 6 },
          requiredApprovers: 1,
          approvers: ['admin@example.com'],
        },
      ],
      timeout: 3600000,
    });
    const request = createRequest('200000000');

    const result = await engine.authorize(request, policy);

    const approvalEval = result.evaluations?.find((e) => e.rule === 'approval_threshold');
    expect(approvalEval).toBeDefined();
    expect(approvalEval?.passed).toBe(false);
    expect(approvalEval?.reason).toContain('approver');
  });

  it('should still work with legacy requireApproval flag', async () => {
    const policy: AgentPolicy = {
      enabled: true,
      requireApproval: true,
    };
    const request = createRequest('50000000'); // 50 USDT

    const result = await engine.authorize(request, policy);

    expect(result.allowed).toBe(false);
    expect(result.requiresApproval).toBe(true);
    // No approvalId for legacy flag
    expect(result.approvalId).toBeUndefined();
  });
});
