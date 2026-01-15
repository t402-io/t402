import { describe, it, expect } from "vitest";
import {
  getTRC20Config,
  getNetworkTokens,
  getDefaultToken,
  getTokenByAddress,
  getNetworksForToken,
  getUsdtNetworks,
  isNetworkSupported,
  getSupportedNetworks,
  TRC20_REGISTRY,
} from "../src/tokens";
import {
  TRON_MAINNET_CAIP2,
  TRON_NILE_CAIP2,
  TRON_SHASTA_CAIP2,
  USDT_ADDRESSES,
  DEFAULT_USDT_DECIMALS,
} from "../src/constants";

describe("Token Registry", () => {
  describe("TRC20_REGISTRY", () => {
    it("should have entries for all supported networks", () => {
      expect(TRC20_REGISTRY[TRON_MAINNET_CAIP2]).toBeDefined();
      expect(TRC20_REGISTRY[TRON_NILE_CAIP2]).toBeDefined();
      expect(TRC20_REGISTRY[TRON_SHASTA_CAIP2]).toBeDefined();
    });

    it("should have correct mainnet token", () => {
      const mainnet = TRC20_REGISTRY[TRON_MAINNET_CAIP2];
      expect(mainnet.network).toBe(TRON_MAINNET_CAIP2);
      expect(mainnet.defaultToken.symbol).toBe("USDT");
      expect(mainnet.defaultToken.contractAddress).toBe(USDT_ADDRESSES[TRON_MAINNET_CAIP2]);
    });

    it("should have USDT token in all networks", () => {
      expect(TRC20_REGISTRY[TRON_MAINNET_CAIP2].tokens.USDT).toBeDefined();
      expect(TRC20_REGISTRY[TRON_NILE_CAIP2].tokens.USDT).toBeDefined();
      expect(TRC20_REGISTRY[TRON_SHASTA_CAIP2].tokens.USDT).toBeDefined();
    });
  });

  describe("getTRC20Config", () => {
    it("should return USDT config for mainnet", () => {
      const config = getTRC20Config(TRON_MAINNET_CAIP2, "USDT");
      expect(config).toBeDefined();
      expect(config?.symbol).toBe("USDT");
      expect(config?.name).toBe("Tether USD");
      expect(config?.decimals).toBe(DEFAULT_USDT_DECIMALS);
      expect(config?.contractAddress).toBe(USDT_ADDRESSES[TRON_MAINNET_CAIP2]);
    });

    it("should return USDT config for nile", () => {
      const config = getTRC20Config(TRON_NILE_CAIP2, "USDT");
      expect(config).toBeDefined();
      expect(config?.contractAddress).toBe(USDT_ADDRESSES[TRON_NILE_CAIP2]);
    });

    it("should return USDT config for shasta", () => {
      const config = getTRC20Config(TRON_SHASTA_CAIP2, "USDT");
      expect(config).toBeDefined();
      expect(config?.contractAddress).toBe(USDT_ADDRESSES[TRON_SHASTA_CAIP2]);
    });

    it("should return undefined for unknown token", () => {
      const config = getTRC20Config(TRON_MAINNET_CAIP2, "UNKNOWN");
      expect(config).toBeUndefined();
    });

    it("should return undefined for unknown network", () => {
      const config = getTRC20Config("tron:unknown", "USDT");
      expect(config).toBeUndefined();
    });
  });

  describe("getNetworkTokens", () => {
    it("should return tokens for mainnet", () => {
      const tokens = getNetworkTokens(TRON_MAINNET_CAIP2);
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens.some((t) => t.symbol === "USDT")).toBe(true);
    });

    it("should return tokens for nile", () => {
      const tokens = getNetworkTokens(TRON_NILE_CAIP2);
      expect(tokens.length).toBeGreaterThan(0);
    });

    it("should return empty array for unknown network", () => {
      const tokens = getNetworkTokens("tron:unknown");
      expect(tokens).toEqual([]);
    });
  });

  describe("getDefaultToken", () => {
    it("should return USDT as default for mainnet", () => {
      const token = getDefaultToken(TRON_MAINNET_CAIP2);
      expect(token).toBeDefined();
      expect(token?.symbol).toBe("USDT");
    });

    it("should return USDT as default for nile", () => {
      const token = getDefaultToken(TRON_NILE_CAIP2);
      expect(token).toBeDefined();
      expect(token?.symbol).toBe("USDT");
    });

    it("should return USDT as default for shasta", () => {
      const token = getDefaultToken(TRON_SHASTA_CAIP2);
      expect(token).toBeDefined();
      expect(token?.symbol).toBe("USDT");
    });

    it("should return undefined for unknown network", () => {
      const token = getDefaultToken("tron:unknown");
      expect(token).toBeUndefined();
    });
  });

  describe("getTokenByAddress", () => {
    it("should find USDT by address on mainnet", () => {
      const token = getTokenByAddress(TRON_MAINNET_CAIP2, USDT_ADDRESSES[TRON_MAINNET_CAIP2]);
      expect(token).toBeDefined();
      expect(token?.symbol).toBe("USDT");
    });

    it("should find USDT by address on nile", () => {
      const token = getTokenByAddress(TRON_NILE_CAIP2, USDT_ADDRESSES[TRON_NILE_CAIP2]);
      expect(token).toBeDefined();
      expect(token?.symbol).toBe("USDT");
    });

    it("should be case insensitive", () => {
      const upperAddr = USDT_ADDRESSES[TRON_MAINNET_CAIP2].toUpperCase();
      const token = getTokenByAddress(TRON_MAINNET_CAIP2, upperAddr);
      expect(token).toBeDefined();
      expect(token?.symbol).toBe("USDT");
    });

    it("should return undefined for unknown address", () => {
      const token = getTokenByAddress(TRON_MAINNET_CAIP2, "TUnknownAddress1234567890");
      expect(token).toBeUndefined();
    });

    it("should return undefined for unknown network", () => {
      const token = getTokenByAddress("tron:unknown", USDT_ADDRESSES[TRON_MAINNET_CAIP2]);
      expect(token).toBeUndefined();
    });
  });

  describe("getNetworksForToken", () => {
    it("should return all networks supporting USDT", () => {
      const networks = getNetworksForToken("USDT");
      expect(networks).toContain(TRON_MAINNET_CAIP2);
      expect(networks).toContain(TRON_NILE_CAIP2);
      expect(networks).toContain(TRON_SHASTA_CAIP2);
    });

    it("should return empty array for unknown token", () => {
      const networks = getNetworksForToken("UNKNOWN");
      expect(networks).toEqual([]);
    });
  });

  describe("getUsdtNetworks", () => {
    it("should return all USDT-supporting networks", () => {
      const networks = getUsdtNetworks();
      expect(networks).toContain(TRON_MAINNET_CAIP2);
      expect(networks).toContain(TRON_NILE_CAIP2);
      expect(networks).toContain(TRON_SHASTA_CAIP2);
      expect(networks.length).toBe(3);
    });
  });

  describe("isNetworkSupported", () => {
    it("should return true for mainnet", () => {
      expect(isNetworkSupported(TRON_MAINNET_CAIP2)).toBe(true);
    });

    it("should return true for nile", () => {
      expect(isNetworkSupported(TRON_NILE_CAIP2)).toBe(true);
    });

    it("should return true for shasta", () => {
      expect(isNetworkSupported(TRON_SHASTA_CAIP2)).toBe(true);
    });

    it("should return false for unknown network", () => {
      expect(isNetworkSupported("tron:unknown")).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isNetworkSupported("")).toBe(false);
    });

    it("should return false for non-TRON network", () => {
      expect(isNetworkSupported("eip155:1")).toBe(false);
    });
  });

  describe("getSupportedNetworks", () => {
    it("should return all supported networks", () => {
      const networks = getSupportedNetworks();
      expect(networks).toContain(TRON_MAINNET_CAIP2);
      expect(networks).toContain(TRON_NILE_CAIP2);
      expect(networks).toContain(TRON_SHASTA_CAIP2);
      expect(networks.length).toBe(3);
    });
  });
});
