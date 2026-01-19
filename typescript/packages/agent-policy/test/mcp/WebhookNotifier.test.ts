import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebhookNotifier } from '../../src/mcp/WebhookNotifier.js';
import { ApprovalManager, InMemoryApprovalStore } from '../../src/mcp/ApprovalManager.js';
import type { PaymentRequest, ApprovalConfig, PendingApproval } from '../../src/types.js';
import type { WebhookPayload, WebhookEndpoint } from '../../src/mcp/WebhookNotifier.js';

describe('WebhookNotifier', () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let notifier: WebhookNotifier;
  let receivedPayloads: WebhookPayload[];

  const createEndpoint = (overrides: Partial<WebhookEndpoint> = {}): WebhookEndpoint => ({
    url: 'https://example.com/webhook',
    ...overrides,
  });

  beforeEach(() => {
    receivedPayloads = [];
    mockFetch = vi.fn().mockImplementation(async (url: string, options: RequestInit) => {
      const payload = JSON.parse(options.body as string) as WebhookPayload;
      receivedPayloads.push(payload);
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });
  });

  const createApproval = (): PendingApproval => ({
    id: 'approval-123',
    agentId: 'agent-123',
    request: {
      amount: { value: '100000000', decimals: 6, symbol: 'USDT' },
      recipient: '0x1234567890abcdef',
      network: 'eip155:8453',
      category: 'api_usage',
      memo: 'Test payment',
    },
    status: 'pending',
    requiredApprovers: 1,
    approvers: ['admin@example.com'],
    currentApprovals: [],
    createdAt: new Date('2026-01-19T10:00:00Z'),
    expiresAt: new Date('2026-01-19T11:00:00Z'),
  });

  describe('notify', () => {
    it('should send webhook with correct payload', async () => {
      notifier = new WebhookNotifier({
        endpoints: [createEndpoint()],
        blocking: true,
        fetch: mockFetch,
      });

      const approval = createApproval();
      await notifier.notifyCreated(approval);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(receivedPayloads).toHaveLength(1);

      const payload = receivedPayloads[0];
      expect(payload.event).toBe('approval.created');
      expect(payload.approval.id).toBe('approval-123');
      expect(payload.approval.agentId).toBe('agent-123');
      expect(payload.approval.amount).toBe('100 USDT');
      expect(payload.approval.recipient).toBe('0x1234567890abcdef');
      expect(payload.approval.network).toBe('eip155:8453');
    });

    it('should include correct headers', async () => {
      notifier = new WebhookNotifier({
        endpoints: [createEndpoint()],
        blocking: true,
        fetch: mockFetch,
      });

      await notifier.notifyCreated(createApproval());

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = options.headers as Record<string, string>;

      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['X-Webhook-Event']).toBe('approval.created');
      expect(headers['X-Webhook-Timestamp']).toBeDefined();
    });

    it('should add HMAC signature when secret is provided', async () => {
      notifier = new WebhookNotifier({
        endpoints: [createEndpoint({ secret: 'my-secret' })],
        blocking: true,
        fetch: mockFetch,
      });

      await notifier.notifyCreated(createApproval());

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = options.headers as Record<string, string>;

      expect(headers['X-Webhook-Signature']).toMatch(/^sha256=[a-f0-9]{64}$/);
    });

    it('should include custom headers', async () => {
      notifier = new WebhookNotifier({
        endpoints: [
          createEndpoint({
            headers: {
              'X-Custom-Header': 'custom-value',
              Authorization: 'Bearer token123',
            },
          }),
        ],
        blocking: true,
        fetch: mockFetch,
      });

      await notifier.notifyCreated(createApproval());

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = options.headers as Record<string, string>;

      expect(headers['X-Custom-Header']).toBe('custom-value');
      expect(headers['Authorization']).toBe('Bearer token123');
    });

    it('should filter endpoints by event subscription', async () => {
      notifier = new WebhookNotifier({
        endpoints: [
          createEndpoint({ url: 'https://all-events.com/webhook' }),
          createEndpoint({
            url: 'https://approved-only.com/webhook',
            events: ['approval.approved'],
          }),
          createEndpoint({
            url: 'https://created-only.com/webhook',
            events: ['approval.created'],
          }),
        ],
        blocking: true,
        fetch: mockFetch,
      });

      await notifier.notifyCreated(createApproval());

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const urls = mockFetch.mock.calls.map(([url]: [string]) => url);
      expect(urls).toContain('https://all-events.com/webhook');
      expect(urls).toContain('https://created-only.com/webhook');
      expect(urls).not.toContain('https://approved-only.com/webhook');
    });

    it('should send to multiple endpoints', async () => {
      notifier = new WebhookNotifier({
        endpoints: [
          createEndpoint({ url: 'https://endpoint1.com/webhook' }),
          createEndpoint({ url: 'https://endpoint2.com/webhook' }),
          createEndpoint({ url: 'https://endpoint3.com/webhook' }),
        ],
        blocking: true,
        fetch: mockFetch,
      });

      await notifier.notifyCreated(createApproval());

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should retry on failure', async () => {
      let attempts = 0;
      mockFetch = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          return new Response('Error', { status: 500 });
        }
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      });

      notifier = new WebhookNotifier({
        endpoints: [createEndpoint({ retries: 3 })],
        blocking: true,
        fetch: mockFetch,
      });

      const results = await notifier.notifyCreated(createApproval());

      expect(attempts).toBe(3);
      expect(results[0].success).toBe(true);
    });

    it('should return failure after max retries', async () => {
      mockFetch = vi.fn().mockImplementation(async () => {
        return new Response('Error', { status: 500, statusText: 'Internal Server Error' });
      });

      notifier = new WebhookNotifier({
        endpoints: [createEndpoint({ retries: 2 })],
        blocking: true,
        fetch: mockFetch,
      });

      const results = await notifier.notifyCreated(createApproval());

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('500');
    });

    it('should return empty array in non-blocking mode', async () => {
      notifier = new WebhookNotifier({
        endpoints: [createEndpoint()],
        blocking: false,
        fetch: mockFetch,
      });

      const results = await notifier.notifyCreated(createApproval());

      expect(results).toHaveLength(0);
      // Wait for async completion
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('notifyDecisionSubmitted', () => {
    it('should send approval.approved event when approved', async () => {
      notifier = new WebhookNotifier({
        endpoints: [createEndpoint()],
        blocking: true,
        fetch: mockFetch,
      });

      const approval = createApproval();
      approval.status = 'approved';

      await notifier.notifyDecisionSubmitted(
        approval,
        {
          approver: 'admin@example.com',
          timestamp: new Date(),
          decision: 'approve',
          comment: 'Looks good',
        },
        {
          approved: true,
          approvalId: approval.id,
          status: 'approved',
        }
      );

      expect(receivedPayloads[0].event).toBe('approval.approved');
      expect(receivedPayloads[0].decision?.approver).toBe('admin@example.com');
      expect(receivedPayloads[0].decision?.decision).toBe('approve');
      expect(receivedPayloads[0].result?.approved).toBe(true);
    });

    it('should send approval.denied event when denied', async () => {
      notifier = new WebhookNotifier({
        endpoints: [createEndpoint()],
        blocking: true,
        fetch: mockFetch,
      });

      const approval = createApproval();
      approval.status = 'denied';

      await notifier.notifyDecisionSubmitted(
        approval,
        {
          approver: 'admin@example.com',
          timestamp: new Date(),
          decision: 'deny',
          comment: 'Not approved',
        },
        {
          approved: false,
          approvalId: approval.id,
          status: 'denied',
          reason: 'Not approved',
        }
      );

      expect(receivedPayloads[0].event).toBe('approval.denied');
      expect(receivedPayloads[0].result?.approved).toBe(false);
      expect(receivedPayloads[0].result?.reason).toBe('Not approved');
    });

    it('should send decision_submitted event when still pending', async () => {
      notifier = new WebhookNotifier({
        endpoints: [createEndpoint()],
        blocking: true,
        fetch: mockFetch,
      });

      const approval = createApproval();
      approval.requiredApprovers = 2;

      await notifier.notifyDecisionSubmitted(
        approval,
        {
          approver: 'admin@example.com',
          timestamp: new Date(),
          decision: 'approve',
        },
        {
          approved: false,
          approvalId: approval.id,
          status: 'pending',
          reason: 'Waiting for 1 more approval(s)',
        }
      );

      expect(receivedPayloads[0].event).toBe('approval.decision_submitted');
    });
  });

  describe('notifyExpired', () => {
    it('should send approval.expired event', async () => {
      notifier = new WebhookNotifier({
        endpoints: [createEndpoint()],
        blocking: true,
        fetch: mockFetch,
      });

      const approval = createApproval();
      approval.status = 'expired';

      await notifier.notifyExpired(approval);

      expect(receivedPayloads[0].event).toBe('approval.expired');
    });
  });

  describe('notifyCancelled', () => {
    it('should send approval.cancelled event', async () => {
      notifier = new WebhookNotifier({
        endpoints: [createEndpoint()],
        blocking: true,
        fetch: mockFetch,
      });

      const approval = createApproval();
      approval.status = 'denied';

      await notifier.notifyCancelled(approval);

      expect(receivedPayloads[0].event).toBe('approval.cancelled');
    });
  });
});

describe('ApprovalManager with Webhooks', () => {
  let manager: ApprovalManager;
  let store: InMemoryApprovalStore;
  let mockFetch: ReturnType<typeof vi.fn>;
  let receivedPayloads: WebhookPayload[];

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
        amount: { value: '50000000', decimals: 6, symbol: 'USDT' },
        requiredApprovers: 1,
        approvers: ['admin@example.com'],
      },
    ],
    timeout: 3600000,
  });

  beforeEach(() => {
    receivedPayloads = [];
    mockFetch = vi.fn().mockImplementation(async (url: string, options: RequestInit) => {
      const payload = JSON.parse(options.body as string) as WebhookPayload;
      receivedPayloads.push(payload);
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });

    store = new InMemoryApprovalStore();
    const webhooks = new WebhookNotifier({
      endpoints: [{ url: 'https://example.com/webhook' }],
      blocking: true,
      fetch: mockFetch,
    });

    manager = new ApprovalManager({ store, webhooks });
  });

  it('should trigger webhook on approval created', async () => {
    const request = createRequest('100000000');
    const config = createConfig();

    await manager.createApproval(request, config);

    expect(receivedPayloads).toHaveLength(1);
    expect(receivedPayloads[0].event).toBe('approval.created');
    expect(receivedPayloads[0].approval.agentId).toBe('test-agent');
  });

  it('should trigger webhook on approval approved', async () => {
    const request = createRequest('100000000');
    const config = createConfig();

    const approval = await manager.createApproval(request, config);
    receivedPayloads = []; // Clear creation webhook

    await manager.submitDecision(approval.id, {
      approver: 'admin@example.com',
      timestamp: new Date(),
      decision: 'approve',
    });

    expect(receivedPayloads).toHaveLength(1);
    expect(receivedPayloads[0].event).toBe('approval.approved');
    expect(receivedPayloads[0].result?.approved).toBe(true);
  });

  it('should trigger webhook on approval denied', async () => {
    const request = createRequest('100000000');
    const config = createConfig();

    const approval = await manager.createApproval(request, config);
    receivedPayloads = [];

    await manager.submitDecision(approval.id, {
      approver: 'admin@example.com',
      timestamp: new Date(),
      decision: 'deny',
      comment: 'Not needed',
    });

    expect(receivedPayloads).toHaveLength(1);
    expect(receivedPayloads[0].event).toBe('approval.denied');
    expect(receivedPayloads[0].decision?.comment).toBe('Not needed');
  });

  it('should trigger webhook on approval cancelled', async () => {
    const request = createRequest('100000000');
    const config = createConfig();

    const approval = await manager.createApproval(request, config);
    receivedPayloads = [];

    await manager.cancelApproval(approval.id);

    expect(receivedPayloads).toHaveLength(1);
    expect(receivedPayloads[0].event).toBe('approval.cancelled');
  });

  it('should trigger webhook on approval expired', async () => {
    const request = createRequest('100000000');
    const config: ApprovalConfig = {
      thresholds: [
        {
          amount: { value: '50000000', decimals: 6 },
          requiredApprovers: 1,
          approvers: ['admin@example.com'],
        },
      ],
      timeout: 1, // 1ms
    };

    const approval = await manager.createApproval(request, config);
    receivedPayloads = [];

    // Wait for expiration
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Trigger expiration check
    await manager.getApproval(approval.id);

    expect(receivedPayloads).toHaveLength(1);
    expect(receivedPayloads[0].event).toBe('approval.expired');
  });

  it('should work without webhooks configured', async () => {
    const managerNoWebhooks = new ApprovalManager({ store: new InMemoryApprovalStore() });
    const request = createRequest('100000000');
    const config = createConfig();

    // Should not throw
    const approval = await managerNoWebhooks.createApproval(request, config);
    await managerNoWebhooks.submitDecision(approval.id, {
      approver: 'admin@example.com',
      timestamp: new Date(),
      decision: 'approve',
    });

    expect(approval.id).toBeDefined();
  });
});
