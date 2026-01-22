import { describe, it, expect } from "vitest";
import {
  USDT_MAINNET,
  TOKEN_REGISTRY,
  DEFAULT_TOKENS,
  getTokenBySymbol,
  getTokenByContract,
  getDefaultToken,
} from "../../src/tokens";
import { TEZOS_MAINNET_CAIP2, TEZOS_GHOSTNET_CAIP2 } from "../../src/constants";

describe("Tezos Tokens", () => {
  describe("USDT_MAINNET", () => {
    it("should have correct contract address", () => {
      expect(USDT_MAINNET.contractAddress).toBe("KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o");
    });

    it("should have token ID 0", () => {
      expect(USDT_MAINNET.tokenId).toBe(0);
    });

    it("should have symbol USDt", () => {
      expect(USDT_MAINNET.symbol).toBe("USDt");
    });

    it("should have 6 decimals", () => {
      expect(USDT_MAINNET.decimals).toBe(6);
    });

    it("should have correct name", () => {
      expect(USDT_MAINNET.name).toBe("Tether USD");
    });

    it("should have KT1 contract address prefix", () => {
      expect(USDT_MAINNET.contractAddress.startsWith("KT1")).toBe(true);
    });
  });

  describe("TOKEN_REGISTRY", () => {
    it("should have mainnet tokens", () => {
      expect(TOKEN_REGISTRY[TEZOS_MAINNET_CAIP2]).toBeDefined();
      expect(TOKEN_REGISTRY[TEZOS_MAINNET_CAIP2].length).toBeGreaterThan(0);
    });

    it("should include USDT on mainnet", () => {
      expect(TOKEN_REGISTRY[TEZOS_MAINNET_CAIP2]).toContain(USDT_MAINNET);
    });

    it("should have ghostnet entry (empty for testnet)", () => {
      expect(TOKEN_REGISTRY[TEZOS_GHOSTNET_CAIP2]).toBeDefined();
      expect(Array.isArray(TOKEN_REGISTRY[TEZOS_GHOSTNET_CAIP2])).toBe(true);
    });
  });

  describe("DEFAULT_TOKENS", () => {
    it("should have USDT as default for mainnet", () => {
      expect(DEFAULT_TOKENS[TEZOS_MAINNET_CAIP2]).toBe(USDT_MAINNET);
    });

    it("should have undefined default for ghostnet", () => {
      expect(DEFAULT_TOKENS[TEZOS_GHOSTNET_CAIP2]).toBeUndefined();
    });
  });

  describe("getTokenBySymbol", () => {
    it("should find token by symbol (case-insensitive)", () => {
      expect(getTokenBySymbol(TEZOS_MAINNET_CAIP2, "USDt")).toBe(USDT_MAINNET);
      expect(getTokenBySymbol(TEZOS_MAINNET_CAIP2, "usdt")).toBe(USDT_MAINNET);
      expect(getTokenBySymbol(TEZOS_MAINNET_CAIP2, "USDT")).toBe(USDT_MAINNET);
    });

    it("should return undefined for unknown symbol", () => {
      expect(getTokenBySymbol(TEZOS_MAINNET_CAIP2, "UNKNOWN")).toBeUndefined();
    });

    it("should return undefined for invalid network", () => {
      expect(getTokenBySymbol("invalid", "USDt")).toBeUndefined();
    });
  });

  describe("getTokenByContract", () => {
    it("should find token by contract address and token ID", () => {
      expect(
        getTokenByContract(
          TEZOS_MAINNET_CAIP2,
          "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o",
          0
        )
      ).toBe(USDT_MAINNET);
    });

    it("should be case-insensitive for contract address", () => {
      expect(
        getTokenByContract(
          TEZOS_MAINNET_CAIP2,
          "kt1xntn74butxhfdtbmm2bgzaqfhpbvkwr8o",
          0
        )
      ).toBe(USDT_MAINNET);
    });

    it("should return undefined for wrong token ID", () => {
      expect(
        getTokenByContract(
          TEZOS_MAINNET_CAIP2,
          "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o",
          1
        )
      ).toBeUndefined();
    });

    it("should return undefined for unknown contract", () => {
      expect(
        getTokenByContract(
          TEZOS_MAINNET_CAIP2,
          "KT1UnknownContract",
          0
        )
      ).toBeUndefined();
    });

    it("should return undefined for invalid network", () => {
      expect(
        getTokenByContract(
          "invalid",
          "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o",
          0
        )
      ).toBeUndefined();
    });
  });

  describe("getDefaultToken", () => {
    it("should return default token for mainnet", () => {
      expect(getDefaultToken(TEZOS_MAINNET_CAIP2)).toBe(USDT_MAINNET);
    });

    it("should return undefined for ghostnet (no default)", () => {
      expect(getDefaultToken(TEZOS_GHOSTNET_CAIP2)).toBeUndefined();
    });

    it("should return undefined for invalid network", () => {
      expect(getDefaultToken("invalid")).toBeUndefined();
    });
  });
});
