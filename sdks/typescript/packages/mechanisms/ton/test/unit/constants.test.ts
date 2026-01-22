import { describe, it, expect } from "vitest";
import {
  TON_MAINNET_CAIP2,
  TON_TESTNET_CAIP2,
  TON_NETWORKS,
  JETTON_TRANSFER_OP,
  DEFAULT_JETTON_TRANSFER_TON,
  DEFAULT_FORWARD_TON,
  SCHEME_EXACT,
} from "../../src/constants";

describe("TON Constants", () => {
  describe("Network Identifiers", () => {
    it("should have correct mainnet CAIP-2 identifier", () => {
      expect(TON_MAINNET_CAIP2).toBe("ton:mainnet");
    });

    it("should have correct testnet CAIP-2 identifier", () => {
      expect(TON_TESTNET_CAIP2).toBe("ton:testnet");
    });

    it("should include both networks in TON_NETWORKS", () => {
      expect(TON_NETWORKS).toContain(TON_MAINNET_CAIP2);
      expect(TON_NETWORKS).toContain(TON_TESTNET_CAIP2);
      expect(TON_NETWORKS).toHaveLength(2);
    });
  });

  describe("Jetton Operations", () => {
    it("should have correct Jetton transfer op code", () => {
      expect(JETTON_TRANSFER_OP).toBe(0x0f8a7ea5);
    });
  });

  describe("Gas Amounts", () => {
    it("should have reasonable default Jetton transfer TON amount", () => {
      // 0.1 TON = 100_000_000 nanoTON
      expect(DEFAULT_JETTON_TRANSFER_TON).toBe(100_000_000n);
    });

    it("should have minimal forward TON amount", () => {
      expect(DEFAULT_FORWARD_TON).toBe(1n);
    });
  });

  describe("Scheme", () => {
    it("should have correct scheme identifier", () => {
      expect(SCHEME_EXACT).toBe("exact");
    });
  });
});
