import { describe, it, expect, beforeEach } from "vitest";
import { ExactLegacyEvmScheme } from "../../../src/exact-legacy/server/scheme";

describe("ExactLegacyEvmScheme (Server)", () => {
  let server: ExactLegacyEvmScheme;

  beforeEach(() => {
    server = new ExactLegacyEvmScheme();
  });

  describe("Construction", () => {
    it("should create instance", () => {
      expect(server).toBeDefined();
      expect(server.scheme).toBe("exact-legacy");
    });

    it("should accept config with preferred token", () => {
      const serverWithConfig = new ExactLegacyEvmScheme({ preferredToken: "USDT" });
      expect(serverWithConfig).toBeDefined();
    });
  });

  describe("parsePrice", () => {
    it("should parse numeric amount for legacy USDT on Ethereum", async () => {
      const result = await server.parsePrice(1.5, "eip155:1");

      expect(result.amount).toBe("1500000"); // 1.5 * 10^6
      expect(result.asset).toBe("0xdAC17F958D2ee523a2206206994597C13D831ec7");
      expect(result.extra?.tokenType).toBe("legacy");
    });

    it("should parse string amount with $ prefix", async () => {
      const result = await server.parsePrice("$2.50", "eip155:1");

      expect(result.amount).toBe("2500000"); // 2.5 * 10^6
    });

    it("should parse string amount without $ prefix", async () => {
      const result = await server.parsePrice("0.10", "eip155:1");

      expect(result.amount).toBe("100000"); // 0.10 * 10^6
    });

    it("should return AssetAmount directly if already provided", async () => {
      const assetAmount = {
        amount: "5000000",
        asset: "0xCustomToken",
        extra: { customField: true },
      };

      const result = await server.parsePrice(assetAmount, "eip155:1");

      expect(result.amount).toBe("5000000");
      expect(result.asset).toBe("0xCustomToken");
      expect(result.extra?.tokenType).toBe("legacy");
      expect(result.extra?.customField).toBe(true);
    });

    it("should throw for invalid money format", async () => {
      await expect(server.parsePrice("invalid", "eip155:1")).rejects.toThrow(
        "Invalid money format",
      );
    });

    it("should throw for network without legacy tokens", async () => {
      // Ink doesn't have legacy USDT
      await expect(server.parsePrice(1.0, "eip155:57073")).rejects.toThrow(
        "No legacy tokens configured",
      );
    });

    it("should parse for Polygon with legacy USDT", async () => {
      const result = await server.parsePrice(1.0, "eip155:137");

      expect(result.amount).toBe("1000000");
      expect(result.asset).toBe("0xc2132D05D31c914a87C6611C10748AEb04B58e8F"); // Polygon USDT
      expect(result.extra?.tokenType).toBe("legacy");
    });
  });

  describe("enhancePaymentRequirements", () => {
    it("should add tokenType to extra", async () => {
      const requirements = {
        scheme: "exact-legacy" as const,
        network: "eip155:1" as const,
        amount: "1000000",
        asset: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        maxTimeoutSeconds: 300,
      };

      const supportedKind = {
        t402Version: 2,
        scheme: "exact-legacy",
        network: "eip155:1" as const,
      };

      const result = await server.enhancePaymentRequirements(requirements, supportedKind, []);

      expect(result.extra?.tokenType).toBe("legacy");
    });

    it("should add spender from supportedKind extra", async () => {
      const requirements = {
        scheme: "exact-legacy" as const,
        network: "eip155:1" as const,
        amount: "1000000",
        asset: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        maxTimeoutSeconds: 300,
      };

      const supportedKind = {
        t402Version: 2,
        scheme: "exact-legacy",
        network: "eip155:1" as const,
        extra: {
          spender: "0xFacilitator1234567890123456789012345678",
        },
      };

      const result = await server.enhancePaymentRequirements(requirements, supportedKind, []);

      expect(result.extra?.spender).toBe("0xFacilitator1234567890123456789012345678");
    });

    it("should preserve existing extra fields", async () => {
      const requirements = {
        scheme: "exact-legacy" as const,
        network: "eip155:1" as const,
        amount: "1000000",
        asset: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        maxTimeoutSeconds: 300,
        extra: {
          customField: "value",
        },
      };

      const supportedKind = {
        t402Version: 2,
        scheme: "exact-legacy",
        network: "eip155:1" as const,
      };

      const result = await server.enhancePaymentRequirements(requirements, supportedKind, []);

      expect(result.extra?.customField).toBe("value");
      expect(result.extra?.tokenType).toBe("legacy");
    });
  });

  describe("registerMoneyParser", () => {
    it("should use custom money parser when registered", async () => {
      const customParser = async (amount: number, network: string) => {
        if (network === "eip155:1" && amount > 100) {
          return {
            amount: (amount * 1e6).toString(),
            asset: "0xCustomLargeAmountToken",
            extra: { customParser: true },
          };
        }
        return null;
      };

      server.registerMoneyParser(customParser);

      const result = await server.parsePrice(150, "eip155:1");

      expect(result.asset).toBe("0xCustomLargeAmountToken");
      expect(result.extra?.customParser).toBe(true);
    });

    it("should fall back to default if custom parser returns null", async () => {
      const customParser = async () => null;

      server.registerMoneyParser(customParser);

      const result = await server.parsePrice(1.0, "eip155:1");

      // Should use default USDT
      expect(result.asset).toBe("0xdAC17F958D2ee523a2206206994597C13D831ec7");
    });

    it("should support chaining", () => {
      const result = server
        .registerMoneyParser(async () => null)
        .registerMoneyParser(async () => null);

      expect(result).toBe(server);
    });
  });

  describe("Static methods", () => {
    it("getSupportedNetworks should return networks with legacy USDT", () => {
      const networks = ExactLegacyEvmScheme.getSupportedNetworks();

      expect(networks).toContain("eip155:1"); // Ethereum
      expect(networks).toContain("eip155:137"); // Polygon
    });

    it("isNetworkSupported should return true for supported networks", () => {
      expect(ExactLegacyEvmScheme.isNetworkSupported("eip155:1")).toBe(true);
      expect(ExactLegacyEvmScheme.isNetworkSupported("eip155:137")).toBe(true);
    });

    it("isNetworkSupported should return false for unsupported networks", () => {
      expect(ExactLegacyEvmScheme.isNetworkSupported("eip155:42161")).toBe(false); // Arbitrum has USDT0
      expect(ExactLegacyEvmScheme.isNetworkSupported("eip155:57073")).toBe(false); // Ink
    });
  });
});
