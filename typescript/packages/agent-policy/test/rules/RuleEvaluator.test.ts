import { describe, it, expect, beforeEach } from 'vitest';
import { RuleEvaluator } from '../../src/rules/RuleEvaluator.js';
import type { TimeRules, MerchantRules, NetworkRules, CategoryRules } from '../../src/types.js';

describe('RuleEvaluator', () => {
  let evaluator: RuleEvaluator;

  beforeEach(() => {
    evaluator = new RuleEvaluator();
  });

  describe('evaluateTimeRules', () => {
    it('should pass when no rules defined', async () => {
      const result = await evaluator.evaluateTimeRules(undefined, new Date());
      expect(result.passed).toBe(true);
      expect(result.rule).toBe('time_rules');
    });

    it('should pass when within allowed window', async () => {
      const rules: TimeRules = {
        allowedWindows: [
          { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 17 }, // Mon-Fri 9-17
        ],
        timezone: 'UTC',
      };

      // Wednesday at 10:00 UTC - use UTC methods in evaluator
      const wednesday10am = new Date('2026-01-21T10:00:00Z');
      expect(wednesday10am.getUTCDay()).toBe(3); // Wednesday
      expect(wednesday10am.getUTCHours()).toBe(10); // 10:00

      const result = await evaluator.evaluateTimeRules(rules, wednesday10am);
      expect(result.passed).toBe(true);
    });

    it('should fail when outside allowed hours', async () => {
      const rules: TimeRules = {
        allowedWindows: [
          { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 17 },
        ],
        timezone: 'UTC',
      };

      // Wednesday at 20:00
      const wednesday8pm = new Date('2026-01-21T20:00:00Z');

      const result = await evaluator.evaluateTimeRules(rules, wednesday8pm);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('not in allowed windows');
    });

    it('should fail when on blocked day', async () => {
      const rules: TimeRules = {
        allowedWindows: [
          { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 17 }, // No weekends
        ],
        timezone: 'UTC',
      };

      // Saturday at 10:00
      const saturday10am = new Date('2026-01-24T10:00:00Z');
      expect(saturday10am.getDay()).toBe(6); // Saturday

      const result = await evaluator.evaluateTimeRules(rules, saturday10am);
      expect(result.passed).toBe(false);
    });

    it('should fail when in blocked period', async () => {
      const rules: TimeRules = {
        blockedPeriods: [
          {
            start: new Date('2026-01-20T00:00:00Z'),
            end: new Date('2026-01-22T00:00:00Z'),
            reason: 'Maintenance window',
          },
        ],
        timezone: 'UTC',
      };

      const duringMaintenance = new Date('2026-01-21T12:00:00Z');

      const result = await evaluator.evaluateTimeRules(rules, duringMaintenance);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Maintenance window');
    });

    it('should pass when outside blocked period', async () => {
      const rules: TimeRules = {
        blockedPeriods: [
          {
            start: new Date('2026-01-20T00:00:00Z'),
            end: new Date('2026-01-22T00:00:00Z'),
            reason: 'Maintenance window',
          },
        ],
        timezone: 'UTC',
      };

      const afterMaintenance = new Date('2026-01-23T12:00:00Z');

      const result = await evaluator.evaluateTimeRules(rules, afterMaintenance);
      expect(result.passed).toBe(true);
    });

    it('should support multiple allowed windows', async () => {
      const rules: TimeRules = {
        allowedWindows: [
          { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 12 }, // Morning
          { days: [1, 2, 3, 4, 5], startHour: 14, endHour: 17 }, // Afternoon
        ],
        timezone: 'UTC',
      };

      // During lunch break (13:00)
      const lunchTime = new Date('2026-01-21T13:00:00Z');

      const result = await evaluator.evaluateTimeRules(rules, lunchTime);
      expect(result.passed).toBe(false);

      // During afternoon (15:00)
      const afternoon = new Date('2026-01-21T15:00:00Z');

      const result2 = await evaluator.evaluateTimeRules(rules, afternoon);
      expect(result2.passed).toBe(true);
    });
  });

  describe('evaluateMerchantRules', () => {
    it('should pass when no rules defined', async () => {
      const result = await evaluator.evaluateMerchantRules(
        undefined,
        '0x1234567890abcdef'
      );
      expect(result.passed).toBe(true);
      expect(result.rule).toBe('merchant_rules');
    });

    it('should pass when recipient is in whitelist', async () => {
      const rules: MerchantRules = {
        whitelist: ['0xaddr1', '0xaddr2', '0xaddr3'],
        requireWhitelist: true,
      };

      const result = await evaluator.evaluateMerchantRules(rules, '0xaddr2');
      expect(result.passed).toBe(true);
    });

    it('should fail when recipient is not in whitelist and whitelist required', async () => {
      const rules: MerchantRules = {
        whitelist: ['0xaddr1', '0xaddr2'],
        requireWhitelist: true,
      };

      const result = await evaluator.evaluateMerchantRules(rules, '0xaddr3');
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('not in whitelist');
    });

    it('should fail when recipient is in blacklist', async () => {
      const rules: MerchantRules = {
        blacklist: ['0xbadaddr1', '0xbadaddr2'],
      };

      const result = await evaluator.evaluateMerchantRules(rules, '0xbadaddr1');
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('blacklisted');
    });

    it('should pass when recipient is not in blacklist', async () => {
      const rules: MerchantRules = {
        blacklist: ['0xbadaddr1', '0xbadaddr2'],
      };

      const result = await evaluator.evaluateMerchantRules(rules, '0xgoodaddr');
      expect(result.passed).toBe(true);
    });

    it('should check blacklist before whitelist', async () => {
      const rules: MerchantRules = {
        whitelist: ['0xaddr1', '0xaddr2'],
        blacklist: ['0xaddr1'], // Same address in both!
        requireWhitelist: true,
      };

      const result = await evaluator.evaluateMerchantRules(rules, '0xaddr1');
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('blacklisted');
    });

    it('should be case insensitive', async () => {
      const rules: MerchantRules = {
        whitelist: ['0xABCDEF123456'],
        requireWhitelist: true,
      };

      const result = await evaluator.evaluateMerchantRules(
        rules,
        '0xabcdef123456'
      );
      expect(result.passed).toBe(true);
    });

    it('should fail when whitelist required but empty', async () => {
      const rules: MerchantRules = {
        whitelist: [],
        requireWhitelist: true,
      };

      const result = await evaluator.evaluateMerchantRules(rules, '0xanyaddr');
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('empty');
    });

    it('should pass without whitelist when not required', async () => {
      const rules: MerchantRules = {
        requireWhitelist: false,
      };

      const result = await evaluator.evaluateMerchantRules(rules, '0xanyaddr');
      expect(result.passed).toBe(true);
    });
  });

  describe('evaluateNetworkRules', () => {
    it('should pass when no rules defined', async () => {
      const result = await evaluator.evaluateNetworkRules(
        undefined,
        'eip155:8453'
      );
      expect(result.passed).toBe(true);
      expect(result.rule).toBe('network_rules');
    });

    it('should pass when network is in allowed list', async () => {
      const rules: NetworkRules = {
        allowedNetworks: ['eip155:1', 'eip155:8453', 'eip155:42161'],
      };

      const result = await evaluator.evaluateNetworkRules(rules, 'eip155:8453');
      expect(result.passed).toBe(true);
    });

    it('should fail when network is not in allowed list', async () => {
      const rules: NetworkRules = {
        allowedNetworks: ['eip155:1', 'eip155:8453'],
      };

      const result = await evaluator.evaluateNetworkRules(
        rules,
        'eip155:42161'
      );
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('not in allowed list');
    });

    it('should fail when network is in blocked list', async () => {
      const rules: NetworkRules = {
        blockedNetworks: ['eip155:56', 'eip155:137'],
      };

      const result = await evaluator.evaluateNetworkRules(rules, 'eip155:56');
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('blocked');
    });

    it('should pass when network is not in blocked list', async () => {
      const rules: NetworkRules = {
        blockedNetworks: ['eip155:56', 'eip155:137'],
      };

      const result = await evaluator.evaluateNetworkRules(rules, 'eip155:8453');
      expect(result.passed).toBe(true);
    });

    it('should be case insensitive', async () => {
      const rules: NetworkRules = {
        allowedNetworks: ['EIP155:8453'],
      };

      const result = await evaluator.evaluateNetworkRules(rules, 'eip155:8453');
      expect(result.passed).toBe(true);
    });

    it('should check blocked before allowed', async () => {
      const rules: NetworkRules = {
        allowedNetworks: ['eip155:8453'],
        blockedNetworks: ['eip155:8453'], // Same in both
      };

      const result = await evaluator.evaluateNetworkRules(rules, 'eip155:8453');
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('blocked');
    });

    it('should pass without allowed list when not specified', async () => {
      const rules: NetworkRules = {
        // No allowedNetworks, only blockedNetworks
        blockedNetworks: ['eip155:56'],
      };

      const result = await evaluator.evaluateNetworkRules(rules, 'eip155:8453');
      expect(result.passed).toBe(true);
    });

    it('should support non-EVM networks', async () => {
      const rules: NetworkRules = {
        allowedNetworks: ['eip155:1', 'solana:mainnet', 'ton:mainnet'],
      };

      const result1 = await evaluator.evaluateNetworkRules(
        rules,
        'solana:mainnet'
      );
      expect(result1.passed).toBe(true);

      const result2 = await evaluator.evaluateNetworkRules(rules, 'ton:mainnet');
      expect(result2.passed).toBe(true);

      const result3 = await evaluator.evaluateNetworkRules(
        rules,
        'tron:mainnet'
      );
      expect(result3.passed).toBe(false);
    });
  });

  describe('evaluateCategoryRules', () => {
    it('should pass when no rules defined', async () => {
      const result = await evaluator.evaluateCategoryRules(undefined, 'api_usage');
      expect(result.passed).toBe(true);
      expect(result.rule).toBe('category_rules');
    });

    it('should pass when category matches allowed list', async () => {
      const rules: CategoryRules = {
        allowedCategories: ['api_usage', 'subscription', 'data_storage'],
      };

      const result = await evaluator.evaluateCategoryRules(rules, 'api_usage');
      expect(result.passed).toBe(true);
    });

    it('should fail when category not in allowed list', async () => {
      const rules: CategoryRules = {
        allowedCategories: ['api_usage', 'subscription'],
      };

      const result = await evaluator.evaluateCategoryRules(rules, 'gambling');
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('not in allowed list');
    });

    it('should fail when category is in blocked list', async () => {
      const rules: CategoryRules = {
        blockedCategories: ['gambling', 'adult_content'],
      };

      const result = await evaluator.evaluateCategoryRules(rules, 'gambling');
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('blocked');
    });

    it('should pass when category not in blocked list', async () => {
      const rules: CategoryRules = {
        blockedCategories: ['gambling', 'adult_content'],
      };

      const result = await evaluator.evaluateCategoryRules(rules, 'api_usage');
      expect(result.passed).toBe(true);
    });

    it('should be case insensitive', async () => {
      const rules: CategoryRules = {
        allowedCategories: ['API_USAGE', 'SUBSCRIPTION'],
      };

      const result = await evaluator.evaluateCategoryRules(rules, 'api_usage');
      expect(result.passed).toBe(true);
    });

    it('should check blocked before allowed', async () => {
      const rules: CategoryRules = {
        allowedCategories: ['api_usage'],
        blockedCategories: ['api_usage'], // Same in both!
      };

      const result = await evaluator.evaluateCategoryRules(rules, 'api_usage');
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('blocked');
    });

    it('should fail when category required but not provided', async () => {
      const rules: CategoryRules = {
        allowedCategories: ['api_usage', 'subscription'],
      };

      const result = await evaluator.evaluateCategoryRules(rules, undefined);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('required');
    });

    it('should pass when no category and only blocked rules', async () => {
      const rules: CategoryRules = {
        blockedCategories: ['gambling'],
      };

      const result = await evaluator.evaluateCategoryRules(rules, undefined);
      expect(result.passed).toBe(true);
    });

    it('should pass when category empty and no allowed list', async () => {
      const rules: CategoryRules = {
        blockedCategories: ['gambling'],
      };

      const result = await evaluator.evaluateCategoryRules(rules, '');
      expect(result.passed).toBe(true);
    });
  });
});
