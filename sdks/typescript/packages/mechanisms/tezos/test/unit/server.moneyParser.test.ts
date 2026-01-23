import { describe, it, expect } from "vitest";
import { ExactDirectTezosServer } from "../../src/exact-direct/server/scheme";
import { TEZOS_MAINNET_CAIP2, TEZOS_GHOSTNET_CAIP2 } from "../../src/constants";
import type { MoneyParser } from "@t402/core/types";

describe("ExactDirectTezosServer - registerMoneyParser", () => {
  describe("Single custom parser", () => {
    it("should use custom parser for Money values", async () => {
      const server = new ExactDirectTezosServer();

      const customParser: MoneyParser = async (amount, _network) => {
        if (amount > 100) {
          return {
            amount: (amount * 1e6).toString(),
            asset: "tezos:NetXdQprcVkpaWU/fa2:KT1custom/0",
            extra: { token: "CUSTOM", tier: "large" },
          };
        }
        return null;
      };

      server.registerMoneyParser(customParser);

      // Large amount should use custom parser
      const result1 = await server.parsePrice(150, TEZOS_MAINNET_CAIP2);
      expect(result1.asset).toBe("tezos:NetXdQprcVkpaWU/fa2:KT1custom/0");
      expect(result1.extra?.token).toBe("CUSTOM");
      expect(result1.amount).toBe((150 * 1e6).toString());

      // Small amount should fall back to default (USDt)
      const result2 = await server.parsePrice(50, TEZOS_MAINNET_CAIP2);
      expect(result2.asset).toContain("KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o");
    });

    it("should receive decimal number, not raw string", async () => {
      const server = new ExactDirectTezosServer();
      let receivedAmount: number | null = null;
      let receivedNetwork: string | null = null;

      server.registerMoneyParser(async (amount, network) => {
        receivedAmount = amount;
        receivedNetwork = network;
        return null;
      });

      await server.parsePrice("$1.50", TEZOS_MAINNET_CAIP2);
      expect(receivedAmount).toBe(1.5);
      expect(receivedNetwork).toBe(TEZOS_MAINNET_CAIP2);

      await server.parsePrice("5.25", TEZOS_MAINNET_CAIP2);
      expect(receivedAmount).toBe(5.25);

      await server.parsePrice(10.99, TEZOS_MAINNET_CAIP2);
      expect(receivedAmount).toBe(10.99);
    });

    it("should not call parser for AssetAmount (pass-through)", async () => {
      const server = new ExactDirectTezosServer();
      let parserCalled = false;

      server.registerMoneyParser(async (_amount, _network) => {
        parserCalled = true;
        return null;
      });

      const assetAmount = {
        amount: "100000",
        asset: "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0",
        extra: { custom: true },
      };

      const result = await server.parsePrice(assetAmount, TEZOS_MAINNET_CAIP2);

      expect(parserCalled).toBe(false);
      expect(result).toEqual(assetAmount);
    });

    it("should support async parsers", async () => {
      const server = new ExactDirectTezosServer();

      server.registerMoneyParser(async (amount, _network) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return {
          amount: (amount * 1e6).toString(),
          asset: "tezos:NetXdQprcVkpaWU/fa2:KT1async/1",
          extra: { async: true },
        };
      });

      const result = await server.parsePrice(5, TEZOS_MAINNET_CAIP2);
      expect(result.asset).toBe("tezos:NetXdQprcVkpaWU/fa2:KT1async/1");
      expect(result.extra?.async).toBe(true);
    });

    it("should fall back to default if parser returns null", async () => {
      const server = new ExactDirectTezosServer();

      server.registerMoneyParser(async (_amount) => {
        return null;
      });

      const result = await server.parsePrice(1, TEZOS_MAINNET_CAIP2);
      expect(result.asset).toContain("KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o");
      expect(result.amount).toBe("1000000");
    });
  });

  describe("Multiple parsers - chain of responsibility", () => {
    it("should try parsers in registration order", async () => {
      const server = new ExactDirectTezosServer();
      const executionOrder: number[] = [];

      server
        .registerMoneyParser(async (amount) => {
          executionOrder.push(1);
          if (amount > 1000)
            return { amount: "1", asset: "Parser1Token", extra: {} };
          return null;
        })
        .registerMoneyParser(async (amount) => {
          executionOrder.push(2);
          if (amount > 100)
            return { amount: "2", asset: "Parser2Token", extra: {} };
          return null;
        })
        .registerMoneyParser(async (_amount) => {
          executionOrder.push(3);
          return { amount: "3", asset: "Parser3Token", extra: {} };
        });

      await server.parsePrice(50, TEZOS_MAINNET_CAIP2);
      expect(executionOrder).toEqual([1, 2, 3]);
    });

    it("should stop at first non-null result", async () => {
      const server = new ExactDirectTezosServer();
      const executionOrder: number[] = [];

      server
        .registerMoneyParser(async (_amount) => {
          executionOrder.push(1);
          return null;
        })
        .registerMoneyParser(async (_amount) => {
          executionOrder.push(2);
          return { amount: "winner", asset: "WinnerToken", extra: {} };
        })
        .registerMoneyParser(async (_amount) => {
          executionOrder.push(3);
          return { amount: "3", asset: "Parser3Token", extra: {} };
        });

      const result = await server.parsePrice(50, TEZOS_MAINNET_CAIP2);

      expect(executionOrder).toEqual([1, 2]);
      expect(result.asset).toBe("WinnerToken");
    });

    it("should use default if all parsers return null", async () => {
      const server = new ExactDirectTezosServer();

      server
        .registerMoneyParser(async () => null)
        .registerMoneyParser(async () => null)
        .registerMoneyParser(async () => null);

      const result = await server.parsePrice(1, TEZOS_MAINNET_CAIP2);
      expect(result.asset).toContain("KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o");
      expect(result.amount).toBe("1000000");
    });
  });

  describe("Error handling", () => {
    it("should propagate errors from parser", async () => {
      const server = new ExactDirectTezosServer();

      server.registerMoneyParser(async (_amount) => {
        throw new Error("Parser error: Tezos RPC unreachable");
      });

      await expect(
        async () => await server.parsePrice(50, TEZOS_MAINNET_CAIP2),
      ).rejects.toThrow("Parser error: Tezos RPC unreachable");
    });

    it("should throw for invalid money format", async () => {
      const server = new ExactDirectTezosServer();

      await expect(
        async () => await server.parsePrice("not-a-number", TEZOS_MAINNET_CAIP2),
      ).rejects.toThrow("Invalid money format");
    });

    it("should propagate errors even with multiple parsers", async () => {
      const server = new ExactDirectTezosServer();

      server
        .registerMoneyParser(async () => null)
        .registerMoneyParser(async () => {
          throw new Error("Second parser failed");
        });

      await expect(
        async () => await server.parsePrice(50, TEZOS_MAINNET_CAIP2),
      ).rejects.toThrow("Second parser failed");
    });
  });

  describe("Chaining and fluent API", () => {
    it("should return this for chaining", () => {
      const server = new ExactDirectTezosServer();

      const parser1: MoneyParser = async () => null;
      const parser2: MoneyParser = async () => null;

      const result = server
        .registerMoneyParser(parser1)
        .registerMoneyParser(parser2);
      expect(result).toBe(server);
    });
  });

  describe("Real-world use cases", () => {
    it("should support tiered pricing", async () => {
      const server = new ExactDirectTezosServer();

      server
        .registerMoneyParser(async (amount) => {
          if (amount > 1000) {
            return {
              amount: (amount * 1e6).toString(),
              asset: "tezos:NetXdQprcVkpaWU/fa2:KT1premium/0",
              extra: { tier: "premium" },
            };
          }
          return null;
        })
        .registerMoneyParser(async (amount) => {
          if (amount > 100) {
            return {
              amount: (amount * 1e6).toString(),
              asset: "tezos:NetXdQprcVkpaWU/fa2:KT1standard/0",
              extra: { tier: "standard" },
            };
          }
          return null;
        });

      const premium = await server.parsePrice(2000, TEZOS_MAINNET_CAIP2);
      expect(premium.extra?.tier).toBe("premium");

      const standard = await server.parsePrice(500, TEZOS_MAINNET_CAIP2);
      expect(standard.extra?.tier).toBe("standard");

      const basic = await server.parsePrice(50, TEZOS_MAINNET_CAIP2);
      expect(basic.asset).toContain("KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o");
    });

    it("should support dynamic exchange rates", async () => {
      const server = new ExactDirectTezosServer();
      const mockRate = 0.98;

      server.registerMoneyParser(async (amount, _network) => {
        const usdtAmount = amount * mockRate;
        return {
          amount: Math.floor(usdtAmount * 1e6).toString(),
          asset: "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0",
          extra: {
            exchangeRate: mockRate,
            originalUSD: amount,
            convertedUSDT: usdtAmount,
          },
        };
      });

      const result = await server.parsePrice(100, TEZOS_MAINNET_CAIP2);
      expect(result.amount).toBe("98000000");
      expect(result.extra?.exchangeRate).toBe(0.98);
      expect(result.extra?.originalUSD).toBe(100);
    });
  });

  describe("Edge cases", () => {
    it("should handle zero amounts", async () => {
      const server = new ExactDirectTezosServer();
      let receivedAmount: number | null = null;

      server.registerMoneyParser(async (amount) => {
        receivedAmount = amount;
        return null;
      });

      await server.parsePrice(0, TEZOS_MAINNET_CAIP2);
      expect(receivedAmount).toBe(0);
    });

    it("should handle very small decimal amounts", async () => {
      const server = new ExactDirectTezosServer();
      let receivedAmount: number | null = null;

      server.registerMoneyParser(async (amount) => {
        receivedAmount = amount;
        return null;
      });

      await server.parsePrice(0.000001, TEZOS_MAINNET_CAIP2);
      expect(receivedAmount).toBe(0.000001);
    });

    it("should handle very large amounts", async () => {
      const server = new ExactDirectTezosServer();
      let receivedAmount: number | null = null;

      server.registerMoneyParser(async (amount) => {
        receivedAmount = amount;
        return null;
      });

      await server.parsePrice(999999999.99, TEZOS_MAINNET_CAIP2);
      expect(receivedAmount).toBe(999999999.99);
    });
  });
});
