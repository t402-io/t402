import { describe, it, expect } from "vitest";
import { ExactDirectPolkadotServer, createExactDirectPolkadotServer } from "../../src/exact-direct/server/scheme";
import {
  POLKADOT_ASSET_HUB_CAIP2,
  KUSAMA_ASSET_HUB_CAIP2,
  WESTEND_ASSET_HUB_CAIP2,
} from "../../src/constants";

describe("ExactDirectPolkadotServer", () => {
  const server = new ExactDirectPolkadotServer();

  describe("parsePrice", () => {
    describe("Polkadot Asset Hub", () => {
      const network = POLKADOT_ASSET_HUB_CAIP2;

      it("should parse dollar string prices", async () => {
        const result = await server.parsePrice("$1.50", network);
        expect(result.amount).toBe("1500000"); // 1.50 USDT = 1500000 (6 decimals)
        // CAIP-19 format: polkadot:.../asset:1984
        expect(result.asset).toBe(`${network}/asset:1984`);
        expect(result.extra).toEqual({
          symbol: "USDT",
          name: "Tether USD",
          decimals: 6,
          assetId: 1984,
        });
      });

      it("should parse simple number string prices", async () => {
        const result = await server.parsePrice("0.10", network);
        expect(result.amount).toBe("100000");
        expect(result.asset).toContain("asset:1984");
      });

      it("should parse number prices", async () => {
        const result = await server.parsePrice(0.1, network);
        expect(result.amount).toBe("100000");
      });

      it("should handle larger amounts", async () => {
        const result = await server.parsePrice("100.50", network);
        expect(result.amount).toBe("100500000");
      });

      it("should handle whole numbers", async () => {
        const result = await server.parsePrice("1", network);
        expect(result.amount).toBe("1000000");
      });

      it("should handle zero amounts", async () => {
        const result = await server.parsePrice(0, network);
        expect(result.amount).toBe("0");
      });

      it("should include assetId in extra", async () => {
        const result = await server.parsePrice("1.00", network);
        expect(result.extra?.assetId).toBe(1984);
      });

      it("should create proper CAIP-19 asset identifier", async () => {
        const result = await server.parsePrice("1.00", network);
        expect(result.asset).toBe(
          `polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984`,
        );
      });
    });

    describe("Kusama Asset Hub", () => {
      const network = KUSAMA_ASSET_HUB_CAIP2;

      it("should use Kusama Asset Hub USDT", async () => {
        const result = await server.parsePrice("1.00", network);
        expect(result.amount).toBe("1000000");
        expect(result.asset).toBe(`${network}/asset:1984`);
        expect(result.extra?.symbol).toBe("USDT");
      });
    });

    describe("Westend Asset Hub (Testnet)", () => {
      const network = WESTEND_ASSET_HUB_CAIP2;

      it("should use Westend Asset Hub test USDT", async () => {
        const result = await server.parsePrice("1.00", network);
        expect(result.amount).toBe("1000000");
        expect(result.asset).toBe(`${network}/asset:1984`);
        expect(result.extra?.name).toBe("Test Tether USD");
      });
    });

    describe("pre-parsed price objects (AssetAmount)", () => {
      it("should handle pre-parsed price objects with asset", async () => {
        const result = await server.parsePrice(
          {
            amount: "123456",
            asset: "polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984",
            extra: { custom: "value" },
          },
          POLKADOT_ASSET_HUB_CAIP2,
        );
        expect(result.amount).toBe("123456");
        expect(result.asset).toBe(
          "polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984",
        );
        expect(result.extra).toEqual({ custom: "value" });
      });

      it("should handle pre-parsed price with empty extra", async () => {
        const result = await server.parsePrice(
          {
            amount: "500000",
            asset: "polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984",
          } as never,
          POLKADOT_ASSET_HUB_CAIP2,
        );
        expect(result.amount).toBe("500000");
        expect(result.extra).toEqual({});
      });

      it("should throw for price objects without asset", async () => {
        await expect(
          async () =>
            await server.parsePrice(
              { amount: "123456" } as never,
              POLKADOT_ASSET_HUB_CAIP2,
            ),
        ).rejects.toThrow("Asset must be specified");
      });
    });

    describe("network validation", () => {
      it("should throw for non-Polkadot network", async () => {
        await expect(
          async () => await server.parsePrice("1.00", "eip155:1"),
        ).rejects.toThrow("Invalid Polkadot network");
      });

      it("should throw for Solana network", async () => {
        await expect(
          async () => await server.parsePrice("1.00", "solana:mainnet"),
        ).rejects.toThrow("Invalid Polkadot network");
      });

      it("should throw for unsupported Polkadot network", async () => {
        await expect(
          async () => await server.parsePrice("1.00", "polkadot:unknown123"),
        ).rejects.toThrow("No tokens configured");
      });
    });

    describe("error cases", () => {
      it("should throw for invalid money formats", async () => {
        await expect(
          async () =>
            await server.parsePrice("not-a-price!", POLKADOT_ASSET_HUB_CAIP2),
        ).rejects.toThrow("Invalid money format");
      });

      it("should throw for non-numeric strings", async () => {
        await expect(
          async () => await server.parsePrice("abc", POLKADOT_ASSET_HUB_CAIP2),
        ).rejects.toThrow("Invalid money format");
      });
    });
  });

  describe("enhancePaymentRequirements", () => {
    it("should preserve existing extra fields", async () => {
      const requirements = {
        scheme: "exact-direct",
        network: POLKADOT_ASSET_HUB_CAIP2,
        asset: "polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984",
        amount: "1000000",
        payTo: "1abc123...",
        maxTimeoutSeconds: 3600,
        extra: { existingField: "value" },
      };

      const result = await server.enhancePaymentRequirements(
        requirements as never,
        {
          t402Version: 2,
          scheme: "exact-direct",
          network: POLKADOT_ASSET_HUB_CAIP2,
          extra: {},
        },
        [],
      );

      expect(result.extra?.existingField).toBe("value");
    });

    it("should add facilitator-provided assetId, assetSymbol, assetDecimals", async () => {
      const requirements = {
        scheme: "exact-direct",
        network: POLKADOT_ASSET_HUB_CAIP2,
        asset: "polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984",
        amount: "1000000",
        payTo: "1abc123...",
        maxTimeoutSeconds: 3600,
        extra: {},
      };

      const result = await server.enhancePaymentRequirements(
        requirements as never,
        {
          t402Version: 2,
          scheme: "exact-direct",
          network: POLKADOT_ASSET_HUB_CAIP2,
          extra: {
            assetId: 1984,
            assetSymbol: "USDT",
            assetDecimals: 6,
            networkName: "Polkadot Asset Hub",
          },
        },
        [],
      );

      expect(result.extra?.assetId).toBe(1984);
      expect(result.extra?.assetSymbol).toBe("USDT");
      expect(result.extra?.assetDecimals).toBe(6);
      expect(result.extra?.networkName).toBe("Polkadot Asset Hub");
    });

    it("should handle empty supportedKind extra", async () => {
      const requirements = {
        scheme: "exact-direct",
        network: POLKADOT_ASSET_HUB_CAIP2,
        asset: "polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984",
        amount: "1000000",
        payTo: "1abc123...",
        maxTimeoutSeconds: 3600,
        extra: { custom: "data" },
      };

      const result = await server.enhancePaymentRequirements(
        requirements as never,
        {
          t402Version: 2,
          scheme: "exact-direct",
          network: POLKADOT_ASSET_HUB_CAIP2,
        },
        ["extension1"],
      );

      expect(result.extra).toEqual({ custom: "data" });
    });

    it("should merge facilitator extras with existing extras", async () => {
      const requirements = {
        scheme: "exact-direct",
        network: POLKADOT_ASSET_HUB_CAIP2,
        asset: "polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984",
        amount: "1000000",
        payTo: "1abc123...",
        maxTimeoutSeconds: 3600,
        extra: { myField: "preserved" },
      };

      const result = await server.enhancePaymentRequirements(
        requirements as never,
        {
          t402Version: 2,
          scheme: "exact-direct",
          network: POLKADOT_ASSET_HUB_CAIP2,
          extra: { assetSymbol: "USDT", networkName: "Polkadot Asset Hub" },
        },
        [],
      );

      expect(result.extra?.myField).toBe("preserved");
      expect(result.extra?.assetSymbol).toBe("USDT");
      expect(result.extra?.networkName).toBe("Polkadot Asset Hub");
    });
  });

  describe("preferredToken configuration", () => {
    it("should use configured preferred token (USDT)", async () => {
      const serverWithPreferred = new ExactDirectPolkadotServer({
        preferredToken: "USDT",
      });

      const result = await serverWithPreferred.parsePrice(
        "1.00",
        POLKADOT_ASSET_HUB_CAIP2,
      );
      expect(result.extra?.assetId).toBe(1984);
      expect(result.extra?.symbol).toBe("USDT");
    });

    it("should fall back to default if preferred token not found", async () => {
      const serverWithInvalid = new ExactDirectPolkadotServer({
        preferredToken: "NONEXISTENT",
      });

      const result = await serverWithInvalid.parsePrice(
        "1.00",
        POLKADOT_ASSET_HUB_CAIP2,
      );
      // Falls back to USDT (default)
      expect(result.extra?.symbol).toBe("USDT");
    });
  });

  describe("createExactDirectPolkadotServer factory", () => {
    it("should create server with default config", () => {
      const srv = createExactDirectPolkadotServer();
      expect(srv).toBeInstanceOf(ExactDirectPolkadotServer);
      expect(srv.scheme).toBe("exact-direct");
    });

    it("should create server with custom config", () => {
      const srv = createExactDirectPolkadotServer({
        preferredToken: "USDT",
      });
      expect(srv).toBeInstanceOf(ExactDirectPolkadotServer);
    });

    it("should produce a functional server", async () => {
      const srv = createExactDirectPolkadotServer();
      const result = await srv.parsePrice("2.50", POLKADOT_ASSET_HUB_CAIP2);
      expect(result.amount).toBe("2500000");
    });
  });

  describe("static methods", () => {
    it("getSupportedNetworks should return all registered networks", () => {
      const networks = ExactDirectPolkadotServer.getSupportedNetworks();
      expect(networks).toContain(POLKADOT_ASSET_HUB_CAIP2);
      expect(networks).toContain(KUSAMA_ASSET_HUB_CAIP2);
      expect(networks).toContain(WESTEND_ASSET_HUB_CAIP2);
    });

    it("isNetworkSupported should return true for valid networks", () => {
      expect(
        ExactDirectPolkadotServer.isNetworkSupported(POLKADOT_ASSET_HUB_CAIP2),
      ).toBe(true);
      expect(
        ExactDirectPolkadotServer.isNetworkSupported(KUSAMA_ASSET_HUB_CAIP2),
      ).toBe(true);
      expect(
        ExactDirectPolkadotServer.isNetworkSupported(WESTEND_ASSET_HUB_CAIP2),
      ).toBe(true);
    });

    it("isNetworkSupported should return false for invalid networks", () => {
      expect(
        ExactDirectPolkadotServer.isNetworkSupported("polkadot:unknown"),
      ).toBe(false);
      expect(ExactDirectPolkadotServer.isNetworkSupported("eip155:1")).toBe(
        false,
      );
    });
  });

  describe("scheme property", () => {
    it("should have scheme set to exact-direct", () => {
      expect(server.scheme).toBe("exact-direct");
    });
  });
});
