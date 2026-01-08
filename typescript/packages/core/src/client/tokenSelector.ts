/**
 * Token Selector Utility for T402 Clients
 *
 * Helps clients select the best payment method from available payment requirements.
 * Prioritizes tokens based on:
 * 1. User token balances
 * 2. Token priority (USDT0 > USDC > legacy tokens)
 * 3. Network gas costs
 */

import type { PaymentRequirements } from "../types";

/**
 * User token balance information
 */
export interface UserTokenBalance {
  /** Token contract address */
  asset: string;
  /** Network in CAIP-2 format (e.g., "eip155:42161") */
  network: string;
  /** Token balance in smallest units */
  amount: string;
  /** Token symbol (optional, for display) */
  symbol?: string;
}

/**
 * Token priority configuration
 * Lower number = higher priority
 */
export const DEFAULT_TOKEN_PRIORITY: Record<string, number> = {
  USDT0: 1, // Highest priority - gasless, cross-chain native
  USDC: 2, // Second - wide support, EIP-3009
  EURC: 3, // Euro stablecoin
  DAI: 4, // Decentralized stablecoin
  USDT: 10, // Lower priority - requires approval transaction (legacy)
};

/**
 * Options for token selection
 */
export interface TokenSelectionOptions {
  /** Custom token priorities (overrides defaults) */
  tokenPriority?: Record<string, number>;
  /** Preferred networks (will be prioritized) */
  preferredNetworks?: string[];
  /** Only consider tokens the user has sufficient balance for */
  requireSufficientBalance?: boolean;
}

/**
 * Result of token selection
 */
export interface TokenSelectionResult {
  /** The selected payment requirements */
  selected: PaymentRequirements | null;
  /** All valid payment options sorted by priority */
  alternatives: PaymentRequirements[];
  /** Reason if no payment method was selected */
  reason?: string;
}

/**
 * Select the best payment method from available requirements
 *
 * @param requirements - Array of payment requirements from the server
 * @param userBalances - Array of user's token balances
 * @param options - Selection options
 * @returns The best payment requirement and alternatives
 *
 * @example
 * ```typescript
 * const result = selectBestPaymentMethod(
 *   paymentRequirements,
 *   [
 *     { asset: "0x...", network: "eip155:42161", amount: "1000000000" },
 *   ],
 *   { requireSufficientBalance: true }
 * );
 *
 * if (result.selected) {
 *   // Use result.selected for payment
 * }
 * ```
 */
export function selectBestPaymentMethod(
  requirements: PaymentRequirements[],
  userBalances: UserTokenBalance[],
  options: TokenSelectionOptions = {},
): TokenSelectionResult {
  const { tokenPriority = DEFAULT_TOKEN_PRIORITY, preferredNetworks = [], requireSufficientBalance = true } = options;

  if (requirements.length === 0) {
    return {
      selected: null,
      alternatives: [],
      reason: "No payment requirements provided",
    };
  }

  // Create a map for quick balance lookup
  const balanceMap = new Map<string, bigint>();
  for (const balance of userBalances) {
    const key = `${balance.network}:${balance.asset.toLowerCase()}`;
    balanceMap.set(key, BigInt(balance.amount));
  }

  // Filter and score requirements
  const scored = requirements
    .map((req) => {
      const key = `${req.network}:${req.asset.toLowerCase()}`;
      const userBalance = balanceMap.get(key) ?? 0n;
      const requiredAmount = BigInt(req.amount);
      const hasSufficientBalance = userBalance >= requiredAmount;

      // Get token symbol from extra or default
      const symbol = (req.extra?.symbol as string) || (req.extra?.name as string) || "UNKNOWN";

      // Calculate priority score
      let priorityScore = tokenPriority[symbol.toUpperCase()] ?? 100;

      // Boost preferred networks
      if (preferredNetworks.includes(req.network)) {
        priorityScore -= 0.5;
      }

      // Penalize if insufficient balance
      if (!hasSufficientBalance) {
        priorityScore += 1000;
      }

      return {
        requirement: req,
        priorityScore,
        hasSufficientBalance,
        userBalance,
        symbol,
      };
    })
    .sort((a, b) => a.priorityScore - b.priorityScore);

  // Filter based on balance requirement
  const validOptions = requireSufficientBalance ? scored.filter((s) => s.hasSufficientBalance) : scored;

  if (validOptions.length === 0) {
    return {
      selected: null,
      alternatives: scored.map((s) => s.requirement),
      reason: requireSufficientBalance
        ? "No payment method with sufficient balance"
        : "No valid payment methods available",
    };
  }

  return {
    selected: validOptions[0].requirement,
    alternatives: validOptions.slice(1).map((s) => s.requirement),
  };
}

/**
 * Check if a payment requirement uses a gasless token (EIP-3009)
 */
export function isGaslessPayment(requirement: PaymentRequirements): boolean {
  const tokenType = requirement.extra?.tokenType;
  return tokenType === "eip3009";
}

/**
 * Check if a payment requirement is for USDT0
 */
export function isUsdt0Payment(requirement: PaymentRequirements): boolean {
  const symbol = requirement.extra?.symbol;
  return symbol === "USDT0";
}

/**
 * Get payment requirements for a specific token
 */
export function filterByToken(requirements: PaymentRequirements[], symbol: string): PaymentRequirements[] {
  return requirements.filter((req) => {
    const reqSymbol = (req.extra?.symbol as string) || "";
    return reqSymbol.toUpperCase() === symbol.toUpperCase();
  });
}

/**
 * Get payment requirements for a specific network
 */
export function filterByNetwork(requirements: PaymentRequirements[], network: string): PaymentRequirements[] {
  return requirements.filter((req) => req.network === network);
}

/**
 * Get all unique networks from payment requirements
 */
export function getAvailableNetworks(requirements: PaymentRequirements[]): string[] {
  return [...new Set(requirements.map((req) => req.network))];
}

/**
 * Get all unique tokens from payment requirements
 */
export function getAvailableTokens(requirements: PaymentRequirements[]): string[] {
  return [
    ...new Set(
      requirements.map((req) => (req.extra?.symbol as string) || (req.extra?.name as string) || "UNKNOWN"),
    ),
  ];
}
