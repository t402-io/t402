import { describe, it, expect } from "vitest";
import {
  isValidAddress,
  isValidExtrinsicHash,
  isValidBlockHash,
  compareAddresses,
  formatAmount,
  parseAmount,
  extractAssetTransfer,
  extractAssetTransferFromEvents,
  buildExtrinsicId,
  parseExtrinsicId,
} from "../../src/utils";
import type { PolkadotExtrinsicResult } from "../../src/types";

describe("Polkadot Utils", () => {
  // Valid Polkadot address for testing (48 chars, SS58 format)
  const validAddress = "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5";
  // Another valid address
  const validAddress2 = "12xtAYsRUrmbniiWQqJtECiBQrMn8AypQcXhnQAc6RB6XkLW";
  // Valid extrinsic hash (0x + 64 hex chars)
  const validExtrinsicHash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
  const validBlockHash = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

  describe("isValidAddress", () => {
    it("should validate correct SS58 addresses", () => {
      expect(isValidAddress(validAddress)).toBe(true);
      expect(isValidAddress(validAddress2)).toBe(true);
    });

    it("should reject invalid addresses", () => {
      expect(isValidAddress("")).toBe(false);
      expect(isValidAddress("invalid")).toBe(false);
      expect(isValidAddress("0x1234567890abcdef")).toBe(false);
      expect(isValidAddress("short")).toBe(false);
    });

    it("should reject null/undefined", () => {
      expect(isValidAddress(null as unknown as string)).toBe(false);
      expect(isValidAddress(undefined as unknown as string)).toBe(false);
    });

    it("should reject addresses with invalid characters", () => {
      // Contains 'O' which is not in base58
      expect(isValidAddress("O5oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5")).toBe(false);
      // Contains 'I' which is not in base58
      expect(isValidAddress("I5oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5")).toBe(false);
      // Contains 'l' which is not in base58
      expect(isValidAddress("l5oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5")).toBe(false);
    });
  });

  describe("isValidExtrinsicHash", () => {
    it("should validate correct extrinsic hashes", () => {
      expect(isValidExtrinsicHash(validExtrinsicHash)).toBe(true);
    });

    it("should reject invalid hashes", () => {
      expect(isValidExtrinsicHash("")).toBe(false);
      expect(isValidExtrinsicHash("0x1234")).toBe(false); // Too short
      expect(isValidExtrinsicHash("1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef")).toBe(false); // Missing 0x
      expect(isValidExtrinsicHash("0xGGGG567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef")).toBe(false); // Invalid hex
    });

    it("should reject null/undefined", () => {
      expect(isValidExtrinsicHash(null as unknown as string)).toBe(false);
      expect(isValidExtrinsicHash(undefined as unknown as string)).toBe(false);
    });
  });

  describe("isValidBlockHash", () => {
    it("should validate correct block hashes", () => {
      expect(isValidBlockHash(validBlockHash)).toBe(true);
    });

    it("should have same validation as extrinsic hash", () => {
      expect(isValidBlockHash(validExtrinsicHash)).toBe(true);
      expect(isValidBlockHash("invalid")).toBe(false);
    });
  });

  describe("compareAddresses", () => {
    it("should return true for identical addresses", () => {
      expect(compareAddresses(validAddress, validAddress)).toBe(true);
    });

    it("should return false for different addresses", () => {
      expect(compareAddresses(validAddress, validAddress2)).toBe(false);
    });

    it("should be case-sensitive", () => {
      expect(compareAddresses(validAddress, validAddress.toLowerCase())).toBe(false);
    });
  });

  describe("formatAmount", () => {
    it("should format whole amounts correctly", () => {
      expect(formatAmount("1000000", 6)).toBe("1");
      expect(formatAmount("100000000", 6)).toBe("100");
    });

    it("should format decimal amounts correctly", () => {
      expect(formatAmount("1500000", 6)).toBe("1.5");
      expect(formatAmount("1234567", 6)).toBe("1.234567");
    });

    it("should trim trailing zeros", () => {
      expect(formatAmount("1100000", 6)).toBe("1.1");
      expect(formatAmount("1010000", 6)).toBe("1.01");
    });

    it("should handle zero", () => {
      expect(formatAmount("0", 6)).toBe("0");
    });

    it("should handle small amounts", () => {
      expect(formatAmount("1", 6)).toBe("0.000001");
      expect(formatAmount("10", 6)).toBe("0.00001");
    });
  });

  describe("parseAmount", () => {
    it("should parse whole amounts correctly", () => {
      expect(parseAmount("1", 6)).toBe("1000000");
      expect(parseAmount("100", 6)).toBe("100000000");
    });

    it("should parse decimal amounts correctly", () => {
      expect(parseAmount("1.5", 6)).toBe("1500000");
      expect(parseAmount("1.234567", 6)).toBe("1234567");
    });

    it("should handle amounts with fewer decimals", () => {
      expect(parseAmount("1.1", 6)).toBe("1100000");
      expect(parseAmount("1.01", 6)).toBe("1010000");
    });

    it("should handle zero", () => {
      expect(parseAmount("0", 6)).toBe("0");
    });

    it("should truncate extra decimal places", () => {
      expect(parseAmount("1.12345678", 6)).toBe("1123456");
    });
  });

  describe("formatAmount and parseAmount roundtrip", () => {
    it("should be reversible for whole amounts", () => {
      const amount = "1000000";
      expect(parseAmount(formatAmount(amount, 6), 6)).toBe(amount);
    });

    it("should be reversible for decimal amounts", () => {
      const amount = "1234567";
      expect(parseAmount(formatAmount(amount, 6), 6)).toBe(amount);
    });
  });

  describe("extractAssetTransfer", () => {
    it("should extract transfer details from valid extrinsic", () => {
      const result: PolkadotExtrinsicResult = {
        extrinsicHash: validExtrinsicHash,
        blockHash: validBlockHash,
        blockNumber: 12345,
        extrinsicIndex: 2,
        timestamp: "2024-01-01T00:00:00Z",
        signer: validAddress,
        success: true,
        module: "assets",
        call: "transfer",
        args: {
          id: 1984,
          target: validAddress2,
          amount: "1000000",
        },
        events: [],
      };

      const transfer = extractAssetTransfer(result);
      expect(transfer).not.toBeNull();
      expect(transfer?.assetId).toBe(1984);
      expect(transfer?.from).toBe(validAddress);
      expect(transfer?.to).toBe(validAddress2);
      expect(transfer?.amount).toBe("1000000");
      expect(transfer?.success).toBe(true);
    });

    it("should extract from transferKeepAlive", () => {
      const result: PolkadotExtrinsicResult = {
        extrinsicHash: validExtrinsicHash,
        blockHash: validBlockHash,
        blockNumber: 12345,
        extrinsicIndex: 2,
        timestamp: "2024-01-01T00:00:00Z",
        signer: validAddress,
        success: true,
        module: "assets",
        call: "transferKeepAlive",
        args: {
          id: 1984,
          target: validAddress2,
          amount: "1000000",
        },
        events: [],
      };

      const transfer = extractAssetTransfer(result);
      expect(transfer).not.toBeNull();
    });

    it("should return null for failed extrinsic", () => {
      const result: PolkadotExtrinsicResult = {
        extrinsicHash: validExtrinsicHash,
        blockHash: validBlockHash,
        blockNumber: 12345,
        extrinsicIndex: 2,
        timestamp: "2024-01-01T00:00:00Z",
        signer: validAddress,
        success: false,
        module: "assets",
        call: "transfer",
        args: {},
        events: [],
      };

      expect(extractAssetTransfer(result)).toBeNull();
    });

    it("should return null for non-assets module", () => {
      const result: PolkadotExtrinsicResult = {
        extrinsicHash: validExtrinsicHash,
        blockHash: validBlockHash,
        blockNumber: 12345,
        extrinsicIndex: 2,
        timestamp: "2024-01-01T00:00:00Z",
        signer: validAddress,
        success: true,
        module: "balances",
        call: "transfer",
        args: {},
        events: [],
      };

      expect(extractAssetTransfer(result)).toBeNull();
    });

    it("should return null for non-transfer call", () => {
      const result: PolkadotExtrinsicResult = {
        extrinsicHash: validExtrinsicHash,
        blockHash: validBlockHash,
        blockNumber: 12345,
        extrinsicIndex: 2,
        timestamp: "2024-01-01T00:00:00Z",
        signer: validAddress,
        success: true,
        module: "assets",
        call: "mint",
        args: {},
        events: [],
      };

      expect(extractAssetTransfer(result)).toBeNull();
    });
  });

  describe("extractAssetTransferFromEvents", () => {
    it("should extract transfer from events", () => {
      const result: PolkadotExtrinsicResult = {
        extrinsicHash: validExtrinsicHash,
        blockHash: validBlockHash,
        blockNumber: 12345,
        extrinsicIndex: 2,
        timestamp: "2024-01-01T00:00:00Z",
        signer: validAddress,
        success: true,
        module: "assets",
        call: "transfer",
        args: {},
        events: [
          {
            module: "assets",
            name: "Transferred",
            data: {
              assetId: 1984,
              from: validAddress,
              to: validAddress2,
              amount: "1000000",
            },
          },
        ],
      };

      const transfer = extractAssetTransferFromEvents(result);
      expect(transfer).not.toBeNull();
      expect(transfer?.assetId).toBe(1984);
      expect(transfer?.from).toBe(validAddress);
      expect(transfer?.to).toBe(validAddress2);
      expect(transfer?.amount).toBe("1000000");
    });

    it("should return null when no Transferred event", () => {
      const result: PolkadotExtrinsicResult = {
        extrinsicHash: validExtrinsicHash,
        blockHash: validBlockHash,
        blockNumber: 12345,
        extrinsicIndex: 2,
        timestamp: "2024-01-01T00:00:00Z",
        signer: validAddress,
        success: true,
        module: "assets",
        call: "transfer",
        args: {},
        events: [],
      };

      expect(extractAssetTransferFromEvents(result)).toBeNull();
    });
  });

  describe("buildExtrinsicId", () => {
    it("should build correct extrinsic ID", () => {
      const id = buildExtrinsicId(validBlockHash, 2);
      expect(id).toBe(`${validBlockHash}-2`);
    });

    it("should handle index 0", () => {
      const id = buildExtrinsicId(validBlockHash, 0);
      expect(id).toBe(`${validBlockHash}-0`);
    });
  });

  describe("parseExtrinsicId", () => {
    it("should parse valid extrinsic ID", () => {
      const id = buildExtrinsicId(validBlockHash, 2);
      const parsed = parseExtrinsicId(id);
      expect(parsed).not.toBeNull();
      expect(parsed?.blockHash).toBe(validBlockHash);
      expect(parsed?.extrinsicIndex).toBe(2);
    });

    it("should return null for invalid ID", () => {
      expect(parseExtrinsicId("invalid")).toBeNull();
      expect(parseExtrinsicId("")).toBeNull();
    });

    it("should return null for invalid block hash", () => {
      expect(parseExtrinsicId("invalidhash-2")).toBeNull();
    });

    it("should return null for non-numeric index", () => {
      expect(parseExtrinsicId(`${validBlockHash}-abc`)).toBeNull();
    });
  });

  describe("buildExtrinsicId and parseExtrinsicId roundtrip", () => {
    it("should be reversible", () => {
      const blockHash = validBlockHash;
      const index = 5;
      const id = buildExtrinsicId(blockHash, index);
      const parsed = parseExtrinsicId(id);
      expect(parsed?.blockHash).toBe(blockHash);
      expect(parsed?.extrinsicIndex).toBe(index);
    });
  });
});
