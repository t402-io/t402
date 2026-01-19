import { describe, it, expect, beforeEach } from 'vitest';
import { ApprovalManager, InMemoryApprovalStore } from '../../src/mcp/ApprovalManager.js';
import type { PaymentRequest, ApprovalConfig, ApprovalDecision } from '../../src/types.js';

describe('ApprovalManager', () => {
  let manager: ApprovalManager;
  let store: InMemoryApprovalStore;

  beforeEach(() => {
    store = new InMemoryApprovalStore();
    manager = new ApprovalManager({ store });
  });

  const createRequest = (amount: string = '100000000'): PaymentRequest => ({
    agentId: 'test-agent',
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
    timeout: 3600000, // 1 hour
  });

  describe('requiresApproval', () => {
    it('should not require approval when no config', () => {
      const request = createRequest();
      const result = manager.requiresApproval(request, undefined);
      expect(result.required).toBe(false);
    });

    it('should not require approval when below all thresholds', () => {
      const request = createRequest('10000000'); // 10 USDT
      const config = createConfig();
      const result = manager.requiresApproval(request, config);
      expect(result.required).toBe(false);
    });

    it('should require approval when above first threshold', () => {
      const request = createRequest('100000000'); // 100 USDT
      const config = createConfig();
      const result = manager.requiresApproval(request, config);
      expect(result.required).toBe(true);
      expect(result.threshold?.requiredApprovers).toBe(1);
    });

    it('should require more approvers when above second threshold', () => {
      const request = createRequest('1000000000'); // 1000 USDT
      const config = createConfig();
      const result = manager.requiresApproval(request, config);
      expect(result.required).toBe(true);
      expect(result.threshold?.requiredApprovers).toBe(2);
    });

    it('should use highest applicable threshold', () => {
      const request = createRequest('500000000'); // 500 USDT exactly
      const config = createConfig();
      const result = manager.requiresApproval(request, config);
      expect(result.required).toBe(true);
      expect(result.threshold?.requiredApprovers).toBe(2);
    });
  });

  describe('createApproval', () => {
    it('should create pending approval', async () => {
      const request = createRequest('100000000');
      const config = createConfig();

      const approval = await manager.createApproval(request, config);

      expect(approval.id).toBeDefined();
      expect(approval.agentId).toBe('test-agent');
      expect(approval.status).toBe('pending');
      expect(approval.requiredApprovers).toBe(1);
      expect(approval.currentApprovals).toHaveLength(0);
    });

    it('should throw when payment does not require approval', async () => {
      const request = createRequest('10000000'); // 10 USDT - below threshold
      const config = createConfig();

      await expect(manager.createApproval(request, config)).rejects.toThrow(
        'Payment does not require approval'
      );
    });

    it('should include reservation ID if provided', async () => {
      const request = createRequest('100000000');
      const config = createConfig();

      const approval = await manager.createApproval(request, config, 'res-123');

      expect(approval.reservationId).toBe('res-123');
    });
  });

  describe('submitDecision', () => {
    it('should approve with single approver', async () => {
      const request = createRequest('100000000');
      const config = createConfig();
      const approval = await manager.createApproval(request, config, 'res-123');

      const decision: ApprovalDecision = {
        approver: 'admin@example.com',
        timestamp: new Date(),
        decision: 'approve',
      };

      const result = await manager.submitDecision(approval.id, decision);

      expect(result.approved).toBe(true);
      expect(result.status).toBe('approved');
      expect(result.reservationId).toBe('res-123');
    });

    it('should remain pending until enough approvers', async () => {
      const request = createRequest('1000000000'); // 1000 USDT - needs 2 approvers
      const config = createConfig();
      const approval = await manager.createApproval(request, config);

      const decision1: ApprovalDecision = {
        approver: 'admin@example.com',
        timestamp: new Date(),
        decision: 'approve',
      };

      const result1 = await manager.submitDecision(approval.id, decision1);
      expect(result1.approved).toBe(false);
      expect(result1.status).toBe('pending');
      expect(result1.reason).toContain('1 more approval');

      const decision2: ApprovalDecision = {
        approver: 'manager@example.com',
        timestamp: new Date(),
        decision: 'approve',
      };

      const result2 = await manager.submitDecision(approval.id, decision2);
      expect(result2.approved).toBe(true);
      expect(result2.status).toBe('approved');
    });

    it('should deny immediately on any denial', async () => {
      const request = createRequest('1000000000');
      const config = createConfig();
      const approval = await manager.createApproval(request, config);

      const decision: ApprovalDecision = {
        approver: 'admin@example.com',
        timestamp: new Date(),
        decision: 'deny',
        comment: 'Too expensive',
      };

      const result = await manager.submitDecision(approval.id, decision);

      expect(result.approved).toBe(false);
      expect(result.status).toBe('denied');
      expect(result.reason).toBe('Too expensive');
    });

    it('should reject unauthorized approver', async () => {
      const request = createRequest('100000000');
      const config = createConfig();
      const approval = await manager.createApproval(request, config);

      const decision: ApprovalDecision = {
        approver: 'random@example.com',
        timestamp: new Date(),
        decision: 'approve',
      };

      const result = await manager.submitDecision(approval.id, decision);

      expect(result.approved).toBe(false);
      expect(result.reason).toContain('not authorized');
    });

    it('should reject duplicate decisions from same approver', async () => {
      const request = createRequest('1000000000');
      const config = createConfig();
      const approval = await manager.createApproval(request, config);

      const decision: ApprovalDecision = {
        approver: 'admin@example.com',
        timestamp: new Date(),
        decision: 'approve',
      };

      await manager.submitDecision(approval.id, decision);
      const result = await manager.submitDecision(approval.id, decision);

      expect(result.approved).toBe(false);
      expect(result.reason).toContain('already submitted');
    });

    it('should reject decisions for non-existent approval', async () => {
      const decision: ApprovalDecision = {
        approver: 'admin@example.com',
        timestamp: new Date(),
        decision: 'approve',
      };

      const result = await manager.submitDecision('non-existent', decision);

      expect(result.approved).toBe(false);
      expect(result.reason).toContain('not found');
    });

    it('should handle case-insensitive approver matching', async () => {
      const request = createRequest('100000000');
      const config = createConfig();
      const approval = await manager.createApproval(request, config);

      const decision: ApprovalDecision = {
        approver: 'ADMIN@EXAMPLE.COM',
        timestamp: new Date(),
        decision: 'approve',
      };

      const result = await manager.submitDecision(approval.id, decision);

      expect(result.approved).toBe(true);
    });
  });

  describe('getApproval', () => {
    it('should return approval by ID', async () => {
      const request = createRequest('100000000');
      const config = createConfig();
      const created = await manager.createApproval(request, config);

      const fetched = await manager.getApproval(created.id);

      expect(fetched).toBeDefined();
      expect(fetched?.id).toBe(created.id);
    });

    it('should return null for non-existent approval', async () => {
      const fetched = await manager.getApproval('non-existent');
      expect(fetched).toBeNull();
    });

    it('should auto-expire old approvals', async () => {
      const request = createRequest('100000000');
      const config: ApprovalConfig = {
        thresholds: [
          {
            amount: { value: '50000000', decimals: 6 },
            requiredApprovers: 1,
            approvers: ['admin@example.com'],
          },
        ],
        timeout: 1, // 1ms timeout for testing
      };

      const approval = await manager.createApproval(request, config);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 10));

      const fetched = await manager.getApproval(approval.id);

      expect(fetched?.status).toBe('expired');
    });
  });

  describe('listPendingApprovals', () => {
    it('should list all pending approvals', async () => {
      const config = createConfig();

      await manager.createApproval(createRequest('100000000'), config);
      await manager.createApproval(createRequest('200000000'), config);

      const approvals = await manager.listPendingApprovals();

      expect(approvals).toHaveLength(2);
    });

    it('should filter by agent ID', async () => {
      const config = createConfig();

      await manager.createApproval(
        { ...createRequest('100000000'), agentId: 'agent-1' },
        config
      );
      await manager.createApproval(
        { ...createRequest('200000000'), agentId: 'agent-2' },
        config
      );

      const approvals = await manager.listPendingApprovals('agent-1');

      expect(approvals).toHaveLength(1);
      expect(approvals[0].agentId).toBe('agent-1');
    });

    it('should not include resolved approvals', async () => {
      const config = createConfig();
      const approval = await manager.createApproval(createRequest('100000000'), config);

      await manager.submitDecision(approval.id, {
        approver: 'admin@example.com',
        timestamp: new Date(),
        decision: 'approve',
      });

      const approvals = await manager.listPendingApprovals();

      expect(approvals).toHaveLength(0);
    });
  });

  describe('cancelApproval', () => {
    it('should cancel pending approval', async () => {
      const request = createRequest('100000000');
      const config = createConfig();
      const approval = await manager.createApproval(request, config);

      const result = await manager.cancelApproval(approval.id);

      expect(result).toBe(true);

      const fetched = await manager.getApproval(approval.id);
      expect(fetched?.status).toBe('denied');
    });

    it('should return false for non-existent approval', async () => {
      const result = await manager.cancelApproval('non-existent');
      expect(result).toBe(false);
    });

    it('should return false for already resolved approval', async () => {
      const request = createRequest('100000000');
      const config = createConfig();
      const approval = await manager.createApproval(request, config);

      await manager.submitDecision(approval.id, {
        approver: 'admin@example.com',
        timestamp: new Date(),
        decision: 'approve',
      });

      const result = await manager.cancelApproval(approval.id);
      expect(result).toBe(false);
    });
  });

  describe('formatAmount', () => {
    it('should format whole amounts', () => {
      const result = manager.formatAmount({ value: '100000000', decimals: 6 });
      expect(result).toBe('100 USDT');
    });

    it('should format fractional amounts', () => {
      const result = manager.formatAmount({ value: '100500000', decimals: 6 });
      expect(result).toBe('100.5 USDT');
    });

    it('should use custom symbol', () => {
      const result = manager.formatAmount({ value: '100000000', decimals: 6, symbol: 'USDC' });
      expect(result).toBe('100 USDC');
    });
  });
});
