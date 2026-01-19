/**
 * MCP Integration for Agent Policy
 *
 * Provides MCP (Model Context Protocol) tools for AI agent payment policy management.
 *
 * @example
 * ```typescript
 * import { AgentPolicyMcpServer } from '@t402-internal/agent-policy/mcp';
 *
 * const server = new AgentPolicyMcpServer({ demoMode: true });
 *
 * // Get tool definitions for MCP registration
 * const tools = server.getToolDefinitions();
 *
 * // Handle tool calls
 * const result = await server.handleToolCall('agent-policy/authorize', {
 *   agentId: 'agent-123',
 *   amount: '100000000',
 *   recipient: '0x...',
 *   network: 'eip155:8453',
 * });
 * ```
 */

// Server
export {
  AgentPolicyMcpServer,
  InMemoryPolicyStore,
  InMemoryLimitStore,
  createServerFromEnv,
  createServerWithRedis,
} from './server.js';

// Redis Policy Store
export { RedisPolicyStore } from './RedisPolicyStore.js';
export type { RedisPolicyStoreConfig } from './RedisPolicyStore.js';

// Simple Policy Engine for MCP
export { SimplePolicyEngine } from './SimplePolicyEngine.js';
export type { SimplePolicyEngineConfig } from './SimplePolicyEngine.js';

// Approval Manager
export { ApprovalManager, InMemoryApprovalStore } from './ApprovalManager.js';
export type { ApprovalStore, ApprovalManagerConfig } from './ApprovalManager.js';

// Redis Approval Store
export { RedisApprovalStore } from './RedisApprovalStore.js';
export type { RedisApprovalStoreConfig } from './RedisApprovalStore.js';

// Webhook Notifier
export { WebhookNotifier } from './WebhookNotifier.js';
export type {
  WebhookEventType,
  WebhookPayload,
  WebhookEndpoint,
  WebhookNotifierConfig,
  WebhookDeliveryResult,
} from './WebhookNotifier.js';

// Types
export type {
  AgentPolicyMcpConfig,
  PolicyStore,
  ToolResult,
  AuthorizePaymentInput,
  GetRemainingBudgetInput,
  GetPolicyInput,
  SetPolicyInput,
  ListPoliciesInput,
  ConfirmPaymentInput,
  ReleasePaymentInput,
  ListPendingApprovalsInput,
  GetApprovalInput,
  SubmitApprovalDecisionInput,
} from './types.js';

export {
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

// Tools
export {
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
