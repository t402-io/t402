import { describe, it, expect } from 'vitest';
import {
  PolicySchema,
  AmountSchema,
  SpendingLimitsSchema,
  TimeRulesSchema,
  MerchantRulesSchema,
  AuthorizationRequestSchema,
} from '../src/types.js';

describe('Type Schemas', () => {
  describe('AmountSchema', () => {
    it('should validate valid amount', () => {
      const amount = {
        value: '1000000',
        decimals: 6,
        symbol: 'USDT',
      };
      const result = AmountSchema.safeParse(amount);
      expect(result.success).toBe(true);
    });

    it('should validate amount without symbol', () => {
      const amount = {
        value: '1000000',
        decimals: 6,
      };
      const result = AmountSchema.safeParse(amount);
      expect(result.success).toBe(true);
    });

    it('should reject invalid amount', () => {
      const amount = {
        value: 1000000, // should be string
        decimals: 6,
      };
      const result = AmountSchema.safeParse(amount);
      expect(result.success).toBe(false);
    });
  });

  describe('SpendingLimitsSchema', () => {
    it('should validate full spending limits', () => {
      const limits = {
        perTransaction: { value: '100000000', decimals: 6 },
        daily: { value: '1000000000', decimals: 6 },
        weekly: { value: '5000000000', decimals: 6 },
        monthly: { value: '20000000000', decimals: 6 },
      };
      const result = SpendingLimitsSchema.safeParse(limits);
      expect(result.success).toBe(true);
    });

    it('should validate partial spending limits', () => {
      const limits = {
        daily: { value: '1000000000', decimals: 6 },
      };
      const result = SpendingLimitsSchema.safeParse(limits);
      expect(result.success).toBe(true);
    });

    it('should validate empty spending limits', () => {
      const limits = {};
      const result = SpendingLimitsSchema.safeParse(limits);
      expect(result.success).toBe(true);
    });
  });

  describe('TimeRulesSchema', () => {
    it('should validate time rules with allowed windows', () => {
      const rules = {
        allowedWindows: [
          { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 17 },
        ],
        timezone: 'UTC',
      };
      const result = TimeRulesSchema.safeParse(rules);
      expect(result.success).toBe(true);
    });

    it('should validate time rules with blocked periods', () => {
      const rules = {
        blockedPeriods: [
          {
            start: '2026-01-01T00:00:00Z',
            end: '2026-01-02T00:00:00Z',
            reason: 'Holiday',
          },
        ],
      };
      const result = TimeRulesSchema.safeParse(rules);
      expect(result.success).toBe(true);
    });

    it('should reject invalid day values', () => {
      const rules = {
        allowedWindows: [
          { days: [7], startHour: 9, endHour: 17 }, // 7 is invalid
        ],
      };
      const result = TimeRulesSchema.safeParse(rules);
      expect(result.success).toBe(false);
    });

    it('should reject invalid hour values', () => {
      const rules = {
        allowedWindows: [
          { days: [1], startHour: 25, endHour: 17 }, // 25 is invalid
        ],
      };
      const result = TimeRulesSchema.safeParse(rules);
      expect(result.success).toBe(false);
    });
  });

  describe('MerchantRulesSchema', () => {
    it('should validate merchant whitelist', () => {
      const rules = {
        whitelist: ['0x1234567890abcdef', '0xabcdef1234567890'],
        requireWhitelist: true,
      };
      const result = MerchantRulesSchema.safeParse(rules);
      expect(result.success).toBe(true);
    });

    it('should validate merchant blacklist', () => {
      const rules = {
        blacklist: ['0xbadaddress123456'],
      };
      const result = MerchantRulesSchema.safeParse(rules);
      expect(result.success).toBe(true);
    });

    it('should validate combined rules', () => {
      const rules = {
        whitelist: ['0x1234567890abcdef'],
        blacklist: ['0xbadaddress123456'],
        requireWhitelist: false,
      };
      const result = MerchantRulesSchema.safeParse(rules);
      expect(result.success).toBe(true);
    });
  });

  describe('AuthorizationRequestSchema', () => {
    it('should validate complete request', () => {
      const request = {
        agentId: 'agent-123',
        amount: { value: '1000000', decimals: 6 },
        recipient: '0x1234567890abcdef1234567890abcdef12345678',
        network: 'eip155:8453',
        category: 'api-service',
        memo: 'Payment for API usage',
      };
      const result = AuthorizationRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should validate minimal request', () => {
      const request = {
        agentId: 'agent-123',
        amount: { value: '1000000', decimals: 6 },
        recipient: '0x1234567890abcdef1234567890abcdef12345678',
        network: 'eip155:8453',
      };
      const result = AuthorizationRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should reject request without required fields', () => {
      const request = {
        agentId: 'agent-123',
        amount: { value: '1000000', decimals: 6 },
        // missing recipient and network
      };
      const result = AuthorizationRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });
  });

  describe('PolicySchema', () => {
    it('should validate complete policy', () => {
      const policy = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Policy',
        description: 'A test policy',
        version: '1.0.0',
        parentId: '550e8400-e29b-41d4-a716-446655440001',
        priority: 10,
        status: 'active',
        limits: {
          perTransaction: { value: '100000000', decimals: 6 },
          daily: { value: '1000000000', decimals: 6 },
        },
        rules: {
          time: {
            allowedWindows: [
              { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 17 },
            ],
          },
          merchant: {
            whitelist: ['0x1234567890abcdef'],
          },
        },
        approval: {
          thresholds: [
            {
              amount: { value: '500000000', decimals: 6 },
              requiredApprovers: 2,
              approvers: ['0xapprover1', '0xapprover2', '0xapprover3'],
            },
          ],
          timeout: 3600000,
        },
        createdAt: '2026-01-19T00:00:00Z',
        updatedAt: '2026-01-19T00:00:00Z',
        createdBy: 'admin',
      };
      const result = PolicySchema.safeParse(policy);
      expect(result.success).toBe(true);
    });

    it('should validate minimal policy', () => {
      const policy = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Minimal Policy',
        version: '1.0.0',
        limits: {},
        rules: {},
        createdAt: '2026-01-19T00:00:00Z',
        updatedAt: '2026-01-19T00:00:00Z',
        createdBy: 'admin',
      };
      const result = PolicySchema.safeParse(policy);
      expect(result.success).toBe(true);
    });

    it('should reject invalid status', () => {
      const policy = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Policy',
        version: '1.0.0',
        status: 'invalid-status',
        limits: {},
        rules: {},
        createdAt: '2026-01-19T00:00:00Z',
        updatedAt: '2026-01-19T00:00:00Z',
        createdBy: 'admin',
      };
      const result = PolicySchema.safeParse(policy);
      expect(result.success).toBe(false);
    });

    it('should reject invalid UUID', () => {
      const policy = {
        id: 'not-a-uuid',
        name: 'Test Policy',
        version: '1.0.0',
        limits: {},
        rules: {},
        createdAt: '2026-01-19T00:00:00Z',
        updatedAt: '2026-01-19T00:00:00Z',
        createdBy: 'admin',
      };
      const result = PolicySchema.safeParse(policy);
      expect(result.success).toBe(false);
    });
  });
});
