/**
 * get tool - Get agent policy configuration
 */

import type { PolicyStore, GetPolicyInput, ToolResult } from '../types.js';
import type { AgentPolicy } from '../../types.js';

export interface GetPolicyOptions {
  policyStore: PolicyStore;
}

export async function executeGetPolicy(
  input: GetPolicyInput,
  options: GetPolicyOptions
): Promise<ToolResult> {
  const { policyStore } = options;

  const policy = await policyStore.getPolicy(input.agentId);

  if (!policy) {
    return {
      success: false,
      error: `No policy found for agent: ${input.agentId}`,
    };
  }

  return {
    success: true,
    data: {
      agentId: input.agentId,
      policy,
    },
  };
}

export function formatGetPolicyResult(result: ToolResult): string {
  if (!result.success) {
    return `## Policy Query Failed\n\n**Error:** ${result.error}`;
  }

  const data = result.data as { agentId: string; policy: AgentPolicy };
  const { agentId, policy } = data;

  const lines: string[] = ['## Agent Policy\n'];

  lines.push(`**Agent ID:** \`${agentId}\`\n`);
  lines.push(`**Status:** ${policy.enabled ? '✅ Enabled' : '❌ Disabled'}\n`);

  if (policy.requireApproval) {
    lines.push('**Manual Approval:** Required\n');
  }

  // Spending Limits
  if (policy.limits) {
    lines.push('\n### Spending Limits\n');
    lines.push('| Period | Limit |\n');
    lines.push('|--------|-------|\n');

    if (policy.limits.perTransaction) {
      lines.push(`| Per Transaction | ${formatLimit(policy.limits.perTransaction)} |\n`);
    }
    if (policy.limits.hourly) {
      lines.push(`| Hourly | ${formatLimit(policy.limits.hourly)} |\n`);
    }
    if (policy.limits.daily) {
      lines.push(`| Daily | ${formatLimit(policy.limits.daily)} |\n`);
    }
    if (policy.limits.weekly) {
      lines.push(`| Weekly | ${formatLimit(policy.limits.weekly)} |\n`);
    }
    if (policy.limits.monthly) {
      lines.push(`| Monthly | ${formatLimit(policy.limits.monthly)} |\n`);
    }
  }

  // Time Rules
  if (policy.timeRules) {
    lines.push('\n### Time Rules\n');

    if (policy.timeRules.allowedWindows && policy.timeRules.allowedWindows.length > 0) {
      lines.push('**Allowed Windows:**\n');
      for (const window of policy.timeRules.allowedWindows) {
        const days = window.days.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ');
        lines.push(`- ${days}: ${window.startHour}:00 - ${window.endHour}:00 UTC\n`);
      }
    }

    if (policy.timeRules.blockedPeriods && policy.timeRules.blockedPeriods.length > 0) {
      lines.push('**Blocked Periods:**\n');
      for (const period of policy.timeRules.blockedPeriods) {
        lines.push(`- ${period.start.toISOString()} to ${period.end.toISOString()}`);
        if (period.reason) {
          lines.push(` (${period.reason})`);
        }
        lines.push('\n');
      }
    }
  }

  // Merchant Rules
  if (policy.merchantRules) {
    lines.push('\n### Merchant Rules\n');

    if (policy.merchantRules.requireWhitelist) {
      lines.push('**Mode:** Whitelist only\n');
    }

    if (policy.merchantRules.whitelist && policy.merchantRules.whitelist.length > 0) {
      lines.push(`**Whitelist:** ${policy.merchantRules.whitelist.length} addresses\n`);
      for (const addr of policy.merchantRules.whitelist.slice(0, 5)) {
        lines.push(`- \`${addr}\`\n`);
      }
      if (policy.merchantRules.whitelist.length > 5) {
        lines.push(`- ... and ${policy.merchantRules.whitelist.length - 5} more\n`);
      }
    }

    if (policy.merchantRules.blacklist && policy.merchantRules.blacklist.length > 0) {
      lines.push(`**Blacklist:** ${policy.merchantRules.blacklist.length} addresses\n`);
      for (const addr of policy.merchantRules.blacklist.slice(0, 5)) {
        lines.push(`- \`${addr}\`\n`);
      }
      if (policy.merchantRules.blacklist.length > 5) {
        lines.push(`- ... and ${policy.merchantRules.blacklist.length - 5} more\n`);
      }
    }
  }

  // Network Rules
  if (policy.networkRules) {
    lines.push('\n### Network Rules\n');

    if (policy.networkRules.allowedNetworks && policy.networkRules.allowedNetworks.length > 0) {
      lines.push('**Allowed Networks:**\n');
      for (const network of policy.networkRules.allowedNetworks) {
        lines.push(`- \`${network}\`\n`);
      }
    }

    if (policy.networkRules.blockedNetworks && policy.networkRules.blockedNetworks.length > 0) {
      lines.push('**Blocked Networks:**\n');
      for (const network of policy.networkRules.blockedNetworks) {
        lines.push(`- \`${network}\`\n`);
      }
    }
  }

  // Category Rules
  if (policy.categoryRules) {
    lines.push('\n### Category Rules\n');

    if (policy.categoryRules.allowedCategories && policy.categoryRules.allowedCategories.length > 0) {
      lines.push('**Allowed Categories:**\n');
      for (const category of policy.categoryRules.allowedCategories) {
        lines.push(`- \`${category}\`\n`);
      }
    }

    if (policy.categoryRules.blockedCategories && policy.categoryRules.blockedCategories.length > 0) {
      lines.push('**Blocked Categories:**\n');
      for (const category of policy.categoryRules.blockedCategories) {
        lines.push(`- \`${category}\`\n`);
      }
    }
  }

  return lines.join('');
}

function formatLimit(amount: { value: string; decimals: number; symbol?: string }): string {
  const symbol = amount.symbol ?? 'USDT';
  const bigValue = BigInt(amount.value);
  const divisor = BigInt(10 ** amount.decimals);
  const integerPart = bigValue / divisor;
  const fractionalPart = bigValue % divisor;

  const fractionalStr = fractionalPart.toString().padStart(amount.decimals, '0').replace(/0+$/, '');

  if (fractionalStr) {
    return `${integerPart}.${fractionalStr} ${symbol}`;
  }
  return `${integerPart} ${symbol}`;
}
