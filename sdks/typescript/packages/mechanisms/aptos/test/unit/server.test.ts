import { describe, it, expect } from "vitest";
import { ExactDirectAptosServer } from "../../src/exact-direct/server/scheme";
import {
  APTOS_MAINNET_CAIP2,
  APTOS_TESTNET_CAIP2,
  APTOS_DEVNET_CAIP2,
} from "../../src/constants";

describe("ExactDirectAptosServer", () => {
  const server = new ExactDirectAptosServer();

  describe("parsePrice", () => {
    describe("Aptos Mainnet", () => {
      const network = APTOS_MAINNET_CAIP2;

      it("should parse dollar string prices", async () => {
        const result = await server.parsePrice("$1.50", network);
        expect(result.amount).toBe("1500000"); // 1.50 USDT = 1500000 (6 decimals)
        expect(result.asset).toBe(
          `${network}/fa:0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb`,
        );
        expect(result.extra).toEqual({
          symbol: "USDT",
          name: "Tether USD",
          decimals: 6,
        });
      });

      it("should parse simple number string prices", async () => {
        const result = await server.parsePrice("0.10", network);
        expect(result.amount).toBe("100000");
        expect(result.asset).toContain("fa:0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb");
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

      it("should create a proper CAIP-19 asset identifier", async () => {
        const result = await server.parsePrice("1.00", network);
        // Format: aptos:1/fa:0x...
        expect(result.asset).toMatch(/^aptos:\d+\/fa:0x[0-9a-f]+$/);
      });
    });

    describe("Aptos Testnet", () => {
      const network = APTOS_TESTNET_CAIP2;

      it("should use Testnet USDT address", async () => {
        const result = await server.parsePrice("1.00", network);
        expect(result.asset).toContain("aptos:2/fa:");
        expect(result.amount).toBe("1000000");
      });

      it("should include token metadata in extra", async () => {
        const result = await server.parsePrice("5.00", network);
        expect(result.extra?.symbol).toBe("USDT");
        expect(result.extra?.decimals).toBe(6);
      });
    });

    describe("pre-parsed price objects (AssetAmount)", () => {
      it("should handle pre-parsed price objects with asset", async () => {
        const result = await server.parsePrice(
          {
            amount: "123456",
            asset: "aptos:1/fa:0xabc123",
            extra: { custom: "value" },
          },
          APTOS_MAINNET_CAIP2,
        );
        expect(result.amount).toBe("123456");
        expect(result.asset).toBe("aptos:1/fa:0xabc123");
        expect(result.extra).toEqual({ custom: "value" });
      });

      it("should handle pre-parsed price with empty extra", async () => {
        const result = await server.parsePrice(
          {
            amount: "500000",
            asset: "aptos:1/fa:0xf73e887a",
          } as never,
          APTOS_MAINNET_CAIP2,
        );
        expect(result.amount).toBe("500000");
        expect(result.extra).toEqual({});
      });

      it("should throw for price objects without asset", async () => {
        await expect(
          async () =>
            await server.parsePrice(
              { amount: "123456" } as never,
              APTOS_MAINNET_CAIP2,
            ),
        ).rejects.toThrow("Asset address must be specified");
      });
    });

    describe("network validation", () => {
      it("should throw for non-Aptos network", async () => {
        await expect(
          async () => await server.parsePrice("1.00", "eip155:1"),
        ).rejects.toThrow("Invalid Aptos network");
      });

      it("should throw for invalid network format", async () => {
        await expect(
          async () => await server.parsePrice("1.00", "solana:mainnet"),
        ).rejects.toThrow("Invalid Aptos network");
      });
    });

    describe("error cases", () => {
      it("should throw for invalid money formats", async () => {
        await expect(
          async () => await server.parsePrice("not-a-price!", APTOS_MAINNET_CAIP2),
        ).rejects.toThrow("Invalid money format");
      });

      it("should throw for non-numeric strings", async () => {
        await expect(
          async () => await server.parsePrice("abc", APTOS_MAINNET_CAIP2),
        ).rejects.toThrow("Invalid money format");
      });

      it("should throw for devnet with no configured tokens", async () => {
        await expect(
          async () => await server.parsePrice("1.00", APTOS_DEVNET_CAIP2),
        ).rejects.toThrow("No tokens configured");
      });
    });
  });

  describe("enhancePaymentRequirements", () => {
    it("should preserve existing extra fields", async () => {
      const requirements = {
        scheme: "exact-direct",
        network: APTOS_MAINNET_CAIP2,
        asset: "aptos:1/fa:0xf73e887a",
        amount: "1000000",
        payTo: "0x123abc",
        maxTimeoutSeconds: 3600,
        extra: { existingField: "value" },
      };

      const result = await server.enhancePaymentRequirements(
        requirements as never,
        {
          t402Version: 2,
          scheme: "exact-direct",
          network: APTOS_MAINNET_CAIP2,
          extra: {},
        },
        [],
      );

      expect(result.extra?.existingField).toBe("value");
    });

    it("should add facilitator-provided assetSymbol and assetDecimals", async () => {
      const requirements = {
        scheme: "exact-direct",
        network: APTOS_MAINNET_CAIP2,
        asset: "aptos:1/fa:0xf73e887a",
        amount: "1000000",
        payTo: "0x123abc",
        maxTimeoutSeconds: 3600,
        extra: {},
      };

      const result = await server.enhancePaymentRequirements(
        requirements as never,
        {
          t402Version: 2,
          scheme: "exact-direct",
          network: APTOS_MAINNET_CAIP2,
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
        network: APTOS_MAINNET_CAIP2,
        asset: "aptos:1/fa:0xf73e887a",
        amount: "1000000",
        payTo: "0x123abc",
        maxTimeoutSeconds: 3600,
        extra: { custom: "data" },
      };

      const result = await server.enhancePaymentRequirements(
        requirements as never,
        {
          t402Version: 2,
          scheme: "exact-direct",
          network: APTOS_MAINNET_CAIP2,
        },
        ["extension1"],
      );

      expect(result.extra).toEqual({ custom: "data" });
    });

    it("should merge facilitator extras with existing extras", async () => {
      const requirements = {
        scheme: "exact-direct",
        network: APTOS_MAINNET_CAIP2,
        asset: "aptos:1/fa:0xf73e887a",
        amount: "1000000",
        payTo: "0x123abc",
        maxTimeoutSeconds: 3600,
        extra: { myField: "preserved" },
      };

      const result = await server.enhancePaymentRequirements(
        requirements as never,
        {
          t402Version: 2,
          scheme: "exact-direct",
          network: APTOS_MAINNET_CAIP2,
          extra: { assetSymbol: "USDT" },
        },
        [],
      );

      expect(result.extra?.myField).toBe("preserved");
      expect(result.extra?.assetSymbol).toBe("USDT");
    });
  });

  describe("preferredToken configuration", () => {
    it("should use USDC when configured as preferred token", async () => {
      const serverWithPreferred = new ExactDirectAptosServer({
        preferredToken: "USDC",
      });

      const result = await serverWithPreferred.parsePrice("1.00", APTOS_MAINNET_CAIP2);
      expect(result.asset).toContain(
        "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
      );
      expect(result.extra?.symbol).toBe("USDC");
    });

    it("should fall back to default if preferred token not found", async () => {
      const serverWithInvalid = new ExactDirectAptosServer({
        preferredToken: "NONEXISTENT",
      });

      const result = await serverWithInvalid.parsePrice("1.00", APTOS_MAINNET_CAIP2);
      // Falls back to USDT (default)
      expect(result.extra?.symbol).toBe("USDT");
    });
  });

  describe("static methods", () => {
    it("getSupportedNetworks should return all registered networks", () => {
      const networks = ExactDirectAptosServer.getSupportedNetworks();
      expect(networks).toContain(APTOS_MAINNET_CAIP2);
      expect(networks).toContain(APTOS_TESTNET_CAIP2);
      expect(networks).toContain(APTOS_DEVNET_CAIP2);
    });

    it("isNetworkSupported should return true for valid networks", () => {
      expect(ExactDirectAptosServer.isNetworkSupported(APTOS_MAINNET_CAIP2)).toBe(true);
      expect(ExactDirectAptosServer.isNetworkSupported(APTOS_TESTNET_CAIP2)).toBe(true);
    });

    it("isNetworkSupported should return false for invalid networks", () => {
      expect(ExactDirectAptosServer.isNetworkSupported("aptos:999")).toBe(false);
      expect(ExactDirectAptosServer.isNetworkSupported("eip155:1")).toBe(false);
    });
  });

  describe("scheme property", () => {
    it("should have scheme set to exact-direct", () => {
      expect(server.scheme).toBe("exact-direct");
    });
  });
});
