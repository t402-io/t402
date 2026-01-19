/**
 * Redis-based Limit Store
 */

import type { Redis } from 'ioredis';
import type { LimitStore } from './types.js';

export class RedisLimitStore implements LimitStore {
  constructor(private readonly redis: Redis) {}

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.redis.setex(key, ttl, value);
    } else {
      await this.redis.set(key, value);
    }
  }

  async increment(key: string, amount: number, ttl?: number): Promise<number> {
    const result = await this.redis.incrbyfloat(key, amount);
    if (ttl) {
      await this.redis.expire(key, ttl);
    }
    return parseFloat(result);
  }

  async decrement(key: string, amount: number): Promise<number> {
    const result = await this.redis.incrbyfloat(key, -amount);
    return parseFloat(result);
  }
}
