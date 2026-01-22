import { describe, it, expect } from "vitest";
import {
  TOKEN_REGISTRY,
  getTokenConfig,
  getSupportedTokens,
  isTokenSupported,
  getTokenByAddress,
  getDefaultToken,
  DEFAULT_TOKEN_SYMBOL,
} from "../../src/tokens.js";
import {
  APTOS_MAINNET_CAIP2,
  APTOS_TESTNET_CAIP2,
  APTOS_DEVNET_CAIP2,
} from "../../src/constants.js";

describe("Aptos Token Registry", () => {
  describe("TOKEN_REGISTRY", () => {
    it("should have mainnet tokens", () => {
      expect(TOKEN_REGISTRY[APTOS_MAINNET_CAIP2]).toBeDefined();
      expect(TOKEN_REGISTRY[APTOS_MAINNET_CAIP2].length).toBeGreaterThan(0);
    });

    it("should have USDT on mainnet", () => {
      const usdt = TOKEN_REGISTRY[APTOS_MAINNET_CAIP2].find(
        (t) => t.symbol === "USDT",
      );
      expect(usdt).toBeDefined();
      expect(usdt?.decimals).toBe(6);
      expect(usdt?.metadataAddress).toMatch(/^0x[a-fA-F0-9]+$/);
    });

    it("should have testnet tokens", () => {
      expect(TOKEN_REGISTRY[APTOS_TESTNET_CAIP2]).toBeDefined();
    });
  });

  describe("getTokenConfig", () => {
    it("should return USDT config for mainnet", () => {
      const config = getTokenConfig(APTOS_MAINNET_CAIP2, "USDT");
      expect(config).toBeDefined();
      expect(config?.symbol).toBe("USDT");
      expect(config?.decimals).toBe(6);
    });

    it("should be case-insensitive", () => {
      const config1 = getTokenConfig(APTOS_MAINNET_CAIP2, "usdt");
      const config2 = getTokenConfig(APTOS_MAINNET_CAIP2, "USDT");
      expect(config1).toEqual(config2);
    });

    it("should return undefined for unknown token", () => {
      const config = getTokenConfig(APTOS_MAINNET_CAIP2, "UNKNOWN");
      expect(config).toBeUndefined();
    });

    it("should return undefined for unknown network", () => {
      const config = getTokenConfig("aptos:999", "USDT");
      expect(config).toBeUndefined();
    });
  });

  describe("getSupportedTokens", () => {
    it("should return all mainnet tokens", () => {
      const tokens = getSupportedTokens(APTOS_MAINNET_CAIP2);
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens.some((t) => t.symbol === "USDT")).toBe(true);
    });

    it("should return empty array for unknown network", () => {
      const tokens = getSupportedTokens("aptos:999");
      expect(tokens).toEqual([]);
    });
  });

  describe("isTokenSupported", () => {
    it("should return true for supported token", () => {
      expect(isTokenSupported(APTOS_MAINNET_CAIP2, "USDT")).toBe(true);
    });

    it("should return false for unsupported token", () => {
      expect(isTokenSupported(APTOS_MAINNET_CAIP2, "UNKNOWN")).toBe(false);
    });

    it("should return false for unknown network", () => {
      expect(isTokenSupported("aptos:999", "USDT")).toBe(false);
    });
  });

  describe("getTokenByAddress", () => {
    it("should find token by metadata address", () => {
      const usdtConfig = getTokenConfig(APTOS_MAINNET_CAIP2, "USDT");
      if (usdtConfig) {
        const token = getTokenByAddress(
          APTOS_MAINNET_CAIP2,
          usdtConfig.metadataAddress,
        );
        expect(token).toBeDefined();
        expect(token?.symbol).toBe("USDT");
      }
    });

    it("should be case-insensitive for address", () => {
      const usdtConfig = getTokenConfig(APTOS_MAINNET_CAIP2, "USDT");
      if (usdtConfig) {
        const token = getTokenByAddress(
          APTOS_MAINNET_CAIP2,
          usdtConfig.metadataAddress.toUpperCase(),
        );
        expect(token).toBeDefined();
      }
    });

    it("should return undefined for unknown address", () => {
      const token = getTokenByAddress(APTOS_MAINNET_CAIP2, "0x1234");
      expect(token).toBeUndefined();
    });
  });

  describe("getDefaultToken", () => {
    it("should return USDT for mainnet", () => {
      const token = getDefaultToken(APTOS_MAINNET_CAIP2);
      expect(token).toBeDefined();
      expect(token?.symbol).toBe(DEFAULT_TOKEN_SYMBOL);
    });

    it("should return undefined for devnet (no tokens)", () => {
      const token = getDefaultToken(APTOS_DEVNET_CAIP2);
      expect(token).toBeUndefined();
    });
  });

  describe("DEFAULT_TOKEN_SYMBOL", () => {
    it("should be USDT", () => {
      expect(DEFAULT_TOKEN_SYMBOL).toBe("USDT");
    });
  });
});
