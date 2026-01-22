import { describe, it, expect } from "vitest";
import {
  getBalanceInputSchema,
  getAllBalancesInputSchema,
  payInputSchema,
  payGaslessInputSchema,
  getBridgeFeeInputSchema,
  bridgeInputSchema,
  formatBalanceResult,
  formatAllBalancesResult,
  formatPaymentResult,
  formatGaslessPaymentResult,
  formatBridgeFeeResult,
  formatBridgeResult,
  TOOL_DEFINITIONS,
} from "../../src/tools/index.js";

describe("Tool Input Schemas", () => {
  describe("getBalanceInputSchema", () => {
    it("should validate valid input", () => {
      const input = {
        network: "ethereum",
        address: "0x1234567890123456789012345678901234567890",
      };
      expect(() => getBalanceInputSchema.parse(input)).not.toThrow();
    });

    it("should reject invalid address", () => {
      const input = {
        network: "ethereum",
        address: "invalid-address",
      };
      expect(() => getBalanceInputSchema.parse(input)).toThrow();
    });

    it("should reject invalid network", () => {
      const input = {
        network: "invalid-network",
        address: "0x1234567890123456789012345678901234567890",
      };
      expect(() => getBalanceInputSchema.parse(input)).toThrow();
    });
  });

  describe("getAllBalancesInputSchema", () => {
    it("should validate with just address", () => {
      const input = {
        address: "0x1234567890123456789012345678901234567890",
      };
      expect(() => getAllBalancesInputSchema.parse(input)).not.toThrow();
    });

    it("should validate with specific networks", () => {
      const input = {
        address: "0x1234567890123456789012345678901234567890",
        networks: ["ethereum", "base", "arbitrum"],
      };
      expect(() => getAllBalancesInputSchema.parse(input)).not.toThrow();
    });
  });

  describe("payInputSchema", () => {
    it("should validate valid payment input", () => {
      const input = {
        to: "0x1234567890123456789012345678901234567890",
        amount: "100.50",
        token: "USDC",
        network: "base",
      };
      expect(() => payInputSchema.parse(input)).not.toThrow();
    });

    it("should validate with memo", () => {
      const input = {
        to: "0x1234567890123456789012345678901234567890",
        amount: "50",
        token: "USDT",
        network: "arbitrum",
        memo: "Payment for services",
      };
      expect(() => payInputSchema.parse(input)).not.toThrow();
    });

    it("should reject invalid amount format", () => {
      const input = {
        to: "0x1234567890123456789012345678901234567890",
        amount: "invalid",
        token: "USDC",
        network: "ethereum",
      };
      expect(() => payInputSchema.parse(input)).toThrow();
    });

    it("should reject invalid token", () => {
      const input = {
        to: "0x1234567890123456789012345678901234567890",
        amount: "100",
        token: "INVALID",
        network: "ethereum",
      };
      expect(() => payInputSchema.parse(input)).toThrow();
    });
  });

  describe("payGaslessInputSchema", () => {
    it("should validate valid gasless payment input", () => {
      const input = {
        to: "0x1234567890123456789012345678901234567890",
        amount: "25.00",
        token: "USDC",
        network: "base",
      };
      expect(() => payGaslessInputSchema.parse(input)).not.toThrow();
    });

    it("should reject unsupported network for gasless", () => {
      const input = {
        to: "0x1234567890123456789012345678901234567890",
        amount: "25.00",
        token: "USDC",
        network: "ink", // ink is not in gasless supported networks
      };
      expect(() => payGaslessInputSchema.parse(input)).toThrow();
    });
  });

  describe("getBridgeFeeInputSchema", () => {
    it("should validate valid bridge fee input", () => {
      const input = {
        fromChain: "arbitrum",
        toChain: "ethereum",
        amount: "100",
        recipient: "0x1234567890123456789012345678901234567890",
      };
      expect(() => getBridgeFeeInputSchema.parse(input)).not.toThrow();
    });

    it("should reject unsupported chain", () => {
      const input = {
        fromChain: "base", // base is not a bridgeable chain
        toChain: "ethereum",
        amount: "100",
        recipient: "0x1234567890123456789012345678901234567890",
      };
      expect(() => getBridgeFeeInputSchema.parse(input)).toThrow();
    });
  });

  describe("bridgeInputSchema", () => {
    it("should validate valid bridge input", () => {
      const input = {
        fromChain: "ethereum",
        toChain: "arbitrum",
        amount: "500",
        recipient: "0x1234567890123456789012345678901234567890",
      };
      expect(() => bridgeInputSchema.parse(input)).not.toThrow();
    });
  });
});

describe("Result Formatters", () => {
  describe("formatBalanceResult", () => {
    it("should format balance with tokens", () => {
      const balance = {
        network: "ethereum" as const,
        chainId: 1,
        native: {
          symbol: "ETH",
          balance: "1000000000000000000",
          formatted: "1.0",
        },
        tokens: [
          {
            symbol: "USDC",
            address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const,
            balance: "1000000000",
            formatted: "1000.0",
            decimals: 6,
          },
        ],
      };

      const result = formatBalanceResult(balance);
      expect(result).toContain("ethereum");
      expect(result).toContain("ETH: 1.0");
      expect(result).toContain("USDC: 1000.0");
    });

    it("should format balance without tokens", () => {
      const balance = {
        network: "ink" as const,
        chainId: 57073,
        native: {
          symbol: "ETH",
          balance: "500000000000000000",
          formatted: "0.5",
        },
        tokens: [],
      };

      const result = formatBalanceResult(balance);
      expect(result).toContain("ink");
      expect(result).toContain("ETH: 0.5");
      expect(result).toContain("No stablecoin balances found");
    });
  });

  describe("formatAllBalancesResult", () => {
    it("should format multi-chain balances", () => {
      const result = {
        address: "0x1234567890123456789012345678901234567890",
        balances: [
          {
            network: "ethereum" as const,
            chainId: 1,
            native: {
              symbol: "ETH",
              balance: "1000000000000000000",
              formatted: "1.0",
            },
            tokens: [
              {
                symbol: "USDC",
                address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const,
                balance: "500000000",
                formatted: "500.0",
                decimals: 6,
              },
            ],
          },
        ],
        totalUsdcBalance: "500.0",
        totalUsdtBalance: "0",
        summary: "Found balances on 1 of 1 networks checked.",
      };

      const formatted = formatAllBalancesResult(result);
      expect(formatted).toContain("Multi-Chain Balance Summary");
      expect(formatted).toContain("Total USDC:** 500.0");
      expect(formatted).toContain("ethereum");
    });
  });

  describe("formatPaymentResult", () => {
    it("should format payment result", () => {
      const payment = {
        txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        network: "base" as const,
        amount: "100.0",
        token: "USDC",
        to: "0x1234567890123456789012345678901234567890" as const,
        explorerUrl: "https://basescan.org/tx/0x1234",
      };

      const result = formatPaymentResult(payment);
      expect(result).toContain("Payment Successful");
      expect(result).toContain("100.0 USDC");
      expect(result).toContain("base");
      expect(result).toContain("View on Explorer");
    });
  });

  describe("formatGaslessPaymentResult", () => {
    it("should format gasless payment result", () => {
      const payment = {
        txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        userOpHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        network: "base" as const,
        amount: "50.0",
        token: "USDC",
        to: "0x1234567890123456789012345678901234567890" as const,
        explorerUrl: "https://basescan.org/tx/0x1234",
        paymaster: "pimlico",
      };

      const result = formatGaslessPaymentResult(payment);
      expect(result).toContain("Gasless Payment Successful");
      expect(result).toContain("UserOp Hash");
      expect(result).toContain("Gas fees were sponsored");
    });
  });

  describe("formatBridgeFeeResult", () => {
    it("should format bridge fee quote", () => {
      const quote = {
        fromChain: "arbitrum" as const,
        toChain: "ethereum" as const,
        amount: "100",
        nativeFee: "1000000000000000",
        nativeFeeFormatted: "0.001 ETH",
        estimatedTime: 900,
      };

      const result = formatBridgeFeeResult(quote);
      expect(result).toContain("Bridge Fee Quote");
      expect(result).toContain("arbitrum");
      expect(result).toContain("ethereum");
      expect(result).toContain("0.001 ETH");
      expect(result).toContain("15 minutes");
    });
  });

  describe("formatBridgeResult", () => {
    it("should format bridge result", () => {
      const bridge = {
        txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as const,
        messageGuid: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as const,
        amount: "100",
        fromChain: "arbitrum" as const,
        toChain: "ethereum" as const,
        estimatedTime: 900,
        trackingUrl: "https://layerzeroscan.com/tx/0xabcdef",
      };

      const result = formatBridgeResult(bridge);
      expect(result).toContain("Bridge Transaction Submitted");
      expect(result).toContain("arbitrum");
      expect(result).toContain("ethereum");
      expect(result).toContain("Message GUID");
      expect(result).toContain("LayerZero Scan");
    });
  });
});

describe("Tool Definitions", () => {
  it("should have all required tools", () => {
    const expectedTools = [
      "t402/getBalance",
      "t402/getAllBalances",
      "t402/pay",
      "t402/payGasless",
      "t402/getBridgeFee",
      "t402/bridge",
    ];

    for (const tool of expectedTools) {
      expect(TOOL_DEFINITIONS).toHaveProperty(tool);
    }
  });

  it("should have valid tool definitions", () => {
    for (const [name, definition] of Object.entries(TOOL_DEFINITIONS)) {
      expect(definition.name).toBe(name);
      expect(definition.description).toBeDefined();
      expect(definition.inputSchema).toBeDefined();
      expect(definition.inputSchema.type).toBe("object");
      expect(definition.inputSchema.properties).toBeDefined();
      expect(definition.inputSchema.required).toBeDefined();
    }
  });
});
