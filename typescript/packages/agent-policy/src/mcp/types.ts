/**
 * MCP Types for Agent Policy
 */

import { z } from 'zod';
import type { AgentPolicy, SpendingLimits, PolicyDecision } from '../types.js';

/**
 * MCP Server configuration
 */
export interface AgentPolicyMcpConfig {
  /** Redis connection URL for limit storage */
  redisUrl?: string;
  /** Default organization ID */
  defaultOrgId?: string;
  /** Enable demo mode (no actual state changes) */
  demoMode?: boolean;
}

/**
 * Policy store interface for MCP server
 */
export interface PolicyStore {
  getPolicy(agentId: string): Promise<AgentPolicy | null>;
  setPolicy(agentId: string, policy: AgentPolicy): Promise<void>;
  deletePolicy(agentId: string): Promise<boolean>;
  listPolicies(orgId?: string): Promise<Array<{ agentId: string; policy: AgentPolicy }>>;
}

/**
 * Tool result structure
 */
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// ============================================
// Tool Input Schemas
// ============================================

/**
 * authorizePayment tool input
 */
export const authorizePaymentInputSchema = z.object({
  agentId: z.string().describe('Unique identifier for the AI agent'),
  amount: z.string().describe('Payment amount as string (e.g., "100000000" for 100 USDT with 6 decimals)'),
  decimals: z.number().default(6).describe('Token decimals (default: 6 for USDT)'),
  symbol: z.string().default('USDT').describe('Token symbol (default: USDT)'),
  recipient: z.string().describe('Recipient address'),
  network: z.string().describe('Network identifier (e.g., "eip155:8453" for Base)'),
  category: z.string().optional().describe('Payment category (e.g., "api_usage", "subscription")'),
  memo: z.string().optional().describe('Optional payment memo/description'),
});

export type AuthorizePaymentInput = z.infer<typeof authorizePaymentInputSchema>;

/**
 * getRemainingBudget tool input
 */
export const getRemainingBudgetInputSchema = z.object({
  agentId: z.string().describe('Unique identifier for the AI agent'),
  period: z.enum(['hourly', 'daily', 'weekly', 'monthly']).describe('Budget period to check'),
});

export type GetRemainingBudgetInput = z.infer<typeof getRemainingBudgetInputSchema>;

/**
 * getPolicy tool input
 */
export const getPolicyInputSchema = z.object({
  agentId: z.string().describe('Unique identifier for the AI agent'),
});

export type GetPolicyInput = z.infer<typeof getPolicyInputSchema>;

/**
 * setPolicy tool input
 */
export const setPolicyInputSchema = z.object({
  agentId: z.string().describe('Unique identifier for the AI agent'),
  policy: z.object({
    limits: z.object({
      perTransaction: z.object({
        value: z.string(),
        decimals: z.number().default(6),
        symbol: z.string().default('USDT'),
      }).optional().describe('Maximum amount per transaction'),
      hourly: z.object({
        value: z.string(),
        decimals: z.number().default(6),
        symbol: z.string().default('USDT'),
      }).optional().describe('Maximum amount per hour'),
      daily: z.object({
        value: z.string(),
        decimals: z.number().default(6),
        symbol: z.string().default('USDT'),
      }).optional().describe('Maximum amount per day'),
      weekly: z.object({
        value: z.string(),
        decimals: z.number().default(6),
        symbol: z.string().default('USDT'),
      }).optional().describe('Maximum amount per week'),
      monthly: z.object({
        value: z.string(),
        decimals: z.number().default(6),
        symbol: z.string().default('USDT'),
      }).optional().describe('Maximum amount per month'),
    }).optional().describe('Spending limits configuration'),
    timeRules: z.object({
      allowedWindows: z.array(z.object({
        days: z.array(z.number().min(0).max(6)).describe('Days of week (0=Sunday, 6=Saturday)'),
        startHour: z.number().min(0).max(23).describe('Start hour (UTC)'),
        endHour: z.number().min(0).max(23).describe('End hour (UTC)'),
      })).optional().describe('Time windows when payments are allowed'),
      timezone: z.string().default('UTC'),
    }).optional().describe('Time-based rules'),
    merchantRules: z.object({
      whitelist: z.array(z.string()).optional().describe('Allowed recipient addresses'),
      blacklist: z.array(z.string()).optional().describe('Blocked recipient addresses'),
      requireWhitelist: z.boolean().optional().describe('Require recipients to be whitelisted'),
    }).optional().describe('Merchant/recipient rules'),
    networkRules: z.object({
      allowedNetworks: z.array(z.string()).optional().describe('Allowed network identifiers'),
      blockedNetworks: z.array(z.string()).optional().describe('Blocked network identifiers'),
    }).optional().describe('Network rules'),
    categoryRules: z.object({
      allowedCategories: z.array(z.string()).optional().describe('Allowed payment categories'),
      blockedCategories: z.array(z.string()).optional().describe('Blocked payment categories'),
    }).optional().describe('Category rules for classifying payments'),
    requireApproval: z.boolean().optional().describe('Require manual approval for all payments (legacy)'),
    approvalConfig: z.object({
      thresholds: z.array(z.object({
        amount: z.object({
          value: z.string(),
          decimals: z.number().default(6),
          symbol: z.string().default('USDT'),
        }).describe('Amount threshold that triggers approval'),
        requiredApprovers: z.number().min(1).describe('Number of approvers required'),
        approvers: z.array(z.string()).describe('List of authorized approver identifiers'),
      })).describe('Approval thresholds by amount'),
      timeout: z.number().optional().describe('Approval timeout in milliseconds (default: 1 hour)'),
    }).optional().describe('Threshold-based approval configuration'),
    enabled: z.boolean().default(true).describe('Whether the policy is active'),
  }).describe('Policy configuration'),
});

export type SetPolicyInput = z.infer<typeof setPolicyInputSchema>;

/**
 * listPolicies tool input
 */
export const listPoliciesInputSchema = z.object({
  orgId: z.string().optional().describe('Filter by organization ID'),
});

export type ListPoliciesInput = z.infer<typeof listPoliciesInputSchema>;

/**
 * confirmPayment tool input
 */
export const confirmPaymentInputSchema = z.object({
  reservationId: z.string().describe('Reservation ID from authorizePayment'),
});

export type ConfirmPaymentInput = z.infer<typeof confirmPaymentInputSchema>;

/**
 * releasePayment tool input
 */
export const releasePaymentInputSchema = z.object({
  reservationId: z.string().describe('Reservation ID from authorizePayment'),
});

export type ReleasePaymentInput = z.infer<typeof releasePaymentInputSchema>;

/**
 * listPendingApprovals tool input
 */
export const listPendingApprovalsInputSchema = z.object({
  agentId: z.string().optional().describe('Filter by agent ID (optional)'),
});

export type ListPendingApprovalsInput = z.infer<typeof listPendingApprovalsInputSchema>;

/**
 * getApproval tool input
 */
export const getApprovalInputSchema = z.object({
  approvalId: z.string().describe('Approval ID to retrieve'),
});

export type GetApprovalInput = z.infer<typeof getApprovalInputSchema>;

/**
 * submitApprovalDecision tool input
 */
export const submitApprovalDecisionInputSchema = z.object({
  approvalId: z.string().describe('Approval ID to approve or deny'),
  decision: z.enum(['approve', 'deny']).describe('Approval decision'),
  approver: z.string().describe('Identifier of the approver'),
  comment: z.string().optional().describe('Optional comment for the decision'),
});

export type SubmitApprovalDecisionInput = z.infer<typeof submitApprovalDecisionInputSchema>;

// ============================================
// Tool Definitions for MCP
// ============================================

export const TOOL_DEFINITIONS = {
  'agent-policy/authorize': {
    name: 'agent-policy/authorize',
    description: 'Check if a payment is authorized according to the agent\'s policy. Returns authorization decision and reservation ID if approved.',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'Unique identifier for the AI agent' },
        amount: { type: 'string', description: 'Payment amount as string (e.g., "100000000" for 100 USDT with 6 decimals)' },
        decimals: { type: 'number', description: 'Token decimals (default: 6 for USDT)' },
        symbol: { type: 'string', description: 'Token symbol (default: USDT)' },
        recipient: { type: 'string', description: 'Recipient address' },
        network: { type: 'string', description: 'Network identifier (e.g., "eip155:8453" for Base)' },
        category: { type: 'string', description: 'Payment category (e.g., "api_usage", "subscription")' },
        memo: { type: 'string', description: 'Optional payment memo/description' },
      },
      required: ['agentId', 'amount', 'recipient', 'network'],
    },
  },
  'agent-policy/budget': {
    name: 'agent-policy/budget',
    description: 'Get remaining budget for an agent in a specific period (hourly, daily, weekly, monthly).',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'Unique identifier for the AI agent' },
        period: { type: 'string', enum: ['hourly', 'daily', 'weekly', 'monthly'], description: 'Budget period to check' },
      },
      required: ['agentId', 'period'],
    },
  },
  'agent-policy/get': {
    name: 'agent-policy/get',
    description: 'Get the current policy configuration for an agent.',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'Unique identifier for the AI agent' },
      },
      required: ['agentId'],
    },
  },
  'agent-policy/set': {
    name: 'agent-policy/set',
    description: 'Set or update the policy configuration for an agent. Includes spending limits, time rules, merchant rules, and network rules.',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'Unique identifier for the AI agent' },
        policy: { type: 'object', description: 'Policy configuration object' },
      },
      required: ['agentId', 'policy'],
    },
  },
  'agent-policy/list': {
    name: 'agent-policy/list',
    description: 'List all policies, optionally filtered by organization ID.',
    inputSchema: {
      type: 'object',
      properties: {
        orgId: { type: 'string', description: 'Filter by organization ID' },
      },
      required: [],
    },
  },
  'agent-policy/confirm': {
    name: 'agent-policy/confirm',
    description: 'Confirm a payment reservation after successful payment execution.',
    inputSchema: {
      type: 'object',
      properties: {
        reservationId: { type: 'string', description: 'Reservation ID from authorizePayment' },
      },
      required: ['reservationId'],
    },
  },
  'agent-policy/release': {
    name: 'agent-policy/release',
    description: 'Release a payment reservation (cancel/rollback). Returns budget to available.',
    inputSchema: {
      type: 'object',
      properties: {
        reservationId: { type: 'string', description: 'Reservation ID from authorizePayment' },
      },
      required: ['reservationId'],
    },
  },
  'agent-policy/approvals/list': {
    name: 'agent-policy/approvals/list',
    description: 'List pending payment approvals. Can filter by agent ID.',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'Filter by agent ID (optional)' },
      },
      required: [],
    },
  },
  'agent-policy/approvals/get': {
    name: 'agent-policy/approvals/get',
    description: 'Get details of a specific pending approval.',
    inputSchema: {
      type: 'object',
      properties: {
        approvalId: { type: 'string', description: 'Approval ID to retrieve' },
      },
      required: ['approvalId'],
    },
  },
  'agent-policy/approvals/decide': {
    name: 'agent-policy/approvals/decide',
    description: 'Submit an approval decision (approve or deny) for a pending payment.',
    inputSchema: {
      type: 'object',
      properties: {
        approvalId: { type: 'string', description: 'Approval ID' },
        decision: { type: 'string', enum: ['approve', 'deny'], description: 'Approval decision' },
        approver: { type: 'string', description: 'Identifier of the approver' },
        comment: { type: 'string', description: 'Optional comment for the decision' },
      },
      required: ['approvalId', 'decision', 'approver'],
    },
  },
} as const;
