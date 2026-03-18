import { describe, it, expect } from "vitest";
import { FIAT_TOOL_DEFINITIONS } from "../src/mcp-tools";
import type { FiatProvider } from "../src/types";

describe("FIAT_TOOL_DEFINITIONS", () => {
  it("should have 7 tool definitions", () => {
    expect(Object.keys(FIAT_TOOL_DEFINITIONS)).toHaveLength(7);
  });

  it("should have all required tools", () => {
    const tools = Object.keys(FIAT_TOOL_DEFINITIONS);
    expect(tools).toContain("t402/quoteBuy");
    expect(tools).toContain("t402/buy");
    expect(tools).toContain("t402/quoteSell");
    expect(tools).toContain("t402/sell");
    expect(tools).toContain("t402/getSupportedAssets");
    expect(tools).toContain("t402/getSupportedCurrencies");
    expect(tools).toContain("t402/getFiatTransactionStatus");
  });

  it("should require confirmation on destructive tools", () => {
    const buy = FIAT_TOOL_DEFINITIONS["t402/buy"];
    const sell = FIAT_TOOL_DEFINITIONS["t402/sell"];
    expect(buy.inputSchema.properties).toHaveProperty("confirmed");
    expect(sell.inputSchema.properties).toHaveProperty("confirmed");
  });

  it("should not require confirmation on read-only tools", () => {
    const quote = FIAT_TOOL_DEFINITIONS["t402/quoteBuy"];
    expect(quote.inputSchema.properties).not.toHaveProperty("confirmed");
  });
});

describe("FiatProvider interface", () => {
  it("should type-check a mock", () => {
    const mock: FiatProvider = {
      name: "test",
      quoteBuy: async () => ({ protocol: "test", cryptoAsset: "USDC", fiatCurrency: "USD", cryptoAmount: "100", fiatAmount: "100", fee: "1", rate: "1" }),
      buy: async () => ({ success: true, protocol: "test", transactionId: "tx1", status: "pending" }),
      quoteSell: async () => ({ protocol: "test", cryptoAsset: "USDC", fiatCurrency: "USD", cryptoAmount: "100", fiatAmount: "99", fee: "1", rate: "1" }),
      sell: async () => ({ success: true, protocol: "test", transactionId: "tx2", status: "pending" }),
      getSupportedAssets: async () => [{ symbol: "USDC", name: "USD Coin", chains: ["ethereum"] }],
      getSupportedCurrencies: async () => [{ code: "USD", name: "US Dollar", symbol: "$" }],
      getTransactionStatus: async () => ({ success: true, protocol: "test", transactionId: "tx1", status: "completed" }),
    };
    expect(mock.name).toBe("test");
  });
});
