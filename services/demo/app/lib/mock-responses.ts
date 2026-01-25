import { type ChainFamily, CHAIN_CONFIGS } from "./testnet-config";

export const mockMarketData = {
  data: {
    symbol: "BTC/USDT",
    price: "98432.50",
    volume24h: "2.4B",
    change24h: "+3.2%",
    high24h: "99100.00",
    low24h: "95800.00",
    timestamp: new Date().toISOString(),
  },
};

export const mockPremiumReport = {
  title: "Premium Market Report",
  generated: new Date().toISOString(),
  sections: [
    { heading: "Market Overview", content: "BTC continues bullish momentum with strong institutional inflows." },
    { heading: "Technical Analysis", content: "RSI at 68, MACD crossing up. Key support at $95,200." },
    { heading: "Outlook", content: "Target: $105,000 by end of quarter. Risk: $92,000 support break." },
  ],
};

export const mockMcpToolResult = {
  jsonrpc: "2.0" as const,
  id: 1,
  result: {
    content: [
      {
        type: "text",
        text: "BTC Analysis: Strong bullish momentum. RSI at 68, MACD crossing up. Support at $95,200, resistance at $102,800. Target: $105,000.",
      },
    ],
  },
};

export const mockA2aTaskResult = {
  id: "task-demo-001",
  status: { state: "completed" as const },
  artifacts: [
    {
      kind: "text",
      parts: [{ kind: "text", text: "Research completed: Bitcoin adoption has grown 40% YoY among institutional investors." }],
    },
  ],
};

export function createMockVerifyResponse(from: string) {
  return {
    isValid: true,
    payer: from,
  };
}

export function createMockSettleResponse(chainOrNetwork: ChainFamily | string) {
  const isFamily = chainOrNetwork in CHAIN_CONFIGS;
  const family = isFamily ? (chainOrNetwork as ChainFamily) : "evm";
  const config = CHAIN_CONFIGS[family];
  const network = isFamily ? config.network : chainOrNetwork;

  // Generate chain-specific transaction hash format
  const mockTxHash = (() => {
    switch (family) {
      case "solana":
        return Array.from({ length: 88 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789"[Math.floor(Math.random() * 58)]).join("");
      case "ton":
        return Array.from({ length: 44 }, () => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"[Math.floor(Math.random() * 64)]).join("");
      case "near":
        return Array.from({ length: 44 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789"[Math.floor(Math.random() * 58)]).join("");
      case "aptos":
        return "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
      case "tezos":
        return "o" + Array.from({ length: 50 }, () => "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"[Math.floor(Math.random() * 58)]).join("");
      case "polkadot":
        return "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
      default:
        return "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    }
  })();

  // Generate chain-specific payer address format
  const mockPayer = (() => {
    switch (family) {
      case "evm":
        return "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD68";
      case "ton":
        return "EQAbcdef1234567890abcdef1234567890abcdef12345";
      case "tron":
        return "TAbcdefghijk1234567890abcdefghijk";
      case "solana":
        return "7nYBs9EwPjhpBZNPDnqWrRcU9d1Q9jK5xN3xH8r4gVMp";
      case "stacks":
        return "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
      case "near":
        return "demo-user.testnet";
      case "aptos":
        return "0x742d35cc6634c0532925a3b844bc9e7595f2bd68742d35cc6634c0532925a3b8";
      case "tezos":
        return "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb";
      case "polkadot":
        return "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY";
      default:
        return "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD68";
    }
  })();

  return {
    success: true,
    transaction: mockTxHash,
    network,
    payer: mockPayer,
  };
}
