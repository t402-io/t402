/**
 * Approval Manager - Handles payment approval workflows
 *
 * Manages pending approvals, approval decisions, and escalation.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  ApprovalConfig,
  ApprovalStatus,
  PendingApproval,
  ApprovalDecision,
  ApprovalResult,
  PaymentRequest,
  Amount,
} from '../types.js';
import type { WebhookNotifier } from './WebhookNotifier.js';

/**
 * Approval store interface
 */
export interface ApprovalStore {
  /** Get a pending approval by ID */
  getApproval(id: string): Promise<PendingApproval | null>;
  /** Save a pending approval */
  saveApproval(approval: PendingApproval): Promise<void>;
  /** Delete an approval */
  deleteApproval(id: string): Promise<boolean>;
  /** List pending approvals for an agent */
  listPendingApprovals(agentId?: string): Promise<PendingApproval[]>;
  /** List all approvals by status */
  listApprovalsByStatus(status: ApprovalStatus): Promise<PendingApproval[]>;
}

/**
 * In-memory approval store implementation
 */
export class InMemoryApprovalStore implements ApprovalStore {
  private approvals = new Map<string, PendingApproval>();

  async getApproval(id: string): Promise<PendingApproval | null> {
    return this.approvals.get(id) ?? null;
  }

  async saveApproval(approval: PendingApproval): Promise<void> {
    this.approvals.set(approval.id, approval);
  }

  async deleteApproval(id: string): Promise<boolean> {
    return this.approvals.delete(id);
  }

  async listPendingApprovals(agentId?: string): Promise<PendingApproval[]> {
    const all = Array.from(this.approvals.values());
    const pending = all.filter((a) => a.status === 'pending');
    if (agentId) {
      return pending.filter((a) => a.agentId === agentId);
    }
    return pending;
  }

  async listApprovalsByStatus(status: ApprovalStatus): Promise<PendingApproval[]> {
    return Array.from(this.approvals.values()).filter((a) => a.status === status);
  }

  // Test helper
  clear(): void {
    this.approvals.clear();
  }
}

export interface ApprovalManagerConfig {
  store: ApprovalStore;
  /** Default timeout in milliseconds (default: 1 hour) */
  defaultTimeout?: number;
  /** Webhook notifier for approval events */
  webhooks?: WebhookNotifier;
}

/**
 * Approval Manager
 *
 * Handles the creation, tracking, and resolution of payment approvals.
 */
export class ApprovalManager {
  private readonly store: ApprovalStore;
  private readonly defaultTimeout: number;
  private readonly webhooks?: WebhookNotifier;

  constructor(config: ApprovalManagerConfig) {
    this.store = config.store;
    this.defaultTimeout = config.defaultTimeout ?? 3600000; // 1 hour
    this.webhooks = config.webhooks;
  }

  /**
   * Check if a payment request requires approval based on the config
   */
  requiresApproval(
    request: PaymentRequest,
    config: ApprovalConfig | undefined
  ): { required: boolean; threshold?: { requiredApprovers: number; approvers: string[] } } {
    if (!config || !config.thresholds || config.thresholds.length === 0) {
      return { required: false };
    }

    const requestAmount = BigInt(request.amount.value);

    // Find the applicable threshold (highest threshold that the amount exceeds)
    const applicableThresholds = config.thresholds
      .filter((t) => requestAmount >= BigInt(t.amount.value))
      .sort((a, b) => {
        const aVal = BigInt(a.amount.value);
        const bVal = BigInt(b.amount.value);
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      });

    if (applicableThresholds.length === 0) {
      return { required: false };
    }

    const threshold = applicableThresholds[0];
    return {
      required: true,
      threshold: {
        requiredApprovers: threshold.requiredApprovers,
        approvers: threshold.approvers,
      },
    };
  }

  /**
   * Create a pending approval for a payment request
   */
  async createApproval(
    request: PaymentRequest,
    config: ApprovalConfig,
    reservationId?: string
  ): Promise<PendingApproval> {
    const check = this.requiresApproval(request, config);
    if (!check.required || !check.threshold) {
      throw new Error('Payment does not require approval');
    }

    const timeout = config.timeout ?? this.defaultTimeout;
    const now = new Date();

    const approval: PendingApproval = {
      id: uuidv4(),
      agentId: request.agentId,
      request: {
        amount: request.amount,
        recipient: request.recipient,
        network: request.network,
        category: request.category,
        memo: request.memo,
      },
      status: 'pending',
      requiredApprovers: check.threshold.requiredApprovers,
      approvers: check.threshold.approvers,
      currentApprovals: [],
      createdAt: now,
      expiresAt: new Date(now.getTime() + timeout),
      reservationId,
    };

    await this.store.saveApproval(approval);

    // Notify webhook subscribers
    if (this.webhooks) {
      await this.webhooks.notifyCreated(approval);
    }

    return approval;
  }

  /**
   * Submit an approval decision
   */
  async submitDecision(
    approvalId: string,
    decision: ApprovalDecision
  ): Promise<ApprovalResult> {
    const approval = await this.store.getApproval(approvalId);

    if (!approval) {
      return {
        approved: false,
        approvalId,
        status: 'denied',
        reason: 'Approval not found',
      };
    }

    // Check if already resolved
    if (approval.status !== 'pending' && approval.status !== 'escalated') {
      return {
        approved: approval.status === 'approved',
        approvalId,
        status: approval.status,
        reason: `Approval already ${approval.status}`,
        reservationId: approval.reservationId,
      };
    }

    // Check if expired
    if (new Date() > approval.expiresAt) {
      approval.status = 'expired';
      approval.resolvedAt = new Date();
      await this.store.saveApproval(approval);

      return {
        approved: false,
        approvalId,
        status: 'expired',
        reason: 'Approval has expired',
      };
    }

    // Check if approver is authorized
    const normalizedApprover = decision.approver.toLowerCase();
    const isAuthorized = approval.approvers.some(
      (a) => a.toLowerCase() === normalizedApprover
    );

    if (!isAuthorized) {
      return {
        approved: false,
        approvalId,
        status: approval.status,
        reason: `Approver ${decision.approver} is not authorized`,
      };
    }

    // Check for duplicate decisions from same approver
    const alreadyDecided = approval.currentApprovals.some(
      (a) => a.approver.toLowerCase() === normalizedApprover
    );

    if (alreadyDecided) {
      return {
        approved: false,
        approvalId,
        status: approval.status,
        reason: `Approver ${decision.approver} has already submitted a decision`,
      };
    }

    // Add the decision
    approval.currentApprovals.push({
      approver: decision.approver,
      timestamp: decision.timestamp,
      decision: decision.decision,
      comment: decision.comment,
    });

    // Check if denied
    if (decision.decision === 'deny') {
      approval.status = 'denied';
      approval.resolvedAt = new Date();
      await this.store.saveApproval(approval);

      const result: ApprovalResult = {
        approved: false,
        approvalId,
        status: 'denied',
        reason: decision.comment || 'Approval denied by approver',
        reservationId: approval.reservationId,
      };

      // Notify webhook subscribers
      if (this.webhooks) {
        await this.webhooks.notifyDecisionSubmitted(approval, decision, result);
      }

      return result;
    }

    // Check if we have enough approvals
    const approveCount = approval.currentApprovals.filter(
      (a) => a.decision === 'approve'
    ).length;

    if (approveCount >= approval.requiredApprovers) {
      approval.status = 'approved';
      approval.resolvedAt = new Date();
      await this.store.saveApproval(approval);

      const result: ApprovalResult = {
        approved: true,
        approvalId,
        status: 'approved',
        reservationId: approval.reservationId,
      };

      // Notify webhook subscribers
      if (this.webhooks) {
        await this.webhooks.notifyDecisionSubmitted(approval, decision, result);
      }

      return result;
    }

    // Still pending, need more approvals
    await this.store.saveApproval(approval);

    const result: ApprovalResult = {
      approved: false,
      approvalId,
      status: 'pending',
      reason: `Waiting for ${approval.requiredApprovers - approveCount} more approval(s)`,
      reservationId: approval.reservationId,
    };

    // Notify webhook subscribers (decision submitted but still pending)
    if (this.webhooks) {
      await this.webhooks.notify('approval.decision_submitted', approval, decision, result);
    }

    return result;
  }

  /**
   * Get a pending approval by ID
   */
  async getApproval(approvalId: string): Promise<PendingApproval | null> {
    const approval = await this.store.getApproval(approvalId);

    // Check and update expired approvals
    if (approval && approval.status === 'pending' && new Date() > approval.expiresAt) {
      approval.status = 'expired';
      approval.resolvedAt = new Date();
      await this.store.saveApproval(approval);

      // Notify webhook subscribers
      if (this.webhooks) {
        await this.webhooks.notifyExpired(approval);
      }
    }

    return approval;
  }

  /**
   * List pending approvals
   */
  async listPendingApprovals(agentId?: string): Promise<PendingApproval[]> {
    const approvals = await this.store.listPendingApprovals(agentId);

    // Check and update expired approvals
    const now = new Date();
    const results: PendingApproval[] = [];

    for (const approval of approvals) {
      if (approval.status === 'pending' && now > approval.expiresAt) {
        approval.status = 'expired';
        approval.resolvedAt = now;
        await this.store.saveApproval(approval);

        // Notify webhook subscribers
        if (this.webhooks) {
          await this.webhooks.notifyExpired(approval);
        }
      } else {
        results.push(approval);
      }
    }

    return results;
  }

  /**
   * Cancel a pending approval
   */
  async cancelApproval(approvalId: string): Promise<boolean> {
    const approval = await this.store.getApproval(approvalId);

    if (!approval || approval.status !== 'pending') {
      return false;
    }

    approval.status = 'denied';
    approval.resolvedAt = new Date();
    await this.store.saveApproval(approval);

    // Notify webhook subscribers
    if (this.webhooks) {
      await this.webhooks.notifyCancelled(approval);
    }

    return true;
  }

  /**
   * Format amount for display
   */
  formatAmount(amount: Amount): string {
    const bigValue = BigInt(amount.value);
    const divisor = BigInt(10 ** amount.decimals);
    const integerPart = bigValue / divisor;
    const fractionalPart = bigValue % divisor;
    const symbol = amount.symbol ?? 'USDT';

    const fractionalStr = fractionalPart
      .toString()
      .padStart(amount.decimals, '0')
      .replace(/0+$/, '');

    if (fractionalStr) {
      return `${integerPart}.${fractionalStr} ${symbol}`;
    }
    return `${integerPart} ${symbol}`;
  }
}
