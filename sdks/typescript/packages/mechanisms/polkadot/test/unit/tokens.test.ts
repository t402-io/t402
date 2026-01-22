import { describe, it, expect } from "vitest";
import {
  USDT_POLKADOT,
  USDT_KUSAMA,
  USDT_WESTEND,
  TOKEN_REGISTRY,
  DEFAULT_TOKENS,
  getTokenConfig,
  getDefaultToken,
  getAssetId,
} from "../../src/tokens";
import {
  POLKADOT_ASSET_HUB_CAIP2,
  KUSAMA_ASSET_HUB_CAIP2,
  WESTEND_ASSET_HUB_CAIP2,
} from "../../src/constants";

describe("Polkadot Tokens", () => {
  describe("USDT Token Configs", () => {
    it("should have correct USDT config for Polkadot", () => {
      expect(USDT_POLKADOT.assetId).toBe(1984);
      expect(USDT_POLKADOT.symbol).toBe("USDT");
      expect(USDT_POLKADOT.name).toBe("Tether USD");
      expect(USDT_POLKADOT.decimals).toBe(6);
      expect(USDT_POLKADOT.issuer).toBe("Tether");
    });

    it("should have correct USDT config for Kusama", () => {
      expect(USDT_KUSAMA.assetId).toBe(1984);
      expect(USDT_KUSAMA.symbol).toBe("USDT");
      expect(USDT_KUSAMA.decimals).toBe(6);
    });

    it("should have correct USDT config for Westend (testnet)", () => {
      expect(USDT_WESTEND.assetId).toBe(1984);
      expect(USDT_WESTEND.symbol).toBe("USDT");
      expect(USDT_WESTEND.name).toBe("Test Tether USD");
      expect(USDT_WESTEND.decimals).toBe(6);
    });

    it("should use same asset ID across all networks", () => {
      expect(USDT_POLKADOT.assetId).toBe(USDT_KUSAMA.assetId);
      expect(USDT_KUSAMA.assetId).toBe(USDT_WESTEND.assetId);
    });
  });

  describe("TOKEN_REGISTRY", () => {
    it("should have tokens for all networks", () => {
      expect(TOKEN_REGISTRY[POLKADOT_ASSET_HUB_CAIP2]).toBeDefined();
      expect(TOKEN_REGISTRY[KUSAMA_ASSET_HUB_CAIP2]).toBeDefined();
      expect(TOKEN_REGISTRY[WESTEND_ASSET_HUB_CAIP2]).toBeDefined();
    });

    it("should have USDT in each network", () => {
      expect(TOKEN_REGISTRY[POLKADOT_ASSET_HUB_CAIP2].USDT).toBe(USDT_POLKADOT);
      expect(TOKEN_REGISTRY[KUSAMA_ASSET_HUB_CAIP2].USDT).toBe(USDT_KUSAMA);
      expect(TOKEN_REGISTRY[WESTEND_ASSET_HUB_CAIP2].USDT).toBe(USDT_WESTEND);
    });
  });

  describe("DEFAULT_TOKENS", () => {
    it("should have default token for each network", () => {
      expect(DEFAULT_TOKENS[POLKADOT_ASSET_HUB_CAIP2]).toBe(USDT_POLKADOT);
      expect(DEFAULT_TOKENS[KUSAMA_ASSET_HUB_CAIP2]).toBe(USDT_KUSAMA);
      expect(DEFAULT_TOKENS[WESTEND_ASSET_HUB_CAIP2]).toBe(USDT_WESTEND);
    });
  });

  describe("getTokenConfig", () => {
    it("should return token config for valid network and symbol", () => {
      const config = getTokenConfig(POLKADOT_ASSET_HUB_CAIP2, "USDT");
      expect(config).toBe(USDT_POLKADOT);
    });

    it("should default to USDT when symbol not specified", () => {
      const config = getTokenConfig(POLKADOT_ASSET_HUB_CAIP2);
      expect(config).toBe(USDT_POLKADOT);
    });

    it("should return undefined for invalid network", () => {
      expect(getTokenConfig("eip155:1", "USDT")).toBeUndefined();
      expect(getTokenConfig("invalid", "USDT")).toBeUndefined();
    });

    it("should return undefined for invalid symbol", () => {
      expect(getTokenConfig(POLKADOT_ASSET_HUB_CAIP2, "INVALID")).toBeUndefined();
      expect(getTokenConfig(POLKADOT_ASSET_HUB_CAIP2, "USDC")).toBeUndefined();
    });
  });

  describe("getDefaultToken", () => {
    it("should return default token for valid network", () => {
      expect(getDefaultToken(POLKADOT_ASSET_HUB_CAIP2)).toBe(USDT_POLKADOT);
      expect(getDefaultToken(KUSAMA_ASSET_HUB_CAIP2)).toBe(USDT_KUSAMA);
      expect(getDefaultToken(WESTEND_ASSET_HUB_CAIP2)).toBe(USDT_WESTEND);
    });

    it("should return undefined for invalid network", () => {
      expect(getDefaultToken("eip155:1")).toBeUndefined();
      expect(getDefaultToken("invalid")).toBeUndefined();
    });
  });

  describe("getAssetId", () => {
    it("should return asset ID for valid network and symbol", () => {
      expect(getAssetId(POLKADOT_ASSET_HUB_CAIP2, "USDT")).toBe(1984);
      expect(getAssetId(KUSAMA_ASSET_HUB_CAIP2, "USDT")).toBe(1984);
      expect(getAssetId(WESTEND_ASSET_HUB_CAIP2, "USDT")).toBe(1984);
    });

    it("should default to USDT when symbol not specified", () => {
      expect(getAssetId(POLKADOT_ASSET_HUB_CAIP2)).toBe(1984);
    });

    it("should return undefined for invalid network", () => {
      expect(getAssetId("invalid")).toBeUndefined();
    });

    it("should return undefined for invalid symbol", () => {
      expect(getAssetId(POLKADOT_ASSET_HUB_CAIP2, "INVALID")).toBeUndefined();
    });
  });
});
