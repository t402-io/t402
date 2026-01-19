/**
 * budget tool - Get remaining budget for an agent
 */

import type { SpendingLimiter } from '../../limits/SpendingLimiter.js';
import type { PolicyStore, GetRemainingBudgetInput, ToolResult } from '../types.js';
import type { BudgetInfo, LimitPeriod } from '../../types.js';

export interface GetRemainingBudgetOptions {
  spendingLimiter: SpendingLimiter;
  policyStore: PolicyStore;
  demoMode?: boolean;
}

export async function executeGetRemainingBudget(
  input: GetRemainingBudgetInput,
  options: GetRemainingBudgetOptions
): Promise<ToolResult> {
  const { spendingLimiter, policyStore } = options;

  // Get agent policy
  const policy = await policyStore.getPolicy(input.agentId);

  if (!policy) {
    return {
      success: false,
      error: `No policy found for agent: ${input.agentId}`,
    };
  }

  if (!policy.limits) {
    return {
      success: true,
      data: {
        agentId: input.agentId,
        period: input.period,
        limit: 'unlimited',
        spent: '0',
        remaining: 'unlimited',
      },
    };
  }

  const budget = await spendingLimiter.getRemainingBudget(
    input.agentId,
    input.period as LimitPeriod,
    policy.limits
  );

  return {
    success: true,
    data: {
      agentId: input.agentId,
      period: input.period,
      ...budget,
    },
  };
}

export function formatGetRemainingBudgetResult(result: ToolResult): string {
  if (!result.success) {
    return `## Budget Query Failed\n\n**Error:** ${result.error}`;
  }

  const data = result.data as {
    agentId: string;
    period: string;
    limit: string;
    spent: string;
    remaining: string;
  };

  const lines: string[] = ['## Budget Status\n'];

  lines.push(`**Agent:** \`${data.agentId}\`\n`);
  lines.push(`**Period:** ${data.period}\n`);
  lines.push('\n### Amounts\n');

  if (data.limit === 'unlimited') {
    lines.push('| Metric | Value |\n');
    lines.push('|--------|-------|\n');
    lines.push('| Limit | Unlimited |\n');
    lines.push(`| Spent | ${formatAmount(data.spent)} |\n`);
    lines.push('| Remaining | Unlimited |\n');
  } else {
    const limit = BigInt(data.limit);
    const spent = BigInt(data.spent);
    const remaining = BigInt(data.remaining);
    const usagePercent = limit > 0n ? Number((spent * 100n) / limit) : 0;

    lines.push('| Metric | Value |\n');
    lines.push('|--------|-------|\n');
    lines.push(`| Limit | ${formatAmount(data.limit)} |\n`);
    lines.push(`| Spent | ${formatAmount(data.spent)} (${usagePercent}%) |\n`);
    lines.push(`| Remaining | ${formatAmount(data.remaining)} |\n`);

    // Visual progress bar
    const barLength = 20;
    const filledLength = Math.round((usagePercent / 100) * barLength);
    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
    lines.push(`\n**Usage:** [${bar}] ${usagePercent}%\n`);

    if (usagePercent >= 90) {
      lines.push('\n⚠️ **Warning:** Budget is nearly exhausted!\n');
    } else if (usagePercent >= 75) {
      lines.push('\n⚡ **Notice:** Budget is getting low.\n');
    }
  }

  return lines.join('');
}

function formatAmount(value: string, decimals = 6): string {
  if (value === 'unlimited' || value === '0') {
    return value === '0' ? '0 USDT' : 'Unlimited';
  }

  const bigValue = BigInt(value);
  const divisor = BigInt(10 ** decimals);
  const integerPart = bigValue / divisor;
  const fractionalPart = bigValue % divisor;

  const fractionalStr = fractionalPart.toString().padStart(decimals, '0').replace(/0+$/, '');

  if (fractionalStr) {
    return `${integerPart}.${fractionalStr} USDT`;
  }
  return `${integerPart} USDT`;
}
