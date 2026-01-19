/**
 * authorize tool - Check if a payment is authorized
 */

import type { SimplePolicyEngine } from '../SimplePolicyEngine.js';
import type { PolicyStore, AuthorizePaymentInput, ToolResult } from '../types.js';
import type { PaymentRequest, PolicyDecision } from '../../types.js';

export interface AuthorizePaymentOptions {
  policyEngine: SimplePolicyEngine;
  policyStore: PolicyStore;
  demoMode?: boolean;
}

export async function executeAuthorizePayment(
  input: AuthorizePaymentInput,
  options: AuthorizePaymentOptions
): Promise<ToolResult> {
  const { policyEngine, policyStore, demoMode } = options;

  // Get agent policy
  const policy = await policyStore.getPolicy(input.agentId);

  if (!policy) {
    return {
      success: false,
      error: `No policy found for agent: ${input.agentId}`,
    };
  }

  if (!policy.enabled) {
    return {
      success: false,
      error: `Policy is disabled for agent: ${input.agentId}`,
    };
  }

  // Build payment request
  const request: PaymentRequest = {
    agentId: input.agentId,
    amount: {
      value: input.amount,
      decimals: input.decimals ?? 6,
      symbol: input.symbol ?? 'USDT',
    },
    recipient: input.recipient,
    network: input.network,
    category: input.category,
    timestamp: new Date(),
    memo: input.memo,
  };

  // Authorize payment
  const decision = await policyEngine.authorize(request, policy);

  if (demoMode) {
    return {
      success: true,
      data: {
        ...decision,
        demoMode: true,
        note: 'Demo mode - no actual reservation created',
      },
    };
  }

  return {
    success: true,
    data: decision,
  };
}

export function formatAuthorizePaymentResult(result: ToolResult): string {
  if (!result.success) {
    return `## Authorization Failed\n\n**Error:** ${result.error}`;
  }

  const decision = result.data as PolicyDecision & { demoMode?: boolean; note?: string };

  const lines: string[] = ['## Payment Authorization Result\n'];

  if (decision.allowed) {
    lines.push('**Status:** ✅ Authorized\n');
    if (decision.reservationId) {
      lines.push(`**Reservation ID:** \`${decision.reservationId}\`\n`);
      lines.push('> Use this ID to confirm or release the payment.\n');
    }
  } else {
    lines.push('**Status:** ❌ Denied\n');
    lines.push(`**Reason:** ${decision.reason}\n`);
  }

  if (decision.requiresApproval) {
    lines.push('\n**Note:** This payment requires manual approval.\n');
  }

  if (decision.evaluations && decision.evaluations.length > 0) {
    lines.push('\n### Rule Evaluations\n');
    for (const evaluation of decision.evaluations) {
      const status = evaluation.passed ? '✅' : '❌';
      lines.push(`- ${status} **${evaluation.rule}**`);
      if (evaluation.reason) {
        lines.push(`: ${evaluation.reason}`);
      }
      lines.push('\n');
    }
  }

  if (decision.demoMode) {
    lines.push(`\n---\n*${decision.note}*`);
  }

  return lines.join('');
}
