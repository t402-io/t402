/**
 * Spending Limiter - Real-time limit enforcement
 */

import type { Amount, SpendingLimits } from '../types.js';
import type { LimitStore, LimitCheckResult } from './types.js';
import { v4 as uuidv4 } from 'uuid';

export interface SpendingLimiterConfig {
  store: LimitStore;
  reservationTtl?: number; // milliseconds, default 5 minutes
}

export class SpendingLimiter {
  private readonly store: LimitStore;
  private readonly reservationTtl: number;
  private readonly reservations = new Map<string, {
    agentId: string;
    amount: Amount;
    period: string;
    expiresAt: Date;
  }>();

  constructor(config: SpendingLimiterConfig) {
    this.store = config.store;
    this.reservationTtl = config.reservationTtl || 5 * 60 * 1000;
  }

  /**
   * Check if a payment is allowed and reserve the amount
   */
  async checkAndReserve(
    agentId: string,
    amount: Amount,
    limits: SpendingLimits
  ): Promise<LimitCheckResult> {
    const periods: Array<{
      key: keyof SpendingLimits;
      name: string;
      ttl: number;
    }> = [
      { key: 'perTransaction', name: 'per_transaction', ttl: 0 },
      { key: 'hourly', name: 'hourly', ttl: 3600 },
      { key: 'daily', name: 'daily', ttl: 86400 },
      { key: 'weekly', name: 'weekly', ttl: 604800 },
      { key: 'monthly', name: 'monthly', ttl: 2592000 },
    ];

    const amountValue = Number(amount.value);

    for (const period of periods) {
      const limit = limits[period.key];
      if (!limit) continue;

      const limitValue = Number(limit.value);

      if (period.key === 'perTransaction') {
        // Per-transaction check - no accumulation
        if (amountValue > limitValue) {
          return {
            allowed: false,
            reason: `Amount ${amountValue} exceeds per-transaction limit ${limitValue}`,
            currentSpending: '0',
            limit: limit.value,
            period: period.name,
          };
        }
        continue;
      }

      // Check accumulated spending
      const key = this.getSpendingKey(agentId, period.name);
      const currentStr = await this.store.get(key);
      const current = currentStr ? Number(currentStr) : 0;

      if (current + amountValue > limitValue) {
        return {
          allowed: false,
          reason: `Would exceed ${period.name} limit: ${current + amountValue} > ${limitValue}`,
          currentSpending: String(current),
          limit: limit.value,
          period: period.name,
        };
      }
    }

    // All checks passed - create reservation
    const reservationId = uuidv4();
    const expiresAt = new Date(Date.now() + this.reservationTtl);

    // Reserve amount in all applicable periods
    for (const period of periods) {
      if (period.key === 'perTransaction') continue;
      if (!limits[period.key]) continue;

      const key = this.getSpendingKey(agentId, period.name);
      await this.store.increment(key, amountValue, period.ttl);
    }

    this.reservations.set(reservationId, {
      agentId,
      amount,
      period: 'all',
      expiresAt,
    });

    return {
      allowed: true,
      reservationId,
      currentSpending: '0', // Would need to track this properly
      limit: '0',
      period: 'all',
    };
  }

  /**
   * Confirm a reservation (payment succeeded)
   */
  async confirm(reservationId: string): Promise<void> {
    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      throw new Error(`Reservation ${reservationId} not found`);
    }

    // Reservation is already applied, just remove from tracking
    this.reservations.delete(reservationId);
  }

  /**
   * Release a reservation (payment failed)
   */
  async release(reservationId: string): Promise<void> {
    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      throw new Error(`Reservation ${reservationId} not found`);
    }

    const amountValue = Number(reservation.amount.value);

    // Decrement from all periods
    const periods = ['hourly', 'daily', 'weekly', 'monthly'];
    for (const period of periods) {
      const key = this.getSpendingKey(reservation.agentId, period);
      await this.store.decrement(key, amountValue);
    }

    this.reservations.delete(reservationId);
  }

  /**
   * Get remaining budget for a period
   */
  async getRemainingBudget(
    agentId: string,
    period: 'hourly' | 'daily' | 'weekly' | 'monthly',
    limits: SpendingLimits
  ): Promise<{ spent: string; limit: string; remaining: string }> {
    const limit = limits[period];
    if (!limit) {
      return { spent: '0', limit: 'unlimited', remaining: 'unlimited' };
    }

    const key = this.getSpendingKey(agentId, period);
    const spentStr = await this.store.get(key);
    const spent = spentStr ? Number(spentStr) : 0;
    const limitValue = Number(limit.value);
    const remaining = Math.max(0, limitValue - spent);

    return {
      spent: String(spent),
      limit: limit.value,
      remaining: String(remaining),
    };
  }

  private getSpendingKey(agentId: string, period: string): string {
    const windowStart = this.getWindowStart(period);
    return `t402:limits:${agentId}:${period}:${windowStart}`;
  }

  private getWindowStart(period: string): number {
    const now = new Date();
    switch (period) {
      case 'hourly':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()).getTime();
      case 'daily':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      case 'weekly':
        const day = now.getDay();
        const diff = now.getDate() - day;
        return new Date(now.getFullYear(), now.getMonth(), diff).getTime();
      case 'monthly':
        return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      default:
        return now.getTime();
    }
  }
}
