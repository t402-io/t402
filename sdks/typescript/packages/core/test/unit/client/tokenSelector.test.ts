import { describe, it, expect } from "vitest";
import {
  selectBestPaymentMethod,
  isGaslessPayment,
  isUsdt0Payment,
  filterByToken,
  filterByNetwork,
  getAvailableNetworks,
  getAvailableTokens,
  type UserTokenBalance,
} from "../../../src/client/tokenSelector";
import type { PaymentRequirements } from "../../../src/types";

describe("Token Selector", () => {
  const mockRequirements: PaymentRequirements[] = [
    {
      scheme: "exact",
      network: "eip155:42161",
      asset: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
      amount: "1000000",
      payTo: "0x1234567890123456789012345678901234567890",
      maxTimeoutSeconds: 60,
      extra: { name: "TetherToken", symbol: "USDT0", tokenType: "eip3009" },
    },
    {
      scheme: "exact",
      network: "eip155:42161",
      asset: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      amount: "1000000",
      payTo: "0x1234567890123456789012345678901234567890",
      maxTimeoutSeconds: 60,
      extra: { name: "USD Coin", symbol: "USDC", tokenType: "eip3009" },
    },
    {
      scheme: "exact",
      network: "eip155:8453",
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      amount: "1000000",
      payTo: "0x1234567890123456789012345678901234567890",
      maxTimeoutSeconds: 60,
      extra: { name: "USD Coin", symbol: "USDC", tokenType: "eip3009" },
    },
  ];

  const mockBalances: UserTokenBalance[] = [
    {
      asset: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
      network: "eip155:42161",
      amount: "5000000", // 5 USDT0
      symbol: "USDT0",
    },
    {
      asset: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      network: "eip155:42161",
      amount: "2000000", // 2 USDC
      symbol: "USDC",
    },
  ];

  describe("selectBestPaymentMethod", () => {
    it("should select USDT0 as highest priority when balance is sufficient", () => {
      const result = selectBestPaymentMethod(mockRequirements, mockBalances);
      expect(result.selected).toBeDefined();
      expect(result.selected?.extra?.symbol).toBe("USDT0");
    });

    it("should return alternatives sorted by priority", () => {
      const result = selectBestPaymentMethod(mockRequirements, mockBalances);
      expect(result.alternatives.length).toBe(1); // USDC on Arbitrum
      expect(result.alternatives[0].extra?.symbol).toBe("USDC");
    });

    it("should skip options with insufficient balance", () => {
      const lowBalances: UserTokenBalance[] = [
        {
          asset: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
          network: "eip155:42161",
          amount: "500000", // 0.5 USDT0 - insufficient
          symbol: "USDT0",
        },
        {
          asset: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          network: "eip155:42161",
          amount: "2000000", // 2 USDC - sufficient
          symbol: "USDC",
        },
      ];

      const result = selectBestPaymentMethod(mockRequirements, lowBalances);
      expect(result.selected?.extra?.symbol).toBe("USDC");
    });

    it("should return null when no option has sufficient balance", () => {
      const noBalances: UserTokenBalance[] = [];
      const result = selectBestPaymentMethod(mockRequirements, noBalances);
      expect(result.selected).toBeNull();
      expect(result.reason).toBe("No payment method with sufficient balance");
    });

    it("should return null for empty requirements", () => {
      const result = selectBestPaymentMethod([], mockBalances);
      expect(result.selected).toBeNull();
      expect(result.reason).toBe("No payment requirements provided");
    });

    it("should respect preferred networks", () => {
      const result = selectBestPaymentMethod(mockRequirements, mockBalances, {
        preferredNetworks: ["eip155:8453"], // Prefer Base
      });
      // Even with preferred network, USDT0 on Arbitrum should win due to higher priority
      // and sufficient balance (Base USDC has no balance)
      expect(result.selected?.extra?.symbol).toBe("USDT0");
    });

    it("should allow all options when requireSufficientBalance is false", () => {
      const result = selectBestPaymentMethod(mockRequirements, [], {
        requireSufficientBalance: false,
      });
      expect(result.selected).toBeDefined();
      expect(result.alternatives.length).toBe(2); // All 3 options available
    });

    it("should support custom token priority", () => {
      const result = selectBestPaymentMethod(mockRequirements, mockBalances, {
        tokenPriority: { USDC: 1, USDT0: 2 }, // Prefer USDC
      });
      expect(result.selected?.extra?.symbol).toBe("USDC");
    });
  });

  describe("isGaslessPayment", () => {
    it("should return true for EIP-3009 tokens", () => {
      expect(isGaslessPayment(mockRequirements[0])).toBe(true);
      expect(isGaslessPayment(mockRequirements[1])).toBe(true);
    });

    it("should return false for legacy tokens", () => {
      const legacyReq: PaymentRequirements = {
        ...mockRequirements[0],
        extra: { tokenType: "legacy" },
      };
      expect(isGaslessPayment(legacyReq)).toBe(false);
    });
  });

  describe("isUsdt0Payment", () => {
    it("should return true for USDT0", () => {
      expect(isUsdt0Payment(mockRequirements[0])).toBe(true);
    });

    it("should return false for non-USDT0", () => {
      expect(isUsdt0Payment(mockRequirements[1])).toBe(false);
    });
  });

  describe("filterByToken", () => {
    it("should filter by token symbol", () => {
      const usdt0Only = filterByToken(mockRequirements, "USDT0");
      expect(usdt0Only.length).toBe(1);
      expect(usdt0Only[0].extra?.symbol).toBe("USDT0");
    });

    it("should be case-insensitive", () => {
      const result = filterByToken(mockRequirements, "usdt0");
      expect(result.length).toBe(1);
    });
  });

  describe("filterByNetwork", () => {
    it("should filter by network", () => {
      const arbitrumOnly = filterByNetwork(mockRequirements, "eip155:42161");
      expect(arbitrumOnly.length).toBe(2);
    });

    it("should return empty for unknown network", () => {
      const result = filterByNetwork(mockRequirements, "eip155:999999");
      expect(result.length).toBe(0);
    });
  });

  describe("getAvailableNetworks", () => {
    it("should return unique networks", () => {
      const networks = getAvailableNetworks(mockRequirements);
      expect(networks).toContain("eip155:42161");
      expect(networks).toContain("eip155:8453");
      expect(networks.length).toBe(2);
    });
  });

  describe("getAvailableTokens", () => {
    it("should return unique tokens", () => {
      const tokens = getAvailableTokens(mockRequirements);
      expect(tokens).toContain("USDT0");
      expect(tokens).toContain("USDC");
      expect(tokens.length).toBe(2); // USDT0 and USDC (USDC appears twice but unique)
    });
  });
});
