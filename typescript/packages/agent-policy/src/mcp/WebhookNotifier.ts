/**
 * Webhook Notifier for Approval Events
 *
 * Sends HTTP webhook notifications for approval workflow events.
 */

import type { PendingApproval, ApprovalResult, ApprovalDecision } from '../types.js';

/**
 * Webhook event types
 */
export type WebhookEventType =
  | 'approval.created'
  | 'approval.decision_submitted'
  | 'approval.approved'
  | 'approval.denied'
  | 'approval.expired'
  | 'approval.cancelled';

/**
 * Base webhook payload
 */
export interface WebhookPayload {
  event: WebhookEventType;
  timestamp: string;
  approval: {
    id: string;
    agentId: string;
    status: string;
    amount: string;
    amountRaw: {
      value: string;
      decimals: number;
      symbol?: string;
    };
    recipient: string;
    network: string;
    category?: string;
    memo?: string;
    requiredApprovers: number;
    currentApprovalCount: number;
    approvers: string[];
    createdAt: string;
    expiresAt: string;
    resolvedAt?: string;
    reservationId?: string;
  };
  decision?: {
    approver: string;
    decision: 'approve' | 'deny';
    comment?: string;
    timestamp: string;
  };
  result?: {
    approved: boolean;
    reason?: string;
  };
}

/**
 * Webhook endpoint configuration
 */
export interface WebhookEndpoint {
  /** Webhook URL */
  url: string;
  /** Events to subscribe to (empty = all events) */
  events?: WebhookEventType[];
  /** Secret for HMAC signature (optional) */
  secret?: string;
  /** Custom headers to include */
  headers?: Record<string, string>;
  /** Timeout in milliseconds (default: 10000) */
  timeout?: number;
  /** Number of retry attempts (default: 3) */
  retries?: number;
}

/**
 * Webhook notifier configuration
 */
export interface WebhookNotifierConfig {
  /** Webhook endpoints */
  endpoints: WebhookEndpoint[];
  /** Whether to wait for webhooks to complete (default: false - fire and forget) */
  blocking?: boolean;
  /** Custom fetch implementation (for testing) */
  fetch?: typeof fetch;
}

/**
 * Webhook delivery result
 */
export interface WebhookDeliveryResult {
  endpoint: string;
  success: boolean;
  statusCode?: number;
  error?: string;
  duration: number;
}

/**
 * Webhook Notifier
 *
 * Handles sending webhook notifications for approval events.
 */
export class WebhookNotifier {
  private readonly endpoints: WebhookEndpoint[];
  private readonly blocking: boolean;
  private readonly fetchFn: typeof fetch;

  constructor(config: WebhookNotifierConfig) {
    this.endpoints = config.endpoints;
    this.blocking = config.blocking ?? false;
    this.fetchFn = config.fetch ?? fetch;
  }

  /**
   * Format amount for display
   */
  private formatAmount(amount: { value: string; decimals: number; symbol?: string }): string {
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

  /**
   * Build webhook payload from approval
   */
  private buildPayload(
    event: WebhookEventType,
    approval: PendingApproval,
    decision?: ApprovalDecision,
    result?: ApprovalResult
  ): WebhookPayload {
    return {
      event,
      timestamp: new Date().toISOString(),
      approval: {
        id: approval.id,
        agentId: approval.agentId,
        status: approval.status,
        amount: this.formatAmount(approval.request.amount),
        amountRaw: approval.request.amount,
        recipient: approval.request.recipient,
        network: approval.request.network,
        category: approval.request.category,
        memo: approval.request.memo,
        requiredApprovers: approval.requiredApprovers,
        currentApprovalCount: approval.currentApprovals.filter((a) => a.decision === 'approve')
          .length,
        approvers: approval.approvers,
        createdAt: approval.createdAt.toISOString(),
        expiresAt: approval.expiresAt.toISOString(),
        resolvedAt: approval.resolvedAt?.toISOString(),
        reservationId: approval.reservationId,
      },
      decision: decision
        ? {
            approver: decision.approver,
            decision: decision.decision,
            comment: decision.comment,
            timestamp: decision.timestamp.toISOString(),
          }
        : undefined,
      result: result
        ? {
            approved: result.approved,
            reason: result.reason,
          }
        : undefined,
    };
  }

  /**
   * Compute HMAC signature for payload
   */
  private async computeSignature(payload: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    return Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Send webhook to a single endpoint
   */
  private async sendToEndpoint(
    endpoint: WebhookEndpoint,
    payload: WebhookPayload
  ): Promise<WebhookDeliveryResult> {
    const startTime = Date.now();
    const payloadStr = JSON.stringify(payload);
    const timeout = endpoint.timeout ?? 10000;
    const maxRetries = endpoint.retries ?? 3;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': payload.event,
      'X-Webhook-Timestamp': payload.timestamp,
      ...endpoint.headers,
    };

    // Add HMAC signature if secret is provided
    if (endpoint.secret) {
      const signature = await this.computeSignature(payloadStr, endpoint.secret);
      headers['X-Webhook-Signature'] = `sha256=${signature}`;
    }

    let lastError: string | undefined;
    let statusCode: number | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await this.fetchFn(endpoint.url, {
          method: 'POST',
          headers,
          body: payloadStr,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        statusCode = response.status;

        if (response.ok) {
          return {
            endpoint: endpoint.url,
            success: true,
            statusCode,
            duration: Date.now() - startTime,
          };
        }

        lastError = `HTTP ${response.status}: ${response.statusText}`;
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
      }

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 100));
      }
    }

    return {
      endpoint: endpoint.url,
      success: false,
      statusCode,
      error: lastError,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Notify all endpoints of an event
   */
  async notify(
    event: WebhookEventType,
    approval: PendingApproval,
    decision?: ApprovalDecision,
    result?: ApprovalResult
  ): Promise<WebhookDeliveryResult[]> {
    const payload = this.buildPayload(event, approval, decision, result);

    // Filter endpoints that subscribe to this event
    const targetEndpoints = this.endpoints.filter((endpoint) => {
      if (!endpoint.events || endpoint.events.length === 0) {
        return true; // Subscribe to all events
      }
      return endpoint.events.includes(event);
    });

    if (targetEndpoints.length === 0) {
      return [];
    }

    const deliveryPromises = targetEndpoints.map((endpoint) =>
      this.sendToEndpoint(endpoint, payload)
    );

    if (this.blocking) {
      return Promise.all(deliveryPromises);
    }

    // Fire and forget - but still return results for logging
    Promise.all(deliveryPromises).catch(() => {
      // Swallow errors in non-blocking mode
    });

    return [];
  }

  /**
   * Notify approval created
   */
  async notifyCreated(approval: PendingApproval): Promise<WebhookDeliveryResult[]> {
    return this.notify('approval.created', approval);
  }

  /**
   * Notify decision submitted
   */
  async notifyDecisionSubmitted(
    approval: PendingApproval,
    decision: ApprovalDecision,
    result: ApprovalResult
  ): Promise<WebhookDeliveryResult[]> {
    // Determine the specific event based on result
    let event: WebhookEventType = 'approval.decision_submitted';
    if (result.status === 'approved') {
      event = 'approval.approved';
    } else if (result.status === 'denied') {
      event = 'approval.denied';
    }

    return this.notify(event, approval, decision, result);
  }

  /**
   * Notify approval expired
   */
  async notifyExpired(approval: PendingApproval): Promise<WebhookDeliveryResult[]> {
    return this.notify('approval.expired', approval);
  }

  /**
   * Notify approval cancelled
   */
  async notifyCancelled(approval: PendingApproval): Promise<WebhookDeliveryResult[]> {
    return this.notify('approval.cancelled', approval);
  }
}
