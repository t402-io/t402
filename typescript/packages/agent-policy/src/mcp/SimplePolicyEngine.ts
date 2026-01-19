/**
 * Simple Policy Engine for MCP
 *
 * A simplified policy engine that works directly with a single policy,
 * designed for MCP tool integration.
 */

import type {
  AgentPolicy,
  PaymentRequest,
  PolicyDecision,
  RuleEvaluation,
} from '../types.js';
import { RuleEvaluator } from '../rules/RuleEvaluator.js';
import type { SpendingLimiter } from '../limits/SpendingLimiter.js';
import type { ApprovalManager } from './ApprovalManager.js';

export interface SimplePolicyEngineConfig {
  spendingLimiter: SpendingLimiter;
  approvalManager?: ApprovalManager;
}

export class SimplePolicyEngine {
  private readonly limiter: SpendingLimiter;
  private readonly ruleEvaluator: RuleEvaluator;
  private readonly approvalManager?: ApprovalManager;

  constructor(config: SimplePolicyEngineConfig) {
    this.limiter = config.spendingLimiter;
    this.approvalManager = config.approvalManager;
    this.ruleEvaluator = new RuleEvaluator();
  }

  /**
   * Authorize a payment request against a policy
   */
  async authorize(
    request: PaymentRequest,
    policy: AgentPolicy
  ): Promise<PolicyDecision> {
    const evaluations: RuleEvaluation[] = [];
    const timestamp = request.timestamp ?? new Date();

    // 1. Evaluate time rules
    const timeEval = await this.ruleEvaluator.evaluateTimeRules(
      policy.timeRules,
      timestamp
    );
    evaluations.push(timeEval);

    if (!timeEval.passed) {
      return {
        allowed: false,
        reason: timeEval.reason || 'Time rule violation',
        evaluations,
      };
    }

    // 2. Evaluate merchant rules
    const merchantEval = await this.ruleEvaluator.evaluateMerchantRules(
      policy.merchantRules,
      request.recipient
    );
    evaluations.push(merchantEval);

    if (!merchantEval.passed) {
      return {
        allowed: false,
        reason: merchantEval.reason || 'Merchant rule violation',
        evaluations,
      };
    }

    // 3. Evaluate network rules
    const networkEval = await this.ruleEvaluator.evaluateNetworkRules(
      policy.networkRules,
      request.network
    );
    evaluations.push(networkEval);

    if (!networkEval.passed) {
      return {
        allowed: false,
        reason: networkEval.reason || 'Network rule violation',
        evaluations,
      };
    }

    // 4. Evaluate category rules
    const categoryEval = await this.ruleEvaluator.evaluateCategoryRules(
      policy.categoryRules,
      request.category
    );
    evaluations.push(categoryEval);

    if (!categoryEval.passed) {
      return {
        allowed: false,
        reason: categoryEval.reason || 'Category rule violation',
        evaluations,
      };
    }

    // 5. Check spending limits
    if (policy.limits) {
      const limitResult = await this.limiter.checkAndReserve(
        request.agentId,
        request.amount,
        policy.limits
      );

      evaluations.push({
        rule: 'spending_limits',
        passed: limitResult.allowed,
        reason: limitResult.reason,
      });

      if (!limitResult.allowed) {
        return {
          allowed: false,
          reason: limitResult.reason || 'Spending limit exceeded',
          evaluations,
        };
      }

      // 6. Check if threshold-based approval required
      if (policy.approvalConfig && this.approvalManager) {
        const approvalCheck = this.approvalManager.requiresApproval(request, policy.approvalConfig);

        if (approvalCheck.required) {
          // Create pending approval with the reservation
          const pendingApproval = await this.approvalManager.createApproval(
            request,
            policy.approvalConfig,
            limitResult.reservationId
          );

          evaluations.push({
            rule: 'approval_threshold',
            passed: false,
            reason: `Requires ${approvalCheck.threshold?.requiredApprovers} approver(s) for amounts >= threshold`,
          });

          return {
            allowed: false,
            reason: `Payment requires approval (${approvalCheck.threshold?.requiredApprovers} approver(s) needed)`,
            requiresApproval: true,
            approvalId: pendingApproval.id,
            reservationId: limitResult.reservationId,
            evaluations,
          };
        }
      }

      // 7. Check if manual approval required (legacy)
      if (policy.requireApproval) {
        // Release the reservation since we need approval
        if (limitResult.reservationId) {
          await this.limiter.release(limitResult.reservationId);
        }

        return {
          allowed: false,
          reason: 'Manual approval required',
          requiresApproval: true,
          evaluations,
        };
      }

      // All checks passed
      return {
        allowed: true,
        reservationId: limitResult.reservationId,
        evaluations,
      };
    }

    // No limits defined - check approval requirements
    if (policy.approvalConfig && this.approvalManager) {
      const approvalCheck = this.approvalManager.requiresApproval(request, policy.approvalConfig);

      if (approvalCheck.required) {
        const pendingApproval = await this.approvalManager.createApproval(
          request,
          policy.approvalConfig
        );

        evaluations.push({
          rule: 'approval_threshold',
          passed: false,
          reason: `Requires ${approvalCheck.threshold?.requiredApprovers} approver(s) for amounts >= threshold`,
        });

        return {
          allowed: false,
          reason: `Payment requires approval (${approvalCheck.threshold?.requiredApprovers} approver(s) needed)`,
          requiresApproval: true,
          approvalId: pendingApproval.id,
          evaluations,
        };
      }
    }

    // Check legacy manual approval requirement
    if (policy.requireApproval) {
      return {
        allowed: false,
        reason: 'Manual approval required',
        requiresApproval: true,
        evaluations,
      };
    }

    // All checks passed (no limits)
    return {
      allowed: true,
      evaluations,
    };
  }
}
