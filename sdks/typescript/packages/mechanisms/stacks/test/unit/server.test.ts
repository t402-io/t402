import { describe, it, expect } from "vitest";
import { ExactDirectStacksServer, createExactDirectStacksServer } from "../../src/exact-direct/server/scheme";
import {
  STACKS_MAINNET_CAIP2,
  STACKS_TESTNET_CAIP2,
} from "../../src/constants";

describe("ExactDirectStacksServer", () => {
  const server = new ExactDirectStacksServer();

  describe("parsePrice", () => {
    describe("Stacks Mainnet", () => {
      const network = STACKS_MAINNET_CAIP2;

      it("should parse dollar string prices", async () => {
        const result = await server.parsePrice("$1.50", network);
        expect(result.amount).toBe("1500000"); // 1.50 sUSDC = 1500000 (6 decimals)
        expect(result.asset).toBe(`${network}/sip010:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc`);
        expect(result.extra).toEqual({
          symbol: "sUSDC",
          name: "Stacks USDC",
          decimals: 6,
          contractAddress: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
        });
      });

      it("should parse simple number string prices", async () => {
        const result = await server.parsePrice("0.10", network);
        expect(result.amount).toBe("100000");
        expect(result.asset).toContain("sip010:");
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

      it("should include contractAddress in extra", async () => {
        const result = await server.parsePrice("1.00", network);
        expect(result.extra?.contractAddress).toBe(
          "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
        );
      });

      it("should create proper CAIP-19 asset identifier", async () => {
        const result = await server.parsePrice("1.00", network);
        expect(result.asset).toBe(
          "stacks:1/sip010:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
        );
      });
    });

    describe("Stacks Testnet", () => {
      const network = STACKS_TESTNET_CAIP2;

      it("should use Testnet sUSDC", async () => {
        const result = await server.parsePrice("1.00", network);
        expect(result.amount).toBe("1000000");
        expect(result.asset).toBe(
          `${network}/sip010:ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.token-susdc`,
        );
        expect(result.extra?.symbol).toBe("sUSDC");
        expect(result.extra?.name).toBe("Test Stacks USDC");
      });
    });

    describe("pre-parsed price objects (AssetAmount)", () => {
      it("should handle pre-parsed price objects with asset", async () => {
        const result = await server.parsePrice(
          {
            amount: "123456",
            asset: "stacks:1/sip010:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
            extra: { custom: "value" },
          },
          STACKS_MAINNET_CAIP2,
        );
        expect(result.amount).toBe("123456");
        expect(result.asset).toBe(
          "stacks:1/sip010:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
        );
        expect(result.extra).toEqual({ custom: "value" });
      });

      it("should handle pre-parsed price with empty extra", async () => {
        const result = await server.parsePrice(
          {
            amount: "500000",
            asset: "stacks:1/sip010:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
          } as never,
          STACKS_MAINNET_CAIP2,
        );
        expect(result.amount).toBe("500000");
        expect(result.extra).toEqual({});
      });

      it("should throw for price objects without asset", async () => {
        await expect(
          async () =>
            await server.parsePrice(
              { amount: "123456" } as never,
              STACKS_MAINNET_CAIP2,
            ),
        ).rejects.toThrow("Asset must be specified");
      });
    });

    describe("network validation", () => {
      it("should throw for non-Stacks network", async () => {
        await expect(
          async () => await server.parsePrice("1.00", "eip155:1"),
        ).rejects.toThrow("Invalid Stacks network");
      });

      it("should throw for Solana network", async () => {
        await expect(
          async () => await server.parsePrice("1.00", "solana:mainnet"),
        ).rejects.toThrow("Invalid Stacks network");
      });

      it("should throw for unsupported Stacks network", async () => {
        await expect(
          async () => await server.parsePrice("1.00", "stacks:unknown123"),
        ).rejects.toThrow("No tokens configured");
      });
    });

    describe("error cases", () => {
      it("should throw for invalid money formats", async () => {
        await expect(
          async () =>
            await server.parsePrice("not-a-price!", STACKS_MAINNET_CAIP2),
        ).rejects.toThrow("Invalid money format");
      });

      it("should throw for non-numeric strings", async () => {
        await expect(
          async () => await server.parsePrice("abc", STACKS_MAINNET_CAIP2),
        ).rejects.toThrow("Invalid money format");
      });
    });
  });

  describe("enhancePaymentRequirements", () => {
    it("should preserve existing extra fields", async () => {
      const requirements = {
        scheme: "exact-direct",
        network: STACKS_MAINNET_CAIP2,
        asset: "stacks:1/sip010:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
        amount: "1000000",
        payTo: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
        maxTimeoutSeconds: 3600,
        extra: { existingField: "value" },
      };

      const result = await server.enhancePaymentRequirements(
        requirements as never,
        {
          t402Version: 2,
          scheme: "exact-direct",
          network: STACKS_MAINNET_CAIP2,
          extra: {},
        },
        [],
      );

      expect(result.extra?.existingField).toBe("value");
    });

    it("should add facilitator-provided contractAddress, assetSymbol, assetDecimals", async () => {
      const requirements = {
        scheme: "exact-direct",
        network: STACKS_MAINNET_CAIP2,
        asset: "stacks:1/sip010:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
        amount: "1000000",
        payTo: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
        maxTimeoutSeconds: 3600,
        extra: {},
      };

      const result = await server.enhancePaymentRequirements(
        requirements as never,
        {
          t402Version: 2,
          scheme: "exact-direct",
          network: STACKS_MAINNET_CAIP2,
          extra: {
            contractAddress: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
            assetSymbol: "sUSDC",
            assetDecimals: 6,
            networkName: "Stacks Mainnet",
          },
        },
        [],
      );

      expect(result.extra?.contractAddress).toBe(
        "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
      );
      expect(result.extra?.assetSymbol).toBe("sUSDC");
      expect(result.extra?.assetDecimals).toBe(6);
      expect(result.extra?.networkName).toBe("Stacks Mainnet");
    });

    it("should handle empty supportedKind extra", async () => {
      const requirements = {
        scheme: "exact-direct",
        network: STACKS_MAINNET_CAIP2,
        asset: "stacks:1/sip010:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
        amount: "1000000",
        payTo: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
        maxTimeoutSeconds: 3600,
        extra: { custom: "data" },
      };

      const result = await server.enhancePaymentRequirements(
        requirements as never,
        {
          t402Version: 2,
          scheme: "exact-direct",
          network: STACKS_MAINNET_CAIP2,
        },
        ["extension1"],
      );

      expect(result.extra).toEqual({ custom: "data" });
    });

    it("should merge facilitator extras with existing extras", async () => {
      const requirements = {
        scheme: "exact-direct",
        network: STACKS_MAINNET_CAIP2,
        asset: "stacks:1/sip010:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
        amount: "1000000",
        payTo: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
        maxTimeoutSeconds: 3600,
        extra: { myField: "preserved" },
      };

      const result = await server.enhancePaymentRequirements(
        requirements as never,
        {
          t402Version: 2,
          scheme: "exact-direct",
          network: STACKS_MAINNET_CAIP2,
          extra: { assetSymbol: "sUSDC", networkName: "Stacks Mainnet" },
        },
        [],
      );

      expect(result.extra?.myField).toBe("preserved");
      expect(result.extra?.assetSymbol).toBe("sUSDC");
      expect(result.extra?.networkName).toBe("Stacks Mainnet");
    });
  });

  describe("preferredToken configuration", () => {
    it("should use configured preferred token (sUSDC)", async () => {
      const serverWithPreferred = new ExactDirectStacksServer({
        preferredToken: "sUSDC",
      });

      const result = await serverWithPreferred.parsePrice(
        "1.00",
        STACKS_MAINNET_CAIP2,
      );
      expect(result.extra?.contractAddress).toBe(
        "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
      );
      expect(result.extra?.symbol).toBe("sUSDC");
    });

    it("should fall back to default if preferred token not found", async () => {
      const serverWithInvalid = new ExactDirectStacksServer({
        preferredToken: "NONEXISTENT",
      });

      const result = await serverWithInvalid.parsePrice(
        "1.00",
        STACKS_MAINNET_CAIP2,
      );
      // Falls back to sUSDC (default)
      expect(result.extra?.symbol).toBe("sUSDC");
    });
  });

  describe("createExactDirectStacksServer factory", () => {
    it("should create server with default config", () => {
      const srv = createExactDirectStacksServer();
      expect(srv).toBeInstanceOf(ExactDirectStacksServer);
      expect(srv.scheme).toBe("exact-direct");
    });

    it("should create server with custom config", () => {
      const srv = createExactDirectStacksServer({
        preferredToken: "sUSDC",
      });
      expect(srv).toBeInstanceOf(ExactDirectStacksServer);
    });

    it("should produce a functional server", async () => {
      const srv = createExactDirectStacksServer();
      const result = await srv.parsePrice("2.50", STACKS_MAINNET_CAIP2);
      expect(result.amount).toBe("2500000");
    });
  });

  describe("static methods", () => {
    it("getSupportedNetworks should return all registered networks", () => {
      const networks = ExactDirectStacksServer.getSupportedNetworks();
      expect(networks).toContain(STACKS_MAINNET_CAIP2);
      expect(networks).toContain(STACKS_TESTNET_CAIP2);
    });

    it("isNetworkSupported should return true for valid networks", () => {
      expect(
        ExactDirectStacksServer.isNetworkSupported(STACKS_MAINNET_CAIP2),
      ).toBe(true);
      expect(
        ExactDirectStacksServer.isNetworkSupported(STACKS_TESTNET_CAIP2),
      ).toBe(true);
    });

    it("isNetworkSupported should return false for invalid networks", () => {
      expect(
        ExactDirectStacksServer.isNetworkSupported("stacks:unknown"),
      ).toBe(false);
      expect(ExactDirectStacksServer.isNetworkSupported("eip155:1")).toBe(
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
