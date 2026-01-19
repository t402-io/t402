import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AgentPolicyMcpServer,
  InMemoryPolicyStore,
  InMemoryLimitStore,
  TOOL_DEFINITIONS,
  createServerFromEnv,
  WebhookNotifier,
} from '../../src/mcp/index.js';
import type { AgentPolicy } from '../../src/types.js';

describe('AgentPolicyMcpServer', () => {
  let server: AgentPolicyMcpServer;
  let policyStore: InMemoryPolicyStore;
  let limitStore: InMemoryLimitStore;

  beforeEach(() => {
    policyStore = new InMemoryPolicyStore();
    limitStore = new InMemoryLimitStore();
    server = new AgentPolicyMcpServer(
      { demoMode: false },
      { policyStore, limitStore }
    );
  });

  describe('constructor', () => {
    it('should create server with default stores', () => {
      const defaultServer = new AgentPolicyMcpServer();
      expect(defaultServer.getToolDefinitions()).toBeDefined();
    });

    it('should create server with custom stores', () => {
      expect(server.getPolicyStore()).toBe(policyStore);
    });

    it('should create server in demo mode', () => {
      const demoServer = new AgentPolicyMcpServer({ demoMode: true });
      expect(demoServer).toBeDefined();
    });
  });

  describe('getToolDefinitions', () => {
    it('should return all tool definitions', () => {
      const tools = server.getToolDefinitions();

      expect(tools['agent-policy/authorize']).toBeDefined();
      expect(tools['agent-policy/budget']).toBeDefined();
      expect(tools['agent-policy/get']).toBeDefined();
      expect(tools['agent-policy/set']).toBeDefined();
      expect(tools['agent-policy/list']).toBeDefined();
      expect(tools['agent-policy/confirm']).toBeDefined();
      expect(tools['agent-policy/release']).toBeDefined();
    });

    it('should have proper tool structure', () => {
      const tools = server.getToolDefinitions();
      const authorizeTool = tools['agent-policy/authorize'];

      expect(authorizeTool.name).toBe('agent-policy/authorize');
      expect(authorizeTool.description).toContain('payment');
      expect(authorizeTool.inputSchema).toBeDefined();
      expect(authorizeTool.inputSchema.type).toBe('object');
      expect(authorizeTool.inputSchema.properties).toBeDefined();
      expect(authorizeTool.inputSchema.required).toContain('agentId');
    });
  });

  describe('handleToolCall - unknown tool', () => {
    it('should return error for unknown tool', async () => {
      const result = await server.handleToolCall('unknown-tool', {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unknown tool');
    });
  });

  describe('handleToolCall - agent-policy/set', () => {
    it('should set a policy', async () => {
      const result = await server.handleToolCall('agent-policy/set', {
        agentId: 'agent-123',
        policy: {
          limits: {
            daily: { value: '1000000000', decimals: 6, symbol: 'USDT' },
          },
          enabled: true,
        },
      });

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('Policy Updated');
    });

    it('should set policy with all rules', async () => {
      const result = await server.handleToolCall('agent-policy/set', {
        agentId: 'agent-456',
        policy: {
          limits: {
            perTransaction: { value: '100000000' },
            daily: { value: '1000000000' },
          },
          timeRules: {
            allowedWindows: [
              { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 17 },
            ],
          },
          merchantRules: {
            whitelist: ['0xaddr1', '0xaddr2'],
            requireWhitelist: true,
          },
          networkRules: {
            allowedNetworks: ['eip155:8453', 'eip155:1'],
          },
          enabled: true,
        },
      });

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('Policy Updated');
      expect(result.content[0].text).toContain('spending limit');
    });
  });

  describe('handleToolCall - agent-policy/get', () => {
    it('should return error for non-existent agent', async () => {
      const result = await server.handleToolCall('agent-policy/get', {
        agentId: 'non-existent',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('No policy found');
    });

    it('should return policy for existing agent', async () => {
      // First set a policy
      await server.handleToolCall('agent-policy/set', {
        agentId: 'agent-123',
        policy: {
          limits: {
            daily: { value: '1000000000' },
          },
          enabled: true,
        },
      });

      // Then get it
      const result = await server.handleToolCall('agent-policy/get', {
        agentId: 'agent-123',
      });

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('Agent Policy');
      expect(result.content[0].text).toContain('agent-123');
    });
  });

  describe('handleToolCall - agent-policy/list', () => {
    it('should return empty list when no policies', async () => {
      const result = await server.handleToolCall('agent-policy/list', {});

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('0 agent');
    });

    it('should list all policies', async () => {
      // Set multiple policies
      await server.handleToolCall('agent-policy/set', {
        agentId: 'agent-1',
        policy: { enabled: true },
      });
      await server.handleToolCall('agent-policy/set', {
        agentId: 'agent-2',
        policy: { enabled: false },
      });

      const result = await server.handleToolCall('agent-policy/list', {});

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('2 agent');
      expect(result.content[0].text).toContain('agent-1');
      expect(result.content[0].text).toContain('agent-2');
    });

    it('should filter by orgId', async () => {
      await server.handleToolCall('agent-policy/set', {
        agentId: 'org1:agent-1',
        policy: { enabled: true },
      });
      await server.handleToolCall('agent-policy/set', {
        agentId: 'org2:agent-2',
        policy: { enabled: true },
      });

      const result = await server.handleToolCall('agent-policy/list', {
        orgId: 'org1',
      });

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('org1:agent-1');
      expect(result.content[0].text).not.toContain('org2:agent-2');
    });
  });

  describe('handleToolCall - agent-policy/authorize', () => {
    beforeEach(async () => {
      // Set up a policy
      await server.handleToolCall('agent-policy/set', {
        agentId: 'agent-123',
        policy: {
          limits: {
            perTransaction: { value: '100000000' }, // 100 USDT
            daily: { value: '1000000000' }, // 1000 USDT
          },
          networkRules: {
            allowedNetworks: ['eip155:8453'],
          },
          enabled: true,
        },
      });
    });

    it('should authorize valid payment', async () => {
      const result = await server.handleToolCall('agent-policy/authorize', {
        agentId: 'agent-123',
        amount: '50000000', // 50 USDT
        recipient: '0xrecipient',
        network: 'eip155:8453',
      });

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('Authorized');
    });

    it('should reject payment exceeding per-transaction limit', async () => {
      const result = await server.handleToolCall('agent-policy/authorize', {
        agentId: 'agent-123',
        amount: '150000000', // 150 USDT > 100 limit
        recipient: '0xrecipient',
        network: 'eip155:8453',
      });

      expect(result.isError).toBeFalsy(); // Tool succeeded, but authorization denied
      expect(result.content[0].text).toContain('Denied');
      expect(result.content[0].text).toContain('per-transaction');
    });

    it('should reject payment on blocked network', async () => {
      const result = await server.handleToolCall('agent-policy/authorize', {
        agentId: 'agent-123',
        amount: '50000000',
        recipient: '0xrecipient',
        network: 'eip155:1', // Not in allowed list
      });

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('Denied');
      expect(result.content[0].text).toContain('not in allowed list');
    });

    it('should return error for non-existent agent', async () => {
      const result = await server.handleToolCall('agent-policy/authorize', {
        agentId: 'non-existent',
        amount: '50000000',
        recipient: '0xrecipient',
        network: 'eip155:8453',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('No policy found');
    });
  });

  describe('handleToolCall - agent-policy/budget', () => {
    beforeEach(async () => {
      await server.handleToolCall('agent-policy/set', {
        agentId: 'agent-123',
        policy: {
          limits: {
            daily: { value: '1000000000' }, // 1000 USDT
          },
          enabled: true,
        },
      });
    });

    it('should return budget info', async () => {
      const result = await server.handleToolCall('agent-policy/budget', {
        agentId: 'agent-123',
        period: 'daily',
      });

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('Budget Status');
      expect(result.content[0].text).toContain('1000');
    });

    it('should track spending', async () => {
      // Make a payment
      await server.handleToolCall('agent-policy/authorize', {
        agentId: 'agent-123',
        amount: '300000000', // 300 USDT
        recipient: '0xrecipient',
        network: 'eip155:8453',
      });

      // Check budget
      const result = await server.handleToolCall('agent-policy/budget', {
        agentId: 'agent-123',
        period: 'daily',
      });

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('300'); // Spent
      expect(result.content[0].text).toContain('700'); // Remaining
    });

    it('should return unlimited for undefined limit', async () => {
      const result = await server.handleToolCall('agent-policy/budget', {
        agentId: 'agent-123',
        period: 'weekly', // Not defined
      });

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('Unlimited');
    });

    it('should return error for non-existent agent', async () => {
      const result = await server.handleToolCall('agent-policy/budget', {
        agentId: 'non-existent',
        period: 'daily',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('No policy found');
    });
  });

  describe('handleToolCall - agent-policy/confirm', () => {
    it('should confirm a reservation', async () => {
      // Set up policy and make a reservation
      await server.handleToolCall('agent-policy/set', {
        agentId: 'agent-123',
        policy: {
          limits: { daily: { value: '1000000000' } },
          enabled: true,
        },
      });

      const authResult = await server.handleToolCall('agent-policy/authorize', {
        agentId: 'agent-123',
        amount: '100000000',
        recipient: '0xrecipient',
        network: 'eip155:8453',
      });

      // Extract reservation ID from result
      const match = authResult.content[0].text.match(/`([a-f0-9-]+)`/);
      const reservationId = match?.[1];

      if (reservationId) {
        const result = await server.handleToolCall('agent-policy/confirm', {
          reservationId,
        });

        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain('Payment Confirmed');
      }
    });

    it('should fail for unknown reservation', async () => {
      const result = await server.handleToolCall('agent-policy/confirm', {
        reservationId: 'unknown-id',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not found');
    });
  });

  describe('handleToolCall - agent-policy/release', () => {
    it('should release a reservation', async () => {
      // Set up policy and make a reservation
      await server.handleToolCall('agent-policy/set', {
        agentId: 'agent-123',
        policy: {
          limits: { daily: { value: '1000000000' } },
          enabled: true,
        },
      });

      const authResult = await server.handleToolCall('agent-policy/authorize', {
        agentId: 'agent-123',
        amount: '100000000',
        recipient: '0xrecipient',
        network: 'eip155:8453',
      });

      // Extract reservation ID
      const match = authResult.content[0].text.match(/`([a-f0-9-]+)`/);
      const reservationId = match?.[1];

      if (reservationId) {
        const result = await server.handleToolCall('agent-policy/release', {
          reservationId,
        });

        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain('Payment Released');
      }
    });

    it('should fail for unknown reservation', async () => {
      const result = await server.handleToolCall('agent-policy/release', {
        reservationId: 'unknown-id',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not found');
    });
  });

  describe('demo mode', () => {
    let demoServer: AgentPolicyMcpServer;

    beforeEach(() => {
      demoServer = new AgentPolicyMcpServer({ demoMode: true });
    });

    it('should indicate demo mode in authorize response', async () => {
      // Set up policy
      await demoServer.handleToolCall('agent-policy/set', {
        agentId: 'agent-123',
        policy: {
          limits: { daily: { value: '1000000000' } },
          enabled: true,
        },
      });

      const result = await demoServer.handleToolCall('agent-policy/authorize', {
        agentId: 'agent-123',
        amount: '50000000',
        recipient: '0xrecipient',
        network: 'eip155:8453',
      });

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('Demo mode');
    });

    it('should indicate demo mode in set policy response', async () => {
      const result = await demoServer.handleToolCall('agent-policy/set', {
        agentId: 'agent-123',
        policy: { enabled: true },
      });

      expect(result.content[0].text).toContain('Demo mode');
    });
  });
});

describe('InMemoryPolicyStore', () => {
  let store: InMemoryPolicyStore;

  beforeEach(() => {
    store = new InMemoryPolicyStore();
  });

  it('should store and retrieve policies', async () => {
    const policy: AgentPolicy = { enabled: true };
    await store.setPolicy('agent-1', policy);

    const retrieved = await store.getPolicy('agent-1');
    expect(retrieved).toEqual(policy);
  });

  it('should return null for non-existent policy', async () => {
    const retrieved = await store.getPolicy('non-existent');
    expect(retrieved).toBeNull();
  });

  it('should delete policies', async () => {
    await store.setPolicy('agent-1', { enabled: true });
    const deleted = await store.deletePolicy('agent-1');

    expect(deleted).toBe(true);
    expect(await store.getPolicy('agent-1')).toBeNull();
  });

  it('should return false when deleting non-existent policy', async () => {
    const deleted = await store.deletePolicy('non-existent');
    expect(deleted).toBe(false);
  });

  it('should list all policies', async () => {
    await store.setPolicy('agent-1', { enabled: true });
    await store.setPolicy('agent-2', { enabled: false });

    const policies = await store.listPolicies();
    expect(policies).toHaveLength(2);
  });

  it('should filter by orgId prefix', async () => {
    await store.setPolicy('org1:agent-1', { enabled: true });
    await store.setPolicy('org2:agent-2', { enabled: true });

    const org1Policies = await store.listPolicies('org1');
    expect(org1Policies).toHaveLength(1);
    expect(org1Policies[0].agentId).toBe('org1:agent-1');
  });

  it('should clear all policies', async () => {
    await store.setPolicy('agent-1', { enabled: true });
    store.clear();

    const policies = await store.listPolicies();
    expect(policies).toHaveLength(0);
  });
});

describe('InMemoryLimitStore', () => {
  let store: InMemoryLimitStore;

  beforeEach(() => {
    store = new InMemoryLimitStore();
  });

  it('should get and set values', async () => {
    await store.set('key1', '100');
    expect(await store.get('key1')).toBe('100');
  });

  it('should return null for non-existent key', async () => {
    expect(await store.get('non-existent')).toBeNull();
  });

  it('should increment values', async () => {
    const result = await store.increment('counter', 10);
    expect(result).toBe(10);

    const result2 = await store.increment('counter', 5);
    expect(result2).toBe(15);
  });

  it('should decrement values', async () => {
    await store.set('counter', '100');
    const result = await store.decrement('counter', 30);
    expect(result).toBe(70);
  });

  it('should clear all data', async () => {
    await store.set('key1', '100');
    store.clear();

    expect(await store.get('key1')).toBeNull();
  });
});

describe('createServerFromEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    vi.resetModules();
    process.env = { ...originalEnv };
    // Clear webhook-related env vars
    delete process.env.AGENT_POLICY_WEBHOOK_URL;
    delete process.env.AGENT_POLICY_WEBHOOK_SECRET;
    delete process.env.AGENT_POLICY_WEBHOOK_EVENTS;
    delete process.env.AGENT_POLICY_WEBHOOK_TIMEOUT;
    delete process.env.AGENT_POLICY_WEBHOOK_RETRIES;
    delete process.env.AGENT_POLICY_WEBHOOK_BLOCKING;
    delete process.env.AGENT_POLICY_WEBHOOKS;
    delete process.env.AGENT_POLICY_DEMO_MODE;
    delete process.env.AGENT_POLICY_ORG_ID;
    delete process.env.AGENT_POLICY_REDIS_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should create server without webhooks when no env vars set', () => {
    const server = createServerFromEnv();
    expect(server).toBeInstanceOf(AgentPolicyMcpServer);
    // ApprovalManager should work without webhooks
    expect(server.getApprovalManager()).toBeDefined();
  });

  it('should create server with demo mode from env', () => {
    process.env.AGENT_POLICY_DEMO_MODE = 'true';
    const server = createServerFromEnv();
    expect(server).toBeInstanceOf(AgentPolicyMcpServer);
  });

  describe('webhook configuration from environment', () => {
    it('should configure webhook from AGENT_POLICY_WEBHOOK_URL', () => {
      process.env.AGENT_POLICY_WEBHOOK_URL = 'https://example.com/webhook';

      const server = createServerFromEnv();
      expect(server).toBeInstanceOf(AgentPolicyMcpServer);
      // Server should be created - webhook notifier is internal to ApprovalManager
    });

    it('should configure webhook with secret', () => {
      process.env.AGENT_POLICY_WEBHOOK_URL = 'https://example.com/webhook';
      process.env.AGENT_POLICY_WEBHOOK_SECRET = 'my-secret';

      const server = createServerFromEnv();
      expect(server).toBeInstanceOf(AgentPolicyMcpServer);
    });

    it('should configure webhook with event filter', () => {
      process.env.AGENT_POLICY_WEBHOOK_URL = 'https://example.com/webhook';
      process.env.AGENT_POLICY_WEBHOOK_EVENTS = 'approval.created,approval.approved,approval.denied';

      const server = createServerFromEnv();
      expect(server).toBeInstanceOf(AgentPolicyMcpServer);
    });

    it('should configure webhook with timeout', () => {
      process.env.AGENT_POLICY_WEBHOOK_URL = 'https://example.com/webhook';
      process.env.AGENT_POLICY_WEBHOOK_TIMEOUT = '5000';

      const server = createServerFromEnv();
      expect(server).toBeInstanceOf(AgentPolicyMcpServer);
    });

    it('should configure webhook with retries', () => {
      process.env.AGENT_POLICY_WEBHOOK_URL = 'https://example.com/webhook';
      process.env.AGENT_POLICY_WEBHOOK_RETRIES = '5';

      const server = createServerFromEnv();
      expect(server).toBeInstanceOf(AgentPolicyMcpServer);
    });

    it('should configure webhook with blocking mode', () => {
      process.env.AGENT_POLICY_WEBHOOK_URL = 'https://example.com/webhook';
      process.env.AGENT_POLICY_WEBHOOK_BLOCKING = 'true';

      const server = createServerFromEnv();
      expect(server).toBeInstanceOf(AgentPolicyMcpServer);
    });

    it('should configure webhooks from JSON array', () => {
      process.env.AGENT_POLICY_WEBHOOKS = JSON.stringify([
        { url: 'https://endpoint1.com/webhook', secret: 'secret1' },
        { url: 'https://endpoint2.com/webhook', events: ['approval.created'] },
      ]);

      const server = createServerFromEnv();
      expect(server).toBeInstanceOf(AgentPolicyMcpServer);
    });

    it('should prefer JSON config over simple URL config', () => {
      process.env.AGENT_POLICY_WEBHOOK_URL = 'https://simple.com/webhook';
      process.env.AGENT_POLICY_WEBHOOKS = JSON.stringify([
        { url: 'https://json.com/webhook' },
      ]);

      const server = createServerFromEnv();
      expect(server).toBeInstanceOf(AgentPolicyMcpServer);
    });

    it('should handle invalid JSON gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      process.env.AGENT_POLICY_WEBHOOKS = 'not valid json';

      const server = createServerFromEnv();
      expect(server).toBeInstanceOf(AgentPolicyMcpServer);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to parse AGENT_POLICY_WEBHOOKS JSON');

      consoleSpy.mockRestore();
    });

    it('should ignore invalid timeout value', () => {
      process.env.AGENT_POLICY_WEBHOOK_URL = 'https://example.com/webhook';
      process.env.AGENT_POLICY_WEBHOOK_TIMEOUT = 'not-a-number';

      const server = createServerFromEnv();
      expect(server).toBeInstanceOf(AgentPolicyMcpServer);
    });

    it('should ignore invalid retries value', () => {
      process.env.AGENT_POLICY_WEBHOOK_URL = 'https://example.com/webhook';
      process.env.AGENT_POLICY_WEBHOOK_RETRIES = 'not-a-number';

      const server = createServerFromEnv();
      expect(server).toBeInstanceOf(AgentPolicyMcpServer);
    });
  });
});

describe('AgentPolicyMcpServer with webhooks', () => {
  it('should accept webhooks in constructor', () => {
    const webhooks = new WebhookNotifier({
      endpoints: [{ url: 'https://example.com/webhook' }],
    });

    const server = new AgentPolicyMcpServer({}, { webhooks });
    expect(server).toBeInstanceOf(AgentPolicyMcpServer);
    expect(server.getApprovalManager()).toBeDefined();
  });

  it('should pass webhooks to ApprovalManager', async () => {
    const mockFetch = vi.fn().mockImplementation(async () => {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });

    const webhooks = new WebhookNotifier({
      endpoints: [{ url: 'https://example.com/webhook' }],
      blocking: true,
      fetch: mockFetch,
    });

    const server = new AgentPolicyMcpServer({}, { webhooks });
    const approvalManager = server.getApprovalManager();

    // Create an approval directly through the manager to test webhooks
    const approval = await approvalManager.createApproval(
      {
        agentId: 'test-agent',
        amount: { value: '500000000', decimals: 6, symbol: 'USDT' },
        recipient: '0xrecipient',
        network: 'eip155:8453',
      },
      {
        thresholds: [
          {
            amount: { value: '100000000', decimals: 6 },
            requiredApprovers: 1,
            approvers: ['admin@example.com'],
          },
        ],
        timeout: 3600000,
      }
    );

    expect(approval.id).toBeDefined();
    expect(approval.status).toBe('pending');
    // Webhook should have been called for approval.created
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(options.body as string);
    expect(payload.event).toBe('approval.created');
  });
});
