import { describe, it, expect } from "vitest";
import {
  STACKS_CAIP2_NAMESPACE,
  STACKS_MAINNET_CAIP2,
  STACKS_TESTNET_CAIP2,
  SCHEME_EXACT_DIRECT,
  DEFAULT_MAINNET_API,
  DEFAULT_TESTNET_API,
  STACKS_NETWORKS,
  getNetworkConfig,
  isStacksNetwork,
} from "../../src/constants";

describe("Stacks Constants", () => {
  describe("CAIP-2 Namespace", () => {
    it("should have correct namespace", () => {
      expect(STACKS_CAIP2_NAMESPACE).toBe("stacks");
    });
  });

  describe("Network Identifiers", () => {
    it("should have correct Stacks Mainnet CAIP-2 identifier", () => {
      expect(STACKS_MAINNET_CAIP2).toBe("stacks:1");
    });

    it("should have correct Stacks Testnet CAIP-2 identifier", () => {
      expect(STACKS_TESTNET_CAIP2).toBe("stacks:2147483648");
    });

    it("should start with stacks: prefix", () => {
      expect(STACKS_MAINNET_CAIP2.startsWith("stacks:")).toBe(true);
      expect(STACKS_TESTNET_CAIP2.startsWith("stacks:")).toBe(true);
    });
  });

  describe("Scheme", () => {
    it("should have correct scheme identifier", () => {
      expect(SCHEME_EXACT_DIRECT).toBe("exact-direct");
    });
  });

  describe("API URLs", () => {
    it("should have valid Hiro API URLs", () => {
      expect(DEFAULT_MAINNET_API).toBe("https://api.mainnet.hiro.so");
      expect(DEFAULT_TESTNET_API).toBe("https://api.testnet.hiro.so");
    });

    it("should use HTTPS", () => {
      expect(DEFAULT_MAINNET_API.startsWith("https://")).toBe(true);
      expect(DEFAULT_TESTNET_API.startsWith("https://")).toBe(true);
    });
  });

  describe("Network Configurations", () => {
    it("should have both networks configured", () => {
      expect(Object.keys(STACKS_NETWORKS)).toHaveLength(2);
      expect(STACKS_NETWORKS[STACKS_MAINNET_CAIP2]).toBeDefined();
      expect(STACKS_NETWORKS[STACKS_TESTNET_CAIP2]).toBeDefined();
    });

    it("should have correct Stacks Mainnet config", () => {
      const config = STACKS_NETWORKS[STACKS_MAINNET_CAIP2];
      expect(config.name).toBe("Stacks Mainnet");
      expect(config.caip2).toBe(STACKS_MAINNET_CAIP2);
      expect(config.chainId).toBe(1);
      expect(config.addressPrefix).toBe("SP");
      expect(config.isTestnet).toBe(false);
    });

    it("should have correct Stacks Testnet config", () => {
      const config = STACKS_NETWORKS[STACKS_TESTNET_CAIP2];
      expect(config.name).toBe("Stacks Testnet");
      expect(config.caip2).toBe(STACKS_TESTNET_CAIP2);
      expect(config.chainId).toBe(2147483648);
      expect(config.addressPrefix).toBe("ST");
      expect(config.isTestnet).toBe(true);
    });

    it("should have all required fields in configs", () => {
      Object.values(STACKS_NETWORKS).forEach((config) => {
        expect(config.name).toBeDefined();
        expect(config.caip2).toBeDefined();
        expect(config.apiUrl).toBeDefined();
        expect(typeof config.chainId).toBe("number");
        expect(config.addressPrefix).toBeDefined();
        expect(typeof config.isTestnet).toBe("boolean");
      });
    });
  });

  describe("getNetworkConfig", () => {
    it("should return config for valid networks", () => {
      const config = getNetworkConfig(STACKS_MAINNET_CAIP2);
      expect(config).toBeDefined();
      expect(config?.name).toBe("Stacks Mainnet");
    });

    it("should return config for testnet", () => {
      const config = getNetworkConfig(STACKS_TESTNET_CAIP2);
      expect(config).toBeDefined();
      expect(config?.name).toBe("Stacks Testnet");
    });

    it("should return undefined for invalid networks", () => {
      expect(getNetworkConfig("eip155:1")).toBeUndefined();
      expect(getNetworkConfig("stacks:unknown")).toBeUndefined();
      expect(getNetworkConfig("")).toBeUndefined();
    });
  });

  describe("isStacksNetwork", () => {
    it("should return true for Stacks networks", () => {
      expect(isStacksNetwork(STACKS_MAINNET_CAIP2)).toBe(true);
      expect(isStacksNetwork(STACKS_TESTNET_CAIP2)).toBe(true);
      expect(isStacksNetwork("stacks:anychain")).toBe(true);
    });

    it("should return false for non-Stacks networks", () => {
      expect(isStacksNetwork("eip155:1")).toBe(false);
      expect(isStacksNetwork("ton:mainnet")).toBe(false);
      expect(isStacksNetwork("polkadot:68d56f15f85d3136970ec16946040bc1")).toBe(false);
      expect(isStacksNetwork("")).toBe(false);
    });
  });
});
