import { describe, it, expect } from "vitest";
import {
  POLKADOT_CAIP2_NAMESPACE,
  POLKADOT_ASSET_HUB_CAIP2,
  KUSAMA_ASSET_HUB_CAIP2,
  WESTEND_ASSET_HUB_CAIP2,
  SCHEME_EXACT_DIRECT,
  DEFAULT_POLKADOT_INDEXER,
  DEFAULT_KUSAMA_INDEXER,
  DEFAULT_WESTEND_INDEXER,
  DEFAULT_POLKADOT_RPC,
  DEFAULT_KUSAMA_RPC,
  DEFAULT_WESTEND_RPC,
  POLKADOT_NETWORKS,
  getNetworkConfig,
  isPolkadotNetwork,
} from "../../src/constants";

describe("Polkadot Constants", () => {
  describe("CAIP-2 Namespace", () => {
    it("should have correct namespace", () => {
      expect(POLKADOT_CAIP2_NAMESPACE).toBe("polkadot");
    });
  });

  describe("Network Identifiers", () => {
    it("should have correct Polkadot Asset Hub CAIP-2 identifier", () => {
      expect(POLKADOT_ASSET_HUB_CAIP2).toBe("polkadot:68d56f15f85d3136970ec16946040bc1");
    });

    it("should have correct Kusama Asset Hub CAIP-2 identifier", () => {
      expect(KUSAMA_ASSET_HUB_CAIP2).toBe(
        "polkadot:48239ef607d7928874027a43a67689209727dfb3d3dc5e5b03a39bdc2eda771a"
      );
    });

    it("should have correct Westend Asset Hub CAIP-2 identifier", () => {
      expect(WESTEND_ASSET_HUB_CAIP2).toBe("polkadot:e143f23803ac50e8f6f8e62695d1ce9e");
    });

    it("should start with polkadot: prefix", () => {
      expect(POLKADOT_ASSET_HUB_CAIP2.startsWith("polkadot:")).toBe(true);
      expect(KUSAMA_ASSET_HUB_CAIP2.startsWith("polkadot:")).toBe(true);
      expect(WESTEND_ASSET_HUB_CAIP2.startsWith("polkadot:")).toBe(true);
    });
  });

  describe("Scheme", () => {
    it("should have correct scheme identifier", () => {
      expect(SCHEME_EXACT_DIRECT).toBe("exact-direct");
    });
  });

  describe("Indexer URLs", () => {
    it("should have valid Subscan URLs", () => {
      expect(DEFAULT_POLKADOT_INDEXER).toBe("https://assethub-polkadot.api.subscan.io");
      expect(DEFAULT_KUSAMA_INDEXER).toBe("https://assethub-kusama.api.subscan.io");
      expect(DEFAULT_WESTEND_INDEXER).toBe("https://assethub-westend.api.subscan.io");
    });

    it("should use HTTPS", () => {
      expect(DEFAULT_POLKADOT_INDEXER.startsWith("https://")).toBe(true);
      expect(DEFAULT_KUSAMA_INDEXER.startsWith("https://")).toBe(true);
      expect(DEFAULT_WESTEND_INDEXER.startsWith("https://")).toBe(true);
    });
  });

  describe("RPC URLs", () => {
    it("should have valid WebSocket RPC URLs", () => {
      expect(DEFAULT_POLKADOT_RPC).toBe("wss://polkadot-asset-hub-rpc.polkadot.io");
      expect(DEFAULT_KUSAMA_RPC).toBe("wss://kusama-asset-hub-rpc.polkadot.io");
      expect(DEFAULT_WESTEND_RPC).toBe("wss://westend-asset-hub-rpc.polkadot.io");
    });

    it("should use WSS", () => {
      expect(DEFAULT_POLKADOT_RPC.startsWith("wss://")).toBe(true);
      expect(DEFAULT_KUSAMA_RPC.startsWith("wss://")).toBe(true);
      expect(DEFAULT_WESTEND_RPC.startsWith("wss://")).toBe(true);
    });
  });

  describe("Network Configurations", () => {
    it("should have all three networks configured", () => {
      expect(Object.keys(POLKADOT_NETWORKS)).toHaveLength(3);
      expect(POLKADOT_NETWORKS[POLKADOT_ASSET_HUB_CAIP2]).toBeDefined();
      expect(POLKADOT_NETWORKS[KUSAMA_ASSET_HUB_CAIP2]).toBeDefined();
      expect(POLKADOT_NETWORKS[WESTEND_ASSET_HUB_CAIP2]).toBeDefined();
    });

    it("should have correct Polkadot Asset Hub config", () => {
      const config = POLKADOT_NETWORKS[POLKADOT_ASSET_HUB_CAIP2];
      expect(config.name).toBe("Polkadot Asset Hub");
      expect(config.caip2).toBe(POLKADOT_ASSET_HUB_CAIP2);
      expect(config.ss58Prefix).toBe(0);
      expect(config.isTestnet).toBe(false);
      expect(config.genesisHash.startsWith("0x")).toBe(true);
    });

    it("should have correct Kusama Asset Hub config", () => {
      const config = POLKADOT_NETWORKS[KUSAMA_ASSET_HUB_CAIP2];
      expect(config.name).toBe("Kusama Asset Hub");
      expect(config.ss58Prefix).toBe(2);
      expect(config.isTestnet).toBe(false);
    });

    it("should have correct Westend Asset Hub config (testnet)", () => {
      const config = POLKADOT_NETWORKS[WESTEND_ASSET_HUB_CAIP2];
      expect(config.name).toBe("Westend Asset Hub");
      expect(config.ss58Prefix).toBe(42);
      expect(config.isTestnet).toBe(true);
    });

    it("should have all required fields in configs", () => {
      Object.values(POLKADOT_NETWORKS).forEach((config) => {
        expect(config.name).toBeDefined();
        expect(config.caip2).toBeDefined();
        expect(config.rpcUrl).toBeDefined();
        expect(config.indexerUrl).toBeDefined();
        expect(config.genesisHash).toBeDefined();
        expect(typeof config.ss58Prefix).toBe("number");
        expect(typeof config.isTestnet).toBe("boolean");
      });
    });
  });

  describe("getNetworkConfig", () => {
    it("should return config for valid networks", () => {
      const config = getNetworkConfig(POLKADOT_ASSET_HUB_CAIP2);
      expect(config).toBeDefined();
      expect(config?.name).toBe("Polkadot Asset Hub");
    });

    it("should return undefined for invalid networks", () => {
      expect(getNetworkConfig("eip155:1")).toBeUndefined();
      expect(getNetworkConfig("polkadot:unknown")).toBeUndefined();
      expect(getNetworkConfig("")).toBeUndefined();
    });
  });

  describe("isPolkadotNetwork", () => {
    it("should return true for Polkadot networks", () => {
      expect(isPolkadotNetwork(POLKADOT_ASSET_HUB_CAIP2)).toBe(true);
      expect(isPolkadotNetwork(KUSAMA_ASSET_HUB_CAIP2)).toBe(true);
      expect(isPolkadotNetwork(WESTEND_ASSET_HUB_CAIP2)).toBe(true);
      expect(isPolkadotNetwork("polkadot:anychain")).toBe(true);
    });

    it("should return false for non-Polkadot networks", () => {
      expect(isPolkadotNetwork("eip155:1")).toBe(false);
      expect(isPolkadotNetwork("ton:mainnet")).toBe(false);
      expect(isPolkadotNetwork("ethereum")).toBe(false);
      expect(isPolkadotNetwork("")).toBe(false);
    });
  });
});
