/**
 * confirm tool - Confirm a payment reservation
 */

import type { SpendingLimiter } from '../../limits/SpendingLimiter.js';
import type { ConfirmPaymentInput, ToolResult } from '../types.js';

export interface ConfirmPaymentOptions {
  spendingLimiter: SpendingLimiter;
  demoMode?: boolean;
}

export async function executeConfirmPayment(
  input: ConfirmPaymentInput,
  options: ConfirmPaymentOptions
): Promise<ToolResult> {
  const { spendingLimiter, demoMode } = options;

  if (demoMode) {
    return {
      success: true,
      data: {
        reservationId: input.reservationId,
        status: 'confirmed',
        demoMode: true,
        note: 'Demo mode - no actual confirmation',
      },
    };
  }

  try {
    await spendingLimiter.confirm(input.reservationId);

    return {
      success: true,
      data: {
        reservationId: input.reservationId,
        status: 'confirmed',
        message: 'Payment reservation confirmed successfully',
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to confirm reservation',
    };
  }
}

export function formatConfirmPaymentResult(result: ToolResult): string {
  if (!result.success) {
    return `## Confirmation Failed\n\n**Error:** ${result.error}`;
  }

  const data = result.data as {
    reservationId: string;
    status: string;
    message?: string;
    demoMode?: boolean;
    note?: string;
  };

  const lines: string[] = ['## Payment Confirmed\n'];

  lines.push(`**Reservation ID:** \`${data.reservationId}\`\n`);
  lines.push(`**Status:** ✅ ${data.status}\n`);

  if (data.message) {
    lines.push(`\n${data.message}\n`);
  }

  lines.push('\n> The reserved budget has been permanently deducted from the agent\'s limits.\n');

  if (data.demoMode) {
    lines.push(`\n---\n*${data.note}*`);
  }

  return lines.join('');
}
