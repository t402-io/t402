import { describe, it, expect } from "vitest";
import {
  APTOS_CAIP2_NAMESPACE,
  APTOS_MAINNET_CAIP2,
  APTOS_TESTNET_CAIP2,
  APTOS_DEVNET_CAIP2,
  APTOS_NETWORKS,
  APTOS_MAINNET_CHAIN_ID,
  APTOS_TESTNET_CHAIN_ID,
  SCHEME_EXACT_DIRECT,
  DEFAULT_MAINNET_RPC,
  DEFAULT_TESTNET_RPC,
  FA_TRANSFER_FUNCTION,
} from "../../src/constants.js";

describe("Aptos Constants", () => {
  describe("CAIP-2 Identifiers", () => {
    it("should have correct namespace", () => {
      expect(APTOS_CAIP2_NAMESPACE).toBe("aptos");
    });

    it("should have correct mainnet identifier", () => {
      expect(APTOS_MAINNET_CAIP2).toBe("aptos:1");
    });

    it("should have correct testnet identifier", () => {
      expect(APTOS_TESTNET_CAIP2).toBe("aptos:2");
    });

    it("should have correct devnet identifier", () => {
      expect(APTOS_DEVNET_CAIP2).toBe("aptos:149");
    });

    it("should include all networks in APTOS_NETWORKS", () => {
      expect(APTOS_NETWORKS).toContain(APTOS_MAINNET_CAIP2);
      expect(APTOS_NETWORKS).toContain(APTOS_TESTNET_CAIP2);
      expect(APTOS_NETWORKS).toContain(APTOS_DEVNET_CAIP2);
      expect(APTOS_NETWORKS.length).toBe(3);
    });
  });

  describe("Chain IDs", () => {
    it("should have correct mainnet chain ID", () => {
      expect(APTOS_MAINNET_CHAIN_ID).toBe(1);
    });

    it("should have correct testnet chain ID", () => {
      expect(APTOS_TESTNET_CHAIN_ID).toBe(2);
    });
  });

  describe("RPC Endpoints", () => {
    it("should have valid mainnet RPC URL", () => {
      expect(DEFAULT_MAINNET_RPC).toMatch(/^https:\/\//);
      expect(DEFAULT_MAINNET_RPC).toContain("aptoslabs.com");
    });

    it("should have valid testnet RPC URL", () => {
      expect(DEFAULT_TESTNET_RPC).toMatch(/^https:\/\//);
      expect(DEFAULT_TESTNET_RPC).toContain("testnet");
    });
  });

  describe("Scheme", () => {
    it("should have correct scheme identifier", () => {
      expect(SCHEME_EXACT_DIRECT).toBe("exact-direct");
    });
  });

  describe("Module Addresses", () => {
    it("should have correct FA transfer function", () => {
      expect(FA_TRANSFER_FUNCTION).toBe("0x1::primary_fungible_store::transfer");
    });
  });
});
