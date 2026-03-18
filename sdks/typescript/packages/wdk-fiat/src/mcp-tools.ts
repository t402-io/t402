/**
 * MCP Tool definitions for fiat on/off-ramp operations.
 */

export const FIAT_TOOL_DEFINITIONS = {
  "t402/quoteBuy": {
    name: "t402/quoteBuy",
    description: "Get a quote for buying crypto with fiat (e.g., buy USDC with USD via credit card). Read-only.",
    inputSchema: {
      type: "object" as const,
      properties: {
        chain: { type: "string", description: "Blockchain network" },
        cryptoAsset: { type: "string", description: 'Crypto to buy (e.g., "USDC", "USDT")' },
        fiatCurrency: { type: "string", description: 'Fiat currency (e.g., "USD", "EUR")' },
        amount: { type: "string", description: "Amount in fiat" },
      },
      required: ["chain", "cryptoAsset", "fiatCurrency", "amount"],
    },
  },

  "t402/buy": {
    name: "t402/buy",
    description: "Buy crypto with fiat. Opens payment provider widget. Requires confirmation.",
    inputSchema: {
      type: "object" as const,
      properties: {
        chain: { type: "string", description: "Blockchain network" },
        cryptoAsset: { type: "string", description: "Crypto to buy" },
        fiatCurrency: { type: "string", description: "Fiat currency" },
        amount: { type: "string", description: "Amount in fiat" },
        confirmed: { type: "boolean", description: "Confirm and execute" },
      },
      required: ["chain", "cryptoAsset", "fiatCurrency", "amount"],
    },
  },

  "t402/quoteSell": {
    name: "t402/quoteSell",
    description: "Get a quote for selling crypto to fiat. Read-only.",
    inputSchema: {
      type: "object" as const,
      properties: {
        chain: { type: "string", description: "Blockchain network" },
        cryptoAsset: { type: "string", description: "Crypto to sell" },
        fiatCurrency: { type: "string", description: "Target fiat currency" },
        amount: { type: "string", description: "Amount in crypto" },
      },
      required: ["chain", "cryptoAsset", "fiatCurrency", "amount"],
    },
  },

  "t402/sell": {
    name: "t402/sell",
    description: "Sell crypto for fiat. Requires confirmation.",
    inputSchema: {
      type: "object" as const,
      properties: {
        chain: { type: "string", description: "Blockchain network" },
        cryptoAsset: { type: "string", description: "Crypto to sell" },
        fiatCurrency: { type: "string", description: "Target fiat currency" },
        amount: { type: "string", description: "Amount in crypto" },
        confirmed: { type: "boolean", description: "Confirm and execute" },
      },
      required: ["chain", "cryptoAsset", "fiatCurrency", "amount"],
    },
  },

  "t402/getSupportedAssets": {
    name: "t402/getSupportedAssets",
    description: "List crypto assets available for fiat purchase/sale on a chain. Read-only.",
    inputSchema: {
      type: "object" as const,
      properties: {
        chain: { type: "string", description: "Blockchain network" },
      },
      required: ["chain"],
    },
  },

  "t402/getSupportedCurrencies": {
    name: "t402/getSupportedCurrencies",
    description: "List fiat currencies supported for crypto purchase/sale. Read-only.",
    inputSchema: {
      type: "object" as const,
      properties: {
        chain: { type: "string", description: "Blockchain network" },
      },
      required: ["chain"],
    },
  },

  "t402/getFiatTransactionStatus": {
    name: "t402/getFiatTransactionStatus",
    description: "Check the status of a fiat buy/sell transaction. Read-only.",
    inputSchema: {
      type: "object" as const,
      properties: {
        transactionId: { type: "string", description: "Transaction ID from buy/sell" },
      },
      required: ["transactionId"],
    },
  },
} as const;
