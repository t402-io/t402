/**
 * Policy Validator - Schema validation for policies
 */

import { PolicySchema, type Policy } from '../types.js';

export class PolicyValidator {
  /**
   * Validate a policy against the schema
   */
  validate(policy: unknown): { valid: boolean; errors?: string[] } {
    const result = PolicySchema.safeParse(policy);

    if (result.success) {
      return { valid: true };
    }

    return {
      valid: false,
      errors: result.error.errors.map(
        (e) => `${e.path.join('.')}: ${e.message}`
      ),
    };
  }

  /**
   * Validate and return typed policy
   */
  parse(policy: unknown): Policy {
    return PolicySchema.parse(policy);
  }

  /**
   * Check if child policy is valid given parent constraints
   */
  validateInheritance(parent: Policy, child: Policy): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    // Check that child limits don't exceed parent limits
    const limitKeys = ['perTransaction', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'lifetime'] as const;

    for (const key of limitKeys) {
      const parentLimit = parent.limits[key];
      const childLimit = child.limits[key];

      if (parentLimit && childLimit) {
        const parentValue = BigInt(parentLimit.value);
        const childValue = BigInt(childLimit.value);

        if (childValue > parentValue) {
          errors.push(
            `Child ${key} limit (${childValue}) exceeds parent limit (${parentValue})`
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}
