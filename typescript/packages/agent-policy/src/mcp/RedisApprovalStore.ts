/**
 * Redis-backed Approval Store
 *
 * Provides persistent storage for pending approvals using Redis.
 */

import type { Redis } from 'ioredis';
import type { ApprovalStore } from './ApprovalManager.js';
import type { ApprovalStatus, PendingApproval } from '../types.js';

export interface RedisApprovalStoreConfig {
  /** Redis client instance */
  redis: Redis;
  /** Key prefix for approval storage (default: "agent-policy:approvals:") */
  keyPrefix?: string;
  /** TTL in seconds for resolved approvals (default: 7 days) */
  resolvedTtl?: number;
}

/**
 * Redis-backed implementation of ApprovalStore
 *
 * Key structure:
 * - Individual approvals: {keyPrefix}approval:{id}
 * - Pending index: {keyPrefix}pending (SET of approval IDs)
 * - Agent index: {keyPrefix}agent:{agentId} (SET of approval IDs)
 * - Status index: {keyPrefix}status:{status} (SET of approval IDs)
 */
export class RedisApprovalStore implements ApprovalStore {
  private readonly redis: Redis;
  private readonly keyPrefix: string;
  private readonly resolvedTtl: number;

  constructor(config: RedisApprovalStoreConfig) {
    this.redis = config.redis;
    this.keyPrefix = config.keyPrefix ?? 'agent-policy:approvals:';
    this.resolvedTtl = config.resolvedTtl ?? 604800; // 7 days
  }

  private getApprovalKey(id: string): string {
    return `${this.keyPrefix}approval:${id}`;
  }

  private getPendingIndexKey(): string {
    return `${this.keyPrefix}pending`;
  }

  private getAgentIndexKey(agentId: string): string {
    return `${this.keyPrefix}agent:${agentId}`;
  }

  private getStatusIndexKey(status: ApprovalStatus): string {
    return `${this.keyPrefix}status:${status}`;
  }

  async getApproval(id: string): Promise<PendingApproval | null> {
    const data = await this.redis.get(this.getApprovalKey(id));

    if (!data) {
      return null;
    }

    try {
      const parsed = JSON.parse(data);
      // Convert date strings back to Date objects
      return {
        ...parsed,
        createdAt: new Date(parsed.createdAt),
        expiresAt: new Date(parsed.expiresAt),
        escalatedAt: parsed.escalatedAt ? new Date(parsed.escalatedAt) : undefined,
        resolvedAt: parsed.resolvedAt ? new Date(parsed.resolvedAt) : undefined,
        currentApprovals: parsed.currentApprovals.map((a: any) => ({
          ...a,
          timestamp: new Date(a.timestamp),
        })),
      };
    } catch {
      return null;
    }
  }

  async saveApproval(approval: PendingApproval): Promise<void> {
    const key = this.getApprovalKey(approval.id);
    const data = JSON.stringify(approval);

    const pipeline = this.redis.pipeline();

    // Store the approval
    if (approval.status === 'pending' || approval.status === 'escalated') {
      pipeline.set(key, data);
    } else {
      // Resolved approvals get TTL
      pipeline.setex(key, this.resolvedTtl, data);
    }

    // Update indexes
    const oldApproval = await this.getApproval(approval.id);
    if (oldApproval) {
      // Remove from old status index
      pipeline.srem(this.getStatusIndexKey(oldApproval.status), approval.id);
      if (oldApproval.status === 'pending') {
        pipeline.srem(this.getPendingIndexKey(), approval.id);
      }
    }

    // Add to new status index
    pipeline.sadd(this.getStatusIndexKey(approval.status), approval.id);

    // Add to pending index if pending
    if (approval.status === 'pending') {
      pipeline.sadd(this.getPendingIndexKey(), approval.id);
    } else {
      pipeline.srem(this.getPendingIndexKey(), approval.id);
    }

    // Add to agent index
    pipeline.sadd(this.getAgentIndexKey(approval.agentId), approval.id);

    await pipeline.exec();
  }

  async deleteApproval(id: string): Promise<boolean> {
    const approval = await this.getApproval(id);
    if (!approval) {
      return false;
    }

    const pipeline = this.redis.pipeline();

    // Delete the approval
    pipeline.del(this.getApprovalKey(id));

    // Remove from all indexes
    pipeline.srem(this.getPendingIndexKey(), id);
    pipeline.srem(this.getStatusIndexKey(approval.status), id);
    pipeline.srem(this.getAgentIndexKey(approval.agentId), id);

    await pipeline.exec();
    return true;
  }

  async listPendingApprovals(agentId?: string): Promise<PendingApproval[]> {
    let ids: string[];

    if (agentId) {
      // Get agent's approvals and intersect with pending
      const agentApprovals = await this.redis.smembers(this.getAgentIndexKey(agentId));
      const pendingApprovals = await this.redis.smembers(this.getPendingIndexKey());
      ids = agentApprovals.filter((id) => pendingApprovals.includes(id));
    } else {
      ids = await this.redis.smembers(this.getPendingIndexKey());
    }

    if (ids.length === 0) {
      return [];
    }

    const results: PendingApproval[] = [];
    for (const id of ids) {
      const approval = await this.getApproval(id);
      if (approval && approval.status === 'pending') {
        results.push(approval);
      }
    }

    return results;
  }

  async listApprovalsByStatus(status: ApprovalStatus): Promise<PendingApproval[]> {
    const ids = await this.redis.smembers(this.getStatusIndexKey(status));

    if (ids.length === 0) {
      return [];
    }

    const results: PendingApproval[] = [];
    for (const id of ids) {
      const approval = await this.getApproval(id);
      if (approval && approval.status === status) {
        results.push(approval);
      }
    }

    return results;
  }

  /**
   * Clean up expired approvals
   */
  async cleanupExpired(): Promise<number> {
    const pendingIds = await this.redis.smembers(this.getPendingIndexKey());
    const now = new Date();
    let cleaned = 0;

    for (const id of pendingIds) {
      const approval = await this.getApproval(id);
      if (approval && approval.status === 'pending' && now > approval.expiresAt) {
        approval.status = 'expired';
        approval.resolvedAt = now;
        await this.saveApproval(approval);
        cleaned++;
      }
    }

    return cleaned;
  }
}
