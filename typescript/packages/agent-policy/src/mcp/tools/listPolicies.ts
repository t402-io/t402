/**
 * list tool - List all agent policies
 */

import type { PolicyStore, ListPoliciesInput, ToolResult } from '../types.js';
import type { AgentPolicy } from '../../types.js';

export interface ListPoliciesOptions {
  policyStore: PolicyStore;
}

export async function executeListPolicies(
  input: ListPoliciesInput,
  options: ListPoliciesOptions
): Promise<ToolResult> {
  const { policyStore } = options;

  const policies = await policyStore.listPolicies(input.orgId);

  return {
    success: true,
    data: {
      orgId: input.orgId,
      count: policies.length,
      policies,
    },
  };
}

export function formatListPoliciesResult(result: ToolResult): string {
  if (!result.success) {
    return `## Policy List Failed\n\n**Error:** ${result.error}`;
  }

  const data = result.data as {
    orgId?: string;
    count: number;
    policies: Array<{ agentId: string; policy: AgentPolicy }>;
  };

  const lines: string[] = ['## Agent Policies\n'];

  if (data.orgId) {
    lines.push(`**Organization:** \`${data.orgId}\`\n`);
  }
  lines.push(`**Total:** ${data.count} agent(s)\n`);

  if (data.count === 0) {
    lines.push('\n*No policies configured.*\n');
    return lines.join('');
  }

  lines.push('\n| Agent ID | Status | Limits | Rules |\n');
  lines.push('|----------|--------|--------|-------|\n');

  for (const { agentId, policy } of data.policies) {
    const status = policy.enabled ? '✅' : '❌';

    // Count limits
    const limitCount = policy.limits ? Object.keys(policy.limits).length : 0;
    const limitsStr = limitCount > 0 ? `${limitCount} limit(s)` : '-';

    // Count rules
    const ruleCount =
      (policy.timeRules?.allowedWindows?.length ?? 0) +
      (policy.timeRules?.blockedPeriods?.length ?? 0) +
      (policy.merchantRules?.whitelist?.length ?? 0) +
      (policy.merchantRules?.blacklist?.length ?? 0) +
      (policy.networkRules?.allowedNetworks?.length ?? 0) +
      (policy.networkRules?.blockedNetworks?.length ?? 0);
    const rulesStr = ruleCount > 0 ? `${ruleCount} rule(s)` : '-';

    lines.push(`| \`${agentId}\` | ${status} | ${limitsStr} | ${rulesStr} |\n`);
  }

  return lines.join('');
}
