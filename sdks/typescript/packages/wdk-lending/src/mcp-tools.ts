/**
 * MCP Tool definitions for DeFi lending operations.
 *
 * These tool definitions can be registered with the t402 MCP server.
 * Each destructive operation requires explicit confirmation.
 */

export const LENDING_TOOL_DEFINITIONS = {
  "t402/quoteSupply": {
    name: "t402/quoteSupply",
    description:
      "Get a quote for supplying tokens to a DeFi lending pool (e.g., Aave V3). Returns estimated fee, current APY, and health factor impact. Read-only, no transaction executed.",
    inputSchema: {
      type: "object" as const,
      properties: {
        chain: {
          type: "string",
          description: 'Blockchain network (e.g., "ethereum", "arbitrum", "polygon")',
        },
        token: {
          type: "string",
          description: 'Token to supply (e.g., "USDC", "USDT", "WETH")',
        },
        amount: {
          type: "string",
          description: 'Amount to supply (e.g., "1000.00")',
        },
      },
      required: ["chain", "token", "amount"],
    },
  },

  "t402/supply": {
    name: "t402/supply",
    description:
      "Supply tokens to a DeFi lending pool. Earns interest (APY) on deposited tokens. Requires confirmation before executing.",
    inputSchema: {
      type: "object" as const,
      properties: {
        chain: { type: "string", description: "Blockchain network" },
        token: { type: "string", description: "Token to supply" },
        amount: { type: "string", description: "Amount to supply" },
        confirmed: {
          type: "boolean",
          description: "Set to true to confirm and execute",
        },
      },
      required: ["chain", "token", "amount"],
    },
  },

  "t402/quoteWithdraw": {
    name: "t402/quoteWithdraw",
    description:
      "Get a quote for withdrawing tokens from a DeFi lending pool. Returns estimated fee and health factor impact. Read-only.",
    inputSchema: {
      type: "object" as const,
      properties: {
        chain: { type: "string", description: "Blockchain network" },
        token: { type: "string", description: "Token to withdraw" },
        amount: { type: "string", description: 'Amount to withdraw (or "max")' },
      },
      required: ["chain", "token", "amount"],
    },
  },

  "t402/withdraw": {
    name: "t402/withdraw",
    description:
      "Withdraw supplied tokens from a DeFi lending pool. Requires confirmation.",
    inputSchema: {
      type: "object" as const,
      properties: {
        chain: { type: "string", description: "Blockchain network" },
        token: { type: "string", description: "Token to withdraw" },
        amount: { type: "string", description: 'Amount to withdraw (or "max")' },
        confirmed: { type: "boolean", description: "Confirm and execute" },
      },
      required: ["chain", "token", "amount"],
    },
  },

  "t402/quoteBorrow": {
    name: "t402/quoteBorrow",
    description:
      "Get a quote for borrowing tokens from a DeFi lending pool. Returns borrow rate, fee, and health factor impact. Read-only.",
    inputSchema: {
      type: "object" as const,
      properties: {
        chain: { type: "string", description: "Blockchain network" },
        token: { type: "string", description: "Token to borrow" },
        amount: { type: "string", description: "Amount to borrow" },
      },
      required: ["chain", "token", "amount"],
    },
  },

  "t402/borrow": {
    name: "t402/borrow",
    description:
      "Borrow tokens from a DeFi lending pool against your supplied collateral. Requires confirmation. WARNING: borrowing affects your health factor.",
    inputSchema: {
      type: "object" as const,
      properties: {
        chain: { type: "string", description: "Blockchain network" },
        token: { type: "string", description: "Token to borrow" },
        amount: { type: "string", description: "Amount to borrow" },
        confirmed: { type: "boolean", description: "Confirm and execute" },
      },
      required: ["chain", "token", "amount"],
    },
  },

  "t402/quoteRepay": {
    name: "t402/quoteRepay",
    description:
      "Get a quote for repaying borrowed tokens. Returns fee and health factor improvement. Read-only.",
    inputSchema: {
      type: "object" as const,
      properties: {
        chain: { type: "string", description: "Blockchain network" },
        token: { type: "string", description: "Token to repay" },
        amount: { type: "string", description: 'Amount to repay (or "max")' },
      },
      required: ["chain", "token", "amount"],
    },
  },

  "t402/repay": {
    name: "t402/repay",
    description:
      "Repay borrowed tokens to a DeFi lending pool. Requires confirmation.",
    inputSchema: {
      type: "object" as const,
      properties: {
        chain: { type: "string", description: "Blockchain network" },
        token: { type: "string", description: "Token to repay" },
        amount: { type: "string", description: 'Amount to repay (or "max")' },
        confirmed: { type: "boolean", description: "Confirm and execute" },
      },
      required: ["chain", "token", "amount"],
    },
  },

  "t402/getLendingPosition": {
    name: "t402/getLendingPosition",
    description:
      "Get current lending position — supplied assets, borrowed assets, health factor, and net APY. Read-only.",
    inputSchema: {
      type: "object" as const,
      properties: {
        chain: { type: "string", description: "Blockchain network" },
        address: { type: "string", description: "Wallet address" },
      },
      required: ["chain", "address"],
    },
  },
} as const;
