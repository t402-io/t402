import { describe, it, expect } from "vitest";
import {
  SCHEME_EXACT_DIRECT,
  TEZOS_CAIP2_NAMESPACE,
  TEZOS_MAINNET_CAIP2,
  TEZOS_GHOSTNET_CAIP2,
  DEFAULT_MAINNET_RPC,
  DEFAULT_GHOSTNET_RPC,
  DEFAULT_MAINNET_INDEXER,
  DEFAULT_GHOSTNET_INDEXER,
  FA2_TRANSFER_ENTRYPOINT,
  FA2_BALANCE_OF_ENTRYPOINT,
  FA2_UPDATE_OPERATORS_ENTRYPOINT,
  SUPPORTED_NETWORKS,
  NETWORK_CONFIGS,
} from "../../src/constants";

describe("Tezos Constants", () => {
  describe("Scheme", () => {
    it("should have correct scheme identifier", () => {
      expect(SCHEME_EXACT_DIRECT).toBe("exact-direct");
    });
  });

  describe("CAIP-2 Namespace", () => {
    it("should have correct namespace", () => {
      expect(TEZOS_CAIP2_NAMESPACE).toBe("tezos");
    });
  });

  describe("Network Identifiers", () => {
    it("should have correct mainnet CAIP-2 identifier", () => {
      expect(TEZOS_MAINNET_CAIP2).toBe("tezos:NetXdQprcVkpaWU");
    });

    it("should have correct ghostnet CAIP-2 identifier", () => {
      expect(TEZOS_GHOSTNET_CAIP2).toBe("tezos:NetXnHfVqm9iesp");
    });

    it("should start with tezos: prefix", () => {
      expect(TEZOS_MAINNET_CAIP2.startsWith("tezos:")).toBe(true);
      expect(TEZOS_GHOSTNET_CAIP2.startsWith("tezos:")).toBe(true);
    });
  });

  describe("RPC URLs", () => {
    it("should have valid mainnet RPC URL", () => {
      expect(DEFAULT_MAINNET_RPC).toBe("https://mainnet.api.tez.ie");
    });

    it("should have valid ghostnet RPC URL", () => {
      expect(DEFAULT_GHOSTNET_RPC).toBe("https://ghostnet.tezos.marigold.dev");
    });

    it("should use HTTPS", () => {
      expect(DEFAULT_MAINNET_RPC.startsWith("https://")).toBe(true);
      expect(DEFAULT_GHOSTNET_RPC.startsWith("https://")).toBe(true);
    });
  });

  describe("Indexer URLs", () => {
    it("should have valid mainnet indexer URL", () => {
      expect(DEFAULT_MAINNET_INDEXER).toBe("https://api.tzkt.io");
    });

    it("should have valid ghostnet indexer URL", () => {
      expect(DEFAULT_GHOSTNET_INDEXER).toBe("https://api.ghostnet.tzkt.io");
    });

    it("should use HTTPS", () => {
      expect(DEFAULT_MAINNET_INDEXER.startsWith("https://")).toBe(true);
      expect(DEFAULT_GHOSTNET_INDEXER.startsWith("https://")).toBe(true);
    });
  });

  describe("FA2 Entrypoints", () => {
    it("should have correct transfer entrypoint", () => {
      expect(FA2_TRANSFER_ENTRYPOINT).toBe("transfer");
    });

    it("should have correct balance_of entrypoint", () => {
      expect(FA2_BALANCE_OF_ENTRYPOINT).toBe("balance_of");
    });

    it("should have correct update_operators entrypoint", () => {
      expect(FA2_UPDATE_OPERATORS_ENTRYPOINT).toBe("update_operators");
    });
  });

  describe("Supported Networks", () => {
    it("should include mainnet and ghostnet", () => {
      expect(SUPPORTED_NETWORKS).toContain(TEZOS_MAINNET_CAIP2);
      expect(SUPPORTED_NETWORKS).toContain(TEZOS_GHOSTNET_CAIP2);
    });

    it("should have exactly 2 networks", () => {
      expect(SUPPORTED_NETWORKS).toHaveLength(2);
    });
  });

  describe("Network Configurations", () => {
    it("should have config for mainnet", () => {
      const config = NETWORK_CONFIGS[TEZOS_MAINNET_CAIP2];
      expect(config).toBeDefined();
      expect(config.name).toBe("Tezos Mainnet");
      expect(config.rpcUrl).toBe(DEFAULT_MAINNET_RPC);
      expect(config.indexerUrl).toBe(DEFAULT_MAINNET_INDEXER);
    });

    it("should have config for ghostnet", () => {
      const config = NETWORK_CONFIGS[TEZOS_GHOSTNET_CAIP2];
      expect(config).toBeDefined();
      expect(config.name).toBe("Tezos Ghostnet");
      expect(config.rpcUrl).toBe(DEFAULT_GHOSTNET_RPC);
      expect(config.indexerUrl).toBe(DEFAULT_GHOSTNET_INDEXER);
    });

    it("should have all required fields", () => {
      Object.values(NETWORK_CONFIGS).forEach((config) => {
        expect(config.name).toBeDefined();
        expect(config.rpcUrl).toBeDefined();
        expect(config.indexerUrl).toBeDefined();
      });
    });
  });
});
