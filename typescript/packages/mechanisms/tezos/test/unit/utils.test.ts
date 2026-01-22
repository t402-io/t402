import { describe, it, expect } from "vitest";
import {
  getNetworkConfig,
  isSupportedNetwork,
  parseNetworkId,
  buildNetworkId,
  getIndexerUrl,
  getRpcUrl,
  compareAddresses,
  formatAmount,
  parseAmount,
  extractFA2TransferDetails,
} from "../../src/utils";
import {
  TEZOS_MAINNET_CAIP2,
  TEZOS_GHOSTNET_CAIP2,
  DEFAULT_MAINNET_RPC,
  DEFAULT_MAINNET_INDEXER,
} from "../../src/constants";

describe("Tezos Utils", () => {
  // Valid Tezos addresses for testing
  const validTz1 = "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb";
  const validKT1 = "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o";

  describe("getNetworkConfig", () => {
    it("should return config for mainnet", () => {
      const config = getNetworkConfig(TEZOS_MAINNET_CAIP2);
      expect(config).toBeDefined();
      expect(config?.name).toBe("Tezos Mainnet");
    });

    it("should return config for ghostnet", () => {
      const config = getNetworkConfig(TEZOS_GHOSTNET_CAIP2);
      expect(config).toBeDefined();
      expect(config?.name).toBe("Tezos Ghostnet");
    });

    it("should return undefined for invalid network", () => {
      expect(getNetworkConfig("invalid")).toBeUndefined();
    });
  });

  describe("isSupportedNetwork", () => {
    it("should return true for mainnet", () => {
      expect(isSupportedNetwork(TEZOS_MAINNET_CAIP2)).toBe(true);
    });

    it("should return true for ghostnet", () => {
      expect(isSupportedNetwork(TEZOS_GHOSTNET_CAIP2)).toBe(true);
    });

    it("should return false for invalid network", () => {
      expect(isSupportedNetwork("invalid")).toBe(false);
      expect(isSupportedNetwork("eip155:1")).toBe(false);
    });
  });

  describe("parseNetworkId", () => {
    it("should parse valid CAIP-2 identifier", () => {
      const result = parseNetworkId(TEZOS_MAINNET_CAIP2);
      expect(result).not.toBeNull();
      expect(result?.namespace).toBe("tezos");
      expect(result?.reference).toBe("NetXdQprcVkpaWU");
    });

    it("should parse ghostnet identifier", () => {
      const result = parseNetworkId(TEZOS_GHOSTNET_CAIP2);
      expect(result).not.toBeNull();
      expect(result?.namespace).toBe("tezos");
      expect(result?.reference).toBe("NetXnHfVqm9iesp");
    });

    it("should return null for invalid format", () => {
      expect(parseNetworkId("invalid")).toBeNull();
      expect(parseNetworkId("")).toBeNull();
      expect(parseNetworkId("a:b:c")).toBeNull();
    });
  });

  describe("buildNetworkId", () => {
    it("should build correct CAIP-2 identifier", () => {
      expect(buildNetworkId("NetXdQprcVkpaWU")).toBe(TEZOS_MAINNET_CAIP2);
      expect(buildNetworkId("NetXnHfVqm9iesp")).toBe(TEZOS_GHOSTNET_CAIP2);
    });
  });

  describe("getIndexerUrl", () => {
    it("should return indexer URL for valid network", () => {
      expect(getIndexerUrl(TEZOS_MAINNET_CAIP2)).toBe(DEFAULT_MAINNET_INDEXER);
    });

    it("should return undefined for invalid network", () => {
      expect(getIndexerUrl("invalid")).toBeUndefined();
    });
  });

  describe("getRpcUrl", () => {
    it("should return RPC URL for valid network", () => {
      expect(getRpcUrl(TEZOS_MAINNET_CAIP2)).toBe(DEFAULT_MAINNET_RPC);
    });

    it("should return undefined for invalid network", () => {
      expect(getRpcUrl("invalid")).toBeUndefined();
    });
  });

  describe("compareAddresses", () => {
    it("should return true for identical addresses", () => {
      expect(compareAddresses(validTz1, validTz1)).toBe(true);
      expect(compareAddresses(validKT1, validKT1)).toBe(true);
    });

    it("should return false for different addresses", () => {
      expect(compareAddresses(validTz1, validKT1)).toBe(false);
    });

    it("should return false for empty addresses", () => {
      expect(compareAddresses("", validTz1)).toBe(false);
      expect(compareAddresses(validTz1, "")).toBe(false);
    });
  });

  describe("formatAmount", () => {
    it("should format whole amounts correctly", () => {
      expect(formatAmount(1000000n, 6)).toBe("1.000000");
      expect(formatAmount(100000000n, 6)).toBe("100.000000");
    });

    it("should format decimal amounts correctly", () => {
      expect(formatAmount(1500000n, 6)).toBe("1.500000");
      expect(formatAmount(1234567n, 6)).toBe("1.234567");
    });

    it("should handle zero", () => {
      expect(formatAmount(0n, 6)).toBe("0.000000");
    });

    it("should handle small amounts", () => {
      expect(formatAmount(1n, 6)).toBe("0.000001");
      expect(formatAmount(10n, 6)).toBe("0.000010");
    });
  });

  describe("parseAmount", () => {
    it("should parse whole amounts correctly", () => {
      expect(parseAmount("1", 6)).toBe(1000000n);
      expect(parseAmount("100", 6)).toBe(100000000n);
    });

    it("should parse decimal amounts correctly", () => {
      expect(parseAmount("1.5", 6)).toBe(1500000n);
      expect(parseAmount("1.234567", 6)).toBe(1234567n);
    });

    it("should handle amounts with fewer decimals", () => {
      expect(parseAmount("1.1", 6)).toBe(1100000n);
    });

    it("should handle zero", () => {
      expect(parseAmount("0", 6)).toBe(0n);
    });

    it("should truncate extra decimals", () => {
      expect(parseAmount("1.12345678", 6)).toBe(1123456n);
    });
  });

  describe("extractFA2TransferDetails", () => {
    it("should extract details from valid FA2 transfer parameter", () => {
      const parameter = [
        {
          from_: validTz1,
          txs: [
            {
              to_: validKT1,
              token_id: 0,
              amount: "1000000",
            },
          ],
        },
      ];

      const result = extractFA2TransferDetails(parameter);
      expect(result).not.toBeNull();
      expect(result?.from).toBe(validTz1);
      expect(result?.to).toBe(validKT1);
      expect(result?.tokenId).toBe(0);
      expect(result?.amount).toBe("1000000");
    });

    it("should handle string token_id", () => {
      const parameter = [
        {
          from_: validTz1,
          txs: [
            {
              to_: validKT1,
              token_id: "0",
              amount: "1000000",
            },
          ],
        },
      ];

      const result = extractFA2TransferDetails(parameter);
      expect(result?.tokenId).toBe(0);
    });

    it("should handle numeric amount", () => {
      const parameter = [
        {
          from_: validTz1,
          txs: [
            {
              to_: validKT1,
              token_id: 0,
              amount: 1000000,
            },
          ],
        },
      ];

      const result = extractFA2TransferDetails(parameter);
      expect(result?.amount).toBe("1000000");
    });

    it("should return null for null parameter", () => {
      expect(extractFA2TransferDetails(null)).toBeNull();
    });

    it("should return null for non-array parameter", () => {
      expect(extractFA2TransferDetails({})).toBeNull();
      expect(extractFA2TransferDetails("invalid")).toBeNull();
    });

    it("should return null for empty array", () => {
      expect(extractFA2TransferDetails([])).toBeNull();
    });

    it("should return null for missing from_", () => {
      const parameter = [
        {
          txs: [{ to_: validKT1, token_id: 0, amount: "1000000" }],
        },
      ];
      expect(extractFA2TransferDetails(parameter)).toBeNull();
    });

    it("should return null for empty txs", () => {
      const parameter = [
        {
          from_: validTz1,
          txs: [],
        },
      ];
      expect(extractFA2TransferDetails(parameter)).toBeNull();
    });
  });
});
