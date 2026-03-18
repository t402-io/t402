import type {
  PaymentPolicy,
  PolicyContext,
  PolicyDecision,
  SessionStats,
} from "./types";

interface PaymentRecord {
  amount: bigint;
  timestamp: number;
}

/**
 * Payment policy engine that evaluates payment requirements against
 * a configured policy and tracks session statistics.
 */
export class PaymentPolicyEngine {
  private readonly policy: PaymentPolicy;
  private readonly payments: PaymentRecord[] = [];
  private sessionStartTime: number;
  private readonly nowFn: () => number;

  /**
   * Create a new policy engine.
   * @param policy - The payment policy to enforce
   * @param options - Optional configuration (e.g. custom clock for testing)
   */
  constructor(
    policy: PaymentPolicy,
    options?: { now?: () => number },
  ) {
    this.policy = policy;
    this.nowFn = options?.now ?? (() => Date.now());
    this.sessionStartTime = this.nowFn();
  }

  /**
   * Evaluate a payment against the configured policy.
   * Returns { allowed: true } if the payment passes all checks,
   * or { allowed: false, reason } with the first failing rule.
   */
  async evaluate(requirements: {
    scheme: string;
    network: string;
    asset: string;
    amount: string;
    payTo: string;
  }): Promise<PolicyDecision> {
    const amount = BigInt(requirements.amount);
    const now = this.nowFn();
    const stats = this.computeStats(now);

    // Built-in rules (checked in order)
    const builtInResult = this.evaluateBuiltInRules(requirements, amount, stats, now);
    if (!builtInResult.allowed) {
      return builtInResult;
    }

    // Custom rules
    if (this.policy.customRules) {
      const context: PolicyContext = { requirements, session: stats };
      for (const rule of this.policy.customRules) {
        const decision = await rule.validate(context);
        if (!decision.allowed) {
          return { allowed: false, reason: `Custom rule "${rule.name}": ${decision.reason}` };
        }
      }
    }

    return { allowed: true };
  }

  /**
   * Record a successful payment. Call this after a payment is confirmed
   * so that session stats are updated for future evaluations.
   */
  recordPayment(amount: string): void {
    this.payments.push({
      amount: BigInt(amount),
      timestamp: this.nowFn(),
    });
  }

  /**
   * Get current session statistics.
   */
  getStats(): SessionStats {
    return this.computeStats(this.nowFn());
  }

  /**
   * Reset the engine, clearing all session history.
   */
  reset(): void {
    this.payments.length = 0;
    this.sessionStartTime = this.nowFn();
  }

  private evaluateBuiltInRules(
    requirements: { scheme: string; network: string; asset: string; amount: string; payTo: string },
    amount: bigint,
    stats: SessionStats,
    _now: number,
  ): PolicyDecision {
    // maxAmountPerPayment
    if (this.policy.maxAmountPerPayment !== undefined) {
      const max = BigInt(this.policy.maxAmountPerPayment);
      if (amount > max) {
        return {
          allowed: false,
          reason: `Amount ${amount} exceeds max per payment ${max}`,
        };
      }
    }

    // maxAmountPerSession
    if (this.policy.maxAmountPerSession !== undefined) {
      const max = BigInt(this.policy.maxAmountPerSession);
      if (stats.totalAmountPaid + amount > max) {
        return {
          allowed: false,
          reason: `Cumulative session amount would be ${stats.totalAmountPaid + amount}, exceeding max ${max}`,
        };
      }
    }

    // maxAmountPerDay
    if (this.policy.maxAmountPerDay !== undefined) {
      const max = BigInt(this.policy.maxAmountPerDay);
      if (stats.amountPaidToday + amount > max) {
        return {
          allowed: false,
          reason: `Daily amount would be ${stats.amountPaidToday + amount}, exceeding max ${max}`,
        };
      }
    }

    // maxPaymentsPerHour
    if (this.policy.maxPaymentsPerHour !== undefined) {
      if (stats.paymentsThisHour >= this.policy.maxPaymentsPerHour) {
        return {
          allowed: false,
          reason: `Payments this hour (${stats.paymentsThisHour}) would exceed max ${this.policy.maxPaymentsPerHour}`,
        };
      }
    }

    // allowedRecipients
    if (this.policy.allowedRecipients !== undefined && this.policy.allowedRecipients.length > 0) {
      const normalized = requirements.payTo.toLowerCase();
      const allowed = this.policy.allowedRecipients.map((r) => r.toLowerCase());
      if (!allowed.includes(normalized)) {
        return {
          allowed: false,
          reason: `Recipient ${requirements.payTo} is not in the allowed list`,
        };
      }
    }

    // blockedRecipients
    if (this.policy.blockedRecipients !== undefined && this.policy.blockedRecipients.length > 0) {
      const normalized = requirements.payTo.toLowerCase();
      const blocked = this.policy.blockedRecipients.map((r) => r.toLowerCase());
      if (blocked.includes(normalized)) {
        return {
          allowed: false,
          reason: `Recipient ${requirements.payTo} is blocked`,
        };
      }
    }

    // allowedNetworks
    if (this.policy.allowedNetworks !== undefined && this.policy.allowedNetworks.length > 0) {
      if (!this.policy.allowedNetworks.includes(requirements.network)) {
        return {
          allowed: false,
          reason: `Network ${requirements.network} is not in the allowed list`,
        };
      }
    }

    // allowedSchemes
    if (this.policy.allowedSchemes !== undefined && this.policy.allowedSchemes.length > 0) {
      if (!this.policy.allowedSchemes.includes(requirements.scheme)) {
        return {
          allowed: false,
          reason: `Scheme ${requirements.scheme} is not in the allowed list`,
        };
      }
    }

    // allowedAssets
    if (this.policy.allowedAssets !== undefined && this.policy.allowedAssets.length > 0) {
      const normalized = requirements.asset.toLowerCase();
      const allowed = this.policy.allowedAssets.map((a) => a.toLowerCase());
      if (!allowed.includes(normalized)) {
        return {
          allowed: false,
          reason: `Asset ${requirements.asset} is not in the allowed list`,
        };
      }
    }

    return { allowed: true };
  }

  private computeStats(now: number): SessionStats {
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    let totalAmountPaid = 0n;
    let amountPaidToday = 0n;
    let paymentsThisHour = 0;

    for (const payment of this.payments) {
      totalAmountPaid += payment.amount;

      if (payment.timestamp > oneDayAgo) {
        amountPaidToday += payment.amount;
      }

      if (payment.timestamp > oneHourAgo) {
        paymentsThisHour++;
      }
    }

    return {
      totalAmountPaid,
      paymentCount: this.payments.length,
      paymentsThisHour,
      amountPaidToday,
      startTime: this.sessionStartTime,
    };
  }
}
