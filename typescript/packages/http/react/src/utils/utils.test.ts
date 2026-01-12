import { describe, it, expect } from "vitest";
import {
  isEvmNetwork,
  isSvmNetwork,
  isTonNetwork,
  isTronNetwork,
  isTestnetNetwork,
  getNetworkDisplayName,
  truncateAddress,
  formatTokenAmount,
  getAssetDisplayName,
  normalizePaymentRequirements,
  choosePaymentRequirement,
  getPreferredNetworks,
} from "./index";
import type { PaymentRequirements } from "@t402/core/types";

describe("Network detection utilities", () => {
  describe("isEvmNetwork", () => {
    it("returns true for EVM networks", () => {
      expect(isEvmNetwork("eip155:1")).toBe(true);
      expect(isEvmNetwork("eip155:8453")).toBe(true);
      expect(isEvmNetwork("eip155:84532")).toBe(true);
    });

    it("returns false for non-EVM networks", () => {
      expect(isEvmNetwork("solana:mainnet")).toBe(false);
      expect(isEvmNetwork("ton:-239")).toBe(false);
      expect(isEvmNetwork("tron:mainnet")).toBe(false);
    });
  });

  describe("isSvmNetwork", () => {
    it("returns true for Solana networks", () => {
      expect(isSvmNetwork("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp")).toBe(true);
      expect(isSvmNetwork("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1")).toBe(true);
    });

    it("returns false for non-Solana networks", () => {
      expect(isSvmNetwork("eip155:1")).toBe(false);
      expect(isSvmNetwork("ton:-239")).toBe(false);
    });
  });

  describe("isTonNetwork", () => {
    it("returns true for TON networks", () => {
      expect(isTonNetwork("ton:-239")).toBe(true);
      expect(isTonNetwork("ton:-3")).toBe(true);
    });

    it("returns false for non-TON networks", () => {
      expect(isTonNetwork("eip155:1")).toBe(false);
      expect(isTonNetwork("solana:mainnet")).toBe(false);
    });
  });

  describe("isTronNetwork", () => {
    it("returns true for TRON networks", () => {
      expect(isTronNetwork("tron:mainnet")).toBe(true);
      expect(isTronNetwork("tron:nile")).toBe(true);
    });

    it("returns false for non-TRON networks", () => {
      expect(isTronNetwork("eip155:1")).toBe(false);
      expect(isTronNetwork("ton:-239")).toBe(false);
    });
  });

  describe("isTestnetNetwork", () => {
    it("returns true for testnets", () => {
      expect(isTestnetNetwork("eip155:84532")).toBe(true); // Base Sepolia
      expect(isTestnetNetwork("eip155:421614")).toBe(true); // Arbitrum Sepolia
      expect(isTestnetNetwork("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1")).toBe(true); // Solana Devnet
      expect(isTestnetNetwork("ton:-3")).toBe(true); // TON Testnet
      expect(isTestnetNetwork("tron:nile")).toBe(true); // TRON Nile
    });

    it("returns false for mainnets", () => {
      expect(isTestnetNetwork("eip155:1")).toBe(false);
      expect(isTestnetNetwork("eip155:8453")).toBe(false);
      expect(isTestnetNetwork("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp")).toBe(false);
      expect(isTestnetNetwork("ton:-239")).toBe(false);
      expect(isTestnetNetwork("tron:mainnet")).toBe(false);
    });
  });

  describe("getNetworkDisplayName", () => {
    it("returns correct names for EVM networks", () => {
      expect(getNetworkDisplayName("eip155:1")).toBe("Ethereum");
      expect(getNetworkDisplayName("eip155:8453")).toBe("Base");
      expect(getNetworkDisplayName("eip155:42161")).toBe("Arbitrum One");
      expect(getNetworkDisplayName("eip155:84532")).toBe("Base Sepolia");
    });

    it("returns correct names for Solana networks", () => {
      expect(getNetworkDisplayName("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp")).toBe("Solana");
      expect(getNetworkDisplayName("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1")).toBe("Solana Devnet");
    });

    it("returns correct names for TON networks", () => {
      expect(getNetworkDisplayName("ton:-239")).toBe("TON");
      expect(getNetworkDisplayName("ton:-3")).toBe("TON Testnet");
    });

    it("returns correct names for TRON networks", () => {
      expect(getNetworkDisplayName("tron:mainnet")).toBe("TRON");
      expect(getNetworkDisplayName("tron:nile")).toBe("TRON Nile");
    });

    it("returns fallback for unknown EVM chains", () => {
      expect(getNetworkDisplayName("eip155:99999")).toBe("Chain 99999");
    });
  });
});

describe("Formatting utilities", () => {
  describe("truncateAddress", () => {
    it("truncates long addresses", () => {
      const address = "0x1234567890abcdef1234567890abcdef12345678";
      expect(truncateAddress(address)).toBe("0x1234...5678");
      expect(truncateAddress(address, 8, 6)).toBe("0x123456...345678");
    });

    it("returns short addresses unchanged", () => {
      expect(truncateAddress("0x1234")).toBe("0x1234");
    });
  });

  describe("formatTokenAmount", () => {
    it("formats amounts with 6 decimals (USDT)", () => {
      expect(formatTokenAmount("1000000")).toBe("1");
      expect(formatTokenAmount("1500000")).toBe("1.5");
      expect(formatTokenAmount("1234567")).toBe("1.23");
      expect(formatTokenAmount("100000000")).toBe("100");
    });

    it("formats amounts with custom decimals", () => {
      expect(formatTokenAmount("1000000000000000000", 18)).toBe("1");
      expect(formatTokenAmount("1500000000000000000", 18)).toBe("1.5");
    });

    it("handles zero fractional part", () => {
      expect(formatTokenAmount("5000000")).toBe("5");
    });
  });

  describe("getAssetDisplayName", () => {
    it("returns uppercase asset names", () => {
      expect(getAssetDisplayName("usdt")).toBe("USDT");
      expect(getAssetDisplayName("usdt0")).toBe("USDT0");
      expect(getAssetDisplayName("usdc")).toBe("USDC");
      expect(getAssetDisplayName("unknown")).toBe("UNKNOWN");
    });
  });
});

describe("Payment requirement utilities", () => {
  const mockRequirement: PaymentRequirements = {
    scheme: "exact",
    network: "eip155:8453",
    asset: "usdt0",
    amount: "1000000",
    payTo: "0x1234567890abcdef1234567890abcdef12345678",
    maxTimeoutSeconds: 300,
    extra: {},
  };

  describe("normalizePaymentRequirements", () => {
    it("wraps single requirement in array", () => {
      const result = normalizePaymentRequirements(mockRequirement);
      expect(result).toEqual([mockRequirement]);
    });

    it("returns array unchanged", () => {
      const requirements = [mockRequirement, { ...mockRequirement, network: "eip155:42161" }];
      const result = normalizePaymentRequirements(requirements);
      expect(result).toEqual(requirements);
    });
  });

  describe("getPreferredNetworks", () => {
    it("returns mainnet networks for production", () => {
      const networks = getPreferredNetworks(false);
      expect(networks).toContain("eip155:8453"); // Base mainnet
      expect(networks).not.toContain("eip155:84532"); // Base Sepolia
    });

    it("returns testnet networks for testnet mode", () => {
      const networks = getPreferredNetworks(true);
      expect(networks).toContain("eip155:84532"); // Base Sepolia
      expect(networks).not.toContain("eip155:8453"); // Base mainnet
    });
  });

  describe("choosePaymentRequirement", () => {
    it("selects preferred network when available", () => {
      const requirements = [
        { ...mockRequirement, network: "eip155:1" },
        { ...mockRequirement, network: "eip155:8453" }, // Base mainnet - preferred
        { ...mockRequirement, network: "eip155:42161" },
      ];
      const result = choosePaymentRequirement(requirements, false);
      expect(result.network).toBe("eip155:8453");
    });

    it("falls back to first requirement when no preferred match", () => {
      const requirements = [
        { ...mockRequirement, network: "eip155:999" },
        { ...mockRequirement, network: "eip155:888" },
      ];
      const result = choosePaymentRequirement(requirements, false);
      expect(result.network).toBe("eip155:999");
    });

    it("works with single requirement", () => {
      const result = choosePaymentRequirement(mockRequirement, false);
      expect(result).toEqual(mockRequirement);
    });
  });
});
