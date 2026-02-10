import { describe, it, expect } from "vitest";
import { ExactDirectCosmosServer } from "../../../src/exact-direct/server/scheme";
import { NOBLE_MAINNET_CAIP2, NOBLE_TESTNET_CAIP2 } from "../../../src/constants";
import type { MoneyParser } from "@t402/core/types";

describe("ExactDirectCosmosServer", () => {
  const server = new ExactDirectCosmosServer();

  describe("scheme property", () => {
    it("should have scheme set to exact-direct", () => {
      expect(server.scheme).toBe("exact-direct");
    });
  });

  describe("parsePrice", () => {
    describe("Noble Mainnet", () => {
      const network = NOBLE_MAINNET_CAIP2;

      it("should parse dollar string prices", async () => {
        const result = await server.parsePrice("$1.50", network);
        expect(result.amount).toBe("1500000"); // 1.50 USDC = 1500000 (6 decimals)
        expect(result.asset).toBe("uusdc");
        expect(result.extra).toEqual({
          symbol: "USDC",
          name: "USD Coin",
          decimals: 6,
        });
      });

      it("should parse simple number string prices", async () => {
        const result = await server.parsePrice("0.10", network);
        expect(result.amount).toBe("100000"); // 0.10 = 100000
        expect(result.asset).toBe("uusdc");
      });

      it("should parse number prices", async () => {
        const result = await server.parsePrice(0.1, network);
        expect(result.amount).toBe("100000");
        expect(result.asset).toBe("uusdc");
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

    describe("Noble Testnet", () => {
      const network = NOBLE_TESTNET_CAIP2;

      it("should use testnet USDC denomination", async () => {
        const result = await server.parsePrice("1.00", network);
        expect(result.asset).toBe("uusdc");
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

    describe("pre-parsed price objects (AssetAmount)", () => {
      it("should handle pre-parsed price objects with asset", async () => {
        const result = await server.parsePrice(
          {
            amount: "123456",
            asset: "uusdc",
            extra: { custom: "value" },
          },
          NOBLE_MAINNET_CAIP2,
        );
        expect(result.amount).toBe("123456");
        expect(result.asset).toBe("uusdc");
        expect(result.extra).toEqual({ custom: "value" });
      });

      it("should handle pre-parsed price with empty extra", async () => {
        const result = await server.parsePrice(
          {
            amount: "500000",
            asset: "uusdc",
          } as never,
          NOBLE_MAINNET_CAIP2,
        );
        expect(result.amount).toBe("500000");
        expect(result.asset).toBe("uusdc");
        expect(result.extra).toEqual({});
      });

      it("should throw for price objects without asset", async () => {
        await expect(
          async () => await server.parsePrice({ amount: "123456" } as never, NOBLE_MAINNET_CAIP2),
        ).rejects.toThrow("Asset address must be specified");
      });
    });

    describe("error cases", () => {
      it("should throw for invalid money formats", async () => {
        await expect(
          async () => await server.parsePrice("not-a-price!", NOBLE_MAINNET_CAIP2),
        ).rejects.toThrow("Invalid money format");
      });

      it("should throw for non-numeric strings", async () => {
        await expect(
          async () => await server.parsePrice("abc", NOBLE_MAINNET_CAIP2),
        ).rejects.toThrow("Invalid money format");
      });

      it("should throw for unsupported network with no tokens", async () => {
        await expect(async () => await server.parsePrice("1.00", "cosmos:unknown")).rejects.toThrow(
          "No tokens configured",
        );
      });
    });
  });

  describe("enhancePaymentRequirements", () => {
    it("should preserve existing extra fields", async () => {
      const requirements = {
        scheme: "exact-direct",
        network: NOBLE_MAINNET_CAIP2,
        asset: "uusdc",
        amount: "1000000",
        payTo: "noble1receiver123456789abc",
        maxTimeoutSeconds: 3600,
        extra: { existingField: "value" },
      };

      const result = await server.enhancePaymentRequirements(
        requirements as never,
        {
          t402Version: 2,
          scheme: "exact-direct",
          network: NOBLE_MAINNET_CAIP2,
          extra: {},
        },
        [],
      );

      expect(result.extra?.existingField).toBe("value");
    });

    it("should add Cosmos-specific extra fields (bech32Prefix, denom)", async () => {
      const requirements = {
        scheme: "exact-direct",
        network: NOBLE_MAINNET_CAIP2,
        asset: "uusdc",
        amount: "1000000",
        payTo: "noble1receiver123456789abc",
        maxTimeoutSeconds: 3600,
        extra: {},
      };

      const result = await server.enhancePaymentRequirements(
        requirements as never,
        {
          t402Version: 2,
          scheme: "exact-direct",
          network: NOBLE_MAINNET_CAIP2,
          extra: {},
        },
        [],
      );

      expect(result.extra?.bech32Prefix).toBe("noble");
      expect(result.extra?.denom).toBe("uusdc");
    });

    it("should add facilitator-provided extra fields", async () => {
      const requirements = {
        scheme: "exact-direct",
        network: NOBLE_MAINNET_CAIP2,
        asset: "uusdc",
        amount: "1000000",
        payTo: "noble1receiver123456789abc",
        maxTimeoutSeconds: 3600,
        extra: {},
      };

      const result = await server.enhancePaymentRequirements(
        requirements as never,
        {
          t402Version: 2,
          scheme: "exact-direct",
          network: NOBLE_MAINNET_CAIP2,
          extra: { assetSymbol: "USDC", assetDecimals: 6, assetDenom: "uusdc" },
        },
        [],
      );

      expect(result.extra?.assetSymbol).toBe("USDC");
      expect(result.extra?.assetDecimals).toBe(6);
      expect(result.extra?.assetDenom).toBe("uusdc");
    });

    it("should handle empty supportedKind extra", async () => {
      const requirements = {
        scheme: "exact-direct",
        network: NOBLE_MAINNET_CAIP2,
        asset: "uusdc",
        amount: "1000000",
        payTo: "noble1receiver123456789abc",
        maxTimeoutSeconds: 3600,
        extra: { custom: "data" },
      };

      const result = await server.enhancePaymentRequirements(
        requirements as never,
        {
          t402Version: 2,
          scheme: "exact-direct",
          network: NOBLE_MAINNET_CAIP2,
        },
        ["extension1"],
      );

      expect(result.extra?.custom).toBe("data");
      expect(result.extra?.bech32Prefix).toBe("noble");
    });
  });

  describe("registerMoneyParser", () => {
    it("should use custom parser for Money values", async () => {
      const customServer = new ExactDirectCosmosServer();

      const customParser: MoneyParser = async (amount, _network) => {
        if (amount > 100) {
          return {
            amount: (amount * 1e9).toString(),
            asset: "custom-denom",
            extra: { token: "CUSTOM", tier: "large" },
          };
        }
        return null;
      };

      customServer.registerMoneyParser(customParser);

      // Large amount should use custom parser
      const result1 = await customServer.parsePrice(150, NOBLE_MAINNET_CAIP2);
      expect(result1.asset).toBe("custom-denom");
      expect(result1.extra?.token).toBe("CUSTOM");

      // Small amount should fall back to default (USDC)
      const result2 = await customServer.parsePrice(50, NOBLE_MAINNET_CAIP2);
      expect(result2.asset).toBe("uusdc");
    });

    it("should support chaining", () => {
      const customServer = new ExactDirectCosmosServer();

      const parser1: MoneyParser = async () => null;
      const parser2: MoneyParser = async () => null;

      const result = customServer.registerMoneyParser(parser1).registerMoneyParser(parser2);
      expect(result).toBe(customServer);
    });

    it("should try parsers in registration order", async () => {
      const customServer = new ExactDirectCosmosServer();
      const executionOrder: number[] = [];

      customServer
        .registerMoneyParser(async (amount) => {
          executionOrder.push(1);
          if (amount > 1000) return { amount: "1", asset: "Parser1Denom", extra: {} };
          return null;
        })
        .registerMoneyParser(async (amount) => {
          executionOrder.push(2);
          if (amount > 100) return { amount: "2", asset: "Parser2Denom", extra: {} };
          return null;
        })
        .registerMoneyParser(async (_amount) => {
          executionOrder.push(3);
          return { amount: "3", asset: "Parser3Denom", extra: {} };
        });

      await customServer.parsePrice(50, NOBLE_MAINNET_CAIP2);
      expect(executionOrder).toEqual([1, 2, 3]);
    });

    it("should stop at first non-null result", async () => {
      const customServer = new ExactDirectCosmosServer();
      const executionOrder: number[] = [];

      customServer
        .registerMoneyParser(async (_amount) => {
          executionOrder.push(1);
          return null;
        })
        .registerMoneyParser(async (_amount) => {
          executionOrder.push(2);
          return { amount: "winner", asset: "WinnerDenom", extra: {} };
        })
        .registerMoneyParser(async (_amount) => {
          executionOrder.push(3);
          return { amount: "3", asset: "Parser3Denom", extra: {} };
        });

      const result = await customServer.parsePrice(50, NOBLE_MAINNET_CAIP2);

      expect(executionOrder).toEqual([1, 2]);
      expect(result.asset).toBe("WinnerDenom");
    });

    it("should not call parser for AssetAmount (pass-through)", async () => {
      const customServer = new ExactDirectCosmosServer();
      let parserCalled = false;

      customServer.registerMoneyParser(async (_amount, _network) => {
        parserCalled = true;
        return null;
      });

      const assetAmount = {
        amount: "100000",
        asset: "uusdc",
        extra: { custom: true },
      };

      const result = await customServer.parsePrice(assetAmount, NOBLE_MAINNET_CAIP2);

      expect(parserCalled).toBe(false);
      expect(result).toEqual(assetAmount);
    });
  });

  describe("static methods", () => {
    it("getSupportedNetworks should return all registered networks", () => {
      const networks = ExactDirectCosmosServer.getSupportedNetworks();
      expect(networks).toContain(NOBLE_MAINNET_CAIP2);
      expect(networks).toContain(NOBLE_TESTNET_CAIP2);
    });

    it("isNetworkSupported should return true for valid networks", () => {
      expect(ExactDirectCosmosServer.isNetworkSupported(NOBLE_MAINNET_CAIP2)).toBe(true);
      expect(ExactDirectCosmosServer.isNetworkSupported(NOBLE_TESTNET_CAIP2)).toBe(true);
    });

    it("isNetworkSupported should return false for invalid networks", () => {
      expect(ExactDirectCosmosServer.isNetworkSupported("cosmos:unknown")).toBe(false);
      expect(ExactDirectCosmosServer.isNetworkSupported("eip155:1")).toBe(false);
    });
  });
});
