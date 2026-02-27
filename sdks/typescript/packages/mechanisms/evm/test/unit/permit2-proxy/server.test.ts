import { describe, it, expect, beforeEach } from "vitest";
import { Permit2ProxyEvmScheme } from "../../../src/permit2-proxy/server/scheme";
import {
  PERMIT2_ADDRESS,
  T402_EXACT_PERMIT2_PROXY,
  T402_UPTO_PERMIT2_PROXY,
} from "../../../src/permit2-proxy/constants";

describe("Permit2ProxyEvmScheme (Server)", () => {
  let server: Permit2ProxyEvmScheme;

  beforeEach(() => {
    server = new Permit2ProxyEvmScheme();
  });

  describe("Construction", () => {
    it("should create instance", () => {
      expect(server).toBeDefined();
      expect(server.scheme).toBe("permit2-proxy");
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
    it("should add permit2Address and proxy addresses to extra", async () => {
      const requirements = {
        scheme: "permit2-proxy" as const,
        network: "eip155:8453" as const,
        amount: "1000000",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        maxTimeoutSeconds: 300,
      };

      const result = await server.enhancePaymentRequirements(
        requirements,
        { t402Version: 2, scheme: "permit2-proxy", network: "eip155:8453" },
        [],
      );

      expect(result.extra?.permit2Address).toBe(PERMIT2_ADDRESS);
      expect(result.extra?.exactProxyAddress).toBe(T402_EXACT_PERMIT2_PROXY);
      expect(result.extra?.uptoProxyAddress).toBe(T402_UPTO_PERMIT2_PROXY);
    });

    it("should preserve existing extra fields", async () => {
      const requirements = {
        scheme: "permit2-proxy" as const,
        network: "eip155:8453" as const,
        amount: "1000000",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        maxTimeoutSeconds: 300,
        extra: { customField: "value" },
      };

      const result = await server.enhancePaymentRequirements(
        requirements,
        { t402Version: 2, scheme: "permit2-proxy", network: "eip155:8453" },
        [],
      );

      expect(result.extra?.customField).toBe("value");
      expect(result.extra?.permit2Address).toBe(PERMIT2_ADDRESS);
    });

    it("should pass through facilitator from supported kind extra", async () => {
      const requirements = {
        scheme: "permit2-proxy" as const,
        network: "eip155:8453" as const,
        amount: "1000000",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        maxTimeoutSeconds: 300,
      };

      const result = await server.enhancePaymentRequirements(
        requirements,
        {
          t402Version: 2,
          scheme: "permit2-proxy",
          network: "eip155:8453",
          extra: { facilitator: "0xFacilitator0000000000000000000000000000001" },
        },
        [],
      );

      expect(result.extra?.facilitator).toBe("0xFacilitator0000000000000000000000000000001");
    });

    it("should use custom proxy addresses from config", async () => {
      const customServer = new Permit2ProxyEvmScheme({
        exactProxyAddress: "0xCustomExact0000000000000000000000000000001",
        uptoProxyAddress: "0xCustomUpto00000000000000000000000000000001",
      });

      const requirements = {
        scheme: "permit2-proxy" as const,
        network: "eip155:8453" as const,
        amount: "1000000",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        maxTimeoutSeconds: 300,
      };

      const result = await customServer.enhancePaymentRequirements(
        requirements,
        { t402Version: 2, scheme: "permit2-proxy", network: "eip155:8453" },
        [],
      );

      expect(result.extra?.exactProxyAddress).toBe("0xCustomExact0000000000000000000000000000001");
      expect(result.extra?.uptoProxyAddress).toBe("0xCustomUpto00000000000000000000000000000001");
    });
  });

  describe("static methods", () => {
    it("getSupportedNetworks returns networks", () => {
      const networks = Permit2ProxyEvmScheme.getSupportedNetworks();
      expect(networks.length).toBeGreaterThan(0);
      expect(networks).toContain("eip155:8453");
    });

    it("isNetworkSupported returns true for valid networks", () => {
      expect(Permit2ProxyEvmScheme.isNetworkSupported("eip155:8453")).toBe(true);
    });

    it("isNetworkSupported returns false for invalid networks", () => {
      expect(Permit2ProxyEvmScheme.isNetworkSupported("eip155:99999")).toBe(false);
    });
  });
});
