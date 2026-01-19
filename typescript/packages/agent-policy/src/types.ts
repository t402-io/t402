/**
 * Core types for Agent Policy Engine
 */

import { z } from 'zod';

// ============================================================================
// Amount Types
// ============================================================================

export const AmountSchema = z.object({
  value: z.string(),
  decimals: z.number(),
  symbol: z.string().optional(),
});

export type Amount = z.infer<typeof AmountSchema>;

// ============================================================================
// Time Rules
// ============================================================================

export const TimeWindowSchema = z.object({
  days: z.array(z.number().min(0).max(6)),
  startHour: z.number().min(0).max(23),
  endHour: z.number().min(0).max(23),
});

export const TimePeriodSchema = z.object({
  start: z.coerce.date(),
  end: z.coerce.date(),
  reason: z.string().optional(),
});

export const TimeRulesSchema = z.object({
  allowedWindows: z.array(TimeWindowSchema).optional(),
  blockedPeriods: z.array(TimePeriodSchema).optional(),
  timezone: z.string().default('UTC'),
});

export type TimeWindow = z.infer<typeof TimeWindowSchema>;
export type TimePeriod = z.infer<typeof TimePeriodSchema>;
export type TimeRules = z.infer<typeof TimeRulesSchema>;

// ============================================================================
// Merchant Rules
// ============================================================================

export const MerchantRulesSchema = z.object({
  whitelist: z.array(z.string()).optional(),
  blacklist: z.array(z.string()).optional(),
  requireWhitelist: z.boolean().default(false),
});

export type MerchantRules = z.infer<typeof MerchantRulesSchema>;

// ============================================================================
// Category Rules
// ============================================================================

export const CategoryRulesSchema = z.object({
  allowedCategories: z.array(z.string()).optional(),
  blockedCategories: z.array(z.string()).optional(),
});

export type CategoryRules = z.infer<typeof CategoryRulesSchema>;

// ============================================================================
// Network Rules
// ============================================================================

export const NetworkRulesSchema = z.object({
  allowedNetworks: z.array(z.string()).optional(),
  blockedNetworks: z.array(z.string()).optional(),
});

export type NetworkRules = z.infer<typeof NetworkRulesSchema>;

// ============================================================================
// Custom Rules (CEL Expressions)
// ============================================================================

export const CustomRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  expression: z.string(),
  action: z.enum(['allow', 'deny', 'require_approval']),
  message: z.string().optional(),
});

export type CustomRule = z.infer<typeof CustomRuleSchema>;

// ============================================================================
// Policy Rules
// ============================================================================

export const PolicyRulesSchema = z.object({
  time: TimeRulesSchema.optional(),
  merchant: MerchantRulesSchema.optional(),
  category: CategoryRulesSchema.optional(),
  network: NetworkRulesSchema.optional(),
  custom: z.array(CustomRuleSchema).optional(),
});

export type PolicyRules = z.infer<typeof PolicyRulesSchema>;

// ============================================================================
// Spending Limits
// ============================================================================

export const SpendingLimitsSchema = z.object({
  perTransaction: AmountSchema.optional(),
  hourly: AmountSchema.optional(),
  daily: AmountSchema.optional(),
  weekly: AmountSchema.optional(),
  monthly: AmountSchema.optional(),
  yearly: AmountSchema.optional(),
  lifetime: AmountSchema.optional(),
});

export type SpendingLimits = z.infer<typeof SpendingLimitsSchema>;

// ============================================================================
// Approval Configuration
// ============================================================================

export const ApprovalThresholdSchema = z.object({
  amount: AmountSchema,
  requiredApprovers: z.number().min(1),
  approvers: z.array(z.string()),
});

export const EscalationConfigSchema = z.object({
  timeout: z.number(), // milliseconds
  escalateTo: z.array(z.string()),
});

export const ApprovalConfigSchema = z.object({
  thresholds: z.array(ApprovalThresholdSchema),
  timeout: z.number().default(3600000), // 1 hour default
  escalation: EscalationConfigSchema.optional(),
});

export type ApprovalThreshold = z.infer<typeof ApprovalThresholdSchema>;
export type EscalationConfig = z.infer<typeof EscalationConfigSchema>;
export type ApprovalConfig = z.infer<typeof ApprovalConfigSchema>;

// ============================================================================
// Policy
// ============================================================================

export const PolicyStatusSchema = z.enum(['active', 'inactive', 'testing']);

export const PolicySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  version: z.string(),

  // Hierarchy
  parentId: z.string().uuid().optional(),
  priority: z.number().default(0),

  // Status
  status: PolicyStatusSchema.default('active'),
  effectiveFrom: z.coerce.date().optional(),
  effectiveUntil: z.coerce.date().optional(),

  // Configuration
  limits: SpendingLimitsSchema,
  rules: PolicyRulesSchema,
  approval: ApprovalConfigSchema.optional(),

  // Metadata
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  createdBy: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

export type PolicyStatus = z.infer<typeof PolicyStatusSchema>;
export type Policy = z.infer<typeof PolicySchema>;

// ============================================================================
// Authorization Types
// ============================================================================

export const AuthorizationRequestSchema = z.object({
  agentId: z.string(),
  amount: AmountSchema,
  recipient: z.string(),
  network: z.string(),
  category: z.string().optional(),
  memo: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type AuthorizationRequest = z.infer<typeof AuthorizationRequestSchema>;

export const AuthorizationDecisionSchema = z.enum([
  'approved',
  'rejected',
  'pending_approval',
]);

export type AuthorizationDecision = z.infer<typeof AuthorizationDecisionSchema>;

export interface RuleEvaluation {
  rule: string;
  passed: boolean;
  reason?: string;
  details?: Record<string, unknown>;
}

export interface AuthorizationResult {
  decision: AuthorizationDecision;
  reservationId?: string;
  reason?: string;
  evaluations: RuleEvaluation[];
  effectivePolicy: Policy;
  timestamp: Date;
}

// ============================================================================
// Spending Tracking
// ============================================================================

export interface SpendingRecord {
  agentId: string;
  period: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'lifetime';
  windowStart: Date;
  windowEnd: Date;
  spent: Amount;
  limit: Amount;
  remaining: Amount;
}

export interface Reservation {
  id: string;
  agentId: string;
  amount: Amount;
  createdAt: Date;
  expiresAt: Date;
  status: 'pending' | 'confirmed' | 'released' | 'expired';
}

// ============================================================================
// MCP-Simplified Types
// ============================================================================

/**
 * Simplified agent policy for MCP integration.
 * Flattened structure for easier configuration via tools.
 */
export interface AgentPolicy {
  enabled: boolean;
  limits?: SpendingLimits;
  timeRules?: TimeRules;
  merchantRules?: MerchantRules;
  networkRules?: NetworkRules;
  categoryRules?: CategoryRules;
  /** @deprecated Use approvalConfig instead */
  requireApproval?: boolean;
  /** Approval configuration with thresholds */
  approvalConfig?: ApprovalConfig;
}

// ============================================================================
// Pending Approval Types
// ============================================================================

export type ApprovalStatus = 'pending' | 'approved' | 'denied' | 'expired' | 'escalated';

export const PendingApprovalSchema = z.object({
  id: z.string().uuid(),
  agentId: z.string(),
  request: z.object({
    amount: AmountSchema,
    recipient: z.string(),
    network: z.string(),
    category: z.string().optional(),
    memo: z.string().optional(),
  }),
  status: z.enum(['pending', 'approved', 'denied', 'expired', 'escalated']),
  requiredApprovers: z.number().min(1),
  approvers: z.array(z.string()),
  currentApprovals: z.array(z.object({
    approver: z.string(),
    timestamp: z.coerce.date(),
    decision: z.enum(['approve', 'deny']),
    comment: z.string().optional(),
  })),
  createdAt: z.coerce.date(),
  expiresAt: z.coerce.date(),
  reservationId: z.string().optional(),
  escalatedAt: z.coerce.date().optional(),
  resolvedAt: z.coerce.date().optional(),
});

export type PendingApproval = z.infer<typeof PendingApprovalSchema>;

export interface ApprovalDecision {
  approver: string;
  timestamp: Date;
  decision: 'approve' | 'deny';
  comment?: string;
}

export interface ApprovalResult {
  approved: boolean;
  approvalId: string;
  status: ApprovalStatus;
  reason?: string;
  reservationId?: string;
}

/**
 * Payment request for authorization check
 */
export interface PaymentRequest {
  agentId: string;
  amount: Amount;
  recipient: string;
  network: string;
  category?: string;
  timestamp?: Date;
  memo?: string;
}

/**
 * Result of a policy authorization decision
 */
export interface PolicyDecision {
  allowed: boolean;
  reason?: string;
  reservationId?: string;
  requiresApproval?: boolean;
  /** ID of pending approval if requiresApproval is true */
  approvalId?: string;
  evaluations?: RuleEvaluation[];
}

/**
 * Time period type for budget queries
 */
export type LimitPeriod = 'hourly' | 'daily' | 'weekly' | 'monthly';

/**
 * Budget information for a specific period
 */
export interface BudgetInfo {
  limit: string;
  spent: string;
  remaining: string;
}
