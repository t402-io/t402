import { describe, it, expect } from "vitest";
import { ExactEvmScheme } from "../../src/exact/server/scheme";

describe("ExactEvmScheme (Server)", () => {
  const server = new ExactEvmScheme();

  describe("USDT0 Support", () => {
    describe("Arbitrum network (USDT0 default)", () => {
      const network = "eip155:42161";

      it("should use USDT0 as default token", async () => {
        const result = await server.parsePrice("$1.00", network);
        expect(result.asset).toBe("0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9");
        expect(result.amount).toBe("1000000");
        expect(result.extra).toEqual({
          name: "TetherToken",
          version: "1",
          symbol: "USDT0",
          tokenType: "eip3009",
        });
      });

      it("should parse decimal amounts correctly", async () => {
        const result = await server.parsePrice(0.5, network);
        expect(result.amount).toBe("500000"); // 0.5 * 10^6
      });
    });

    describe("Ethereum mainnet (USDT0 available)", () => {
      const network = "eip155:1";

      it("should use USDT0 as default token", async () => {
        const result = await server.parsePrice("$1.00", network);
        expect(result.asset).toBe("0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee");
        expect(result.extra?.symbol).toBe("USDT0");
        expect(result.extra?.tokenType).toBe("eip3009");
      });
    });

    describe("Ink network (USDT0 only)", () => {
      const network = "eip155:57073";

      it("should use USDT0 on Ink", async () => {
        const result = await server.parsePrice("$1.00", network);
        expect(result.asset).toBe("0x0200C29006150606B650577BBE7B6248F58470c1");
        expect(result.extra?.symbol).toBe("USDT0");
      });
    });

    describe("Berachain network (USDT0 only)", () => {
      const network = "eip155:80094";

      it("should use USDT0 on Berachain", async () => {
        const result = await server.parsePrice("$1.00", network);
        expect(result.asset).toBe("0x779Ded0c9e1022225f8E0630b35a9b54bE713736");
        expect(result.extra?.symbol).toBe("USDT0");
      });
    });
  });

  describe("preferredToken configuration", () => {
    it("should use USDC when configured on Arbitrum", async () => {
      const usdcServer = new ExactEvmScheme({ preferredToken: "USDC" });
      const result = await usdcServer.parsePrice("$1.00", "eip155:42161");
      expect(result.asset).toBe("0xaf88d065e77c8cC2239327C5EDb3A432268e5831");
      expect(result.extra?.symbol).toBe("USDC");
    });

    it("should fallback to default if preferred token not available", async () => {
      const usdtServer = new ExactEvmScheme({ preferredToken: "USDT0" });
      // Base doesn't have USDT0, should fallback to USDC
      const result = await usdtServer.parsePrice("$1.00", "eip155:8453");
      expect(result.extra?.symbol).toBe("USDC");
    });
  });

  describe("static methods", () => {
    it("getSupportedNetworks should include USDT0 networks", () => {
      const networks = ExactEvmScheme.getSupportedNetworks();
      expect(networks).toContain("eip155:42161"); // Arbitrum
      expect(networks).toContain("eip155:57073"); // Ink
      expect(networks).toContain("eip155:80094"); // Berachain
    });

    it("isNetworkSupported should return true for supported networks", () => {
      expect(ExactEvmScheme.isNetworkSupported("eip155:42161")).toBe(true);
      expect(ExactEvmScheme.isNetworkSupported("eip155:999999")).toBe(false);
    });
  });

  describe("parsePrice", () => {
    describe("Base Sepolia network", () => {
      const network = "eip155:84532";

      it("should parse dollar string prices", async () => {
        const result = await server.parsePrice("$0.10", network);
        expect(result.amount).toBe("100000"); // 0.10 USDC = 100000 smallest units
        expect(result.asset).toBe("0x036CbD53842c5426634e7929541eC2318f3dCF7e");
        expect(result.extra?.name).toBe("USDC");
        expect(result.extra?.symbol).toBe("USDC");
        expect(result.extra?.tokenType).toBe("eip3009");
      });

      it("should parse simple number string prices", async () => {
        const result = await server.parsePrice("0.10", network);
        expect(result.amount).toBe("100000");
        expect(result.asset).toBe("0x036CbD53842c5426634e7929541eC2318f3dCF7e");
      });

      it("should parse number prices", async () => {
        const result = await server.parsePrice(0.1, network);
        expect(result.amount).toBe("100000");
        expect(result.asset).toBe("0x036CbD53842c5426634e7929541eC2318f3dCF7e");
      });

      it("should handle larger amounts", async () => {
        const result = await server.parsePrice("100.50", network);
        expect(result.amount).toBe("100500000"); // 100.50 USDC
      });

      it("should handle whole numbers", async () => {
        const result = await server.parsePrice("1", network);
        expect(result.amount).toBe("1000000"); // 1 USDC
      });
    });

    describe("Base mainnet network", () => {
      const network = "eip155:8453";

      it("should use Base mainnet USDC address", async () => {
        const result = await server.parsePrice("1.00", network);
        expect(result.asset).toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
        expect(result.amount).toBe("1000000");
        expect(result.extra?.name).toBe("USD Coin");
        expect(result.extra?.symbol).toBe("USDC");
        expect(result.extra?.tokenType).toBe("eip3009");
      });
    });

    describe("Ethereum mainnet network", () => {
      const network = "eip155:1";

      it("should use Ethereum mainnet USDT0 address (default)", async () => {
        const result = await server.parsePrice("1.00", network);
        // USDT0 is now the default for Ethereum mainnet
        expect(result.asset).toBe("0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee");
        expect(result.amount).toBe("1000000");
        expect(result.extra?.name).toBe("TetherToken");
        expect(result.extra?.symbol).toBe("USDT0");
      });

      it("should use USDC when explicitly configured", async () => {
        const usdcServer = new ExactEvmScheme({ preferredToken: "USDC" });
        const result = await usdcServer.parsePrice("1.00", network);
        expect(result.asset).toBe("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
        expect(result.extra?.name).toBe("USD Coin");
        expect(result.extra?.symbol).toBe("USDC");
      });
    });

    describe("Sepolia testnet network", () => {
      const network = "eip155:11155111";

      it("should use Sepolia USDC address", async () => {
        const result = await server.parsePrice("1.00", network);
        expect(result.asset).toBe("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238");
        expect(result.amount).toBe("1000000");
        expect(result.extra?.name).toBe("USDC");
        expect(result.extra?.symbol).toBe("USDC");
        expect(result.extra?.tokenType).toBe("eip3009");
      });
    });

    describe("pre-parsed price objects", () => {
      it("should handle pre-parsed price objects with asset", async () => {
        const result = await server.parsePrice(
          {
            amount: "123456",
            asset: "0x1234567890123456789012345678901234567890",
            extra: { foo: "bar" },
          },
          "eip155:84532",
        );
        expect(result.amount).toBe("123456");
        expect(result.asset).toBe("0x1234567890123456789012345678901234567890");
        expect(result.extra).toEqual({ foo: "bar" });
      });

      it("should throw for price objects without asset", async () => {
        await expect(
          async () => await server.parsePrice({ amount: "123456" } as never, "eip155:84532"),
        ).rejects.toThrow("Asset address must be specified");
      });
    });

    describe("error cases", () => {
      it("should throw for unsupported networks", async () => {
        await expect(async () => await server.parsePrice("1.00", "eip155:999999")).rejects.toThrow(
          "No tokens configured",
        );
      });

      it("should throw for invalid money formats", async () => {
        await expect(
          async () => await server.parsePrice("not-a-price!", "eip155:84532"),
        ).rejects.toThrow("Invalid money format");
      });

      it("should throw for invalid amounts", async () => {
        await expect(async () => await server.parsePrice("abc", "eip155:84532")).rejects.toThrow(
          "Invalid money format",
        );
      });
    });
  });

  describe("enhancePaymentRequirements", () => {
    it("should return payment requirements unchanged", async () => {
      const requirements = {
        scheme: "exact",
        network: "eip155:84532",
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        amount: "100000",
        payTo: "0x9876543210987654321098765432109876543210",
        maxTimeoutSeconds: 3600,
        extra: { name: "USDC", version: "2" },
      };

      const result = await server.enhancePaymentRequirements(
        requirements as never,
        {
          t402Version: 2,
          scheme: "exact",
          network: "eip155:84532",
        },
        [],
      );

      expect(result).toEqual(requirements);
    });
  });
});
