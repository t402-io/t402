/**
 * Policy Engine - Core authorization logic
 */

import type {
  Policy,
  AuthorizationRequest,
  AuthorizationResult,
  RuleEvaluation,
  SpendingLimits,
} from '../types.js';
import { PolicyResolver } from './PolicyResolver.js';
import type { SpendingLimiter } from '../limits/SpendingLimiter.js';
import type { RuleEvaluator } from '../rules/RuleEvaluator.js';

export interface PolicyEngineConfig {
  policyStore: PolicyStore;
  spendingLimiter: SpendingLimiter;
  ruleEvaluator: RuleEvaluator;
}

export interface PolicyStore {
  getPolicy(id: string): Promise<Policy | null>;
  getPoliciesForAgent(agentId: string): Promise<Policy[]>;
  getPolicyChain(policyId: string): Promise<Policy[]>;
}

export class PolicyEngine {
  private readonly policyStore: PolicyStore;
  private readonly resolver: PolicyResolver;
  private readonly limiter: SpendingLimiter;
  private readonly ruleEvaluator: RuleEvaluator;

  constructor(config: PolicyEngineConfig) {
    this.policyStore = config.policyStore;
    this.resolver = new PolicyResolver();
    this.limiter = config.spendingLimiter;
    this.ruleEvaluator = config.ruleEvaluator;
  }

  /**
   * Authorize a payment request
   */
  async authorize(request: AuthorizationRequest): Promise<AuthorizationResult> {
    const evaluations: RuleEvaluation[] = [];
    const timestamp = new Date();

    // 1. Get policy chain for agent
    const policies = await this.policyStore.getPoliciesForAgent(request.agentId);

    if (policies.length === 0) {
      return {
        decision: 'rejected',
        reason: 'No policy found for agent',
        evaluations: [],
        effectivePolicy: this.createDefaultPolicy(),
        timestamp,
      };
    }

    // 2. Resolve effective policy
    const effectivePolicy = this.resolver.resolve(policies);

    // 3. Evaluate time rules
    const timeEval = await this.ruleEvaluator.evaluateTimeRules(
      effectivePolicy.rules.time,
      timestamp
    );
    evaluations.push(timeEval);

    if (!timeEval.passed) {
      return {
        decision: 'rejected',
        reason: timeEval.reason,
        evaluations,
        effectivePolicy,
        timestamp,
      };
    }

    // 4. Evaluate merchant rules
    const merchantEval = await this.ruleEvaluator.evaluateMerchantRules(
      effectivePolicy.rules.merchant,
      request.recipient
    );
    evaluations.push(merchantEval);

    if (!merchantEval.passed) {
      return {
        decision: 'rejected',
        reason: merchantEval.reason,
        evaluations,
        effectivePolicy,
        timestamp,
      };
    }

    // 5. Evaluate network rules
    const networkEval = await this.ruleEvaluator.evaluateNetworkRules(
      effectivePolicy.rules.network,
      request.network
    );
    evaluations.push(networkEval);

    if (!networkEval.passed) {
      return {
        decision: 'rejected',
        reason: networkEval.reason,
        evaluations,
        effectivePolicy,
        timestamp,
      };
    }

    // 6. Check spending limits
    const limitResult = await this.limiter.checkAndReserve(
      request.agentId,
      request.amount,
      effectivePolicy.limits
    );
    evaluations.push({
      rule: 'spending_limits',
      passed: limitResult.allowed,
      reason: limitResult.reason,
      details: {
        current: limitResult.currentSpending,
        limit: limitResult.limit,
        period: limitResult.period,
      },
    });

    if (!limitResult.allowed) {
      return {
        decision: 'rejected',
        reason: limitResult.reason,
        evaluations,
        effectivePolicy,
        timestamp,
      };
    }

    // 7. Check approval requirements
    if (effectivePolicy.approval) {
      const requiresApproval = this.checkApprovalRequired(
        request.amount,
        effectivePolicy.approval.thresholds
      );

      if (requiresApproval) {
        // Release the reservation since we need approval
        await this.limiter.release(limitResult.reservationId!);

        return {
          decision: 'pending_approval',
          reason: 'Amount exceeds approval threshold',
          evaluations,
          effectivePolicy,
          timestamp,
        };
      }
    }

    // 8. All checks passed
    return {
      decision: 'approved',
      reservationId: limitResult.reservationId,
      evaluations,
      effectivePolicy,
      timestamp,
    };
  }

  /**
   * Confirm a reservation after successful payment
   */
  async confirmReservation(reservationId: string): Promise<void> {
    await this.limiter.confirm(reservationId);
  }

  /**
   * Release a reservation if payment fails
   */
  async releaseReservation(reservationId: string): Promise<void> {
    await this.limiter.release(reservationId);
  }

  /**
   * Get remaining budget for an agent
   */
  async getRemainingBudget(
    agentId: string,
    period: 'hourly' | 'daily' | 'weekly' | 'monthly'
  ): Promise<{ spent: string; limit: string; remaining: string }> {
    const policies = await this.policyStore.getPoliciesForAgent(agentId);
    const effectivePolicy = this.resolver.resolve(policies);
    return this.limiter.getRemainingBudget(
      agentId,
      period,
      effectivePolicy.limits
    );
  }

  private checkApprovalRequired(
    amount: { value: string; decimals: number },
    thresholds: Array<{ amount: { value: string; decimals: number } }>
  ): boolean {
    const amountValue = BigInt(amount.value);

    for (const threshold of thresholds) {
      const thresholdValue = BigInt(threshold.amount.value);
      if (amountValue >= thresholdValue) {
        return true;
      }
    }

    return false;
  }

  private createDefaultPolicy(): Policy {
    return {
      id: '00000000-0000-0000-0000-000000000000',
      name: 'Default Deny Policy',
      version: '1.0.0',
      status: 'active',
      priority: 0,
      limits: {},
      rules: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'system',
    };
  }
}
