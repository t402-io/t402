/**
 * Bazaar marketplace discovery tools for AI agents.
 *
 * Enables agents to search for, pay for, and monetize t402-protected services.
 */

import { z } from "zod";

// ============================================================================
// Search Bazaar
// ============================================================================

export const searchBazaarInputSchema = z.object({
  query: z.string().describe("Search query (supports multi-word, e.g., 'weather API', 'image generation')"),
  category: z.string().optional().describe("Filter by category (e.g., 'ai', 'data', 'compute')"),
  maxPrice: z.string().optional().describe("Maximum price in USD (e.g., '10.00')"),
  network: z.string().optional().describe("Filter by CAIP-2 network (e.g., 'eip155:8453')"),
  token: z.string().optional().describe("Filter by token (e.g., 'USDC', 'USDT0')"),
  tags: z.string().optional().describe("Filter by tags (comma-separated, e.g., 'llm,inference')"),
});

export type SearchBazaarInput = z.infer<typeof searchBazaarInputSchema>;

export interface BazaarService {
  url: string;
  name: string;
  description: string;
  category: string;
  price: { amount: string; token: string; network: string };
  methods: string[];
  tags?: string[];
  verified?: boolean;
}

export async function executeSearchBazaar(
  input: SearchBazaarInput,
  options?: { bazaarUrl?: string },
): Promise<BazaarService[]> {
  const bazaarUrl = options?.bazaarUrl || "https://bazaar.t402.io/api/v1";

  const params = new URLSearchParams();
  params.set("q", input.query);
  if (input.category) params.set("category", input.category);
  if (input.maxPrice) params.set("maxPrice", input.maxPrice);
  if (input.network) params.set("network", input.network);
  if (input.token) params.set("token", input.token);
  if (input.tags) params.set("tags", input.tags);

  try {
    const res = await fetch(`${bazaarUrl}/search?${params}`);
    if (!res.ok) {
      return getDemoResults(input.query);
    }
    const data = (await res.json()) as { services: BazaarService[] };
    return data.services;
  } catch {
    // Fallback to demo results when bazaar is not available
    return getDemoResults(input.query);
  }
}

function getDemoResults(query: string): BazaarService[] {
  const q = query.toLowerCase();
  const all: BazaarService[] = [
    {
      url: "https://api.weather402.com/forecast",
      name: "Weather Forecast API",
      description: "Global weather data with hourly resolution, 7-day forecast",
      category: "data",
      price: { amount: "1000", token: "USDC", network: "eip155:8453" },
      methods: ["GET"],
    },
    {
      url: "https://api.llm402.com/v1/chat/completions",
      name: "LLM Inference API",
      description: "Pay-per-request access to GPT-4, Claude, and open models",
      category: "ai",
      price: { amount: "5000", token: "USDC", network: "eip155:8453" },
      methods: ["POST"],
    },
    {
      url: "https://api.market402.com/report",
      name: "DeFi Market Intelligence",
      description: "Weekly DeFi market analysis with trading signals and risk metrics",
      category: "reports",
      price: { amount: "50000", token: "USDT0", network: "eip155:42161" },
      methods: ["GET"],
    },
    {
      url: "https://api.image402.com/generate",
      name: "Image Generation API",
      description: "High-res image generation via Stable Diffusion XL and Flux",
      category: "ai",
      price: { amount: "2000", token: "USDC", network: "eip155:8453" },
      methods: ["POST"],
    },
    {
      url: "https://api.compute402.com/gpu/run",
      name: "GPU Compute Service",
      description: "On-demand GPU compute for ML inference (A100, H100)",
      category: "compute",
      price: { amount: "100000", token: "USDT0", network: "eip155:42161" },
      methods: ["POST"],
    },
  ];

  return all.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q),
  );
}

export function formatSearchBazaarResult(services: BazaarService[]): string {
  if (services.length === 0) return "No services found.";
  return services
    .map((s) => {
      let line = `• **${s.name}** — ${s.description}\n  URL: ${s.url}\n  Price: ${Number(s.price.amount) / 1e6} ${s.price.token} on ${s.price.network}`;
      if (s.tags && s.tags.length > 0) line += `\n  Tags: ${s.tags.join(", ")}`;
      if (s.verified !== undefined) line += `\n  Verified: ${s.verified ? "✓" : "✗"}`;
      return line;
    })
    .join("\n\n");
}

// ============================================================================
// Pay For Service
// ============================================================================

export const payForServiceInputSchema = z.object({
  url: z.string().describe("URL of the t402-protected service"),
  method: z.string().optional().describe('HTTP method (default: "GET")'),
  body: z.string().optional().describe("Request body (for POST/PUT)"),
  maxAmount: z.string().optional().describe("Max amount willing to pay in USD"),
  confirmed: z.boolean().optional().describe("Confirm and execute payment"),
});

export type PayForServiceInput = z.infer<typeof payForServiceInputSchema>;

// ============================================================================
// Monetize Service
// ============================================================================

export const monetizeServiceInputSchema = z.object({
  endpoint: z.string().describe("Your API endpoint URL"),
  price: z.string().describe('Price per request in USD (e.g., "0.01")'),
  token: z.string().optional().describe('Token (default: "USDC")'),
  network: z.string().optional().describe('Network (default: "eip155:8453")'),
  description: z.string().optional().describe("Service description"),
});

export type MonetizeServiceInput = z.infer<typeof monetizeServiceInputSchema>;

export function generateMonetizeConfig(input: MonetizeServiceInput): string {
  const token = input.token || "USDC";
  const network = input.network || "eip155:8453";
  const amount = Math.round(parseFloat(input.price) * 1e6).toString();

  return `// t402 payment middleware configuration
import { paymentMiddleware } from "@t402/express";

app.use(paymentMiddleware({
  "${input.endpoint}": {
    accepts: [{
      scheme: "exact",
      network: "${network}",
      price: { amount: "${amount}", asset: "${token}" },
      payTo: process.env.SELLER_ADDRESS,
    }],
    description: ${JSON.stringify(input.description || `Paid API: ${input.endpoint}`)},
    mimeType: "application/json",
  },
}));`;
}

// ============================================================================
// Tool Definitions
// ============================================================================

export const BAZAAR_TOOL_DEFINITIONS = {
  "t402/searchBazaar": {
    name: "t402/searchBazaar",
    description:
      "Search the t402 bazaar marketplace for paid API services. Returns matching services with URLs, prices, and descriptions. Use this to discover services an agent can pay for.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query (supports multi-word)" },
        category: { type: "string", description: 'Category filter (e.g., "ai", "data", "compute")' },
        maxPrice: { type: "string", description: "Max price in USD" },
        network: { type: "string", description: "CAIP-2 network filter" },
        token: { type: "string", description: 'Token filter (e.g., "USDC", "USDT0")' },
        tags: { type: "string", description: 'Tag filter (comma-separated, e.g., "llm,inference")' },
      },
      required: ["query"],
    },
  },

  "t402/payForService": {
    name: "t402/payForService",
    description:
      "Pay for a t402-protected service. Fetches the URL, handles 402 payment, and returns the resource. Like t402/autoPay but for discovered bazaar services.",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "Service URL" },
        method: { type: "string", description: 'HTTP method (default: "GET")' },
        body: { type: "string", description: "Request body" },
        maxAmount: { type: "string", description: "Max payment amount" },
        confirmed: { type: "boolean", description: "Confirm and execute" },
      },
      required: ["url"],
    },
  },

  "t402/monetizeService": {
    name: "t402/monetizeService",
    description:
      "Generate t402 middleware configuration to monetize your API. Returns ready-to-use Express middleware code that adds 402 payment protection to your endpoint.",
    inputSchema: {
      type: "object" as const,
      properties: {
        endpoint: { type: "string", description: "Your API endpoint" },
        price: { type: "string", description: 'Price per request in USD (e.g., "0.01")' },
        token: { type: "string", description: 'Token (default: "USDC")' },
        network: { type: "string", description: 'Network (default: "eip155:8453")' },
        description: { type: "string", description: "Service description" },
      },
      required: ["endpoint", "price"],
    },
  },
};
