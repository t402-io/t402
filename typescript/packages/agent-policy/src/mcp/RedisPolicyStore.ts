/**
 * Redis-backed Policy Store
 *
 * Provides persistent storage for agent policies using Redis.
 * Policies are stored as JSON strings with keys prefixed by "policy:".
 */

import type { Redis } from 'ioredis';
import type { PolicyStore } from './types.js';
import type { AgentPolicy } from '../types.js';

/**
 * Configuration options for RedisPolicyStore
 */
export interface RedisPolicyStoreConfig {
  /** Redis client instance */
  redis: Redis;
  /** Key prefix for policy storage (default: "agent-policy:") */
  keyPrefix?: string;
  /** TTL in seconds for policies (optional, no expiry by default) */
  ttl?: number;
}

/**
 * Redis-backed implementation of PolicyStore
 *
 * Key structure:
 * - Individual policies: {keyPrefix}policy:{agentId}
 * - Agent index: {keyPrefix}agents (SET of all agent IDs)
 * - Org index: {keyPrefix}org:{orgId} (SET of agent IDs for org)
 */
export class RedisPolicyStore implements PolicyStore {
  private readonly redis: Redis;
  private readonly keyPrefix: string;
  private readonly ttl?: number;

  constructor(config: RedisPolicyStoreConfig) {
    this.redis = config.redis;
    this.keyPrefix = config.keyPrefix ?? 'agent-policy:';
    this.ttl = config.ttl;
  }

  /**
   * Get the Redis key for a policy
   */
  private getPolicyKey(agentId: string): string {
    return `${this.keyPrefix}policy:${agentId}`;
  }

  /**
   * Get the Redis key for the agents index
   */
  private getAgentsIndexKey(): string {
    return `${this.keyPrefix}agents`;
  }

  /**
   * Get the Redis key for an organization's agent index
   */
  private getOrgIndexKey(orgId: string): string {
    return `${this.keyPrefix}org:${orgId}`;
  }

  /**
   * Extract organization ID from agent ID if present
   * Convention: agentId can be "orgId:agentName" or just "agentName"
   */
  private extractOrgId(agentId: string): string | null {
    const colonIndex = agentId.indexOf(':');
    if (colonIndex > 0) {
      return agentId.substring(0, colonIndex);
    }
    return null;
  }

  /**
   * Get a policy by agent ID
   */
  async getPolicy(agentId: string): Promise<AgentPolicy | null> {
    const key = this.getPolicyKey(agentId);
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data) as AgentPolicy;
    } catch {
      // Invalid JSON, treat as not found
      return null;
    }
  }

  /**
   * Set a policy for an agent
   */
  async setPolicy(agentId: string, policy: AgentPolicy): Promise<void> {
    const key = this.getPolicyKey(agentId);
    const data = JSON.stringify(policy);

    // Use pipeline for atomic operation
    const pipeline = this.redis.pipeline();

    // Store the policy
    if (this.ttl) {
      pipeline.setex(key, this.ttl, data);
    } else {
      pipeline.set(key, data);
    }

    // Add to agents index
    pipeline.sadd(this.getAgentsIndexKey(), agentId);

    // Add to org index if applicable
    const orgId = this.extractOrgId(agentId);
    if (orgId) {
      pipeline.sadd(this.getOrgIndexKey(orgId), agentId);
    }

    await pipeline.exec();
  }

  /**
   * Delete a policy
   */
  async deletePolicy(agentId: string): Promise<boolean> {
    const key = this.getPolicyKey(agentId);

    // Check if exists
    const exists = await this.redis.exists(key);
    if (!exists) {
      return false;
    }

    // Use pipeline for atomic operation
    const pipeline = this.redis.pipeline();

    // Delete the policy
    pipeline.del(key);

    // Remove from agents index
    pipeline.srem(this.getAgentsIndexKey(), agentId);

    // Remove from org index if applicable
    const orgId = this.extractOrgId(agentId);
    if (orgId) {
      pipeline.srem(this.getOrgIndexKey(orgId), agentId);
    }

    await pipeline.exec();
    return true;
  }

  /**
   * List all policies, optionally filtered by organization
   */
  async listPolicies(
    orgId?: string
  ): Promise<Array<{ agentId: string; policy: AgentPolicy }>> {
    // Get agent IDs from appropriate index
    let agentIds: string[];

    if (orgId) {
      // Get agents for specific org
      agentIds = await this.redis.smembers(this.getOrgIndexKey(orgId));
    } else {
      // Get all agents
      agentIds = await this.redis.smembers(this.getAgentsIndexKey());
    }

    if (agentIds.length === 0) {
      return [];
    }

    // Fetch all policies in batch
    const keys = agentIds.map((id) => this.getPolicyKey(id));
    const values = await this.redis.mget(...keys);

    // Parse and filter valid policies
    const results: Array<{ agentId: string; policy: AgentPolicy }> = [];

    for (let i = 0; i < agentIds.length; i++) {
      const data = values[i];
      if (data) {
        try {
          const policy = JSON.parse(data) as AgentPolicy;
          results.push({ agentId: agentIds[i], policy });
        } catch {
          // Skip invalid JSON
        }
      }
    }

    return results;
  }

  /**
   * Check if a policy exists
   */
  async hasPolicy(agentId: string): Promise<boolean> {
    const key = this.getPolicyKey(agentId);
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  /**
   * Get multiple policies at once
   */
  async getPolicies(
    agentIds: string[]
  ): Promise<Map<string, AgentPolicy | null>> {
    if (agentIds.length === 0) {
      return new Map();
    }

    const keys = agentIds.map((id) => this.getPolicyKey(id));
    const values = await this.redis.mget(...keys);

    const results = new Map<string, AgentPolicy | null>();

    for (let i = 0; i < agentIds.length; i++) {
      const data = values[i];
      if (data) {
        try {
          results.set(agentIds[i], JSON.parse(data) as AgentPolicy);
        } catch {
          results.set(agentIds[i], null);
        }
      } else {
        results.set(agentIds[i], null);
      }
    }

    return results;
  }

  /**
   * Set multiple policies at once
   */
  async setPolicies(
    policies: Array<{ agentId: string; policy: AgentPolicy }>
  ): Promise<void> {
    if (policies.length === 0) {
      return;
    }

    const pipeline = this.redis.pipeline();

    for (const { agentId, policy } of policies) {
      const key = this.getPolicyKey(agentId);
      const data = JSON.stringify(policy);

      if (this.ttl) {
        pipeline.setex(key, this.ttl, data);
      } else {
        pipeline.set(key, data);
      }

      pipeline.sadd(this.getAgentsIndexKey(), agentId);

      const orgId = this.extractOrgId(agentId);
      if (orgId) {
        pipeline.sadd(this.getOrgIndexKey(orgId), agentId);
      }
    }

    await pipeline.exec();
  }

  /**
   * Delete all policies (use with caution!)
   */
  async clear(): Promise<void> {
    // Get all agent IDs
    const agentIds = await this.redis.smembers(this.getAgentsIndexKey());

    if (agentIds.length === 0) {
      return;
    }

    const pipeline = this.redis.pipeline();

    // Delete all policy keys
    for (const agentId of agentIds) {
      pipeline.del(this.getPolicyKey(agentId));
    }

    // Delete agents index
    pipeline.del(this.getAgentsIndexKey());

    // Delete org indexes
    const orgIds = new Set<string>();
    for (const agentId of agentIds) {
      const orgId = this.extractOrgId(agentId);
      if (orgId) {
        orgIds.add(orgId);
      }
    }
    for (const orgId of orgIds) {
      pipeline.del(this.getOrgIndexKey(orgId));
    }

    await pipeline.exec();
  }

  /**
   * Get count of policies
   */
  async count(): Promise<number> {
    return this.redis.scard(this.getAgentsIndexKey());
  }

  /**
   * Get count of policies for an organization
   */
  async countByOrg(orgId: string): Promise<number> {
    return this.redis.scard(this.getOrgIndexKey(orgId));
  }
}
