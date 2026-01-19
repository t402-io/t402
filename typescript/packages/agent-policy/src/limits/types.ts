/**
 * Types for Spending Limits
 */

import type { Amount, SpendingLimits } from '../types.js';

export interface LimitCheckResult {
  allowed: boolean;
  reservationId?: string;
  reason?: string;
  currentSpending: string;
  limit: string;
  period: string;
}

export interface ReservationResult {
  id: string;
  agentId: string;
  amount: Amount;
  expiresAt: Date;
}

export interface LimitStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  increment(key: string, amount: number, ttl?: number): Promise<number>;
  decrement(key: string, amount: number): Promise<number>;
}
