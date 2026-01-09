/**
 * WDK Gasless Tests
 */

import { describe, it, expect } from "vitest";
import {
  USDT0_ADDRESSES,
  USDC_ADDRESSES,
  CHAIN_IDS,
  getTokenAddress,
  getChainName,
} from "./constants.js";
import type { Address } from "viem";

describe("Constants", () => {
  describe("USDT0_ADDRESSES", () => {
    it("should have addresses for supported chains", () => {
      expect(USDT0_ADDRESSES.ethereum).toBe(
        "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee"
      );
      expect(USDT0_ADDRESSES.arbitrum).toBe(
        "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"
      );
      expect(USDT0_ADDRESSES.ink).toBe(
        "0x0200C29006150606B650577BBE7B6248F58470c1"
      );
    });

    it("should have valid addresses", () => {
      Object.values(USDT0_ADDRESSES).forEach((address) => {
        expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      });
    });
  });

  describe("USDC_ADDRESSES", () => {
    it("should have addresses for supported chains", () => {
      expect(USDC_ADDRESSES.ethereum).toBe(
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
      );
      expect(USDC_ADDRESSES.base).toBe(
        "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
      );
    });
  });

  describe("CHAIN_IDS", () => {
    it("should have correct chain IDs", () => {
      expect(CHAIN_IDS.ethereum).toBe(1);
      expect(CHAIN_IDS.arbitrum).toBe(42161);
      expect(CHAIN_IDS.base).toBe(8453);
      expect(CHAIN_IDS.optimism).toBe(10);
    });
  });

  describe("getTokenAddress", () => {
    it("should return USDT0 address for supported chains", () => {
      expect(getTokenAddress("USDT0", "ethereum")).toBe(
        USDT0_ADDRESSES.ethereum
      );
      expect(getTokenAddress("USDT0", "arbitrum")).toBe(
        USDT0_ADDRESSES.arbitrum
      );
    });

    it("should return USDC address for supported chains", () => {
      expect(getTokenAddress("USDC", "ethereum")).toBe(USDC_ADDRESSES.ethereum);
      expect(getTokenAddress("USDC", "base")).toBe(USDC_ADDRESSES.base);
    });

    it("should return custom address if provided", () => {
      const customAddress = "0x1234567890123456789012345678901234567890" as Address;
      expect(getTokenAddress(customAddress, "ethereum")).toBe(customAddress);
    });

    it("should throw for unsupported chain", () => {
      expect(() => getTokenAddress("USDT0", "unsupported")).toThrow(
        "Token USDT0 not available on unsupported"
      );
    });

    it("should be case insensitive for chain name", () => {
      expect(getTokenAddress("USDT0", "ETHEREUM")).toBe(USDT0_ADDRESSES.ethereum);
      expect(getTokenAddress("USDC", "BASE")).toBe(USDC_ADDRESSES.base);
    });
  });

  describe("getChainName", () => {
    it("should return chain name for valid chain ID", () => {
      expect(getChainName(1)).toBe("ethereum");
      expect(getChainName(42161)).toBe("arbitrum");
      expect(getChainName(8453)).toBe("base");
    });

    it("should throw for unsupported chain ID", () => {
      expect(() => getChainName(999999)).toThrow("Unsupported chain ID: 999999");
    });
  });
});

describe("Exports", () => {
  it("should export main client", async () => {
    const mod = await import("./index.js");
    expect(mod.WdkGaslessClient).toBeDefined();
    expect(mod.createWdkGaslessClient).toBeDefined();
  });

  it("should export smart account", async () => {
    const mod = await import("./index.js");
    expect(mod.WdkSmartAccount).toBeDefined();
    expect(mod.createWdkSmartAccount).toBeDefined();
    expect(mod.SAFE_4337_ADDRESSES).toBeDefined();
  });

  it("should export constants", async () => {
    const mod = await import("./index.js");
    expect(mod.USDT0_ADDRESSES).toBeDefined();
    expect(mod.USDC_ADDRESSES).toBeDefined();
    expect(mod.CHAIN_IDS).toBeDefined();
    expect(mod.DEFAULT_BUNDLER_URLS).toBeDefined();
    expect(mod.getTokenAddress).toBeDefined();
    expect(mod.getChainName).toBeDefined();
  });
});
