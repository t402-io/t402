import { describe, it, expect } from "vitest";
import {
  NOBLE_MAINNET_CAIP2,
  NOBLE_TESTNET_CAIP2,
  COSMOS_NETWORKS,
  SCHEME_EXACT_DIRECT,
  NETWORK_RPC_ENDPOINTS,
  NETWORK_REST_ENDPOINTS,
  NOBLE_BECH32_PREFIX,
  USDC_DENOM,
  DEFAULT_GAS_LIMIT,
  DEFAULT_FEE_AMOUNT,
  MSG_TYPE_SEND,
  MAX_TRANSACTION_AGE,
  COSMOS_CAIP2_NAMESPACE,
} from "../../src/constants";

describe("Cosmos Constants", () => {
  describe("Network Identifiers", () => {
    it("should have correct CAIP-2 format for mainnet", () => {
      expect(NOBLE_MAINNET_CAIP2).toBe("cosmos:noble-1");
    });

    it("should have correct CAIP-2 format for testnet", () => {
      expect(NOBLE_TESTNET_CAIP2).toBe("cosmos:grand-1");
    });

    it("should include all networks in COSMOS_NETWORKS array", () => {
      expect(COSMOS_NETWORKS).toContain(NOBLE_MAINNET_CAIP2);
      expect(COSMOS_NETWORKS).toContain(NOBLE_TESTNET_CAIP2);
      expect(COSMOS_NETWORKS.length).toBe(2);
    });
  });

  describe("Scheme Identifier", () => {
    it("should have correct scheme identifier", () => {
      expect(SCHEME_EXACT_DIRECT).toBe("exact-direct");
    });
  });

  describe("RPC Endpoints", () => {
    it("should have endpoint for mainnet", () => {
      expect(NETWORK_RPC_ENDPOINTS[NOBLE_MAINNET_CAIP2]).toBe("https://noble-rpc.polkachu.com");
    });

    it("should have endpoint for testnet", () => {
      expect(NETWORK_RPC_ENDPOINTS[NOBLE_TESTNET_CAIP2]).toBe(
        "https://rpc.testnet.noble.strange.love",
      );
    });
  });

  describe("REST Endpoints", () => {
    it("should have REST endpoint for mainnet", () => {
      expect(NETWORK_REST_ENDPOINTS[NOBLE_MAINNET_CAIP2]).toBe("https://noble-api.polkachu.com");
    });

    it("should have REST endpoint for testnet", () => {
      expect(NETWORK_REST_ENDPOINTS[NOBLE_TESTNET_CAIP2]).toBe(
        "https://api.testnet.noble.strange.love",
      );
    });
  });

  describe("Bech32 Prefix", () => {
    it("should have noble prefix", () => {
      expect(NOBLE_BECH32_PREFIX).toBe("noble");
    });
  });

  describe("Token Configuration", () => {
    it("should have correct USDC denomination", () => {
      expect(USDC_DENOM).toBe("uusdc");
    });
  });

  describe("Gas Configuration", () => {
    it("should have reasonable gas limit", () => {
      expect(DEFAULT_GAS_LIMIT).toBe(200000);
    });

    it("should have reasonable fee amount", () => {
      expect(DEFAULT_FEE_AMOUNT).toBe("5000");
    });
  });

  describe("Message Types", () => {
    it("should have correct MsgSend type URL", () => {
      expect(MSG_TYPE_SEND).toBe("/cosmos.bank.v1beta1.MsgSend");
    });
  });

  describe("Timing Constants", () => {
    it("should have 5 minute max transaction age", () => {
      expect(MAX_TRANSACTION_AGE).toBe(5 * 60 * 1000);
    });
  });

  describe("CAIP Namespace", () => {
    it("should have cosmos namespace", () => {
      expect(COSMOS_CAIP2_NAMESPACE).toBe("cosmos");
    });
  });
});
