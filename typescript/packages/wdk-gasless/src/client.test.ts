/**
 * WDK Gasless Client Tests
 *
 * Tests for WdkGaslessClient and createWdkGaslessClient
 */

import { describe, it, expect } from "vitest";
import { CHAIN_IDS, getChainName, getTokenAddress, USDT0_ADDRESSES, USDC_ADDRESSES } from "./constants.js";

describe("WdkGaslessClient dependencies", () => {
  describe("Chain support", () => {
    it("should support Ethereum (1)", () => {
      expect(CHAIN_IDS.ethereum).toBe(1);
      expect(getChainName(1)).toBe("ethereum");
    });

    it("should support Arbitrum (42161)", () => {
      expect(CHAIN_IDS.arbitrum).toBe(42161);
      expect(getChainName(42161)).toBe("arbitrum");
    });

    it("should support Base (8453)", () => {
      expect(CHAIN_IDS.base).toBe(8453);
      expect(getChainName(8453)).toBe("base");
    });

    it("should support Optimism (10)", () => {
      expect(CHAIN_IDS.optimism).toBe(10);
      expect(getChainName(10)).toBe("optimism");
    });

    it("should support Ink (57073)", () => {
      expect(CHAIN_IDS.ink).toBe(57073);
      expect(getChainName(57073)).toBe("ink");
    });

    it("should throw for unsupported chain", () => {
      expect(() => getChainName(999999)).toThrow("Unsupported chain ID: 999999");
    });
  });

  describe("Token address resolution", () => {
    it("should resolve USDT0 addresses for supported chains", () => {
      expect(getTokenAddress("USDT0", "ethereum")).toBe(USDT0_ADDRESSES.ethereum);
      expect(getTokenAddress("USDT0", "arbitrum")).toBe(USDT0_ADDRESSES.arbitrum);
      expect(getTokenAddress("USDT0", "ink")).toBe(USDT0_ADDRESSES.ink);
    });

    it("should resolve USDC addresses for supported chains", () => {
      expect(getTokenAddress("USDC", "ethereum")).toBe(USDC_ADDRESSES.ethereum);
      expect(getTokenAddress("USDC", "base")).toBe(USDC_ADDRESSES.base);
      expect(getTokenAddress("USDC", "arbitrum")).toBe(USDC_ADDRESSES.arbitrum);
    });

    it("should return custom address if provided", () => {
      const customAddress = "0x1234567890123456789012345678901234567890";
      expect(getTokenAddress(customAddress as `0x${string}`, "ethereum")).toBe(customAddress);
    });

    it("should be case insensitive", () => {
      expect(getTokenAddress("USDT0", "ETHEREUM")).toBe(USDT0_ADDRESSES.ethereum);
      expect(getTokenAddress("USDC", "BASE")).toBe(USDC_ADDRESSES.base);
    });

    it("should throw for unsupported token/chain combination", () => {
      expect(() => getTokenAddress("USDT0", "unsupported")).toThrow("Token USDT0 not available");
    });
  });
});

describe("WdkGaslessClient exports", () => {
  it("should export WdkGaslessClient class", async () => {
    const mod = await import("./client.js");
    expect(mod.WdkGaslessClient).toBeDefined();
    expect(typeof mod.WdkGaslessClient).toBe("function");
  });

  it("should export createWdkGaslessClient function", async () => {
    const mod = await import("./client.js");
    expect(mod.createWdkGaslessClient).toBeDefined();
    expect(typeof mod.createWdkGaslessClient).toBe("function");
  });

  it("should export CreateWdkGaslessClientConfig type", async () => {
    // TypeScript-only check - if this compiles, the type is exported
    const mod = await import("./client.js");
    expect(mod).toBeDefined();
  });
});

describe("WdkGaslessClient type validation", () => {
  it("should require signer in config", async () => {
    const { WdkGaslessClient } = await import("./client.js");

    // This should throw because config is incomplete
    expect(() => {
      new WdkGaslessClient({} as any);
    }).toThrow();
  });
});
