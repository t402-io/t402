import { describe, it, expect } from "vitest";
import {
  USDT_ADDRESSES,
  JETTON_REGISTRY,
  getJettonConfig,
  getNetworkJettons,
  getDefaultJetton,
  getJettonByAddress,
  getNetworksForJetton,
  isNetworkSupported,
  getSupportedNetworks,
} from "../../src/tokens";
import { TON_MAINNET_CAIP2, TON_TESTNET_CAIP2 } from "../../src/constants";

describe("TON Tokens", () => {
  describe("USDT Addresses", () => {
    it("should have mainnet USDT address", () => {
      expect(USDT_ADDRESSES[TON_MAINNET_CAIP2]).toBeDefined();
      expect(USDT_ADDRESSES[TON_MAINNET_CAIP2]).toMatch(/^EQ/);
    });

    it("should have testnet USDT address", () => {
      expect(USDT_ADDRESSES[TON_TESTNET_CAIP2]).toBeDefined();
    });
  });

  describe("Jetton Registry", () => {
    it("should have mainnet configuration", () => {
      expect(JETTON_REGISTRY[TON_MAINNET_CAIP2]).toBeDefined();
      expect(JETTON_REGISTRY[TON_MAINNET_CAIP2].USDT).toBeDefined();
    });

    it("should have correct USDT configuration", () => {
      const usdt = JETTON_REGISTRY[TON_MAINNET_CAIP2].USDT;
      expect(usdt.symbol).toBe("USDT");
      expect(usdt.decimals).toBe(6);
      expect(usdt.priority).toBe(1);
    });
  });

  describe("getJettonConfig", () => {
    it("should return USDT config for mainnet", () => {
      const config = getJettonConfig(TON_MAINNET_CAIP2, "USDT");
      expect(config).toBeDefined();
      expect(config?.symbol).toBe("USDT");
      expect(config?.decimals).toBe(6);
    });

    it("should return undefined for unknown token", () => {
      const config = getJettonConfig(TON_MAINNET_CAIP2, "UNKNOWN");
      expect(config).toBeUndefined();
    });

    it("should be case-insensitive", () => {
      const config1 = getJettonConfig(TON_MAINNET_CAIP2, "usdt");
      const config2 = getJettonConfig(TON_MAINNET_CAIP2, "USDT");
      expect(config1).toEqual(config2);
    });
  });

  describe("getNetworkJettons", () => {
    it("should return all Jettons for mainnet sorted by priority", () => {
      const jettons = getNetworkJettons(TON_MAINNET_CAIP2);
      expect(jettons.length).toBeGreaterThan(0);
      expect(jettons[0].symbol).toBe("USDT");
    });

    it("should return empty array for unknown network", () => {
      const jettons = getNetworkJettons("unknown:network");
      expect(jettons).toEqual([]);
    });
  });

  describe("getDefaultJetton", () => {
    it("should return USDT as default for mainnet", () => {
      const defaultJetton = getDefaultJetton(TON_MAINNET_CAIP2);
      expect(defaultJetton).toBeDefined();
      expect(defaultJetton?.symbol).toBe("USDT");
    });

    it("should return undefined for unknown network", () => {
      const defaultJetton = getDefaultJetton("unknown:network");
      expect(defaultJetton).toBeUndefined();
    });
  });

  describe("getJettonByAddress", () => {
    it("should find USDT by address", () => {
      const usdtAddress = USDT_ADDRESSES[TON_MAINNET_CAIP2];
      const jetton = getJettonByAddress(TON_MAINNET_CAIP2, usdtAddress);
      expect(jetton).toBeDefined();
      expect(jetton?.symbol).toBe("USDT");
    });

    it("should return undefined for unknown address", () => {
      const jetton = getJettonByAddress(TON_MAINNET_CAIP2, "EQUnknownAddress");
      expect(jetton).toBeUndefined();
    });
  });

  describe("getNetworksForJetton", () => {
    it("should return networks supporting USDT", () => {
      const networks = getNetworksForJetton("USDT");
      expect(networks).toContain(TON_MAINNET_CAIP2);
      expect(networks).toContain(TON_TESTNET_CAIP2);
    });

    it("should return empty array for unknown token", () => {
      const networks = getNetworksForJetton("UNKNOWN");
      expect(networks).toEqual([]);
    });
  });

  describe("isNetworkSupported", () => {
    it("should return true for mainnet", () => {
      expect(isNetworkSupported(TON_MAINNET_CAIP2)).toBe(true);
    });

    it("should return true for testnet", () => {
      expect(isNetworkSupported(TON_TESTNET_CAIP2)).toBe(true);
    });

    it("should return false for unknown network", () => {
      expect(isNetworkSupported("unknown:network")).toBe(false);
    });
  });

  describe("getSupportedNetworks", () => {
    it("should return all supported networks", () => {
      const networks = getSupportedNetworks();
      expect(networks).toContain(TON_MAINNET_CAIP2);
      expect(networks).toContain(TON_TESTNET_CAIP2);
    });
  });
});
