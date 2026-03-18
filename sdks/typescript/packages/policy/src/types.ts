/**
 * Payment policy configuration for AI agent guardrails.
 * Defines constraints on what payments an agent is allowed to make.
 */
export interface PaymentPolicy {
  /** Max amount per single payment (in smallest unit, e.g. wei or satoshi) */
  maxAmountPerPayment?: string;
  /** Max cumulative amount per session */
  maxAmountPerSession?: string;
  /** Max cumulative amount per day (rolling 24h window) */
  maxAmountPerDay?: string;
  /** Max number of payments per hour (rolling 1h window) */
  maxPaymentsPerHour?: number;
  /** Allowed recipient addresses (payTo). If set, only these recipients are permitted. */
  allowedRecipients?: string[];
  /** Blocked recipient addresses. Checked after allowedRecipients. */
  blockedRecipients?: string[];
  /** Allowed CAIP-2 network IDs (e.g. "eip155:8453"). If set, only these networks are permitted. */
  allowedNetworks?: string[];
  /** Allowed payment schemes (e.g. "exact"). If set, only these schemes are permitted. */
  allowedSchemes?: string[];
  /** Allowed asset contract addresses. If set, only these assets are permitted. */
  allowedAssets?: string[];
  /** Custom validation rules evaluated in order */
  customRules?: PolicyRule[];
}

/**
 * A custom policy rule with a name and validation function.
 */
export interface PolicyRule {
  /** Human-readable name for this rule */
  name: string;
  /** Validation function that returns whether the payment is allowed */
  validate: (context: PolicyContext) => PolicyDecision | Promise<PolicyDecision>;
}

/**
 * Context passed to policy rules for evaluation.
 */
export interface PolicyContext {
  /** The payment requirements being evaluated */
  requirements: {
    scheme: string;
    network: string;
    asset: string;
    amount: string;
    payTo: string;
  };
  /** Cumulative session statistics */
  session: SessionStats;
}

/**
 * Statistics tracked across the session for policy enforcement.
 */
export interface SessionStats {
  /** Total amount paid in this session (in smallest unit) */
  totalAmountPaid: bigint;
  /** Total number of payments made in this session */
  paymentCount: number;
  /** Number of payments made in the current rolling hour */
  paymentsThisHour: number;
  /** Amount paid in the current rolling 24h window (in smallest unit) */
  amountPaidToday: bigint;
  /** Session start time (Unix timestamp in ms) */
  startTime: number;
}

/**
 * Result of a policy evaluation.
 */
export type PolicyDecision = { allowed: true } | { allowed: false; reason: string };
