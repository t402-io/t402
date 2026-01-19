/**
 * Policy Resolver - Handles policy inheritance and merging
 */

import type {
  Policy,
  SpendingLimits,
  PolicyRules,
  TimeRules,
  Amount,
} from '../types.js';

export class PolicyResolver {
  /**
   * Resolve multiple policies into a single effective policy
   * Policies should be ordered from root (first) to leaf (last)
   */
  resolve(policies: Policy[]): Policy {
    if (policies.length === 0) {
      throw new Error('No policies to resolve');
    }

    if (policies.length === 1) {
      return policies[0];
    }

    // Sort by hierarchy (parent first) then by priority
    const sorted = this.sortPolicies(policies);

    // Start with first policy as base
    let effective = { ...sorted[0] };

    // Merge each subsequent policy
    for (let i = 1; i < sorted.length; i++) {
      effective = this.mergePolicies(effective, sorted[i]);
    }

    return effective;
  }

  private sortPolicies(policies: Policy[]): Policy[] {
    // Build parent-child relationships
    const childMap = new Map<string | undefined, Policy[]>();

    for (const policy of policies) {
      const parentId = policy.parentId;
      if (!childMap.has(parentId)) {
        childMap.set(parentId, []);
      }
      childMap.get(parentId)!.push(policy);
    }

    // Topological sort from root
    const result: Policy[] = [];
    const queue = childMap.get(undefined) || [];

    while (queue.length > 0) {
      // Sort current level by priority (descending)
      queue.sort((a, b) => b.priority - a.priority);

      const current = queue.shift()!;
      result.push(current);

      // Add children to queue
      const children = childMap.get(current.id) || [];
      queue.push(...children);
    }

    return result;
  }

  private mergePolicies(parent: Policy, child: Policy): Policy {
    return {
      ...child,
      limits: this.mergeLimits(parent.limits, child.limits),
      rules: this.mergeRules(parent.rules, child.rules),
      approval: child.approval || parent.approval,
    };
  }

  private mergeLimits(
    parent: SpendingLimits,
    child: SpendingLimits
  ): SpendingLimits {
    const result: SpendingLimits = { ...parent };

    // For each limit, take the more restrictive (lower) value
    const periods: (keyof SpendingLimits)[] = [
      'perTransaction',
      'hourly',
      'daily',
      'weekly',
      'monthly',
      'yearly',
      'lifetime',
    ];

    for (const period of periods) {
      if (child[period]) {
        if (!parent[period]) {
          result[period] = child[period];
        } else {
          result[period] = this.minAmount(parent[period]!, child[period]!);
        }
      }
    }

    return result;
  }

  private mergeRules(parent: PolicyRules, child: PolicyRules): PolicyRules {
    return {
      time: this.mergeTimeRules(parent.time, child.time),
      merchant: this.mergeMerchantRules(parent.merchant, child.merchant),
      category: this.mergeCategoryRules(parent.category, child.category),
      network: this.mergeNetworkRules(parent.network, child.network),
      custom: [...(parent.custom || []), ...(child.custom || [])],
    };
  }

  private mergeTimeRules(
    parent: PolicyRules['time'],
    child: PolicyRules['time']
  ): PolicyRules['time'] {
    if (!parent) return child;
    if (!child) return parent;

    return {
      // Allowed windows: intersection (more restrictive)
      allowedWindows: this.intersectTimeWindows(
        parent.allowedWindows,
        child.allowedWindows
      ),
      // Blocked periods: union (more restrictive)
      blockedPeriods: [
        ...(parent.blockedPeriods || []),
        ...(child.blockedPeriods || []),
      ],
      timezone: child.timezone || parent.timezone,
    };
  }

  private mergeMerchantRules(
    parent: PolicyRules['merchant'],
    child: PolicyRules['merchant']
  ): PolicyRules['merchant'] {
    if (!parent) return child;
    if (!child) return parent;

    return {
      // Whitelist: intersection (more restrictive)
      whitelist: this.intersectArrays(parent.whitelist, child.whitelist),
      // Blacklist: union (more restrictive)
      blacklist: this.unionArrays(parent.blacklist, child.blacklist),
      requireWhitelist: parent.requireWhitelist || child.requireWhitelist,
    };
  }

  private mergeCategoryRules(
    parent: PolicyRules['category'],
    child: PolicyRules['category']
  ): PolicyRules['category'] {
    if (!parent) return child;
    if (!child) return parent;

    return {
      allowedCategories: this.intersectArrays(
        parent.allowedCategories,
        child.allowedCategories
      ),
      blockedCategories: this.unionArrays(
        parent.blockedCategories,
        child.blockedCategories
      ),
    };
  }

  private mergeNetworkRules(
    parent: PolicyRules['network'],
    child: PolicyRules['network']
  ): PolicyRules['network'] {
    if (!parent) return child;
    if (!child) return parent;

    return {
      allowedNetworks: this.intersectArrays(
        parent.allowedNetworks,
        child.allowedNetworks
      ),
      blockedNetworks: this.unionArrays(
        parent.blockedNetworks,
        child.blockedNetworks
      ),
    };
  }

  private minAmount(a: Amount, b: Amount): Amount {
    // Assuming same decimals for simplicity
    const aValue = BigInt(a.value);
    const bValue = BigInt(b.value);
    return aValue < bValue ? a : b;
  }

  private intersectArrays<T>(
    a: T[] | undefined,
    b: T[] | undefined
  ): T[] | undefined {
    if (!a) return b;
    if (!b) return a;
    return a.filter((x) => b.includes(x));
  }

  private unionArrays<T>(
    a: T[] | undefined,
    b: T[] | undefined
  ): T[] | undefined {
    if (!a && !b) return undefined;
    return [...new Set([...(a || []), ...(b || [])])];
  }

  private intersectTimeWindows(
    a: TimeRules['allowedWindows'],
    b: TimeRules['allowedWindows']
  ): TimeRules['allowedWindows'] {
    // If either is undefined, return the other
    if (!a || a.length === 0) return b;
    if (!b || b.length === 0) return a;

    // Compute intersection of time windows
    // For each combination of windows, find overlapping days and hours
    const result: TimeRules['allowedWindows'] = [];

    for (const windowA of a) {
      for (const windowB of b) {
        // Find common days
        const commonDays = windowA.days.filter((d) => windowB.days.includes(d));
        if (commonDays.length === 0) continue;

        // Find overlapping hours
        const startHour = Math.max(windowA.startHour, windowB.startHour);
        const endHour = Math.min(windowA.endHour, windowB.endHour);

        // Only valid if start < end
        if (startHour < endHour) {
          result.push({
            days: commonDays,
            startHour,
            endHour,
          });
        }
      }
    }

    // Return undefined if no valid intersections (more restrictive)
    return result.length > 0 ? result : [];
  }
}
