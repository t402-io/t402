import { describe, it, expect, vi } from "vitest";
import { WdkBridge, createDirectBridge } from "../../src/bridge";

// Mock @t402/evm module
vi.mock("@t402/evm", () => ({
  Usdt0Bridge: vi.fn().mockImplementation((signer, chain) => ({
    signer,
    chain,
    quote: vi.fn(),
    send: vi.fn(),
  })),
  supportsBridging: vi.fn((chain: string) => {
    const supported = ["ethereum", "arbitrum", "base", "ink", "berachain", "unichain"];
    return supported.includes(chain);
  }),
  getBridgeableChains: vi.fn(() => [
    "ethereum",
    "arbitrum",
    "base",
    "ink",
    "berachain",
    "unichain",
  ]),
}));

describe("WdkBridge", () => {
  describe("supportsBridging", () => {
    it("should return true for supported chains", () => {
      expect(WdkBridge.supportsBridging("ethereum")).toBe(true);
      expect(WdkBridge.supportsBridging("arbitrum")).toBe(true);
      expect(WdkBridge.supportsBridging("base")).toBe(true);
    });

    it("should return false for unsupported chains", () => {
      expect(WdkBridge.supportsBridging("polygon")).toBe(false);
      expect(WdkBridge.supportsBridging("unknown")).toBe(false);
    });
  });

  describe("getBridgeableChains", () => {
    it("should return all bridgeable chains", () => {
      const chains = WdkBridge.getBridgeableChains();
      expect(chains).toContain("ethereum");
      expect(chains).toContain("arbitrum");
      expect(chains).toContain("base");
      expect(chains.length).toBeGreaterThan(0);
    });
  });

  describe("getSupportedDestinations", () => {
    it("should return destinations excluding source chain", () => {
      const destinations = WdkBridge.getSupportedDestinations("arbitrum");
      expect(destinations).toContain("ethereum");
      expect(destinations).toContain("base");
      expect(destinations).not.toContain("arbitrum");
    });

    it("should return all bridgeable chains when source not in list", () => {
      const destinations = WdkBridge.getSupportedDestinations("polygon");
      expect(destinations).toContain("ethereum");
      expect(destinations).toContain("arbitrum");
    });
  });
});

describe("createDirectBridge", () => {
  it("should create a Usdt0Bridge instance", () => {
    const mockSigner = {
      address: "0x1234567890123456789012345678901234567890" as `0x${string}`,
      readContract: vi.fn(),
      writeContract: vi.fn(),
      waitForTransactionReceipt: vi.fn(),
    };

    const bridge = createDirectBridge(mockSigner, "arbitrum");
    expect(bridge).toBeDefined();
  });
});
