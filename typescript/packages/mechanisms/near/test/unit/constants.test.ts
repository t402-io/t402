import { describe, it, expect } from "vitest";
import {
  NEAR_MAINNET_CAIP2,
  NEAR_TESTNET_CAIP2,
  NEAR_NETWORKS,
  SCHEME_EXACT_DIRECT,
  NETWORK_RPC_ENDPOINTS,
} from "../../src/constants.js";

describe("NEAR Constants", () => {
  describe("Network Identifiers", () => {
    it("should have correct CAIP-2 format for mainnet", () => {
      expect(NEAR_MAINNET_CAIP2).toBe("near:mainnet");
    });

    it("should have correct CAIP-2 format for testnet", () => {
      expect(NEAR_TESTNET_CAIP2).toBe("near:testnet");
    });

    it("should include all networks in NEAR_NETWORKS array", () => {
      expect(NEAR_NETWORKS).toContain(NEAR_MAINNET_CAIP2);
      expect(NEAR_NETWORKS).toContain(NEAR_TESTNET_CAIP2);
      expect(NEAR_NETWORKS.length).toBe(2);
    });
  });

  describe("Scheme Identifier", () => {
    it("should have correct scheme identifier", () => {
      expect(SCHEME_EXACT_DIRECT).toBe("exact-direct");
    });
  });

  describe("RPC Endpoints", () => {
    it("should have endpoint for mainnet", () => {
      expect(NETWORK_RPC_ENDPOINTS[NEAR_MAINNET_CAIP2]).toBe("https://rpc.mainnet.near.org");
    });

    it("should have endpoint for testnet", () => {
      expect(NETWORK_RPC_ENDPOINTS[NEAR_TESTNET_CAIP2]).toBe("https://rpc.testnet.near.org");
    });
  });
});
