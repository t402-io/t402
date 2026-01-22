import { describe, it, expect } from "vitest";
import { Address } from "@ton/core";
import {
  normalizeNetwork,
  isTonNetwork,
  validateTonAddress,
  parseTonAddress,
  addressesEqual,
  formatAddress,
  convertToJettonAmount,
  convertFromJettonAmount,
  generateQueryId,
  buildJettonTransferBody,
  parseJettonTransferBody,
} from "../../src/utils";
import { TON_MAINNET_CAIP2, TON_TESTNET_CAIP2, JETTON_TRANSFER_OP } from "../../src/constants";

describe("TON Utils", () => {
  // Valid TON address for testing (TON Foundation)
  const validAddress = "EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N";

  describe("normalizeNetwork", () => {
    it("should accept CAIP-2 format networks", () => {
      expect(normalizeNetwork(TON_MAINNET_CAIP2)).toBe(TON_MAINNET_CAIP2);
      expect(normalizeNetwork(TON_TESTNET_CAIP2)).toBe(TON_TESTNET_CAIP2);
    });

    it("should convert legacy format to CAIP-2", () => {
      expect(normalizeNetwork("ton")).toBe(TON_MAINNET_CAIP2);
      expect(normalizeNetwork("ton-mainnet")).toBe(TON_MAINNET_CAIP2);
      expect(normalizeNetwork("mainnet")).toBe(TON_MAINNET_CAIP2);
      expect(normalizeNetwork("ton-testnet")).toBe(TON_TESTNET_CAIP2);
      expect(normalizeNetwork("testnet")).toBe(TON_TESTNET_CAIP2);
    });

    it("should throw for unsupported networks", () => {
      expect(() => normalizeNetwork("ethereum")).toThrow("Unsupported TON network");
      expect(() => normalizeNetwork("ton:unknown")).toThrow("Unsupported TON network");
    });
  });

  describe("isTonNetwork", () => {
    it("should return true for valid TON networks", () => {
      expect(isTonNetwork(TON_MAINNET_CAIP2)).toBe(true);
      expect(isTonNetwork(TON_TESTNET_CAIP2)).toBe(true);
      expect(isTonNetwork("ton")).toBe(true);
    });

    it("should return false for non-TON networks", () => {
      expect(isTonNetwork("ethereum")).toBe(false);
      expect(isTonNetwork("eip155:1")).toBe(false);
    });
  });

  describe("validateTonAddress", () => {
    it("should validate correct TON addresses", () => {
      expect(validateTonAddress(validAddress)).toBe(true);
    });

    it("should reject invalid addresses", () => {
      expect(validateTonAddress("invalid")).toBe(false);
      expect(validateTonAddress("0x1234")).toBe(false);
      expect(validateTonAddress("")).toBe(false);
    });
  });

  describe("parseTonAddress", () => {
    it("should parse valid TON addresses", () => {
      const addr = parseTonAddress(validAddress);
      expect(addr).toBeInstanceOf(Address);
    });

    it("should throw for invalid addresses", () => {
      expect(() => parseTonAddress("invalid")).toThrow();
    });
  });

  describe("addressesEqual", () => {
    it("should return true for equal addresses", () => {
      expect(addressesEqual(validAddress, validAddress)).toBe(true);
    });

    it("should handle different formats of the same address", () => {
      // Parse and reformat to ensure we're testing format handling
      const addr = Address.parse(validAddress);
      const bounceable = addr.toString({ bounceable: true });
      const nonBounceable = addr.toString({ bounceable: false });
      expect(addressesEqual(bounceable, nonBounceable)).toBe(true);
    });

    it("should return false for different addresses", () => {
      const otherAddress = "EQBvW8Z5huBkMJYdnfAEM5JqTNLuuU8s0xkwYeGPdHaC3sN7";
      expect(addressesEqual(validAddress, otherAddress)).toBe(false);
    });

    it("should return false for invalid addresses", () => {
      expect(addressesEqual("invalid", validAddress)).toBe(false);
      expect(addressesEqual(validAddress, "invalid")).toBe(false);
    });
  });

  describe("formatAddress", () => {
    it("should format address to friendly format", () => {
      const formatted = formatAddress(validAddress);
      expect(formatted).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it("should support bounceable option", () => {
      const bounceable = formatAddress(validAddress, { bounceable: true });
      const nonBounceable = formatAddress(validAddress, { bounceable: false });
      // Both should be valid but may differ
      expect(validateTonAddress(bounceable)).toBe(true);
      expect(validateTonAddress(nonBounceable)).toBe(true);
    });
  });

  describe("convertToJettonAmount", () => {
    it("should convert decimal to smallest units", () => {
      expect(convertToJettonAmount("1.5", 6)).toBe("1500000");
      expect(convertToJettonAmount("100", 6)).toBe("100000000");
      expect(convertToJettonAmount("0.000001", 6)).toBe("1");
    });

    it("should handle zero", () => {
      expect(convertToJettonAmount("0", 6)).toBe("0");
    });

    it("should throw for invalid amounts", () => {
      expect(() => convertToJettonAmount("invalid", 6)).toThrow("Invalid amount");
    });
  });

  describe("convertFromJettonAmount", () => {
    it("should convert smallest units to decimal", () => {
      expect(convertFromJettonAmount("1500000", 6)).toBe("1.5");
      expect(convertFromJettonAmount("100000000", 6)).toBe("100");
      expect(convertFromJettonAmount("1", 6)).toBe("0.000001");
    });

    it("should handle zero", () => {
      expect(convertFromJettonAmount("0", 6)).toBe("0");
    });

    it("should handle bigint input", () => {
      expect(convertFromJettonAmount(1500000n, 6)).toBe("1.5");
    });
  });

  describe("generateQueryId", () => {
    it("should generate unique IDs", () => {
      const id1 = generateQueryId();
      const id2 = generateQueryId();
      expect(id1).not.toBe(id2);
    });

    it("should return bigint", () => {
      const id = generateQueryId();
      expect(typeof id).toBe("bigint");
    });

    it("should be positive", () => {
      const id = generateQueryId();
      expect(id).toBeGreaterThan(0n);
    });
  });

  describe("buildJettonTransferBody and parseJettonTransferBody", () => {
    it("should build and parse Jetton transfer body correctly", () => {
      const params = {
        queryId: 12345n,
        amount: 1000000n,
        destination: Address.parse(validAddress),
        responseDestination: Address.parse(validAddress),
        forwardAmount: 1n,
      };

      const cell = buildJettonTransferBody(params);
      const parsed = parseJettonTransferBody(cell);

      expect(parsed.op).toBe(JETTON_TRANSFER_OP);
      expect(parsed.queryId).toBe(params.queryId);
      expect(parsed.amount).toBe(params.amount);
      expect(parsed.destination.equals(params.destination)).toBe(true);
      expect(parsed.responseDestination.equals(params.responseDestination)).toBe(true);
      expect(parsed.forwardAmount).toBe(params.forwardAmount);
    });
  });
});
