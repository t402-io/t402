import { PAY_TO, TESTNET_NETWORK, TESTNET_ASSET, DEMO_AMOUNT } from "./config";

export function createPaymentRequired(resource: { url: string; description: string }) {
  return {
    t402Version: 2,
    error: "Payment required",
    resource: { ...resource, mimeType: "application/json" },
    accepts: [
      {
        scheme: "exact",
        network: TESTNET_NETWORK,
        amount: DEMO_AMOUNT,
        asset: TESTNET_ASSET,
        payTo: PAY_TO,
        maxTimeoutSeconds: 60,
        extra: { name: "USDT", version: "2" },
      },
    ],
  };
}

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

export function createMockSettleResponse(network: string) {
  return {
    success: true,
    transaction: "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
    network,
    payer: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD68",
  };
}
