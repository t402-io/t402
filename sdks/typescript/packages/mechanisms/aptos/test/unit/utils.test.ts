import { describe, it, expect } from "vitest";
import {
  isValidAptosAddress,
  normalizeAptosAddress,
  compareAddresses,
  isValidTxHash,
  getDefaultRpcUrl,
  isAptosNetwork,
  parseAssetIdentifier,
  createAssetIdentifier,
  formatAmount,
  parseAmount,
} from "../../src/utils.js";
import {
  APTOS_MAINNET_CAIP2,
  APTOS_TESTNET_CAIP2,
  DEFAULT_MAINNET_RPC,
  DEFAULT_TESTNET_RPC,
} from "../../src/constants.js";

describe("Aptos Utilities", () => {
  describe("isValidAptosAddress", () => {
    it("should accept valid full address", () => {
      const addr =
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      expect(isValidAptosAddress(addr)).toBe(true);
    });

    it("should accept valid short address", () => {
      expect(isValidAptosAddress("0x1")).toBe(true);
      expect(isValidAptosAddress("0xabc")).toBe(true);
    });

    it("should reject address without 0x prefix", () => {
      expect(isValidAptosAddress("1234")).toBe(false);
    });

    it("should reject empty string", () => {
      expect(isValidAptosAddress("")).toBe(false);
    });

    it("should reject invalid hex characters", () => {
      expect(isValidAptosAddress("0xGGGG")).toBe(false);
    });

    it("should reject too long address", () => {
      const tooLong = "0x" + "a".repeat(65);
      expect(isValidAptosAddress(tooLong)).toBe(false);
    });
  });

  describe("normalizeAptosAddress", () => {
    it("should pad short address", () => {
      const result = normalizeAptosAddress("0x1");
      expect(result).toBe("0x" + "0".repeat(63) + "1");
    });

    it("should lowercase address", () => {
      const result = normalizeAptosAddress("0xABCD");
      expect(result).toMatch(/^0x[0-9a-f]+$/);
    });

    it("should throw for invalid address", () => {
      expect(() => normalizeAptosAddress("invalid")).toThrow();
    });
  });

  describe("compareAddresses", () => {
    it("should return true for same address", () => {
      const addr =
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      expect(compareAddresses(addr, addr)).toBe(true);
    });

    it("should return true for different case", () => {
      const addr1 = "0xABCDEF";
      const addr2 = "0xabcdef";
      expect(compareAddresses(addr1, addr2)).toBe(true);
    });

    it("should return true for short vs full address", () => {
      const short = "0x1";
      const full = "0x" + "0".repeat(63) + "1";
      expect(compareAddresses(short, full)).toBe(true);
    });

    it("should return false for different addresses", () => {
      expect(compareAddresses("0x1", "0x2")).toBe(false);
    });

    it("should return false for invalid addresses", () => {
      expect(compareAddresses("invalid", "0x1")).toBe(false);
    });
  });

  describe("isValidTxHash", () => {
    it("should accept valid transaction hash", () => {
      const hash =
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      expect(isValidTxHash(hash)).toBe(true);
    });

    it("should reject hash without 0x prefix", () => {
      const hash =
        "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      expect(isValidTxHash(hash)).toBe(false);
    });

    it("should reject short hash", () => {
      expect(isValidTxHash("0x1234")).toBe(false);
    });

    it("should reject empty string", () => {
      expect(isValidTxHash("")).toBe(false);
    });
  });

  describe("getDefaultRpcUrl", () => {
    it("should return mainnet RPC for mainnet", () => {
      expect(getDefaultRpcUrl(APTOS_MAINNET_CAIP2)).toBe(DEFAULT_MAINNET_RPC);
    });

    it("should return testnet RPC for testnet", () => {
      expect(getDefaultRpcUrl(APTOS_TESTNET_CAIP2)).toBe(DEFAULT_TESTNET_RPC);
    });

    it("should throw for unknown network", () => {
      expect(() => getDefaultRpcUrl("aptos:999")).toThrow();
    });
  });

  describe("isAptosNetwork", () => {
    it("should return true for Aptos networks", () => {
      expect(isAptosNetwork(APTOS_MAINNET_CAIP2)).toBe(true);
      expect(isAptosNetwork(APTOS_TESTNET_CAIP2)).toBe(true);
      expect(isAptosNetwork("aptos:999")).toBe(true);
    });

    it("should return false for non-Aptos networks", () => {
      expect(isAptosNetwork("eip155:1")).toBe(false);
      expect(isAptosNetwork("solana:mainnet")).toBe(false);
      expect(isAptosNetwork("near:mainnet")).toBe(false);
    });
  });

  describe("parseAssetIdentifier", () => {
    it("should parse valid asset identifier", () => {
      const asset = "aptos:1/fa:0x123abc";
      const result = parseAssetIdentifier(asset);
      expect(result).toBeDefined();
      expect(result?.network).toBe("aptos:1");
      expect(result?.metadataAddress).toBe("0x123abc");
    });

    it("should return null for invalid format", () => {
      expect(parseAssetIdentifier("invalid")).toBeNull();
      expect(parseAssetIdentifier("aptos:1")).toBeNull();
      expect(parseAssetIdentifier("aptos:1/erc20:0x123")).toBeNull();
    });

    it("should return null for non-Aptos network", () => {
      expect(parseAssetIdentifier("eip155:1/fa:0x123")).toBeNull();
    });
  });

  describe("createAssetIdentifier", () => {
    it("should create valid asset identifier", () => {
      const result = createAssetIdentifier("aptos:1", "0x123abc");
      expect(result).toBe("aptos:1/fa:0x123abc");
    });
  });

  describe("formatAmount", () => {
    it("should format amount with decimals", () => {
      expect(formatAmount(1000000n, 6)).toBe("1.000000");
      expect(formatAmount(1500000n, 6)).toBe("1.500000");
    });

    it("should handle zero", () => {
      expect(formatAmount(0n, 6)).toBe("0.000000");
    });

    it("should handle small amounts", () => {
      expect(formatAmount(1n, 6)).toBe("0.000001");
    });
  });

  describe("parseAmount", () => {
    it("should parse decimal amount", () => {
      expect(parseAmount("1.5", 6)).toBe(1500000n);
      expect(parseAmount("1.000001", 6)).toBe(1000001n);
    });

    it("should handle whole numbers", () => {
      expect(parseAmount("100", 6)).toBe(100000000n);
    });

    it("should handle zero", () => {
      expect(parseAmount("0", 6)).toBe(0n);
    });

    it("should truncate extra decimals", () => {
      expect(parseAmount("1.1234567890", 6)).toBe(1123456n);
    });
  });
});
