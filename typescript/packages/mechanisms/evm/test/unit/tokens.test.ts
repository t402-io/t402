import { describe, it, expect } from "vitest";
import {
  USDT0_ADDRESSES,
  USDC_ADDRESSES,
  USDT_LEGACY_ADDRESSES,
  TOKEN_REGISTRY,
  getTokenConfig,
  getNetworkTokens,
  getDefaultToken,
  getTokenByAddress,
  supportsEIP3009,
  getNetworksForToken,
  getUsdt0Networks,
  getEIP712Domain,
} from "../../src/tokens";

describe("Token Configuration", () => {
  describe("USDT0 Addresses", () => {
    it("should have Ethereum mainnet USDT0 address", () => {
      expect(USDT0_ADDRESSES["eip155:1"]).toBe("0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee");
    });

    it("should have Arbitrum USDT0 address", () => {
      expect(USDT0_ADDRESSES["eip155:42161"]).toBe("0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9");
    });

    it("should have Ink mainnet USDT0 address", () => {
      expect(USDT0_ADDRESSES["eip155:57073"]).toBe("0x0200C29006150606B650577BBE7B6248F58470c1");
    });

    it("should have Berachain USDT0 address", () => {
      expect(USDT0_ADDRESSES["eip155:80094"]).toBe("0x779Ded0c9e1022225f8E0630b35a9b54bE713736");
    });

    it("should have Unichain USDT0 address", () => {
      expect(USDT0_ADDRESSES["eip155:130"]).toBe("0x588ce4F028D8e7B53B687865d6A67b3A54C75518");
    });
  });

  describe("USDC Addresses", () => {
    it("should have Ethereum mainnet USDC address", () => {
      expect(USDC_ADDRESSES["eip155:1"]).toBe("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
    });

    it("should have Base mainnet USDC address", () => {
      expect(USDC_ADDRESSES["eip155:8453"]).toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    });

    it("should have Arbitrum USDC address", () => {
      expect(USDC_ADDRESSES["eip155:42161"]).toBe("0xaf88d065e77c8cC2239327C5EDb3A432268e5831");
    });
  });

  describe("USDT Legacy Addresses", () => {
    it("should have Ethereum mainnet USDT address", () => {
      expect(USDT_LEGACY_ADDRESSES["eip155:1"]).toBe("0xdAC17F958D2ee523a2206206994597C13D831ec7");
    });
  });

  describe("Token Registry", () => {
    it("should have USDT0 configured for Arbitrum", () => {
      const token = TOKEN_REGISTRY["eip155:42161"]?.["USDT0"];
      expect(token).toBeDefined();
      expect(token?.symbol).toBe("USDT0");
      expect(token?.name).toBe("TetherToken");
      expect(token?.version).toBe("1");
      expect(token?.decimals).toBe(6);
      expect(token?.tokenType).toBe("eip3009");
      expect(token?.priority).toBe(1);
    });

    it("should have USDC configured for Base", () => {
      const token = TOKEN_REGISTRY["eip155:8453"]?.["USDC"];
      expect(token).toBeDefined();
      expect(token?.symbol).toBe("USDC");
      expect(token?.name).toBe("USD Coin");
      expect(token?.decimals).toBe(6);
      expect(token?.tokenType).toBe("eip3009");
    });

    it("should have legacy USDT configured for Ethereum", () => {
      const token = TOKEN_REGISTRY["eip155:1"]?.["USDT"];
      expect(token).toBeDefined();
      expect(token?.tokenType).toBe("legacy");
      expect(token?.priority).toBe(10); // Lower priority
    });
  });

  describe("getTokenConfig", () => {
    it("should return USDT0 config for Arbitrum", () => {
      const config = getTokenConfig("eip155:42161", "USDT0");
      expect(config).toBeDefined();
      expect(config?.symbol).toBe("USDT0");
      expect(config?.name).toBe("TetherToken");
    });

    it("should be case-insensitive", () => {
      const config1 = getTokenConfig("eip155:42161", "usdt0");
      const config2 = getTokenConfig("eip155:42161", "USDT0");
      expect(config1).toEqual(config2);
    });

    it("should return undefined for unsupported token", () => {
      const config = getTokenConfig("eip155:42161", "FAKE");
      expect(config).toBeUndefined();
    });

    it("should return undefined for unsupported network", () => {
      const config = getTokenConfig("eip155:999999", "USDT0");
      expect(config).toBeUndefined();
    });
  });

  describe("getNetworkTokens", () => {
    it("should return tokens sorted by priority", () => {
      const tokens = getNetworkTokens("eip155:42161");
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens[0].symbol).toBe("USDT0"); // Priority 1
      expect(tokens[1].symbol).toBe("USDC"); // Priority 2
    });

    it("should return empty array for unsupported network", () => {
      const tokens = getNetworkTokens("eip155:999999");
      expect(tokens).toEqual([]);
    });
  });

  describe("getDefaultToken", () => {
    it("should return USDT0 as default for Arbitrum", () => {
      const token = getDefaultToken("eip155:42161");
      expect(token?.symbol).toBe("USDT0");
    });

    it("should return USDC as default for Base (no USDT0)", () => {
      const token = getDefaultToken("eip155:8453");
      expect(token?.symbol).toBe("USDC");
    });

    it("should return undefined for unsupported network", () => {
      const token = getDefaultToken("eip155:999999");
      expect(token).toBeUndefined();
    });
  });

  describe("getTokenByAddress", () => {
    it("should find token by address", () => {
      const token = getTokenByAddress("eip155:42161", "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9");
      expect(token?.symbol).toBe("USDT0");
    });

    it("should be case-insensitive for addresses", () => {
      const token = getTokenByAddress(
        "eip155:42161",
        "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", // lowercase
      );
      expect(token?.symbol).toBe("USDT0");
    });

    it("should return undefined for unknown address", () => {
      const token = getTokenByAddress("eip155:42161", "0x0000000000000000000000000000000000000000");
      expect(token).toBeUndefined();
    });
  });

  describe("supportsEIP3009", () => {
    it("should return true for USDT0", () => {
      expect(supportsEIP3009("eip155:42161", "USDT0")).toBe(true);
    });

    it("should return true for USDC", () => {
      expect(supportsEIP3009("eip155:8453", "USDC")).toBe(true);
    });

    it("should return false for legacy USDT", () => {
      expect(supportsEIP3009("eip155:1", "USDT")).toBe(false);
    });

    it("should return false for unknown tokens", () => {
      expect(supportsEIP3009("eip155:42161", "FAKE")).toBe(false);
    });
  });

  describe("getNetworksForToken", () => {
    it("should return all USDT0 networks", () => {
      const networks = getNetworksForToken("USDT0");
      expect(networks).toContain("eip155:1");
      expect(networks).toContain("eip155:42161");
      expect(networks).toContain("eip155:57073");
      expect(networks).toContain("eip155:80094");
      expect(networks).toContain("eip155:130");
    });

    it("should return all USDC networks", () => {
      const networks = getNetworksForToken("USDC");
      expect(networks).toContain("eip155:1");
      expect(networks).toContain("eip155:8453");
      expect(networks).toContain("eip155:42161");
    });
  });

  describe("getUsdt0Networks", () => {
    it("should return all USDT0 supported networks", () => {
      const networks = getUsdt0Networks();
      expect(networks.length).toBeGreaterThanOrEqual(5);
      expect(networks).toContain("eip155:42161"); // Arbitrum
      expect(networks).toContain("eip155:57073"); // Ink
    });
  });

  describe("getEIP712Domain", () => {
    it("should return correct domain for USDT0", () => {
      const domain = getEIP712Domain(
        "eip155:42161",
        "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
        42161,
      );
      expect(domain).toEqual({
        name: "TetherToken",
        version: "1",
        chainId: 42161,
        verifyingContract: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
      });
    });

    it("should return correct domain for USDC", () => {
      const domain = getEIP712Domain(
        "eip155:8453",
        "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        8453,
      );
      expect(domain).toEqual({
        name: "USD Coin",
        version: "2",
        chainId: 8453,
        verifyingContract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      });
    });

    it("should return undefined for unknown token", () => {
      const domain = getEIP712Domain(
        "eip155:42161",
        "0x0000000000000000000000000000000000000000",
        42161,
      );
      expect(domain).toBeUndefined();
    });
  });
});
