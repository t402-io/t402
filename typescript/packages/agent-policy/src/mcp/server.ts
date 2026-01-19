/**
 * Agent Policy MCP Server
 *
 * Provides MCP tools for AI agent payment policy management.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type {
  AgentPolicyMcpConfig,
  PolicyStore,
  ToolResult,
} from './types.js';
import {
  TOOL_DEFINITIONS,
  authorizePaymentInputSchema,
  getRemainingBudgetInputSchema,
  getPolicyInputSchema,
  setPolicyInputSchema,
  listPoliciesInputSchema,
  confirmPaymentInputSchema,
  releasePaymentInputSchema,
  listPendingApprovalsInputSchema,
  getApprovalInputSchema,
  submitApprovalDecisionInputSchema,
} from './types.js';
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
  executeListPendingApprovals,
  formatListPendingApprovalsResult,
  executeGetApproval,
  formatGetApprovalResult,
  executeSubmitApprovalDecision,
  formatSubmitApprovalDecisionResult,
} from './tools/index.js';
import { SimplePolicyEngine } from './SimplePolicyEngine.js';
import { SpendingLimiter } from '../limits/SpendingLimiter.js';
import type { LimitStore } from '../limits/types.js';
import type { AgentPolicy } from '../types.js';
import { ApprovalManager, InMemoryApprovalStore } from './ApprovalManager.js';
import type { ApprovalStore } from './ApprovalManager.js';
import { WebhookNotifier } from './WebhookNotifier.js';
import type { WebhookEndpoint, WebhookEventType } from './WebhookNotifier.js';

/**
 * In-memory policy store for standalone usage
 */
export class InMemoryPolicyStore implements PolicyStore {
  private policies = new Map<string, AgentPolicy>();

  async getPolicy(agentId: string): Promise<AgentPolicy | null> {
    return this.policies.get(agentId) ?? null;
  }

  async setPolicy(agentId: string, policy: AgentPolicy): Promise<void> {
    this.policies.set(agentId, policy);
  }

  async deletePolicy(agentId: string): Promise<boolean> {
    return this.policies.delete(agentId);
  }

  async listPolicies(
    orgId?: string
  ): Promise<Array<{ agentId: string; policy: AgentPolicy }>> {
    const result: Array<{ agentId: string; policy: AgentPolicy }> = [];
    for (const [agentId, policy] of this.policies) {
      // Filter by orgId prefix if provided
      if (!orgId || agentId.startsWith(`${orgId}:`)) {
        result.push({ agentId, policy });
      }
    }
    return result;
  }

  // Helper for testing
  clear(): void {
    this.policies.clear();
  }
}

/**
 * In-memory limit store for standalone usage
 */
export class InMemoryLimitStore implements LimitStore {
  private data = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
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

  // Helper for testing
  clear(): void {
    this.data.clear();
  }
}

/**
 * Tool handler response
 */
interface ToolHandlerResponse {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

/**
 * Agent Policy MCP Server
 *
 * Exposes policy management capabilities via MCP protocol.
 */
export class AgentPolicyMcpServer {
  private config: AgentPolicyMcpConfig;
  private policyStore: PolicyStore;
  private limitStore: LimitStore;
  private approvalStore: ApprovalStore;
  private policyEngine: SimplePolicyEngine;
  private spendingLimiter: SpendingLimiter;
  private approvalManager: ApprovalManager;
  private mcpServer: Server;

  constructor(config: AgentPolicyMcpConfig = {}, stores?: {
    policyStore?: PolicyStore;
    limitStore?: LimitStore;
    approvalStore?: ApprovalStore;
    webhooks?: WebhookNotifier;
  }) {
    this.config = config;

    // Initialize stores
    this.policyStore = stores?.policyStore ?? new InMemoryPolicyStore();
    this.limitStore = stores?.limitStore ?? new InMemoryLimitStore();
    this.approvalStore = stores?.approvalStore ?? new InMemoryApprovalStore();

    // Initialize policy engine, limiter, and approval manager
    this.spendingLimiter = new SpendingLimiter({ store: this.limitStore });
    this.approvalManager = new ApprovalManager({
      store: this.approvalStore,
      webhooks: stores?.webhooks,
    });
    this.policyEngine = new SimplePolicyEngine({
      spendingLimiter: this.spendingLimiter,
      approvalManager: this.approvalManager,
    });

    // Initialize MCP server
    this.mcpServer = new Server(
      {
        name: 'agent-policy',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupMcpHandlers();
  }

  /**
   * Set up MCP request handlers
   */
  private setupMcpHandlers(): void {
    // List available tools
    this.mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: Object.values(TOOL_DEFINITIONS),
      };
    });

    // Handle tool calls
    this.mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const result = await this.handleToolCall(name, args as Record<string, unknown>);
      // Return MCP-compatible response
      return {
        content: result.content,
        isError: result.isError,
      };
    });
  }

  /**
   * Get tool definitions for MCP registration
   */
  getToolDefinitions(): typeof TOOL_DEFINITIONS {
    return TOOL_DEFINITIONS;
  }

  /**
   * Handle a tool call
   */
  async handleToolCall(
    name: string,
    args: Record<string, unknown>
  ): Promise<ToolHandlerResponse> {
    let result: ToolResult;
    let formatted: string;

    try {
      switch (name) {
        case 'agent-policy/authorize': {
          const input = authorizePaymentInputSchema.parse(args);
          result = await executeAuthorizePayment(input, {
            policyEngine: this.policyEngine,
            policyStore: this.policyStore,
            demoMode: this.config.demoMode,
          });
          formatted = formatAuthorizePaymentResult(result);
          break;
        }

        case 'agent-policy/budget': {
          const input = getRemainingBudgetInputSchema.parse(args);
          result = await executeGetRemainingBudget(input, {
            spendingLimiter: this.spendingLimiter,
            policyStore: this.policyStore,
            demoMode: this.config.demoMode,
          });
          formatted = formatGetRemainingBudgetResult(result);
          break;
        }

        case 'agent-policy/get': {
          const input = getPolicyInputSchema.parse(args);
          result = await executeGetPolicy(input, {
            policyStore: this.policyStore,
          });
          formatted = formatGetPolicyResult(result);
          break;
        }

        case 'agent-policy/set': {
          const input = setPolicyInputSchema.parse(args);
          result = await executeSetPolicy(input, {
            policyStore: this.policyStore,
            demoMode: this.config.demoMode,
          });
          formatted = formatSetPolicyResult(result);
          break;
        }

        case 'agent-policy/list': {
          const input = listPoliciesInputSchema.parse(args);
          result = await executeListPolicies(input, {
            policyStore: this.policyStore,
          });
          formatted = formatListPoliciesResult(result);
          break;
        }

        case 'agent-policy/confirm': {
          const input = confirmPaymentInputSchema.parse(args);
          result = await executeConfirmPayment(input, {
            spendingLimiter: this.spendingLimiter,
            demoMode: this.config.demoMode,
          });
          formatted = formatConfirmPaymentResult(result);
          break;
        }

        case 'agent-policy/release': {
          const input = releasePaymentInputSchema.parse(args);
          result = await executeReleasePayment(input, {
            spendingLimiter: this.spendingLimiter,
            demoMode: this.config.demoMode,
          });
          formatted = formatReleasePaymentResult(result);
          break;
        }

        case 'agent-policy/approvals/list': {
          const input = listPendingApprovalsInputSchema.parse(args);
          result = await executeListPendingApprovals(input, {
            approvalManager: this.approvalManager,
          });
          formatted = formatListPendingApprovalsResult(result);
          break;
        }

        case 'agent-policy/approvals/get': {
          const input = getApprovalInputSchema.parse(args);
          result = await executeGetApproval(input, {
            approvalManager: this.approvalManager,
          });
          formatted = formatGetApprovalResult(result);
          break;
        }

        case 'agent-policy/approvals/decide': {
          const input = submitApprovalDecisionInputSchema.parse(args);
          result = await executeSubmitApprovalDecision(input, {
            approvalManager: this.approvalManager,
          });
          formatted = formatSubmitApprovalDecisionResult(result);
          break;
        }

        default:
          return {
            content: [{ type: 'text', text: `Unknown tool: ${name}` }],
            isError: true,
          };
      }

      return {
        content: [{ type: 'text', text: formatted }],
        isError: !result.success,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{ type: 'text', text: `## Error\n\n${message}` }],
        isError: true,
      };
    }
  }

  /**
   * Get the policy store for direct access
   */
  getPolicyStore(): PolicyStore {
    return this.policyStore;
  }

  /**
   * Get the spending limiter for direct access
   */
  getSpendingLimiter(): SpendingLimiter {
    return this.spendingLimiter;
  }

  /**
   * Get the policy engine for direct access
   */
  getPolicyEngine(): SimplePolicyEngine {
    return this.policyEngine;
  }

  /**
   * Get the approval manager for direct access
   */
  getApprovalManager(): ApprovalManager {
    return this.approvalManager;
  }

  /**
   * Start the server using stdio transport
   */
  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.mcpServer.connect(transport);
    console.error('agent-policy MCP Server running on stdio');
  }
}

/**
 * Parse webhook configuration from environment variables
 */
function parseWebhookEndpointsFromEnv(): WebhookEndpoint[] | undefined {
  // Check for JSON configuration first (most flexible)
  const webhooksJson = process.env.AGENT_POLICY_WEBHOOKS;
  if (webhooksJson) {
    try {
      return JSON.parse(webhooksJson) as WebhookEndpoint[];
    } catch {
      console.error('Failed to parse AGENT_POLICY_WEBHOOKS JSON');
    }
  }

  // Fall back to simple single-endpoint configuration
  const webhookUrl = process.env.AGENT_POLICY_WEBHOOK_URL;
  if (!webhookUrl) {
    return undefined;
  }

  const endpoint: WebhookEndpoint = {
    url: webhookUrl,
  };

  // Optional secret for HMAC signature
  const secret = process.env.AGENT_POLICY_WEBHOOK_SECRET;
  if (secret) {
    endpoint.secret = secret;
  }

  // Optional event filter (comma-separated)
  const eventsStr = process.env.AGENT_POLICY_WEBHOOK_EVENTS;
  if (eventsStr) {
    endpoint.events = eventsStr.split(',').map((e) => e.trim()) as WebhookEventType[];
  }

  // Optional timeout in milliseconds
  const timeoutStr = process.env.AGENT_POLICY_WEBHOOK_TIMEOUT;
  if (timeoutStr) {
    const timeout = parseInt(timeoutStr, 10);
    if (!isNaN(timeout)) {
      endpoint.timeout = timeout;
    }
  }

  // Optional retry count
  const retriesStr = process.env.AGENT_POLICY_WEBHOOK_RETRIES;
  if (retriesStr) {
    const retries = parseInt(retriesStr, 10);
    if (!isNaN(retries)) {
      endpoint.retries = retries;
    }
  }

  return [endpoint];
}

/**
 * Create and configure an AgentPolicyMcpServer from environment variables
 *
 * Environment variables:
 * - AGENT_POLICY_REDIS_URL: Redis connection URL for persistent storage
 * - AGENT_POLICY_ORG_ID: Default organization ID
 * - AGENT_POLICY_DEMO_MODE: Enable demo mode (no actual payments)
 * - AGENT_POLICY_KEY_PREFIX: Redis key prefix (default: "agent-policy:")
 * - AGENT_POLICY_TTL: Policy TTL in seconds (optional)
 *
 * Webhook configuration (simple - single endpoint):
 * - AGENT_POLICY_WEBHOOK_URL: Webhook endpoint URL
 * - AGENT_POLICY_WEBHOOK_SECRET: HMAC secret for signature (optional)
 * - AGENT_POLICY_WEBHOOK_EVENTS: Comma-separated event types (optional, default: all)
 * - AGENT_POLICY_WEBHOOK_TIMEOUT: Request timeout in ms (optional, default: 10000)
 * - AGENT_POLICY_WEBHOOK_RETRIES: Retry attempts (optional, default: 3)
 *
 * Webhook configuration (advanced - JSON array):
 * - AGENT_POLICY_WEBHOOKS: JSON array of WebhookEndpoint objects
 */
export function createServerFromEnv(): AgentPolicyMcpServer {
  const config: AgentPolicyMcpConfig = {
    redisUrl: process.env.AGENT_POLICY_REDIS_URL,
    defaultOrgId: process.env.AGENT_POLICY_ORG_ID,
    demoMode: process.env.AGENT_POLICY_DEMO_MODE === 'true',
  };

  // Configure webhooks from environment
  const webhookEndpoints = parseWebhookEndpointsFromEnv();
  let webhooks: WebhookNotifier | undefined;

  if (webhookEndpoints && webhookEndpoints.length > 0) {
    const blocking = process.env.AGENT_POLICY_WEBHOOK_BLOCKING === 'true';
    webhooks = new WebhookNotifier({
      endpoints: webhookEndpoints,
      blocking,
    });
  }

  return new AgentPolicyMcpServer(config, { webhooks });
}

/**
 * Create and configure an AgentPolicyMcpServer with Redis stores
 *
 * @param redisUrl - Redis connection URL
 * @param options - Additional configuration options
 */
export async function createServerWithRedis(
  redisUrl: string,
  options: {
    keyPrefix?: string;
    ttl?: number;
    demoMode?: boolean;
    defaultOrgId?: string;
    approvalTtl?: number;
    /** Webhook endpoints for approval notifications */
    webhookEndpoints?: WebhookEndpoint[];
    /** Whether to wait for webhooks to complete (default: false) */
    webhookBlocking?: boolean;
  } = {}
): Promise<AgentPolicyMcpServer> {
  // Dynamic import to avoid requiring ioredis when not using Redis
  const { Redis: RedisClient } = await import('ioredis');
  const { RedisPolicyStore } = await import('./RedisPolicyStore.js');
  const { RedisLimitStore } = await import('../limits/RedisLimitStore.js');
  const { RedisApprovalStore } = await import('./RedisApprovalStore.js');

  const redis = new RedisClient(redisUrl);

  const keyPrefix = options.keyPrefix ?? 'agent-policy:';

  const policyStore = new RedisPolicyStore({
    redis,
    keyPrefix,
    ttl: options.ttl,
  });

  const limitStore = new RedisLimitStore(redis);

  const approvalStore = new RedisApprovalStore({
    redis,
    keyPrefix: `${keyPrefix}approvals:`,
    resolvedTtl: options.approvalTtl,
  });

  // Configure webhooks if endpoints provided
  let webhooks: WebhookNotifier | undefined;
  if (options.webhookEndpoints && options.webhookEndpoints.length > 0) {
    webhooks = new WebhookNotifier({
      endpoints: options.webhookEndpoints,
      blocking: options.webhookBlocking ?? false,
    });
  }

  const config: AgentPolicyMcpConfig = {
    redisUrl,
    defaultOrgId: options.defaultOrgId,
    demoMode: options.demoMode ?? false,
  };

  return new AgentPolicyMcpServer(config, { policyStore, limitStore, approvalStore, webhooks });
}
