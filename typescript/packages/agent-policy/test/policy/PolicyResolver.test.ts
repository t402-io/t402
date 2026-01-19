import { describe, it, expect, beforeEach } from 'vitest';
import { PolicyResolver } from '../../src/policy/PolicyResolver.js';
import type { Policy } from '../../src/types.js';

describe('PolicyResolver', () => {
  let resolver: PolicyResolver;

  beforeEach(() => {
    resolver = new PolicyResolver();
  });

  const createPolicy = (overrides: Partial<Policy> = {}): Policy => ({
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test Policy',
    version: '1.0.0',
    priority: 0,
    status: 'active',
    limits: {},
    rules: {},
    createdAt: new Date('2026-01-19'),
    updatedAt: new Date('2026-01-19'),
    createdBy: 'admin',
    ...overrides,
  });

  describe('resolve', () => {
    it('should return single policy unchanged', () => {
      const policy = createPolicy({
        limits: {
          daily: { value: '1000000000', decimals: 6 },
        },
      });

      const result = resolver.resolve([policy]);

      expect(result).toEqual(policy);
    });

    it('should throw error for empty policy array', () => {
      expect(() => resolver.resolve([])).toThrow('No policies to resolve');
    });

    it('should merge limits taking minimum (more restrictive)', () => {
      const parent = createPolicy({
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Parent Policy',
        limits: {
          daily: { value: '1000000000', decimals: 6 },
          weekly: { value: '5000000000', decimals: 6 },
        },
      });

      const child = createPolicy({
        id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Child Policy',
        parentId: parent.id,
        limits: {
          daily: { value: '500000000', decimals: 6 }, // More restrictive
          monthly: { value: '10000000000', decimals: 6 }, // New limit
        },
      });

      const result = resolver.resolve([parent, child]);

      expect(result.limits.daily?.value).toBe('500000000'); // Child's limit (lower)
      expect(result.limits.weekly?.value).toBe('5000000000'); // Inherited from parent
      expect(result.limits.monthly?.value).toBe('10000000000'); // From child
    });

    it('should merge merchant whitelist using intersection', () => {
      const parent = createPolicy({
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Parent Policy',
        rules: {
          merchant: {
            whitelist: ['0xaddr1', '0xaddr2', '0xaddr3'],
          },
        },
      });

      const child = createPolicy({
        id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Child Policy',
        parentId: parent.id,
        rules: {
          merchant: {
            whitelist: ['0xaddr2', '0xaddr3', '0xaddr4'],
          },
        },
      });

      const result = resolver.resolve([parent, child]);

      // Intersection: only 0xaddr2 and 0xaddr3
      expect(result.rules.merchant?.whitelist).toEqual(['0xaddr2', '0xaddr3']);
    });

    it('should merge merchant blacklist using union', () => {
      const parent = createPolicy({
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Parent Policy',
        rules: {
          merchant: {
            blacklist: ['0xbad1', '0xbad2'],
          },
        },
      });

      const child = createPolicy({
        id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Child Policy',
        parentId: parent.id,
        rules: {
          merchant: {
            blacklist: ['0xbad2', '0xbad3'],
          },
        },
      });

      const result = resolver.resolve([parent, child]);

      // Union: all unique values
      expect(result.rules.merchant?.blacklist).toContain('0xbad1');
      expect(result.rules.merchant?.blacklist).toContain('0xbad2');
      expect(result.rules.merchant?.blacklist).toContain('0xbad3');
      expect(result.rules.merchant?.blacklist?.length).toBe(3);
    });

    it('should combine blocked time periods from all policies', () => {
      const parent = createPolicy({
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Parent Policy',
        rules: {
          time: {
            blockedPeriods: [
              {
                start: new Date('2026-01-01'),
                end: new Date('2026-01-02'),
                reason: 'Holiday 1',
              },
            ],
          },
        },
      });

      const child = createPolicy({
        id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Child Policy',
        parentId: parent.id,
        rules: {
          time: {
            blockedPeriods: [
              {
                start: new Date('2026-02-01'),
                end: new Date('2026-02-02'),
                reason: 'Holiday 2',
              },
            ],
          },
        },
      });

      const result = resolver.resolve([parent, child]);

      expect(result.rules.time?.blockedPeriods?.length).toBe(2);
    });

    it('should merge network rules correctly', () => {
      const parent = createPolicy({
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Parent Policy',
        rules: {
          network: {
            allowedNetworks: ['eip155:1', 'eip155:8453', 'eip155:42161'],
            blockedNetworks: ['eip155:56'],
          },
        },
      });

      const child = createPolicy({
        id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Child Policy',
        parentId: parent.id,
        rules: {
          network: {
            allowedNetworks: ['eip155:8453', 'eip155:42161'], // Subset
            blockedNetworks: ['eip155:137'],
          },
        },
      });

      const result = resolver.resolve([parent, child]);

      // Allowed: intersection
      expect(result.rules.network?.allowedNetworks).toEqual([
        'eip155:8453',
        'eip155:42161',
      ]);

      // Blocked: union
      expect(result.rules.network?.blockedNetworks).toContain('eip155:56');
      expect(result.rules.network?.blockedNetworks).toContain('eip155:137');
    });

    it('should combine custom rules from all policies', () => {
      const parent = createPolicy({
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Parent Policy',
        rules: {
          custom: [
            {
              id: 'rule1',
              name: 'Parent Rule',
              expression: 'amount < 1000',
              action: 'allow' as const,
            },
          ],
        },
      });

      const child = createPolicy({
        id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Child Policy',
        parentId: parent.id,
        rules: {
          custom: [
            {
              id: 'rule2',
              name: 'Child Rule',
              expression: 'category != "gambling"',
              action: 'deny' as const,
            },
          ],
        },
      });

      const result = resolver.resolve([parent, child]);

      expect(result.rules.custom?.length).toBe(2);
      expect(result.rules.custom?.find((r) => r.id === 'rule1')).toBeDefined();
      expect(result.rules.custom?.find((r) => r.id === 'rule2')).toBeDefined();
    });

    it('should prefer child approval config', () => {
      const parent = createPolicy({
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Parent Policy',
        approval: {
          thresholds: [
            {
              amount: { value: '1000000000', decimals: 6 },
              requiredApprovers: 1,
              approvers: ['0xapprover1'],
            },
          ],
          timeout: 3600000,
        },
      });

      const child = createPolicy({
        id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Child Policy',
        parentId: parent.id,
        approval: {
          thresholds: [
            {
              amount: { value: '500000000', decimals: 6 },
              requiredApprovers: 2,
              approvers: ['0xapprover1', '0xapprover2'],
            },
          ],
          timeout: 1800000,
        },
      });

      const result = resolver.resolve([parent, child]);

      expect(result.approval?.timeout).toBe(1800000);
      expect(result.approval?.thresholds[0].requiredApprovers).toBe(2);
    });

    it('should inherit approval config from parent if child has none', () => {
      const parent = createPolicy({
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Parent Policy',
        approval: {
          thresholds: [
            {
              amount: { value: '1000000000', decimals: 6 },
              requiredApprovers: 1,
              approvers: ['0xapprover1'],
            },
          ],
          timeout: 3600000,
        },
      });

      const child = createPolicy({
        id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Child Policy',
        parentId: parent.id,
        // No approval config
      });

      const result = resolver.resolve([parent, child]);

      expect(result.approval?.timeout).toBe(3600000);
    });

    it('should handle three-level hierarchy', () => {
      const grandparent = createPolicy({
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Organization Policy',
        limits: {
          monthly: { value: '100000000000', decimals: 6 },
        },
        rules: {
          merchant: {
            blacklist: ['0xbad1'],
          },
        },
      });

      const parent = createPolicy({
        id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Department Policy',
        parentId: grandparent.id,
        limits: {
          weekly: { value: '10000000000', decimals: 6 },
        },
        rules: {
          merchant: {
            blacklist: ['0xbad2'],
          },
        },
      });

      const child = createPolicy({
        id: '550e8400-e29b-41d4-a716-446655440003',
        name: 'Agent Policy',
        parentId: parent.id,
        limits: {
          daily: { value: '1000000000', decimals: 6 },
        },
        rules: {
          merchant: {
            blacklist: ['0xbad3'],
          },
        },
      });

      const result = resolver.resolve([grandparent, parent, child]);

      // All limits should be present
      expect(result.limits.monthly?.value).toBe('100000000000');
      expect(result.limits.weekly?.value).toBe('10000000000');
      expect(result.limits.daily?.value).toBe('1000000000');

      // All blacklist entries should be combined
      expect(result.rules.merchant?.blacklist?.length).toBe(3);
    });

    it('should handle priority ordering at same level', () => {
      const policy1 = createPolicy({
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Low Priority',
        priority: 1,
        limits: {
          daily: { value: '1000000000', decimals: 6 },
        },
      });

      const policy2 = createPolicy({
        id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'High Priority',
        priority: 10,
        limits: {
          daily: { value: '500000000', decimals: 6 },
        },
      });

      // Pass in non-priority order
      const result = resolver.resolve([policy1, policy2]);

      // Higher priority should be processed, resulting in its limits
      // being considered (though min is still taken)
      expect(result.limits.daily?.value).toBe('500000000');
    });

    it('should intersect time windows between parent and child', () => {
      const parent = createPolicy({
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Parent Policy',
        rules: {
          time: {
            allowedWindows: [
              { days: [1, 2, 3, 4, 5], startHour: 8, endHour: 18 }, // Mon-Fri 8-18
            ],
            timezone: 'UTC',
          },
        },
      });

      const child = createPolicy({
        id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Child Policy',
        parentId: parent.id,
        rules: {
          time: {
            allowedWindows: [
              { days: [1, 2, 3], startHour: 9, endHour: 17 }, // Mon-Wed 9-17
            ],
            timezone: 'UTC',
          },
        },
      });

      const result = resolver.resolve([parent, child]);

      // Intersection: Mon-Wed (common days), 9-17 (overlapping hours)
      expect(result.rules.time?.allowedWindows).toHaveLength(1);
      expect(result.rules.time?.allowedWindows?.[0].days).toEqual([1, 2, 3]);
      expect(result.rules.time?.allowedWindows?.[0].startHour).toBe(9);
      expect(result.rules.time?.allowedWindows?.[0].endHour).toBe(17);
    });

    it('should return empty windows when no overlap in days', () => {
      const parent = createPolicy({
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Parent Policy',
        rules: {
          time: {
            allowedWindows: [
              { days: [1, 2, 3], startHour: 9, endHour: 17 }, // Mon-Wed
            ],
            timezone: 'UTC',
          },
        },
      });

      const child = createPolicy({
        id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Child Policy',
        parentId: parent.id,
        rules: {
          time: {
            allowedWindows: [
              { days: [4, 5], startHour: 9, endHour: 17 }, // Thu-Fri
            ],
            timezone: 'UTC',
          },
        },
      });

      const result = resolver.resolve([parent, child]);

      // No common days, so empty
      expect(result.rules.time?.allowedWindows).toHaveLength(0);
    });

    it('should return empty windows when no overlap in hours', () => {
      const parent = createPolicy({
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Parent Policy',
        rules: {
          time: {
            allowedWindows: [
              { days: [1, 2, 3], startHour: 9, endHour: 12 }, // 9-12
            ],
            timezone: 'UTC',
          },
        },
      });

      const child = createPolicy({
        id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Child Policy',
        parentId: parent.id,
        rules: {
          time: {
            allowedWindows: [
              { days: [1, 2, 3], startHour: 14, endHour: 18 }, // 14-18
            ],
            timezone: 'UTC',
          },
        },
      });

      const result = resolver.resolve([parent, child]);

      // No overlapping hours
      expect(result.rules.time?.allowedWindows).toHaveLength(0);
    });

    it('should use child windows when parent has none', () => {
      const parent = createPolicy({
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Parent Policy',
        rules: {},
      });

      const child = createPolicy({
        id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Child Policy',
        parentId: parent.id,
        rules: {
          time: {
            allowedWindows: [
              { days: [1, 2, 3], startHour: 9, endHour: 17 },
            ],
            timezone: 'UTC',
          },
        },
      });

      const result = resolver.resolve([parent, child]);

      expect(result.rules.time?.allowedWindows).toHaveLength(1);
      expect(result.rules.time?.allowedWindows?.[0].days).toEqual([1, 2, 3]);
    });

    it('should use parent windows when child has none', () => {
      const parent = createPolicy({
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Parent Policy',
        rules: {
          time: {
            allowedWindows: [
              { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 17 },
            ],
            timezone: 'UTC',
          },
        },
      });

      const child = createPolicy({
        id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Child Policy',
        parentId: parent.id,
        rules: {},
      });

      const result = resolver.resolve([parent, child]);

      expect(result.rules.time?.allowedWindows).toHaveLength(1);
      expect(result.rules.time?.allowedWindows?.[0].days).toEqual([1, 2, 3, 4, 5]);
    });
  });
});
