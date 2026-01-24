import { describe, it, expect } from "vitest";
import {
  SUSDC_MAINNET,
  SUSDC_TESTNET,
  TOKEN_REGISTRY,
  DEFAULT_TOKENS,
  getTokenConfig,
  getDefaultToken,
  getContractAddress,
} from "../../src/tokens";
import {
  STACKS_MAINNET_CAIP2,
  STACKS_TESTNET_CAIP2,
} from "../../src/constants";

describe("Stacks Tokens", () => {
  describe("sUSDC Token Configs", () => {
    it("should have correct sUSDC config for Mainnet", () => {
      expect(SUSDC_MAINNET.contractAddress).toBe(
        "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
      );
      expect(SUSDC_MAINNET.symbol).toBe("sUSDC");
      expect(SUSDC_MAINNET.name).toBe("Stacks USDC");
      expect(SUSDC_MAINNET.decimals).toBe(6);
      expect(SUSDC_MAINNET.issuer).toBe("Stacks");
    });

    it("should have correct sUSDC config for Testnet", () => {
      expect(SUSDC_TESTNET.contractAddress).toBe(
        "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.token-susdc",
      );
      expect(SUSDC_TESTNET.symbol).toBe("sUSDC");
      expect(SUSDC_TESTNET.name).toBe("Test Stacks USDC");
      expect(SUSDC_TESTNET.decimals).toBe(6);
    });

    it("should use same decimals across all networks", () => {
      expect(SUSDC_MAINNET.decimals).toBe(SUSDC_TESTNET.decimals);
    });

    it("should have mainnet address starting with SP", () => {
      expect(SUSDC_MAINNET.contractAddress.startsWith("SP")).toBe(true);
    });

    it("should have testnet address starting with ST", () => {
      expect(SUSDC_TESTNET.contractAddress.startsWith("ST")).toBe(true);
    });
  });

  describe("TOKEN_REGISTRY", () => {
    it("should have tokens for all networks", () => {
      expect(TOKEN_REGISTRY[STACKS_MAINNET_CAIP2]).toBeDefined();
      expect(TOKEN_REGISTRY[STACKS_TESTNET_CAIP2]).toBeDefined();
    });

    it("should have sUSDC in each network", () => {
      expect(TOKEN_REGISTRY[STACKS_MAINNET_CAIP2].sUSDC).toBe(SUSDC_MAINNET);
      expect(TOKEN_REGISTRY[STACKS_TESTNET_CAIP2].sUSDC).toBe(SUSDC_TESTNET);
    });
  });

  describe("DEFAULT_TOKENS", () => {
    it("should have default token for each network", () => {
      expect(DEFAULT_TOKENS[STACKS_MAINNET_CAIP2]).toBe(SUSDC_MAINNET);
      expect(DEFAULT_TOKENS[STACKS_TESTNET_CAIP2]).toBe(SUSDC_TESTNET);
    });
  });

  describe("getTokenConfig", () => {
    it("should return token config for valid network and symbol", () => {
      const config = getTokenConfig(STACKS_MAINNET_CAIP2, "sUSDC");
      expect(config).toBe(SUSDC_MAINNET);
    });

    it("should default to sUSDC when symbol not specified", () => {
      const config = getTokenConfig(STACKS_MAINNET_CAIP2);
      expect(config).toBe(SUSDC_MAINNET);
    });

    it("should return undefined for invalid network", () => {
      expect(getTokenConfig("eip155:1", "sUSDC")).toBeUndefined();
      expect(getTokenConfig("invalid", "sUSDC")).toBeUndefined();
    });

    it("should return undefined for invalid symbol", () => {
      expect(getTokenConfig(STACKS_MAINNET_CAIP2, "INVALID")).toBeUndefined();
      expect(getTokenConfig(STACKS_MAINNET_CAIP2, "USDT")).toBeUndefined();
    });
  });

  describe("getDefaultToken", () => {
    it("should return default token for valid network", () => {
      expect(getDefaultToken(STACKS_MAINNET_CAIP2)).toBe(SUSDC_MAINNET);
      expect(getDefaultToken(STACKS_TESTNET_CAIP2)).toBe(SUSDC_TESTNET);
    });

    it("should return undefined for invalid network", () => {
      expect(getDefaultToken("eip155:1")).toBeUndefined();
      expect(getDefaultToken("invalid")).toBeUndefined();
    });
  });

  describe("getContractAddress", () => {
    it("should return contract address for valid network and symbol", () => {
      expect(getContractAddress(STACKS_MAINNET_CAIP2, "sUSDC")).toBe(
        "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
      );
      expect(getContractAddress(STACKS_TESTNET_CAIP2, "sUSDC")).toBe(
        "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.token-susdc",
      );
    });

    it("should default to sUSDC when symbol not specified", () => {
      expect(getContractAddress(STACKS_MAINNET_CAIP2)).toBe(
        "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
      );
    });

    it("should return undefined for invalid network", () => {
      expect(getContractAddress("invalid")).toBeUndefined();
    });

    it("should return undefined for invalid symbol", () => {
      expect(getContractAddress(STACKS_MAINNET_CAIP2, "INVALID")).toBeUndefined();
    });
  });
});
