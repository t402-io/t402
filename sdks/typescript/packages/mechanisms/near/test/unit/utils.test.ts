import { describe, it, expect } from "vitest";
import {
  normalizeNetwork,
  extractNetworkId,
  isValidAccountId,
  getRpcEndpoint,
  formatAmount,
  toTokenUnits,
} from "../../src/utils.js";

describe("NEAR Utilities", () => {
  describe("normalizeNetwork", () => {
    it("should pass through CAIP-2 format", () => {
      expect(normalizeNetwork("near:mainnet")).toBe("near:mainnet");
      expect(normalizeNetwork("near:testnet")).toBe("near:testnet");
    });

    it("should convert shorthand to CAIP-2", () => {
      expect(normalizeNetwork("mainnet")).toBe("near:mainnet");
      expect(normalizeNetwork("testnet")).toBe("near:testnet");
    });
  });

  describe("extractNetworkId", () => {
    it("should extract network ID from CAIP-2", () => {
      expect(extractNetworkId("near:mainnet")).toBe("mainnet");
      expect(extractNetworkId("near:testnet")).toBe("testnet");
    });

    it("should return input if no colon", () => {
      expect(extractNetworkId("mainnet")).toBe("mainnet");
    });
  });

  describe("isValidAccountId", () => {
    it("should accept valid account IDs", () => {
      expect(isValidAccountId("alice.near")).toBe(true);
      expect(isValidAccountId("bob123.near")).toBe(true);
      expect(isValidAccountId("my-account.near")).toBe(true);
      expect(isValidAccountId("test_account.near")).toBe(true);
      expect(isValidAccountId("ab")).toBe(true);
    });

    it("should reject invalid account IDs", () => {
      expect(isValidAccountId("")).toBe(false);
      expect(isValidAccountId("a")).toBe(false); // Too short
      expect(isValidAccountId("-alice.near")).toBe(false); // Starts with hyphen
      expect(isValidAccountId("Alice.near")).toBe(false); // Uppercase
      expect(isValidAccountId("alice@near")).toBe(false); // Invalid character
    });
  });

  describe("getRpcEndpoint", () => {
    it("should return correct endpoint for mainnet", () => {
      expect(getRpcEndpoint("near:mainnet")).toBe("https://rpc.mainnet.near.org");
    });

    it("should return correct endpoint for testnet", () => {
      expect(getRpcEndpoint("near:testnet")).toBe("https://rpc.testnet.near.org");
    });

    it("should default to mainnet for unknown network", () => {
      expect(getRpcEndpoint("near:unknown")).toBe("https://rpc.mainnet.near.org");
    });
  });

  describe("formatAmount", () => {
    it("should format amount with decimals", () => {
      expect(formatAmount(1000000n, 6)).toBe("1.00");
      expect(formatAmount(1500000n, 6)).toBe("1.50");
      expect(formatAmount(100000n, 6)).toBe("0.10");
    });

    it("should handle large amounts", () => {
      expect(formatAmount(1000000000000n, 6)).toBe("1000000.00");
    });
  });

  describe("toTokenUnits", () => {
    it("should convert decimal to token units", () => {
      expect(toTokenUnits("1.00", 6)).toBe(1000000n);
      expect(toTokenUnits("1.50", 6)).toBe(1500000n);
      expect(toTokenUnits("0.10", 6)).toBe(100000n);
    });

    it("should handle number input", () => {
      expect(toTokenUnits(1.5, 6)).toBe(1500000n);
    });

    it("should throw on invalid input", () => {
      expect(() => toTokenUnits("invalid", 6)).toThrow("Invalid amount");
    });
  });
});
