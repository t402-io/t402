/**
 * MCP (Model Context Protocol) utilities for T402 payment integration
 * Implements JSON-RPC 2.0 with T402 payment flow
 */

import type { ChainFamily } from "./testnet-config";

// JSON-RPC 2.0 types
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: Record<string, unknown> & {
    _meta?: {
      "t402/payment"?: PaymentMeta;
    };
  };
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: {
    content: Array<{ type: string; text: string }>;
    _meta?: {
      "t402/payment-response"?: PaymentResponse;
    };
  };
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface PaymentMeta {
  t402Version: number;
  resource: ResourceInfo;
  accepted: PaymentRequirement;
  payload: {
    signature: string;
    authorization: Record<string, unknown>;
  };
}

export interface PaymentResponse {
  success: boolean;
  transaction?: string;
  network?: string;
  payer?: string;
  error?: string;
}

export interface ResourceInfo {
  url: string;
  description: string;
  mimeType: string;
}

export interface PaymentRequirement {
  scheme: string;
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds?: number;
}

// MCP Tool definitions
export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
  cost: string; // USDT amount
  execute: (input: Record<string, unknown>) => Promise<string>;
}

// Available demo tools
export const MCP_TOOLS: McpTool[] = [
  {
    name: "analyze",
    description: "Analyze text for sentiment, topics, and key insights",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to analyze" },
        aspects: { type: "string", description: "Comma-separated aspects to analyze" },
      },
      required: ["text"],
    },
    cost: "1000", // 0.001 USDT
    execute: async (input) => {
      const text = String(input.text || "").slice(0, 500);
      const wordCount = text.split(/\s+/).length;
      const sentiment = wordCount > 50 ? "neutral" : wordCount > 20 ? "positive" : "brief";

      return JSON.stringify({
        wordCount,
        sentiment,
        topics: ["general"],
        keyPhrases: text.split(/\s+/).slice(0, 5),
        readingTime: `${Math.ceil(wordCount / 200)} min`,
      });
    },
  },
  {
    name: "summarize",
    description: "Generate a concise summary of provided content",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string", description: "Content to summarize" },
        maxLength: { type: "string", description: "Maximum summary length in words" },
      },
      required: ["content"],
    },
    cost: "1000",
    execute: async (input) => {
      const content = String(input.content || "");
      const maxLength = parseInt(String(input.maxLength || "50"));
      const words = content.split(/\s+/).slice(0, maxLength);

      return JSON.stringify({
        summary: words.join(" ") + (content.split(/\s+/).length > maxLength ? "..." : ""),
        originalLength: content.length,
        summaryLength: words.join(" ").length,
        compressionRatio: (words.join(" ").length / Math.max(1, content.length)).toFixed(2),
      });
    },
  },
  {
    name: "translate",
    description: "Translate text between languages",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to translate" },
        targetLang: { type: "string", description: "Target language code (e.g., 'es', 'fr', 'zh')" },
        sourceLang: { type: "string", description: "Source language code (optional)" },
      },
      required: ["text", "targetLang"],
    },
    cost: "2000", // 0.002 USDT (translation is more expensive)
    execute: async (input) => {
      const text = String(input.text || "");
      const targetLang = String(input.targetLang || "es");

      // Simulated translation (just demonstrates the flow)
      const translations: Record<string, string> = {
        es: `[ES] ${text}`,
        fr: `[FR] ${text}`,
        zh: `[ZH] ${text}`,
        ja: `[JA] ${text}`,
        de: `[DE] ${text}`,
      };

      return JSON.stringify({
        original: text,
        translated: translations[targetLang] || `[${targetLang.toUpperCase()}] ${text}`,
        sourceLang: "en",
        targetLang,
        confidence: 0.95,
      });
    },
  },
];

/**
 * Create a 402 Payment Required JSON-RPC error
 */
export function createPaymentRequiredError(
  id: number | string,
  tool: McpTool,
  accepts: PaymentRequirement[]
): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code: 402,
      message: "Payment required",
      data: {
        t402Version: 2,
        error: `Payment required to use tool: ${tool.name}`,
        resource: {
          url: `mcp://tool/${tool.name}`,
          description: tool.description,
          mimeType: "application/json",
        },
        accepts,
      },
    },
  };
}

/**
 * Create a successful tool response
 */
export function createToolResponse(
  id: number | string,
  result: string,
  paymentResponse?: PaymentResponse
): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      content: [{ type: "text", text: result }],
      _meta: paymentResponse
        ? { "t402/payment-response": paymentResponse }
        : undefined,
    },
  };
}

/**
 * Create an error response
 */
export function createErrorResponse(
  id: number | string,
  code: number,
  message: string,
  data?: unknown
): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: { code, message, data },
  };
}

/**
 * Parse MCP request and extract payment if present
 */
export function parseRequest(body: unknown): {
  request: JsonRpcRequest | null;
  payment: PaymentMeta | null;
  error: string | null;
} {
  if (!body || typeof body !== "object") {
    return { request: null, payment: null, error: "Invalid JSON-RPC request" };
  }

  const req = body as Partial<JsonRpcRequest>;

  if (req.jsonrpc !== "2.0") {
    return { request: null, payment: null, error: "Invalid JSON-RPC version" };
  }

  if (!req.id) {
    return { request: null, payment: null, error: "Missing request ID" };
  }

  if (!req.method) {
    return { request: null, payment: null, error: "Missing method" };
  }

  const payment = req.params?._meta?.["t402/payment"] ?? null;

  return {
    request: req as JsonRpcRequest,
    payment,
    error: null,
  };
}

/**
 * Get tool by name
 */
export function getTool(name: string): McpTool | null {
  return MCP_TOOLS.find((t) => t.name === name) ?? null;
}

/**
 * List all available tools in MCP format
 */
export function listTools(): Array<{
  name: string;
  description: string;
  inputSchema: McpTool["inputSchema"];
}> {
  return MCP_TOOLS.map((t) => ({
    name: t.name,
    description: `${t.description} (Cost: ${(parseInt(t.cost) / 1000000).toFixed(4)} USDT)`,
    inputSchema: t.inputSchema,
  }));
}
