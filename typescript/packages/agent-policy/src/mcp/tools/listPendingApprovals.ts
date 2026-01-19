/**
 * listPendingApprovals tool - List pending payment approvals
 */

import type { ApprovalManager } from '../ApprovalManager.js';
import type { ListPendingApprovalsInput, ToolResult } from '../types.js';
import type { PendingApproval } from '../../types.js';

export interface ListPendingApprovalsOptions {
  approvalManager: ApprovalManager;
}

export async function executeListPendingApprovals(
  input: ListPendingApprovalsInput,
  options: ListPendingApprovalsOptions
): Promise<ToolResult> {
  const { approvalManager } = options;

  try {
    const approvals = await approvalManager.listPendingApprovals(input.agentId);

    return {
      success: true,
      data: {
        count: approvals.length,
        approvals: approvals.map((a) => ({
          id: a.id,
          agentId: a.agentId,
          amount: approvalManager.formatAmount(a.request.amount),
          recipient: a.request.recipient,
          network: a.request.network,
          category: a.request.category,
          status: a.status,
          requiredApprovers: a.requiredApprovers,
          currentApprovalCount: a.currentApprovals.filter((d) => d.decision === 'approve').length,
          approvers: a.approvers,
          createdAt: a.createdAt.toISOString(),
          expiresAt: a.expiresAt.toISOString(),
        })),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list pending approvals',
    };
  }
}

export function formatListPendingApprovalsResult(result: ToolResult): string {
  if (!result.success) {
    return `## List Pending Approvals Failed\n\n**Error:** ${result.error}`;
  }

  const data = result.data as {
    count: number;
    approvals: Array<{
      id: string;
      agentId: string;
      amount: string;
      recipient: string;
      network: string;
      category?: string;
      status: string;
      requiredApprovers: number;
      currentApprovalCount: number;
      approvers: string[];
      createdAt: string;
      expiresAt: string;
    }>;
  };

  const lines: string[] = ['## Pending Approvals\n'];

  if (data.count === 0) {
    lines.push('No pending approvals found.\n');
    return lines.join('');
  }

  lines.push(`**Total:** ${data.count} pending approval(s)\n`);

  for (const approval of data.approvals) {
    lines.push(`\n### Approval: \`${approval.id}\`\n`);
    lines.push(`- **Agent:** ${approval.agentId}\n`);
    lines.push(`- **Amount:** ${approval.amount}\n`);
    lines.push(`- **Recipient:** \`${approval.recipient}\`\n`);
    lines.push(`- **Network:** ${approval.network}\n`);
    if (approval.category) {
      lines.push(`- **Category:** ${approval.category}\n`);
    }
    lines.push(`- **Status:** ${approval.status}\n`);
    lines.push(
      `- **Approvals:** ${approval.currentApprovalCount}/${approval.requiredApprovers} required\n`
    );
    lines.push(`- **Authorized Approvers:** ${approval.approvers.join(', ')}\n`);
    lines.push(`- **Created:** ${approval.createdAt}\n`);
    lines.push(`- **Expires:** ${approval.expiresAt}\n`);
  }

  return lines.join('');
}
