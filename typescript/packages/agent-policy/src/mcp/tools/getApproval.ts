/**
 * getApproval tool - Get details of a pending approval
 */

import type { ApprovalManager } from '../ApprovalManager.js';
import type { GetApprovalInput, ToolResult } from '../types.js';

export interface GetApprovalOptions {
  approvalManager: ApprovalManager;
}

export async function executeGetApproval(
  input: GetApprovalInput,
  options: GetApprovalOptions
): Promise<ToolResult> {
  const { approvalManager } = options;

  try {
    const approval = await approvalManager.getApproval(input.approvalId);

    if (!approval) {
      return {
        success: false,
        error: `Approval not found: ${input.approvalId}`,
      };
    }

    return {
      success: true,
      data: {
        id: approval.id,
        agentId: approval.agentId,
        request: {
          amount: approvalManager.formatAmount(approval.request.amount),
          rawAmount: approval.request.amount,
          recipient: approval.request.recipient,
          network: approval.request.network,
          category: approval.request.category,
          memo: approval.request.memo,
        },
        status: approval.status,
        requiredApprovers: approval.requiredApprovers,
        approvers: approval.approvers,
        currentApprovals: approval.currentApprovals.map((a) => ({
          approver: a.approver,
          decision: a.decision,
          timestamp: a.timestamp.toISOString(),
          comment: a.comment,
        })),
        createdAt: approval.createdAt.toISOString(),
        expiresAt: approval.expiresAt.toISOString(),
        resolvedAt: approval.resolvedAt?.toISOString(),
        reservationId: approval.reservationId,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get approval',
    };
  }
}

export function formatGetApprovalResult(result: ToolResult): string {
  if (!result.success) {
    return `## Get Approval Failed\n\n**Error:** ${result.error}`;
  }

  const data = result.data as {
    id: string;
    agentId: string;
    request: {
      amount: string;
      rawAmount: { value: string; decimals: number; symbol?: string };
      recipient: string;
      network: string;
      category?: string;
      memo?: string;
    };
    status: string;
    requiredApprovers: number;
    approvers: string[];
    currentApprovals: Array<{
      approver: string;
      decision: string;
      timestamp: string;
      comment?: string;
    }>;
    createdAt: string;
    expiresAt: string;
    resolvedAt?: string;
    reservationId?: string;
  };

  const lines: string[] = ['## Approval Details\n'];

  lines.push(`**ID:** \`${data.id}\`\n`);
  lines.push(`**Agent:** ${data.agentId}\n`);
  lines.push(`**Status:** ${data.status}\n`);

  lines.push('\n### Payment Request\n');
  lines.push(`- **Amount:** ${data.request.amount}\n`);
  lines.push(`- **Recipient:** \`${data.request.recipient}\`\n`);
  lines.push(`- **Network:** ${data.request.network}\n`);
  if (data.request.category) {
    lines.push(`- **Category:** ${data.request.category}\n`);
  }
  if (data.request.memo) {
    lines.push(`- **Memo:** ${data.request.memo}\n`);
  }

  lines.push('\n### Approval Status\n');
  const approveCount = data.currentApprovals.filter((a) => a.decision === 'approve').length;
  lines.push(`- **Required:** ${data.requiredApprovers} approver(s)\n`);
  lines.push(`- **Current:** ${approveCount} approval(s)\n`);
  lines.push(`- **Authorized Approvers:** ${data.approvers.join(', ')}\n`);

  if (data.currentApprovals.length > 0) {
    lines.push('\n### Decisions\n');
    for (const decision of data.currentApprovals) {
      const emoji = decision.decision === 'approve' ? '✅' : '❌';
      lines.push(`- ${emoji} **${decision.approver}** (${decision.timestamp})`);
      if (decision.comment) {
        lines.push(`: ${decision.comment}`);
      }
      lines.push('\n');
    }
  }

  lines.push('\n### Timestamps\n');
  lines.push(`- **Created:** ${data.createdAt}\n`);
  lines.push(`- **Expires:** ${data.expiresAt}\n`);
  if (data.resolvedAt) {
    lines.push(`- **Resolved:** ${data.resolvedAt}\n`);
  }

  if (data.reservationId) {
    lines.push(`\n**Reservation ID:** \`${data.reservationId}\`\n`);
  }

  return lines.join('');
}
