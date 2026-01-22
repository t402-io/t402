import { describe, it, expect } from "vitest";
import {
  getTokenConfig,
  getTokenByContract,
  getDefaultToken,
  getNetworkTokens,
  isNetworkSupported,
} from "../../src/tokens.js";
import { NEAR_MAINNET_CAIP2, NEAR_TESTNET_CAIP2 } from "../../src/constants.js";

describe("NEAR Token Registry", () => {
  describe("getTokenConfig", () => {
    it("should return USDC config for mainnet", () => {
      const config = getTokenConfig(NEAR_MAINNET_CAIP2, "USDC");
      expect(config).toBeDefined();
      expect(config?.symbol).toBe("USDC");
      expect(config?.decimals).toBe(6);
      expect(config?.contractId).toBe(
        "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
      );
    });

    it("should return USDT config for mainnet", () => {
      const config = getTokenConfig(NEAR_MAINNET_CAIP2, "USDT");
      expect(config).toBeDefined();
      expect(config?.symbol).toBe("USDT");
      expect(config?.contractId).toBe("usdt.tether-token.near");
    });

    it("should return USDC config for testnet", () => {
      const config = getTokenConfig(NEAR_TESTNET_CAIP2, "USDC");
      expect(config).toBeDefined();
      expect(config?.symbol).toBe("USDC");
      expect(config?.contractId).toBe("usdc.fakes.testnet");
    });

    it("should return undefined for unknown symbol", () => {
      const config = getTokenConfig(NEAR_MAINNET_CAIP2, "UNKNOWN");
      expect(config).toBeUndefined();
    });

    it("should return undefined for unknown network", () => {
      const config = getTokenConfig("near:unknown", "USDC");
      expect(config).toBeUndefined();
    });

    it("should be case-insensitive for symbol", () => {
      const config1 = getTokenConfig(NEAR_MAINNET_CAIP2, "usdc");
      const config2 = getTokenConfig(NEAR_MAINNET_CAIP2, "USDC");
      expect(config1).toEqual(config2);
    });
  });

  describe("getTokenByContract", () => {
    it("should return token by contract ID", () => {
      const config = getTokenByContract(
        NEAR_MAINNET_CAIP2,
        "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
      );
      expect(config).toBeDefined();
      expect(config?.symbol).toBe("USDC");
    });

    it("should return undefined for unknown contract", () => {
      const config = getTokenByContract(NEAR_MAINNET_CAIP2, "unknown.near");
      expect(config).toBeUndefined();
    });
  });

  describe("getDefaultToken", () => {
    it("should return highest priority token for mainnet (USDC)", () => {
      const token = getDefaultToken(NEAR_MAINNET_CAIP2);
      expect(token).toBeDefined();
      expect(token?.symbol).toBe("USDC");
    });

    it("should return undefined for unknown network", () => {
      const token = getDefaultToken("near:unknown");
      expect(token).toBeUndefined();
    });
  });

  describe("getNetworkTokens", () => {
    it("should return all tokens for mainnet", () => {
      const tokens = getNetworkTokens(NEAR_MAINNET_CAIP2);
      expect(tokens.length).toBe(2);
      expect(tokens.map((t) => t.symbol)).toContain("USDC");
      expect(tokens.map((t) => t.symbol)).toContain("USDT");
    });

    it("should return empty array for unknown network", () => {
      const tokens = getNetworkTokens("near:unknown");
      expect(tokens).toEqual([]);
    });
  });

  describe("isNetworkSupported", () => {
    it("should return true for mainnet", () => {
      expect(isNetworkSupported(NEAR_MAINNET_CAIP2)).toBe(true);
    });

    it("should return true for testnet", () => {
      expect(isNetworkSupported(NEAR_TESTNET_CAIP2)).toBe(true);
    });

    it("should return false for unknown network", () => {
      expect(isNetworkSupported("near:unknown")).toBe(false);
    });
  });
});
