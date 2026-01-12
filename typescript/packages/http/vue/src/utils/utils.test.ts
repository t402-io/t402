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
    });

    it("returns false for non-EVM networks", () => {
      expect(isEvmNetwork("solana:mainnet")).toBe(false);
      expect(isEvmNetwork("ton:-239")).toBe(false);
    });
  });

  describe("isSvmNetwork", () => {
    it("returns true for Solana networks", () => {
      expect(isSvmNetwork("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp")).toBe(true);
    });

    it("returns false for non-Solana networks", () => {
      expect(isSvmNetwork("eip155:1")).toBe(false);
    });
  });

  describe("isTonNetwork", () => {
    it("returns true for TON networks", () => {
      expect(isTonNetwork("ton:-239")).toBe(true);
    });

    it("returns false for non-TON networks", () => {
      expect(isTonNetwork("eip155:1")).toBe(false);
    });
  });

  describe("isTronNetwork", () => {
    it("returns true for TRON networks", () => {
      expect(isTronNetwork("tron:mainnet")).toBe(true);
    });

    it("returns false for non-TRON networks", () => {
      expect(isTronNetwork("eip155:1")).toBe(false);
    });
  });

  describe("isTestnetNetwork", () => {
    it("returns true for testnets", () => {
      expect(isTestnetNetwork("eip155:84532")).toBe(true);
      expect(isTestnetNetwork("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1")).toBe(true);
      expect(isTestnetNetwork("ton:-3")).toBe(true);
      expect(isTestnetNetwork("tron:nile")).toBe(true);
    });

    it("returns false for mainnets", () => {
      expect(isTestnetNetwork("eip155:1")).toBe(false);
      expect(isTestnetNetwork("eip155:8453")).toBe(false);
    });
  });

  describe("getNetworkDisplayName", () => {
    it("returns correct names for known networks", () => {
      expect(getNetworkDisplayName("eip155:1")).toBe("Ethereum");
      expect(getNetworkDisplayName("eip155:8453")).toBe("Base");
      expect(getNetworkDisplayName("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1")).toBe("Solana Devnet");
      expect(getNetworkDisplayName("ton:-239")).toBe("TON");
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
    });

    it("returns short addresses unchanged", () => {
      expect(truncateAddress("0x1234")).toBe("0x1234");
    });
  });

  describe("formatTokenAmount", () => {
    it("formats amounts with 6 decimals", () => {
      expect(formatTokenAmount("1000000")).toBe("1");
      expect(formatTokenAmount("1500000")).toBe("1.5");
    });
  });

  describe("getAssetDisplayName", () => {
    it("returns uppercase asset names", () => {
      expect(getAssetDisplayName("usdt")).toBe("USDT");
      expect(getAssetDisplayName("usdt0")).toBe("USDT0");
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
      const requirements = [mockRequirement];
      const result = normalizePaymentRequirements(requirements);
      expect(result).toEqual(requirements);
    });
  });

  describe("getPreferredNetworks", () => {
    it("returns mainnet networks for production", () => {
      const networks = getPreferredNetworks(false);
      expect(networks).toContain("eip155:8453");
    });

    it("returns testnet networks for testnet mode", () => {
      const networks = getPreferredNetworks(true);
      expect(networks).toContain("eip155:84532");
    });
  });

  describe("choosePaymentRequirement", () => {
    it("selects preferred network when available", () => {
      const requirements = [
        { ...mockRequirement, network: "eip155:1" },
        { ...mockRequirement, network: "eip155:8453" },
      ];
      const result = choosePaymentRequirement(requirements, false);
      expect(result.network).toBe("eip155:8453");
    });

    it("falls back to first requirement when no preferred match", () => {
      const requirements = [{ ...mockRequirement, network: "eip155:999" }];
      const result = choosePaymentRequirement(requirements, false);
      expect(result.network).toBe("eip155:999");
    });
  });
});
