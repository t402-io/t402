import { describe, it, expect } from "vitest";
import {
  LAYERZERO_ENDPOINT_IDS,
  USDT0_OFT_ADDRESSES,
  LAYERZERO_ENDPOINT_V2,
  NETWORK_TO_CHAIN,
  CHAIN_TO_NETWORK,
  getEndpointId,
  getEndpointIdFromNetwork,
  getUsdt0OftAddress,
  supportsBridging,
  getBridgeableChains,
  addressToBytes32,
  bytes32ToAddress,
} from "../../../src/bridge/constants";

describe("Bridge Constants", () => {
  describe("LAYERZERO_ENDPOINT_IDS", () => {
    it("should have correct endpoint IDs for major chains", () => {
      expect(LAYERZERO_ENDPOINT_IDS.ethereum).toBe(30101);
      expect(LAYERZERO_ENDPOINT_IDS.arbitrum).toBe(30110);
      expect(LAYERZERO_ENDPOINT_IDS.base).toBe(30184);
    });

    it("should have endpoint IDs for USDT0 chains", () => {
      expect(LAYERZERO_ENDPOINT_IDS.ink).toBeDefined();
      expect(LAYERZERO_ENDPOINT_IDS.berachain).toBeDefined();
      expect(LAYERZERO_ENDPOINT_IDS.unichain).toBeDefined();
    });
  });

  describe("USDT0_OFT_ADDRESSES", () => {
    it("should have addresses for USDT0 chains", () => {
      expect(USDT0_OFT_ADDRESSES.ethereum).toBe(
        "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee",
      );
      expect(USDT0_OFT_ADDRESSES.arbitrum).toBe(
        "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
      );
      expect(USDT0_OFT_ADDRESSES.ink).toBe(
        "0x0200C29006150606B650577BBE7B6248F58470c1",
      );
    });
  });

  describe("LAYERZERO_ENDPOINT_V2", () => {
    it("should be the canonical LayerZero V2 endpoint address", () => {
      expect(LAYERZERO_ENDPOINT_V2).toBe(
        "0x1a44076050125825900e736c501f859c50fE728c",
      );
    });
  });

  describe("NETWORK_TO_CHAIN and CHAIN_TO_NETWORK", () => {
    it("should correctly map networks to chains", () => {
      expect(NETWORK_TO_CHAIN["eip155:1"]).toBe("ethereum");
      expect(NETWORK_TO_CHAIN["eip155:42161"]).toBe("arbitrum");
      expect(NETWORK_TO_CHAIN["eip155:8453"]).toBe("base");
    });

    it("should correctly map chains to networks", () => {
      expect(CHAIN_TO_NETWORK.ethereum).toBe("eip155:1");
      expect(CHAIN_TO_NETWORK.arbitrum).toBe("eip155:42161");
      expect(CHAIN_TO_NETWORK.base).toBe("eip155:8453");
    });

    it("should be inverse mappings", () => {
      for (const [network, chain] of Object.entries(NETWORK_TO_CHAIN)) {
        expect(CHAIN_TO_NETWORK[chain]).toBe(network);
      }
    });
  });

  describe("getEndpointId", () => {
    it("should return endpoint ID for known chains", () => {
      expect(getEndpointId("ethereum")).toBe(30101);
      expect(getEndpointId("arbitrum")).toBe(30110);
    });

    it("should return undefined for unknown chains", () => {
      expect(getEndpointId("unknown")).toBeUndefined();
    });
  });

  describe("getEndpointIdFromNetwork", () => {
    it("should return endpoint ID from CAIP-2 network", () => {
      expect(getEndpointIdFromNetwork("eip155:1")).toBe(30101);
      expect(getEndpointIdFromNetwork("eip155:42161")).toBe(30110);
    });

    it("should return undefined for unknown networks", () => {
      expect(getEndpointIdFromNetwork("eip155:999")).toBeUndefined();
    });
  });

  describe("getUsdt0OftAddress", () => {
    it("should return OFT address for USDT0 chains", () => {
      expect(getUsdt0OftAddress("ethereum")).toBeDefined();
      expect(getUsdt0OftAddress("arbitrum")).toBeDefined();
    });

    it("should return undefined for non-USDT0 chains", () => {
      expect(getUsdt0OftAddress("base")).toBeUndefined();
      expect(getUsdt0OftAddress("unknown")).toBeUndefined();
    });
  });

  describe("supportsBridging", () => {
    it("should return true for chains that support bridging", () => {
      expect(supportsBridging("ethereum")).toBe(true);
      expect(supportsBridging("arbitrum")).toBe(true);
      expect(supportsBridging("ink")).toBe(true);
    });

    it("should return false for chains that don't support bridging", () => {
      expect(supportsBridging("base")).toBe(false); // No USDT0
      expect(supportsBridging("unknown")).toBe(false);
    });
  });

  describe("getBridgeableChains", () => {
    it("should return all chains that support USDT0 bridging", () => {
      const chains = getBridgeableChains();

      expect(chains).toContain("ethereum");
      expect(chains).toContain("arbitrum");
      expect(chains).toContain("ink");
      expect(chains).toContain("berachain");
      expect(chains).toContain("unichain");
    });

    it("should not include chains without USDT0", () => {
      const chains = getBridgeableChains();

      expect(chains).not.toContain("base");
      expect(chains).not.toContain("polygon");
    });
  });

  describe("addressToBytes32", () => {
    it("should pad address to 32 bytes", () => {
      const address = "0x1234567890123456789012345678901234567890";
      const bytes32 = addressToBytes32(address);

      expect(bytes32).toHaveLength(66); // 0x + 64 chars
      expect(bytes32).toMatch(/^0x[0-9a-f]{64}$/);
      expect(bytes32.slice(-40)).toBe(address.slice(2).toLowerCase());
    });

    it("should handle checksummed addresses", () => {
      const address = "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9";
      const bytes32 = addressToBytes32(address);

      expect(bytes32.slice(-40)).toBe(address.slice(2).toLowerCase());
    });
  });

  describe("bytes32ToAddress", () => {
    it("should extract address from bytes32", () => {
      const bytes32 =
        "0x0000000000000000000000001234567890123456789012345678901234567890";
      const address = bytes32ToAddress(bytes32);

      expect(address).toBe("0x1234567890123456789012345678901234567890");
    });

    it("should be inverse of addressToBytes32", () => {
      const originalAddress = "0x1234567890123456789012345678901234567890";
      const bytes32 = addressToBytes32(originalAddress);
      const recoveredAddress = bytes32ToAddress(bytes32);

      expect(recoveredAddress.toLowerCase()).toBe(originalAddress.toLowerCase());
    });
  });
});
