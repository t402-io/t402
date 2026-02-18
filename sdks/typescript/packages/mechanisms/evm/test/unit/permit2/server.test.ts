import { describe, it, expect, beforeEach } from "vitest";
import { Permit2EvmScheme } from "../../../src/permit2/server/scheme";
import { PERMIT2_ADDRESS } from "../../../src/permit2/constants";

describe("Permit2EvmScheme (Server)", () => {
  let server: Permit2EvmScheme;

  beforeEach(() => {
    server = new Permit2EvmScheme();
  });

  describe("Construction", () => {
    it("should create instance", () => {
      expect(server).toBeDefined();
      expect(server.scheme).toBe("permit2");
    });
  });

  describe("parsePrice", () => {
    it("should pass through AssetAmount directly", async () => {
      const result = await server.parsePrice(
        { amount: "1000000", asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
        "eip155:8453",
      );

      expect(result.amount).toBe("1000000");
      expect(result.asset).toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    });

    it("should parse numeric price", async () => {
      const result = await server.parsePrice(1.5, "eip155:8453");

      expect(result.amount).toBe("1500000");
      expect(result.asset).toBeDefined();
    });

    it("should parse string price with dollar sign", async () => {
      const result = await server.parsePrice("$1.50", "eip155:8453");

      expect(result.amount).toBe("1500000");
    });

    it("should throw for invalid money format", async () => {
      await expect(server.parsePrice("invalid", "eip155:8453")).rejects.toThrow();
    });

    it("should throw for non-finite number", async () => {
      await expect(server.parsePrice(Infinity, "eip155:8453")).rejects.toThrow();
    });
  });

  describe("enhancePaymentRequirements", () => {
    it("should add permit2Address to extra", async () => {
      const requirements = {
        scheme: "permit2" as const,
        network: "eip155:8453" as const,
        amount: "1000000",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        maxTimeoutSeconds: 300,
      };

      const result = await server.enhancePaymentRequirements(
        requirements,
        { t402Version: 2, scheme: "permit2", network: "eip155:8453" },
        [],
      );

      expect(result.extra?.permit2Address).toBe(PERMIT2_ADDRESS);
    });

    it("should preserve existing extra fields", async () => {
      const requirements = {
        scheme: "permit2" as const,
        network: "eip155:8453" as const,
        amount: "1000000",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        maxTimeoutSeconds: 300,
        extra: { customField: "value" },
      };

      const result = await server.enhancePaymentRequirements(
        requirements,
        { t402Version: 2, scheme: "permit2", network: "eip155:8453" },
        [],
      );

      expect(result.extra?.customField).toBe("value");
      expect(result.extra?.permit2Address).toBe(PERMIT2_ADDRESS);
    });
  });

  describe("static methods", () => {
    it("getSupportedNetworks returns networks", () => {
      const networks = Permit2EvmScheme.getSupportedNetworks();
      expect(networks.length).toBeGreaterThan(0);
      expect(networks).toContain("eip155:8453");
    });

    it("isNetworkSupported returns true for valid networks", () => {
      expect(Permit2EvmScheme.isNetworkSupported("eip155:8453")).toBe(true);
    });

    it("isNetworkSupported returns false for invalid networks", () => {
      expect(Permit2EvmScheme.isNetworkSupported("eip155:99999")).toBe(false);
    });
  });
});
