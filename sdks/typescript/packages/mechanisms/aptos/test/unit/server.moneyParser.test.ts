import { describe, it, expect } from "vitest";
import { ExactDirectAptosServer } from "../../src/exact-direct/server/scheme";
import { APTOS_MAINNET_CAIP2, APTOS_TESTNET_CAIP2 } from "../../src/constants";
import type { MoneyParser } from "@t402/core/types";

describe("ExactDirectAptosServer - registerMoneyParser", () => {
  describe("Single custom parser", () => {
    it("should use custom parser for Money values", async () => {
      const server = new ExactDirectAptosServer();

      const customParser: MoneyParser = async (amount, _network) => {
        if (amount > 100) {
          return {
            amount: (amount * 1e8).toString(),
            asset: "aptos:1/fa:0xcustom",
            extra: { token: "CUSTOM", tier: "large" },
          };
        }
        return null;
      };

      server.registerMoneyParser(customParser);

      // Large amount should use custom parser
      const result1 = await server.parsePrice(150, APTOS_MAINNET_CAIP2);
      expect(result1.asset).toBe("aptos:1/fa:0xcustom");
      expect(result1.extra?.token).toBe("CUSTOM");
      expect(result1.amount).toBe((150 * 1e8).toString());

      // Small amount should fall back to default (USDT)
      const result2 = await server.parsePrice(50, APTOS_MAINNET_CAIP2);
      expect(result2.asset).toContain(
        "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
      );
    });

    it("should receive decimal number, not raw string", async () => {
      const server = new ExactDirectAptosServer();
      let receivedAmount: number | null = null;
      let receivedNetwork: string | null = null;

      server.registerMoneyParser(async (amount, network) => {
        receivedAmount = amount;
        receivedNetwork = network;
        return null;
      });

      await server.parsePrice("$1.50", APTOS_MAINNET_CAIP2);
      expect(receivedAmount).toBe(1.5);
      expect(receivedNetwork).toBe(APTOS_MAINNET_CAIP2);

      await server.parsePrice("5.25", APTOS_MAINNET_CAIP2);
      expect(receivedAmount).toBe(5.25);

      await server.parsePrice(10.99, APTOS_MAINNET_CAIP2);
      expect(receivedAmount).toBe(10.99);
    });

    it("should not call parser for AssetAmount (pass-through)", async () => {
      const server = new ExactDirectAptosServer();
      let parserCalled = false;

      server.registerMoneyParser(async (_amount, _network) => {
        parserCalled = true;
        return null;
      });

      const assetAmount = {
        amount: "100000",
        asset: "aptos:1/fa:0xabc",
        extra: { custom: true },
      };

      const result = await server.parsePrice(assetAmount, APTOS_MAINNET_CAIP2);

      expect(parserCalled).toBe(false);
      expect(result).toEqual(assetAmount);
    });

    it("should support async parsers", async () => {
      const server = new ExactDirectAptosServer();

      server.registerMoneyParser(async (amount, _network) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return {
          amount: (amount * 1e6).toString(),
          asset: "aptos:1/fa:0xasync",
          extra: { async: true },
        };
      });

      const result = await server.parsePrice(5, APTOS_MAINNET_CAIP2);
      expect(result.asset).toBe("aptos:1/fa:0xasync");
      expect(result.extra?.async).toBe(true);
    });

    it("should fall back to default if parser returns null", async () => {
      const server = new ExactDirectAptosServer();

      server.registerMoneyParser(async (_amount) => {
        return null;
      });

      const result = await server.parsePrice(1, APTOS_MAINNET_CAIP2);
      expect(result.asset).toContain(
        "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
      );
      expect(result.amount).toBe("1000000");
    });
  });

  describe("Multiple parsers - chain of responsibility", () => {
    it("should try parsers in registration order", async () => {
      const server = new ExactDirectAptosServer();
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

      await server.parsePrice(50, APTOS_MAINNET_CAIP2);
      expect(executionOrder).toEqual([1, 2, 3]);
    });

    it("should stop at first non-null result", async () => {
      const server = new ExactDirectAptosServer();
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

      const result = await server.parsePrice(50, APTOS_MAINNET_CAIP2);

      expect(executionOrder).toEqual([1, 2]);
      expect(result.asset).toBe("WinnerToken");
    });

    it("should use default if all parsers return null", async () => {
      const server = new ExactDirectAptosServer();

      server
        .registerMoneyParser(async () => null)
        .registerMoneyParser(async () => null)
        .registerMoneyParser(async () => null);

      const result = await server.parsePrice(1, APTOS_MAINNET_CAIP2);
      expect(result.asset).toContain(
        "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
      );
      expect(result.amount).toBe("1000000");
    });
  });

  describe("Error handling", () => {
    it("should propagate errors from parser", async () => {
      const server = new ExactDirectAptosServer();

      server.registerMoneyParser(async (_amount) => {
        throw new Error("Parser error: configuration invalid");
      });

      await expect(
        async () => await server.parsePrice(50, APTOS_MAINNET_CAIP2),
      ).rejects.toThrow("Parser error: configuration invalid");
    });

    it("should throw for invalid money format", async () => {
      const server = new ExactDirectAptosServer();

      await expect(
        async () => await server.parsePrice("not-a-number", APTOS_MAINNET_CAIP2),
      ).rejects.toThrow("Invalid money format");
    });

    it("should propagate errors even with multiple parsers", async () => {
      const server = new ExactDirectAptosServer();

      server
        .registerMoneyParser(async () => null)
        .registerMoneyParser(async () => {
          throw new Error("Second parser failed");
        });

      await expect(
        async () => await server.parsePrice(50, APTOS_MAINNET_CAIP2),
      ).rejects.toThrow("Second parser failed");
    });
  });

  describe("Chaining and fluent API", () => {
    it("should return this for chaining", () => {
      const server = new ExactDirectAptosServer();

      const parser1: MoneyParser = async () => null;
      const parser2: MoneyParser = async () => null;

      const result = server
        .registerMoneyParser(parser1)
        .registerMoneyParser(parser2);
      expect(result).toBe(server);
    });
  });

  describe("Network-specific behavior", () => {
    it("should support network-aware parsers", async () => {
      const server = new ExactDirectAptosServer();

      server.registerMoneyParser(async (amount, network) => {
        if (network === APTOS_TESTNET_CAIP2) {
          return {
            amount: (amount * 1e6).toString(),
            asset: "aptos:2/fa:0xtesttoken",
            extra: { network: "testnet" },
          };
        }
        return null;
      });

      const testnetResult = await server.parsePrice(10, APTOS_TESTNET_CAIP2);
      expect(testnetResult.extra?.network).toBe("testnet");
      expect(testnetResult.asset).toBe("aptos:2/fa:0xtesttoken");

      const mainnetResult = await server.parsePrice(10, APTOS_MAINNET_CAIP2);
      expect(mainnetResult.asset).toContain(
        "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
      );
    });
  });

  describe("Edge cases", () => {
    it("should handle zero amounts", async () => {
      const server = new ExactDirectAptosServer();
      let receivedAmount: number | null = null;

      server.registerMoneyParser(async (amount) => {
        receivedAmount = amount;
        return null;
      });

      await server.parsePrice(0, APTOS_MAINNET_CAIP2);
      expect(receivedAmount).toBe(0);
    });

    it("should handle very small decimal amounts", async () => {
      const server = new ExactDirectAptosServer();
      let receivedAmount: number | null = null;

      server.registerMoneyParser(async (amount) => {
        receivedAmount = amount;
        return null;
      });

      await server.parsePrice(0.000001, APTOS_MAINNET_CAIP2);
      expect(receivedAmount).toBe(0.000001);
    });

    it("should handle very large amounts", async () => {
      const server = new ExactDirectAptosServer();
      let receivedAmount: number | null = null;

      server.registerMoneyParser(async (amount) => {
        receivedAmount = amount;
        return null;
      });

      await server.parsePrice(999999999.99, APTOS_MAINNET_CAIP2);
      expect(receivedAmount).toBe(999999999.99);
    });

    it("should handle dollar sign with whitespace", async () => {
      const server = new ExactDirectAptosServer();

      const result = await server.parsePrice("$ 5.00", APTOS_MAINNET_CAIP2);
      expect(result.amount).toBe("5000000");
    });
  });
});
