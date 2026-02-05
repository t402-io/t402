import { describe, it, expect } from "vitest";
import { ExactDirectNearServer } from "../../src/exact-direct/server/scheme";
import { NEAR_MAINNET_CAIP2, NEAR_TESTNET_CAIP2 } from "../../src/constants";

describe("ExactDirectNearServer", () => {
  const server = new ExactDirectNearServer();

  describe("parsePrice", () => {
    describe("NEAR Mainnet", () => {
      const network = NEAR_MAINNET_CAIP2;

      it("should parse dollar string prices", async () => {
        const result = await server.parsePrice("$1.50", network);
        expect(result.amount).toBe("1500000"); // 1.50 USDC = 1500000 (6 decimals)
        expect(result.asset).toBe(
          "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
        );
        expect(result.extra).toEqual({
          symbol: "USDC",
          name: "USD Coin",
          decimals: 6,
        });
      });

      it("should parse simple number string prices", async () => {
        const result = await server.parsePrice("0.10", network);
        expect(result.amount).toBe("100000"); // 0.10 = 100000
        expect(result.asset).toBe(
          "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
        );
      });

      it("should parse number prices", async () => {
        const result = await server.parsePrice(0.1, network);
        expect(result.amount).toBe("100000");
        expect(result.asset).toBe(
          "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
        );
      });

      it("should handle larger amounts", async () => {
        const result = await server.parsePrice("100.50", network);
        expect(result.amount).toBe("100500000"); // 100.50 * 1e6
      });

      it("should handle whole numbers", async () => {
        const result = await server.parsePrice("1", network);
        expect(result.amount).toBe("1000000"); // 1 * 1e6
      });

      it("should handle zero amounts", async () => {
        const result = await server.parsePrice(0, network);
        expect(result.amount).toBe("0");
      });
    });

    describe("NEAR Testnet", () => {
      const network = NEAR_TESTNET_CAIP2;

      it("should use Testnet USDC address", async () => {
        const result = await server.parsePrice("1.00", network);
        expect(result.asset).toBe("usdc.fakes.testnet");
        expect(result.amount).toBe("1000000");
      });

      it("should include token metadata in extra", async () => {
        const result = await server.parsePrice("5.00", network);
        expect(result.extra).toEqual({
          symbol: "USDC",
          name: "USD Coin (Testnet)",
          decimals: 6,
        });
      });
    });

    describe("network normalization", () => {
      it("should handle non-prefixed network identifiers", async () => {
        const result = await server.parsePrice("1.00", "mainnet");
        expect(result.asset).toBe(
          "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
        );
        expect(result.amount).toBe("1000000");
      });
    });

    describe("pre-parsed price objects (AssetAmount)", () => {
      it("should handle pre-parsed price objects with asset", async () => {
        const result = await server.parsePrice(
          {
            amount: "123456",
            asset: "usdt.tether-token.near",
            extra: { custom: "value" },
          },
          NEAR_MAINNET_CAIP2,
        );
        expect(result.amount).toBe("123456");
        expect(result.asset).toBe("usdt.tether-token.near");
        expect(result.extra).toEqual({ custom: "value" });
      });

      it("should handle pre-parsed price with empty extra", async () => {
        const result = await server.parsePrice(
          {
            amount: "500000",
            asset: "usdt.tether-token.near",
          } as never,
          NEAR_MAINNET_CAIP2,
        );
        expect(result.amount).toBe("500000");
        expect(result.asset).toBe("usdt.tether-token.near");
        expect(result.extra).toEqual({});
      });

      it("should throw for price objects without asset", async () => {
        await expect(
          async () => await server.parsePrice({ amount: "123456" } as never, NEAR_MAINNET_CAIP2),
        ).rejects.toThrow("Asset address must be specified");
      });
    });

    describe("error cases", () => {
      it("should throw for invalid money formats", async () => {
        await expect(
          async () => await server.parsePrice("not-a-price!", NEAR_MAINNET_CAIP2),
        ).rejects.toThrow("Invalid money format");
      });

      it("should throw for non-numeric strings", async () => {
        await expect(
          async () => await server.parsePrice("abc", NEAR_MAINNET_CAIP2),
        ).rejects.toThrow("Invalid money format");
      });

      it("should throw for unsupported network with no tokens", async () => {
        await expect(async () => await server.parsePrice("1.00", "near:unknown")).rejects.toThrow(
          "No tokens configured",
        );
      });
    });
  });

  describe("enhancePaymentRequirements", () => {
    it("should preserve existing extra fields", async () => {
      const requirements = {
        scheme: "exact-direct",
        network: NEAR_MAINNET_CAIP2,
        asset: "usdt.tether-token.near",
        amount: "1000000",
        payTo: "receiver.near",
        maxTimeoutSeconds: 3600,
        extra: { existingField: "value" },
      };

      const result = await server.enhancePaymentRequirements(
        requirements as never,
        {
          t402Version: 2,
          scheme: "exact-direct",
          network: NEAR_MAINNET_CAIP2,
          extra: {},
        },
        [],
      );

      expect(result.extra?.existingField).toBe("value");
    });

    it("should add facilitator-provided assetSymbol", async () => {
      const requirements = {
        scheme: "exact-direct",
        network: NEAR_MAINNET_CAIP2,
        asset: "usdt.tether-token.near",
        amount: "1000000",
        payTo: "receiver.near",
        maxTimeoutSeconds: 3600,
        extra: {},
      };

      const result = await server.enhancePaymentRequirements(
        requirements as never,
        {
          t402Version: 2,
          scheme: "exact-direct",
          network: NEAR_MAINNET_CAIP2,
          extra: { assetSymbol: "USDT", assetDecimals: 6 },
        },
        [],
      );

      expect(result.extra?.assetSymbol).toBe("USDT");
      expect(result.extra?.assetDecimals).toBe(6);
    });

    it("should handle empty supportedKind extra", async () => {
      const requirements = {
        scheme: "exact-direct",
        network: NEAR_MAINNET_CAIP2,
        asset: "usdt.tether-token.near",
        amount: "1000000",
        payTo: "receiver.near",
        maxTimeoutSeconds: 3600,
        extra: { custom: "data" },
      };

      const result = await server.enhancePaymentRequirements(
        requirements as never,
        {
          t402Version: 2,
          scheme: "exact-direct",
          network: NEAR_MAINNET_CAIP2,
        },
        ["extension1"],
      );

      expect(result.extra).toEqual({ custom: "data" });
    });
  });

  describe("preferredToken configuration", () => {
    it("should use preferred token when configured", async () => {
      const serverWithPreferred = new ExactDirectNearServer({
        preferredToken: "USDT",
      });

      const result = await serverWithPreferred.parsePrice("1.00", NEAR_MAINNET_CAIP2);
      expect(result.asset).toBe("usdt.tether-token.near");
      expect(result.extra?.symbol).toBe("USDT");
    });

    it("should fall back to default if preferred token not found", async () => {
      const serverWithInvalid = new ExactDirectNearServer({
        preferredToken: "NONEXISTENT",
      });

      const result = await serverWithInvalid.parsePrice("1.00", NEAR_MAINNET_CAIP2);
      // Should fall back to default (USDC with highest priority)
      expect(result.asset).toBe("17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1");
    });
  });

  describe("static methods", () => {
    it("getSupportedNetworks should return all registered networks", () => {
      const networks = ExactDirectNearServer.getSupportedNetworks();
      expect(networks).toContain(NEAR_MAINNET_CAIP2);
      expect(networks).toContain(NEAR_TESTNET_CAIP2);
    });

    it("isNetworkSupported should return true for valid networks", () => {
      expect(ExactDirectNearServer.isNetworkSupported(NEAR_MAINNET_CAIP2)).toBe(true);
      expect(ExactDirectNearServer.isNetworkSupported(NEAR_TESTNET_CAIP2)).toBe(true);
    });

    it("isNetworkSupported should return false for invalid networks", () => {
      expect(ExactDirectNearServer.isNetworkSupported("near:unknown")).toBe(false);
      expect(ExactDirectNearServer.isNetworkSupported("eip155:1")).toBe(false);
    });
  });

  describe("scheme property", () => {
    it("should have scheme set to exact-direct", () => {
      expect(server.scheme).toBe("exact-direct");
    });
  });
});
