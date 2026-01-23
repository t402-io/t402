import { describe, it, expect } from "vitest";
import { ExactDirectTezosServer } from "../../src/exact-direct/server/scheme";
import {
  TEZOS_MAINNET_CAIP2,
  TEZOS_GHOSTNET_CAIP2,
} from "../../src/constants";

describe("ExactDirectTezosServer", () => {
  const server = new ExactDirectTezosServer();

  describe("parsePrice", () => {
    describe("Tezos Mainnet", () => {
      const network = TEZOS_MAINNET_CAIP2;

      it("should parse dollar string prices", async () => {
        const result = await server.parsePrice("$1.50", network);
        expect(result.amount).toBe("1500000"); // 1.50 USDt = 1500000 (6 decimals)
        // CAIP-19 format: tezos:NetXdQprcVkpaWU/fa2:KT1.../0
        expect(result.asset).toBe(
          `${network}/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0`,
        );
        expect(result.extra).toEqual({
          symbol: "USDt",
          name: "Tether USD",
          decimals: 6,
          tokenId: 0,
        });
      });

      it("should parse simple number string prices", async () => {
        const result = await server.parsePrice("0.10", network);
        expect(result.amount).toBe("100000");
        expect(result.asset).toContain("fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o");
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

      it("should create a proper CAIP-19 asset identifier for FA2", async () => {
        const result = await server.parsePrice("1.00", network);
        // Format: tezos:NetXdQprcVkpaWU/fa2:KT1.../tokenId
        expect(result.asset).toMatch(
          /^tezos:[A-Za-z0-9]+\/fa2:KT1[A-Za-z0-9]+\/\d+$/,
        );
      });

      it("should include tokenId in extra", async () => {
        const result = await server.parsePrice("1.00", network);
        expect(result.extra?.tokenId).toBe(0);
      });
    });

    describe("pre-parsed price objects (AssetAmount)", () => {
      it("should handle pre-parsed price objects with asset", async () => {
        const result = await server.parsePrice(
          {
            amount: "123456",
            asset: "tezos:NetXdQprcVkpaWU/fa2:KT1abc123/0",
            extra: { custom: "value" },
          },
          TEZOS_MAINNET_CAIP2,
        );
        expect(result.amount).toBe("123456");
        expect(result.asset).toBe("tezos:NetXdQprcVkpaWU/fa2:KT1abc123/0");
        expect(result.extra).toEqual({ custom: "value" });
      });

      it("should handle pre-parsed price with empty extra", async () => {
        const result = await server.parsePrice(
          {
            amount: "500000",
            asset: "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0",
          } as never,
          TEZOS_MAINNET_CAIP2,
        );
        expect(result.amount).toBe("500000");
        expect(result.extra).toEqual({});
      });

      it("should throw for price objects without asset", async () => {
        await expect(
          async () =>
            await server.parsePrice(
              { amount: "123456" } as never,
              TEZOS_MAINNET_CAIP2,
            ),
        ).rejects.toThrow("Asset must be specified");
      });
    });

    describe("network validation", () => {
      it("should throw for non-Tezos network", async () => {
        await expect(
          async () => await server.parsePrice("1.00", "eip155:1"),
        ).rejects.toThrow("Invalid Tezos network");
      });

      it("should throw for Solana network", async () => {
        await expect(
          async () => await server.parsePrice("1.00", "solana:mainnet"),
        ).rejects.toThrow("Invalid Tezos network");
      });
    });

    describe("Tezos Ghostnet (Testnet)", () => {
      it("should throw for ghostnet with no configured tokens", async () => {
        await expect(
          async () => await server.parsePrice("1.00", TEZOS_GHOSTNET_CAIP2),
        ).rejects.toThrow("No tokens configured");
      });
    });

    describe("error cases", () => {
      it("should throw for invalid money formats", async () => {
        await expect(
          async () => await server.parsePrice("not-a-price!", TEZOS_MAINNET_CAIP2),
        ).rejects.toThrow("Invalid money format");
      });

      it("should throw for non-numeric strings", async () => {
        await expect(
          async () => await server.parsePrice("abc", TEZOS_MAINNET_CAIP2),
        ).rejects.toThrow("Invalid money format");
      });
    });
  });

  describe("enhancePaymentRequirements", () => {
    it("should preserve existing extra fields", async () => {
      const requirements = {
        scheme: "exact-direct",
        network: TEZOS_MAINNET_CAIP2,
        asset: "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0",
        amount: "1000000",
        payTo: "tz1abc123",
        maxTimeoutSeconds: 3600,
        extra: { existingField: "value" },
      };

      const result = await server.enhancePaymentRequirements(
        requirements as never,
        {
          t402Version: 2,
          scheme: "exact-direct",
          network: TEZOS_MAINNET_CAIP2,
          extra: {},
        },
        [],
      );

      expect(result.extra?.existingField).toBe("value");
    });

    it("should add facilitator-provided assetSymbol and assetDecimals", async () => {
      const requirements = {
        scheme: "exact-direct",
        network: TEZOS_MAINNET_CAIP2,
        asset: "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0",
        amount: "1000000",
        payTo: "tz1abc123",
        maxTimeoutSeconds: 3600,
        extra: {},
      };

      const result = await server.enhancePaymentRequirements(
        requirements as never,
        {
          t402Version: 2,
          scheme: "exact-direct",
          network: TEZOS_MAINNET_CAIP2,
          extra: { assetSymbol: "USDt", assetDecimals: 6 },
        },
        [],
      );

      expect(result.extra?.assetSymbol).toBe("USDt");
      expect(result.extra?.assetDecimals).toBe(6);
    });

    it("should handle empty supportedKind extra", async () => {
      const requirements = {
        scheme: "exact-direct",
        network: TEZOS_MAINNET_CAIP2,
        asset: "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0",
        amount: "1000000",
        payTo: "tz1abc123",
        maxTimeoutSeconds: 3600,
        extra: { custom: "data" },
      };

      const result = await server.enhancePaymentRequirements(
        requirements as never,
        {
          t402Version: 2,
          scheme: "exact-direct",
          network: TEZOS_MAINNET_CAIP2,
        },
        ["extension1"],
      );

      expect(result.extra).toEqual({ custom: "data" });
    });

    it("should merge facilitator extras with existing extras", async () => {
      const requirements = {
        scheme: "exact-direct",
        network: TEZOS_MAINNET_CAIP2,
        asset: "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0",
        amount: "1000000",
        payTo: "tz1abc123",
        maxTimeoutSeconds: 3600,
        extra: { myField: "preserved" },
      };

      const result = await server.enhancePaymentRequirements(
        requirements as never,
        {
          t402Version: 2,
          scheme: "exact-direct",
          network: TEZOS_MAINNET_CAIP2,
          extra: { assetSymbol: "USDt" },
        },
        [],
      );

      expect(result.extra?.myField).toBe("preserved");
      expect(result.extra?.assetSymbol).toBe("USDt");
    });
  });

  describe("preferredToken configuration", () => {
    it("should use configured preferred token (USDt)", async () => {
      const serverWithPreferred = new ExactDirectTezosServer({
        preferredToken: "USDt",
      });

      const result = await serverWithPreferred.parsePrice("1.00", TEZOS_MAINNET_CAIP2);
      expect(result.asset).toContain("KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o");
      expect(result.extra?.symbol).toBe("USDt");
    });

    it("should fall back to default if preferred token not found", async () => {
      const serverWithInvalid = new ExactDirectTezosServer({
        preferredToken: "NONEXISTENT",
      });

      const result = await serverWithInvalid.parsePrice("1.00", TEZOS_MAINNET_CAIP2);
      // Falls back to USDt (default for mainnet)
      expect(result.extra?.symbol).toBe("USDt");
    });
  });

  describe("static methods", () => {
    it("getSupportedNetworks should return all registered networks", () => {
      const networks = ExactDirectTezosServer.getSupportedNetworks();
      expect(networks).toContain(TEZOS_MAINNET_CAIP2);
      expect(networks).toContain(TEZOS_GHOSTNET_CAIP2);
    });

    it("isNetworkSupported should return true for valid networks", () => {
      expect(ExactDirectTezosServer.isNetworkSupported(TEZOS_MAINNET_CAIP2)).toBe(true);
      expect(ExactDirectTezosServer.isNetworkSupported(TEZOS_GHOSTNET_CAIP2)).toBe(true);
    });

    it("isNetworkSupported should return false for invalid networks", () => {
      expect(ExactDirectTezosServer.isNetworkSupported("tezos:unknown")).toBe(false);
      expect(ExactDirectTezosServer.isNetworkSupported("eip155:1")).toBe(false);
    });
  });

  describe("scheme property", () => {
    it("should have scheme set to exact-direct", () => {
      expect(server.scheme).toBe("exact-direct");
    });
  });
});
