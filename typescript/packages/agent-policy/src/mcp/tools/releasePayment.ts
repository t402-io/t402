/**
 * release tool - Release a payment reservation
 */

import type { SpendingLimiter } from '../../limits/SpendingLimiter.js';
import type { ReleasePaymentInput, ToolResult } from '../types.js';

export interface ReleasePaymentOptions {
  spendingLimiter: SpendingLimiter;
  demoMode?: boolean;
}

export async function executeReleasePayment(
  input: ReleasePaymentInput,
  options: ReleasePaymentOptions
): Promise<ToolResult> {
  const { spendingLimiter, demoMode } = options;

  if (demoMode) {
    return {
      success: true,
      data: {
        reservationId: input.reservationId,
        status: 'released',
        demoMode: true,
        note: 'Demo mode - no actual release',
      },
    };
  }

  try {
    await spendingLimiter.release(input.reservationId);

    return {
      success: true,
      data: {
        reservationId: input.reservationId,
        status: 'released',
        message: 'Payment reservation released successfully',
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to release reservation',
    };
  }
}

export function formatReleasePaymentResult(result: ToolResult): string {
  if (!result.success) {
    return `## Release Failed\n\n**Error:** ${result.error}`;
  }

  const data = result.data as {
    reservationId: string;
    status: string;
    message?: string;
    demoMode?: boolean;
    note?: string;
  };

  const lines: string[] = ['## Payment Released\n'];

  lines.push(`**Reservation ID:** \`${data.reservationId}\`\n`);
  lines.push(`**Status:** 🔄 ${data.status}\n`);

  if (data.message) {
    lines.push(`\n${data.message}\n`);
  }

  lines.push('\n> The reserved budget has been returned to the agent\'s available limits.\n');

  if (data.demoMode) {
    lines.push(`\n---\n*${data.note}*`);
  }

  return lines.join('');
}
