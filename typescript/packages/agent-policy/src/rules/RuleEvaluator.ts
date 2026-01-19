/**
 * Rule Evaluator - Evaluates policy rules against requests
 */

import type {
  TimeRules,
  MerchantRules,
  NetworkRules,
  CategoryRules,
  RuleEvaluation,
} from '../types.js';

export class RuleEvaluator {
  /**
   * Evaluate time rules
   */
  async evaluateTimeRules(
    rules: TimeRules | undefined,
    timestamp: Date
  ): Promise<RuleEvaluation> {
    if (!rules) {
      return { rule: 'time_rules', passed: true };
    }

    // Check blocked periods
    if (rules.blockedPeriods) {
      for (const period of rules.blockedPeriods) {
        if (timestamp >= period.start && timestamp <= period.end) {
          return {
            rule: 'time_rules',
            passed: false,
            reason: `Currently in blocked period: ${period.reason || 'No reason provided'}`,
            details: { blockedPeriod: period },
          };
        }
      }
    }

    // Check allowed windows (using UTC for consistency)
    if (rules.allowedWindows && rules.allowedWindows.length > 0) {
      const day = timestamp.getUTCDay();
      const hour = timestamp.getUTCHours();

      const inAllowedWindow = rules.allowedWindows.some(
        (window) =>
          window.days.includes(day) &&
          hour >= window.startHour &&
          hour < window.endHour
      );

      if (!inAllowedWindow) {
        return {
          rule: 'time_rules',
          passed: false,
          reason: `Current time (day: ${day}, hour: ${hour}) not in allowed windows`,
          details: { allowedWindows: rules.allowedWindows },
        };
      }
    }

    return { rule: 'time_rules', passed: true };
  }

  /**
   * Evaluate merchant rules
   */
  async evaluateMerchantRules(
    rules: MerchantRules | undefined,
    recipient: string
  ): Promise<RuleEvaluation> {
    if (!rules) {
      return { rule: 'merchant_rules', passed: true };
    }

    const normalizedRecipient = recipient.toLowerCase();

    // Check blacklist
    if (rules.blacklist) {
      const isBlacklisted = rules.blacklist.some(
        (addr) => addr.toLowerCase() === normalizedRecipient
      );

      if (isBlacklisted) {
        return {
          rule: 'merchant_rules',
          passed: false,
          reason: `Recipient ${recipient} is blacklisted`,
        };
      }
    }

    // Check whitelist
    if (rules.requireWhitelist || (rules.whitelist && rules.whitelist.length > 0)) {
      if (!rules.whitelist || rules.whitelist.length === 0) {
        return {
          rule: 'merchant_rules',
          passed: false,
          reason: 'Whitelist required but empty',
        };
      }

      const isWhitelisted = rules.whitelist.some(
        (addr) => addr.toLowerCase() === normalizedRecipient
      );

      if (!isWhitelisted) {
        return {
          rule: 'merchant_rules',
          passed: false,
          reason: `Recipient ${recipient} not in whitelist`,
        };
      }
    }

    return { rule: 'merchant_rules', passed: true };
  }

  /**
   * Evaluate network rules
   */
  async evaluateNetworkRules(
    rules: NetworkRules | undefined,
    network: string
  ): Promise<RuleEvaluation> {
    if (!rules) {
      return { rule: 'network_rules', passed: true };
    }

    // Check blocked networks
    if (rules.blockedNetworks) {
      const isBlocked = rules.blockedNetworks.some(
        (n) => n.toLowerCase() === network.toLowerCase()
      );

      if (isBlocked) {
        return {
          rule: 'network_rules',
          passed: false,
          reason: `Network ${network} is blocked`,
        };
      }
    }

    // Check allowed networks
    if (rules.allowedNetworks && rules.allowedNetworks.length > 0) {
      const isAllowed = rules.allowedNetworks.some(
        (n) => n.toLowerCase() === network.toLowerCase()
      );

      if (!isAllowed) {
        return {
          rule: 'network_rules',
          passed: false,
          reason: `Network ${network} not in allowed list`,
          details: { allowedNetworks: rules.allowedNetworks },
        };
      }
    }

    return { rule: 'network_rules', passed: true };
  }

  /**
   * Evaluate category rules
   *
   * Categories are case-insensitive strings that can be used to classify
   * payments (e.g., "api_usage", "subscription", "data_storage").
   */
  async evaluateCategoryRules(
    rules: CategoryRules | undefined,
    category: string | undefined
  ): Promise<RuleEvaluation> {
    if (!rules) {
      return { rule: 'category_rules', passed: true };
    }

    // If no category provided and rules exist, check if we need to enforce
    if (!category) {
      // If allowed categories are specified, we need a category
      if (rules.allowedCategories && rules.allowedCategories.length > 0) {
        return {
          rule: 'category_rules',
          passed: false,
          reason: 'Category required but not provided',
          details: { allowedCategories: rules.allowedCategories },
        };
      }
      // No allowed categories specified, pass through
      return { rule: 'category_rules', passed: true };
    }

    const normalizedCategory = category.toLowerCase();

    // Check blocked categories
    if (rules.blockedCategories && rules.blockedCategories.length > 0) {
      const isBlocked = rules.blockedCategories.some(
        (c) => c.toLowerCase() === normalizedCategory
      );

      if (isBlocked) {
        return {
          rule: 'category_rules',
          passed: false,
          reason: `Category "${category}" is blocked`,
          details: { blockedCategories: rules.blockedCategories },
        };
      }
    }

    // Check allowed categories
    if (rules.allowedCategories && rules.allowedCategories.length > 0) {
      const isAllowed = rules.allowedCategories.some(
        (c) => c.toLowerCase() === normalizedCategory
      );

      if (!isAllowed) {
        return {
          rule: 'category_rules',
          passed: false,
          reason: `Category "${category}" not in allowed list`,
          details: { allowedCategories: rules.allowedCategories },
        };
      }
    }

    return { rule: 'category_rules', passed: true };
  }
}
