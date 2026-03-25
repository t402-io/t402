/**
 * Dynamic content generator for market analysis.
 * Generates contextual analysis based on real price data.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { PriceData } from "./price-service";

export interface MarketSection {
  heading: string;
  content: string;
}

export interface MarketReport {
  title: string;
  generated: string;
  sections: MarketSection[];
}

/**
 * Calculate a pseudo-RSI based on 24h change.
 * This is a simplified indicator for demo purposes.
 */
function calculatePseudoRSI(change24h: number): number {
  // Map -10% to +10% change to 30-70 RSI range
  const normalized = Math.max(-10, Math.min(10, change24h));
  return 50 + normalized * 2;
}

/**
 * Generate a market outlook based on price trend.
 */
function getTrendDescription(change24h: number): {
  trend: string;
  momentum: string;
  outlook: string;
} {
  if (change24h > 5) {
    return {
      trend: "strongly bullish",
      momentum: "significant upward momentum",
      outlook: "Continuation expected, watch for profit-taking near resistance.",
    };
  }
  if (change24h > 2) {
    return {
      trend: "bullish",
      momentum: "positive momentum",
      outlook: "Trend favors buyers, but stay alert for pullbacks.",
    };
  }
  if (change24h > 0) {
    return {
      trend: "slightly bullish",
      momentum: "mild upward drift",
      outlook: "Cautiously optimistic, wait for confirmation before adding positions.",
    };
  }
  if (change24h > -2) {
    return {
      trend: "slightly bearish",
      momentum: "mild downward pressure",
      outlook: "Watch support levels, potential consolidation ahead.",
    };
  }
  if (change24h > -5) {
    return {
      trend: "bearish",
      momentum: "negative momentum",
      outlook: "Risk-off sentiment prevails, consider reducing exposure.",
    };
  }
  return {
    trend: "strongly bearish",
    momentum: "significant selling pressure",
    outlook: "Wait for stabilization before entering new positions.",
  };
}

/**
 * Generate AI-powered market analysis using Claude, with fallback to static analysis.
 */
export async function generateAiMarketAnalysis(priceData: PriceData): Promise<MarketReport> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return generateMarketAnalysis(priceData);
  }

  const { price, change24h, volume24h, high24h, low24h } = priceData;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `You are a crypto market analyst. Given BTC current price: $${price.toLocaleString()}, 24h change: ${change24h.toFixed(2)}%, 24h volume: $${(volume24h / 1e9).toFixed(1)}B, 24h high: $${high24h.toLocaleString()}, 24h low: $${low24h.toLocaleString()}.

Write a professional market analysis with exactly 4 sections. Respond in JSON only:
{ "sections": [{ "heading": "string", "content": "string (2-3 sentences)" }] }

Sections: 1) Market Overview, 2) Technical Analysis, 3) Volume & Momentum, 4) Short-term Outlook`,
        },
      ],
      system: "You are a professional cryptocurrency market analyst. Respond with valid JSON only, no markdown fences or extra text.",
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock?.text) {
      return generateMarketAnalysis(priceData);
    }

    const parsed = JSON.parse(textBlock.text) as { sections: MarketSection[] };
    if (!Array.isArray(parsed.sections) || parsed.sections.length === 0) {
      return generateMarketAnalysis(priceData);
    }

    return {
      title: "Premium Market Report",
      generated: new Date().toISOString(),
      sections: parsed.sections,
    };
  } catch {
    return generateMarketAnalysis(priceData);
  }
}

/**
 * Generate dynamic market analysis based on real price data.
 */
export function generateMarketAnalysis(priceData: PriceData): MarketReport {
  const { price, change24h, volume24h, high24h, low24h } = priceData;
  const { trend, momentum, outlook } = getTrendDescription(change24h);

  const rsi = calculatePseudoRSI(change24h);
  const support = price * 0.95;
  const resistance = price * 1.05;
  const changeSign = change24h >= 0 ? "+" : "";

  return {
    title: "Premium Market Report",
    generated: new Date().toISOString(),
    sections: [
      {
        heading: "Market Overview",
        content: `BTC is trading at $${price.toLocaleString()} with a ${changeSign}${change24h.toFixed(1)}% change over the past 24 hours. The market shows ${trend} conditions with ${momentum}. 24h range: $${low24h.toLocaleString()} - $${high24h.toLocaleString()}.`,
      },
      {
        heading: "Technical Analysis",
        content: `RSI indicator at ${rsi.toFixed(0)}${rsi > 70 ? " (overbought)" : rsi < 30 ? " (oversold)" : " (neutral)"}. Key support level at $${support.toLocaleString()}, resistance at $${resistance.toLocaleString()}. ${change24h > 0 ? "MACD showing bullish crossover" : "MACD trending downward"}.`,
      },
      {
        heading: "Volume Analysis",
        content: `24h trading volume at $${(volume24h / 1e9).toFixed(1)}B. ${volume24h > 30e9 ? "Above-average volume suggests strong conviction in current trend." : "Moderate volume indicates steady institutional participation."}`,
      },
      {
        heading: "Outlook",
        content: outlook,
      },
    ],
  };
}

/**
 * Generate mock market data for display.
 * Uses real price as base but returns formatted display values.
 */
export function generateMarketDisplayData(priceData: PriceData) {
  const changeSign = priceData.change24h >= 0 ? "+" : "";

  return {
    symbol: "BTC/USDT",
    price: priceData.price.toFixed(2),
    volume24h: `${(priceData.volume24h / 1e9).toFixed(1)}B`,
    change24h: `${changeSign}${priceData.change24h.toFixed(1)}%`,
    high24h: priceData.high24h.toFixed(2),
    low24h: priceData.low24h.toFixed(2),
    timestamp: priceData.lastUpdated,
  };
}

/**
 * Content library for premium articles.
 * Can be expanded with more diverse content.
 */
export const CONTENT_LIBRARY = {
  "market-report": {
    type: "market-report",
    title: "Premium Market Report",
    description: "In-depth analysis of current market conditions",
  },
  "defi-analysis": {
    type: "defi-analysis",
    title: "DeFi Ecosystem Deep Dive",
    description: "Analysis of major DeFi protocols and trends",
  },
  "institutional-flows": {
    type: "institutional-flows",
    title: "Institutional Flow Analysis",
    description: "Tracking large-scale capital movements",
  },
} as const;
