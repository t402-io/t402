import { describe, it, expect } from "vitest";
import {
  DEFAULT_CHAINS,
  DEFAULT_RPC_ENDPOINTS,
  USDT0_ADDRESSES,
  USDC_ADDRESSES,
  USDT_LEGACY_ADDRESSES,
  CHAIN_TOKENS,
  normalizeChainConfig,
  getNetworkFromChain,
  getChainFromNetwork,
  getChainId,
  getUsdt0Chains,
  getPreferredToken,
} from "../../src/chains";

describe("Chain Configuration", () => {
  describe("DEFAULT_CHAINS", () => {
    it("should have Arbitrum configured", () => {
      expect(DEFAULT_CHAINS.arbitrum).toBeDefined();
      expect(DEFAULT_CHAINS.arbitrum.chainId).toBe(42161);
      expect(DEFAULT_CHAINS.arbitrum.network).toBe("eip155:42161");
    });

    it("should have Ethereum configured", () => {
      expect(DEFAULT_CHAINS.ethereum).toBeDefined();
      expect(DEFAULT_CHAINS.ethereum.chainId).toBe(1);
      expect(DEFAULT_CHAINS.ethereum.network).toBe("eip155:1");
    });

    it("should have all USDT0 chains", () => {
      expect(DEFAULT_CHAINS.ink).toBeDefined();
      expect(DEFAULT_CHAINS.berachain).toBeDefined();
      expect(DEFAULT_CHAINS.unichain).toBeDefined();
    });
  });

  describe("Token Addresses", () => {
    it("should have USDT0 addresses for supported chains", () => {
      expect(USDT0_ADDRESSES.ethereum).toBe("0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee");
      expect(USDT0_ADDRESSES.arbitrum).toBe("0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9");
      expect(USDT0_ADDRESSES.ink).toBe("0x0200C29006150606B650577BBE7B6248F58470c1");
    });

    it("should have USDC addresses for supported chains", () => {
      expect(USDC_ADDRESSES.ethereum).toBe("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
      expect(USDC_ADDRESSES.base).toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    });

    it("should have legacy USDT addresses", () => {
      expect(USDT_LEGACY_ADDRESSES.ethereum).toBe("0xdAC17F958D2ee523a2206206994597C13D831ec7");
    });
  });

  describe("CHAIN_TOKENS", () => {
    it("should have correct tokens for Arbitrum", () => {
      const tokens = CHAIN_TOKENS.arbitrum;
      expect(tokens).toBeDefined();
      expect(tokens.length).toBeGreaterThanOrEqual(2);

      const usdt0 = tokens.find((t) => t.symbol === "USDT0");
      expect(usdt0).toBeDefined();
      expect(usdt0?.supportsEIP3009).toBe(true);
      expect(usdt0?.decimals).toBe(6);
    });

    it("should mark legacy USDT as not supporting EIP-3009", () => {
      const tokens = CHAIN_TOKENS.ethereum;
      const legacyUsdt = tokens.find((t) => t.symbol === "USDT");
      expect(legacyUsdt?.supportsEIP3009).toBe(false);
    });
  });

  describe("normalizeChainConfig", () => {
    it("should normalize string config (RPC URL)", () => {
      const config = normalizeChainConfig("arbitrum", "https://custom-rpc.io");
      expect(config.provider).toBe("https://custom-rpc.io");
      expect(config.chainId).toBe(42161);
      expect(config.network).toBe("eip155:42161");
      expect(config.name).toBe("arbitrum");
    });

    it("should normalize object config", () => {
      const config = normalizeChainConfig("custom", {
        provider: "https://custom.io",
        chainId: 12345,
        network: "eip155:12345",
      });
      expect(config.provider).toBe("https://custom.io");
      expect(config.chainId).toBe(12345);
      expect(config.network).toBe("eip155:12345");
    });

    it("should use defaults for partial object config", () => {
      const config = normalizeChainConfig("ethereum", {
        provider: "https://my-eth-node.io",
        chainId: 1,
        network: "eip155:1",
      });
      expect(config.chainId).toBe(1);
      expect(config.network).toBe("eip155:1");
    });
  });

  describe("getNetworkFromChain", () => {
    it("should return CAIP-2 network ID", () => {
      expect(getNetworkFromChain("arbitrum")).toBe("eip155:42161");
      expect(getNetworkFromChain("ethereum")).toBe("eip155:1");
      expect(getNetworkFromChain("base")).toBe("eip155:8453");
    });

    it("should return default for unknown chain", () => {
      expect(getNetworkFromChain("unknown")).toBe("eip155:1");
    });
  });

  describe("getChainFromNetwork", () => {
    it("should return chain name from network ID", () => {
      expect(getChainFromNetwork("eip155:42161")).toBe("arbitrum");
      expect(getChainFromNetwork("eip155:1")).toBe("ethereum");
      expect(getChainFromNetwork("eip155:8453")).toBe("base");
    });

    it("should return undefined for unknown network", () => {
      expect(getChainFromNetwork("eip155:999999")).toBeUndefined();
    });
  });

  describe("getChainId", () => {
    it("should return chain ID", () => {
      expect(getChainId("arbitrum")).toBe(42161);
      expect(getChainId("ethereum")).toBe(1);
      expect(getChainId("base")).toBe(8453);
    });

    it("should return 1 for unknown chain", () => {
      expect(getChainId("unknown")).toBe(1);
    });
  });

  describe("getUsdt0Chains", () => {
    it("should return all chains with USDT0", () => {
      const chains = getUsdt0Chains();
      expect(chains).toContain("ethereum");
      expect(chains).toContain("arbitrum");
      expect(chains).toContain("ink");
      expect(chains).toContain("berachain");
      expect(chains).toContain("unichain");
      expect(chains).not.toContain("base"); // Base doesn't have USDT0
    });
  });

  describe("getPreferredToken", () => {
    it("should prefer USDT0 when available", () => {
      const token = getPreferredToken("arbitrum");
      expect(token?.symbol).toBe("USDT0");
    });

    it("should fallback to USDC when USDT0 not available", () => {
      const token = getPreferredToken("base");
      expect(token?.symbol).toBe("USDC");
    });

    it("should return undefined for unknown chain", () => {
      const token = getPreferredToken("unknown");
      expect(token).toBeUndefined();
    });
  });
});
