/**
 * set tool - Set or update agent policy
 */

import type { PolicyStore, SetPolicyInput, ToolResult } from '../types.js';
import type { AgentPolicy } from '../../types.js';

export interface SetPolicyOptions {
  policyStore: PolicyStore;
  demoMode?: boolean;
}

export async function executeSetPolicy(
  input: SetPolicyInput,
  options: SetPolicyOptions
): Promise<ToolResult> {
  const { policyStore, demoMode } = options;

  // Convert input to AgentPolicy
  const policy: AgentPolicy = {
    enabled: input.policy.enabled ?? true,
    requireApproval: input.policy.requireApproval,
  };

  // Convert limits
  if (input.policy.limits) {
    policy.limits = {};
    if (input.policy.limits.perTransaction) {
      policy.limits.perTransaction = {
        value: input.policy.limits.perTransaction.value,
        decimals: input.policy.limits.perTransaction.decimals ?? 6,
        symbol: input.policy.limits.perTransaction.symbol ?? 'USDT',
      };
    }
    if (input.policy.limits.hourly) {
      policy.limits.hourly = {
        value: input.policy.limits.hourly.value,
        decimals: input.policy.limits.hourly.decimals ?? 6,
        symbol: input.policy.limits.hourly.symbol ?? 'USDT',
      };
    }
    if (input.policy.limits.daily) {
      policy.limits.daily = {
        value: input.policy.limits.daily.value,
        decimals: input.policy.limits.daily.decimals ?? 6,
        symbol: input.policy.limits.daily.symbol ?? 'USDT',
      };
    }
    if (input.policy.limits.weekly) {
      policy.limits.weekly = {
        value: input.policy.limits.weekly.value,
        decimals: input.policy.limits.weekly.decimals ?? 6,
        symbol: input.policy.limits.weekly.symbol ?? 'USDT',
      };
    }
    if (input.policy.limits.monthly) {
      policy.limits.monthly = {
        value: input.policy.limits.monthly.value,
        decimals: input.policy.limits.monthly.decimals ?? 6,
        symbol: input.policy.limits.monthly.symbol ?? 'USDT',
      };
    }
  }

  // Convert time rules
  if (input.policy.timeRules) {
    policy.timeRules = {
      timezone: input.policy.timeRules.timezone ?? 'UTC',
    };
    if (input.policy.timeRules.allowedWindows) {
      policy.timeRules.allowedWindows = input.policy.timeRules.allowedWindows;
    }
  }

  // Convert merchant rules
  if (input.policy.merchantRules) {
    policy.merchantRules = {
      whitelist: input.policy.merchantRules.whitelist,
      blacklist: input.policy.merchantRules.blacklist,
      requireWhitelist: input.policy.merchantRules.requireWhitelist ?? false,
    };
  }

  // Convert network rules
  if (input.policy.networkRules) {
    policy.networkRules = {
      allowedNetworks: input.policy.networkRules.allowedNetworks,
      blockedNetworks: input.policy.networkRules.blockedNetworks,
    };
  }

  // Convert category rules
  if (input.policy.categoryRules) {
    policy.categoryRules = {
      allowedCategories: input.policy.categoryRules.allowedCategories,
      blockedCategories: input.policy.categoryRules.blockedCategories,
    };
  }

  // Always save the policy (even in demo mode for in-memory testing)
  await policyStore.setPolicy(input.agentId, policy);

  if (demoMode) {
    return {
      success: true,
      data: {
        agentId: input.agentId,
        policy,
        message: 'Policy updated successfully',
        demoMode: true,
        note: 'Demo mode - changes are in-memory only',
      },
    };
  }

  return {
    success: true,
    data: {
      agentId: input.agentId,
      policy,
      message: 'Policy updated successfully',
    },
  };
}

export function formatSetPolicyResult(result: ToolResult): string {
  if (!result.success) {
    return `## Policy Update Failed\n\n**Error:** ${result.error}`;
  }

  const data = result.data as {
    agentId: string;
    policy: AgentPolicy;
    message?: string;
    demoMode?: boolean;
    note?: string;
  };

  const lines: string[] = ['## Policy Updated\n'];

  lines.push(`**Agent ID:** \`${data.agentId}\`\n`);
  lines.push(`**Status:** ✅ ${data.message || 'Success'}\n`);

  // Summary of configured rules
  const configured: string[] = [];

  if (data.policy.limits) {
    const limitCount = Object.keys(data.policy.limits).length;
    configured.push(`${limitCount} spending limit(s)`);
  }

  if (data.policy.timeRules?.allowedWindows?.length) {
    configured.push(`${data.policy.timeRules.allowedWindows.length} time window(s)`);
  }

  if (data.policy.merchantRules?.whitelist?.length) {
    configured.push(`${data.policy.merchantRules.whitelist.length} whitelisted merchant(s)`);
  }

  if (data.policy.merchantRules?.blacklist?.length) {
    configured.push(`${data.policy.merchantRules.blacklist.length} blacklisted merchant(s)`);
  }

  if (data.policy.networkRules?.allowedNetworks?.length) {
    configured.push(`${data.policy.networkRules.allowedNetworks.length} allowed network(s)`);
  }

  if (data.policy.categoryRules?.allowedCategories?.length) {
    configured.push(`${data.policy.categoryRules.allowedCategories.length} allowed category(ies)`);
  }

  if (data.policy.categoryRules?.blockedCategories?.length) {
    configured.push(`${data.policy.categoryRules.blockedCategories.length} blocked category(ies)`);
  }

  if (configured.length > 0) {
    lines.push('\n### Configured Rules\n');
    for (const item of configured) {
      lines.push(`- ${item}\n`);
    }
  }

  if (data.policy.requireApproval) {
    lines.push('\n⚠️ **Manual approval is required for all payments.**\n');
  }

  if (data.demoMode) {
    lines.push(`\n---\n*${data.note}*`);
  }

  return lines.join('');
}
