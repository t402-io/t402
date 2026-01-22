import { describe, it, expect } from "vitest";
import {
  isValidTezosAddress,
  isValidOperationHash,
  isTezosNetwork,
} from "../../src/types";

describe("Tezos Types", () => {
  describe("isValidTezosAddress", () => {
    it("should validate tz1 addresses", () => {
      expect(isValidTezosAddress("tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb")).toBe(true);
    });

    it("should validate tz2 addresses", () => {
      expect(isValidTezosAddress("tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m")).toBe(true);
    });

    it("should validate tz3 addresses", () => {
      expect(isValidTezosAddress("tz3WXYtyDUNL91qfiCJtVUX746QpNv5i5ve5")).toBe(true);
    });

    it("should validate KT1 contract addresses", () => {
      expect(isValidTezosAddress("KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o")).toBe(true);
    });

    it("should reject invalid prefixes", () => {
      expect(isValidTezosAddress("tz4InvalidPrefixAddress12345678901234")).toBe(false);
      expect(isValidTezosAddress("KT2InvalidPrefixAddress12345678901234")).toBe(false);
    });

    it("should reject wrong length addresses", () => {
      expect(isValidTezosAddress("tz1Short")).toBe(false);
      expect(isValidTezosAddress("tz1TooLongAddressThatExceeds36Characters")).toBe(false);
    });

    it("should reject empty/null addresses", () => {
      expect(isValidTezosAddress("")).toBe(false);
      expect(isValidTezosAddress(null as unknown as string)).toBe(false);
      expect(isValidTezosAddress(undefined as unknown as string)).toBe(false);
    });

    it("should reject Ethereum-style addresses", () => {
      expect(isValidTezosAddress("0x1234567890123456789012345678901234567890")).toBe(false);
    });
  });

  describe("isValidOperationHash", () => {
    it("should validate correct operation hashes", () => {
      // Operation hashes start with 'o' and are 51 characters
      expect(isValidOperationHash("oo7TSyLzXuiMxZjGp5Z4P4VBUXuc6MNr8PhJNcLX8yY1jyMhMNH")).toBe(true);
    });

    it("should reject hashes without o prefix", () => {
      expect(isValidOperationHash("xo7TSyLzXuiMxZjGp5Z4P4VBUXuc6MNr8PhJNcLX8yY1jyMhMNH")).toBe(false);
    });

    it("should reject hashes with wrong length", () => {
      expect(isValidOperationHash("oshort")).toBe(false);
      expect(isValidOperationHash("o" + "a".repeat(100))).toBe(false);
    });

    it("should reject empty/null hashes", () => {
      expect(isValidOperationHash("")).toBe(false);
      expect(isValidOperationHash(null as unknown as string)).toBe(false);
      expect(isValidOperationHash(undefined as unknown as string)).toBe(false);
    });
  });

  describe("isTezosNetwork", () => {
    it("should return true for Tezos networks", () => {
      expect(isTezosNetwork("tezos:NetXdQprcVkpaWU")).toBe(true);
      expect(isTezosNetwork("tezos:NetXnHfVqm9iesp")).toBe(true);
      expect(isTezosNetwork("tezos:anychain")).toBe(true);
    });

    it("should return false for non-Tezos networks", () => {
      expect(isTezosNetwork("eip155:1")).toBe(false);
      expect(isTezosNetwork("ton:mainnet")).toBe(false);
      expect(isTezosNetwork("polkadot:mainnet")).toBe(false);
      expect(isTezosNetwork("ethereum")).toBe(false);
      expect(isTezosNetwork("")).toBe(false);
    });
  });
});
