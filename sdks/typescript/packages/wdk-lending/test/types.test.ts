import { describe, it, expect } from "vitest";
import { LENDING_TOOL_DEFINITIONS } from "../src/mcp-tools";
import type { LendingProtocol, LendingQuote, LendingResult, LendingPosition } from "../src/types";

describe("LENDING_TOOL_DEFINITIONS", () => {
  it("should have 9 tool definitions", () => {
    expect(Object.keys(LENDING_TOOL_DEFINITIONS)).toHaveLength(9);
  });

  it("should have all required tools", () => {
    const tools = Object.keys(LENDING_TOOL_DEFINITIONS);
    expect(tools).toContain("t402/quoteSupply");
    expect(tools).toContain("t402/supply");
    expect(tools).toContain("t402/quoteWithdraw");
    expect(tools).toContain("t402/withdraw");
    expect(tools).toContain("t402/quoteBorrow");
    expect(tools).toContain("t402/borrow");
    expect(tools).toContain("t402/quoteRepay");
    expect(tools).toContain("t402/repay");
    expect(tools).toContain("t402/getLendingPosition");
  });

  it("should have confirmed field only on destructive tools", () => {
    const destructive = ["t402/supply", "t402/withdraw", "t402/borrow", "t402/repay"];
    const readOnly = ["t402/quoteSupply", "t402/quoteWithdraw", "t402/quoteBorrow", "t402/quoteRepay", "t402/getLendingPosition"];

    for (const name of destructive) {
      const tool = LENDING_TOOL_DEFINITIONS[name as keyof typeof LENDING_TOOL_DEFINITIONS];
      expect(tool.inputSchema.properties).toHaveProperty("confirmed");
    }

    for (const name of readOnly) {
      const tool = LENDING_TOOL_DEFINITIONS[name as keyof typeof LENDING_TOOL_DEFINITIONS];
      expect(tool.inputSchema.properties).not.toHaveProperty("confirmed");
    }
  });

  it("should require chain and token for all tools", () => {
    for (const [name, tool] of Object.entries(LENDING_TOOL_DEFINITIONS)) {
      if (name === "t402/getLendingPosition") {
        expect(tool.inputSchema.required).toContain("chain");
        expect(tool.inputSchema.required).toContain("address");
      } else {
        expect(tool.inputSchema.required).toContain("chain");
        expect(tool.inputSchema.required).toContain("token");
        expect(tool.inputSchema.required).toContain("amount");
      }
    }
  });
});

describe("LendingProtocol interface", () => {
  it("should type-check a mock implementation", () => {
    const mockProtocol: LendingProtocol = {
      name: "test-protocol",
      quoteSupply: async () => ({ protocol: "test", chain: "ethereum", operation: "supply", token: "USDC", amount: "1000", fee: "0.5" }),
      supply: async () => ({ success: true, protocol: "test", hash: "0x", operation: "supply", token: "USDC", amount: "1000", fee: "0.5" }),
      quoteWithdraw: async () => ({ protocol: "test", chain: "ethereum", operation: "withdraw", token: "USDC", amount: "1000", fee: "0.3" }),
      withdraw: async () => ({ success: true, protocol: "test", hash: "0x", operation: "withdraw", token: "USDC", amount: "1000", fee: "0.3" }),
      quoteBorrow: async () => ({ protocol: "test", chain: "ethereum", operation: "borrow", token: "USDC", amount: "500", fee: "0.8" }),
      borrow: async () => ({ success: true, protocol: "test", hash: "0x", operation: "borrow", token: "USDC", amount: "500", fee: "0.8" }),
      quoteRepay: async () => ({ protocol: "test", chain: "ethereum", operation: "repay", token: "USDC", amount: "500", fee: "0.2" }),
      repay: async () => ({ success: true, protocol: "test", hash: "0x", operation: "repay", token: "USDC", amount: "500", fee: "0.2" }),
      getPosition: async () => ({
        protocol: "test", chain: "ethereum",
        supplied: [{ token: "0xUSDC", symbol: "USDC", amount: "1000", valueUsd: "1000", apy: "3.5" }],
        borrowed: [],
        healthFactor: "999",
        netApy: "3.5",
      }),
    };

    expect(mockProtocol.name).toBe("test-protocol");
  });
});
