/**
 * submitApprovalDecision tool - Approve or deny a pending payment
 */

import type { ApprovalManager } from '../ApprovalManager.js';
import type { SubmitApprovalDecisionInput, ToolResult } from '../types.js';
import type { ApprovalResult } from '../../types.js';

export interface SubmitApprovalDecisionOptions {
  approvalManager: ApprovalManager;
}

export async function executeSubmitApprovalDecision(
  input: SubmitApprovalDecisionInput,
  options: SubmitApprovalDecisionOptions
): Promise<ToolResult> {
  const { approvalManager } = options;

  try {
    const result = await approvalManager.submitDecision(input.approvalId, {
      approver: input.approver,
      timestamp: new Date(),
      decision: input.decision,
      comment: input.comment,
    });

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit approval decision',
    };
  }
}

export function formatSubmitApprovalDecisionResult(result: ToolResult): string {
  if (!result.success) {
    return `## Approval Decision Failed\n\n**Error:** ${result.error}`;
  }

  const data = result.data as ApprovalResult;

  const lines: string[] = ['## Approval Decision Result\n'];

  lines.push(`**Approval ID:** \`${data.approvalId}\`\n`);
  lines.push(`**Status:** ${data.status}\n`);

  if (data.approved) {
    lines.push('\n✅ **Payment has been approved!**\n');
    if (data.reservationId) {
      lines.push(`\n**Reservation ID:** \`${data.reservationId}\`\n`);
      lines.push('> Use this ID to confirm the payment after execution.\n');
    }
  } else {
    if (data.status === 'denied') {
      lines.push('\n❌ **Payment has been denied.**\n');
    } else if (data.status === 'pending') {
      lines.push('\n⏳ **Awaiting more approvals.**\n');
    } else if (data.status === 'expired') {
      lines.push('\n⏰ **Approval has expired.**\n');
    }
    if (data.reason) {
      lines.push(`\n**Reason:** ${data.reason}\n`);
    }
  }

  return lines.join('');
}
