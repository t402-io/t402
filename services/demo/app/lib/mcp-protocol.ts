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

// Weather code descriptions from Open-Meteo WMO codes
const WEATHER_CODES: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

// Available demo tools
export const MCP_TOOLS: McpTool[] = [
  {
    name: "get_weather",
    description: "Get current weather data for any city",
    inputSchema: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name" },
      },
      required: ["city"],
    },
    cost: "1000", // 0.001 USDT
    execute: async (input) => {
      const city = String(input.city || "Tokyo");

      const fallback = {
        city: "Tokyo",
        country: "Japan",
        temperature: "22°C",
        humidity: "65%",
        windSpeed: "12 km/h",
        conditions: "Partly cloudy",
        timestamp: new Date().toISOString(),
      };

      try {
        // Primary: wttr.in (works reliably from Docker containers)
        const res = await fetch(
          `https://wttr.in/${encodeURIComponent(city)}?format=j1`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (!res.ok) return JSON.stringify(fallback);

        const json = await res.json();
        const current = json.current_condition?.[0];
        if (!current) return JSON.stringify({ ...fallback, city });

        const area = json.nearest_area?.[0];
        return JSON.stringify({
          city: area?.areaName?.[0]?.value || city,
          country: area?.country?.[0]?.value || "Unknown",
          temperature: `${current.temp_C}°C`,
          humidity: `${current.humidity}%`,
          windSpeed: `${current.windspeedKmph} km/h`,
          conditions: current.weatherDesc?.[0]?.value || "Unknown",
          timestamp: new Date().toISOString(),
        });
      } catch {
        return JSON.stringify(fallback);
      }
    },
  },
  {
    name: "web_search",
    description: "Search the web for information",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
      },
      required: ["query"],
    },
    cost: "1000", // 0.001 USDT
    execute: async (input) => {
      const query = String(input.query || "T402 protocol");

      const fallbackResults = {
        results: [
          {
            title: "T402 - HTTP-Native Payment Protocol",
            snippet: "T402 is an open-source protocol enabling HTTP 402 payments with USDT stablecoins across EVM, Solana, TON, and TRON networks.",
            url: "https://t402.io",
          },
          {
            title: "T402 Documentation",
            snippet: "Learn how to integrate T402 payments into your API, MCP server, or web application with SDKs for TypeScript, Go, Python, and Java.",
            url: "https://docs.t402.io",
          },
          {
            title: "T402 GitHub Repository",
            snippet: "Open-source HTTP 402 payment protocol. 13 blockchain mechanisms, 4 SDK languages, facilitator settlement service.",
            url: "https://github.com/t402-io/t402",
          },
        ],
      };

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return JSON.stringify(fallbackResults);
      }

      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-20250414",
            max_tokens: 1024,
            messages: [
              {
                role: "user",
                content: `Given the search query '${query}', provide 3 search results. Respond in JSON only, no markdown: { "results": [{ "title": "...", "snippet": "...", "url": "..." }] }`,
              },
            ],
          }),
        });

        if (!res.ok) return JSON.stringify(fallbackResults);

        const data = await res.json();
        const text = data.content?.[0]?.text ?? "";
        const parsed = JSON.parse(text);
        if (parsed.results && Array.isArray(parsed.results)) {
          return JSON.stringify(parsed);
        }
        return JSON.stringify(fallbackResults);
      } catch {
        return JSON.stringify(fallbackResults);
      }
    },
  },
  {
    name: "calculate",
    description: "Perform mathematical calculations",
    inputSchema: {
      type: "object",
      properties: {
        expression: { type: "string", description: "Math expression" },
      },
      required: ["expression"],
    },
    cost: "1000", // 0.001 USDT
    execute: async (input) => {
      const expression = String(input.expression || "");

      // Sanitize: only allow digits, decimal points, operators, parens, spaces, and Math builtins
      const sanitized = expression.replace(
        /[^0-9.+\-*/() Math.sqrtpowPIE]/g,
        ""
      );

      if (sanitized !== expression) {
        return JSON.stringify({
          error: "Invalid expression",
          expression,
          message: "Expression contains disallowed characters. Only numbers, operators (+, -, *, /), parentheses, spaces, and Math functions (sqrt, pow, PI, E) are allowed.",
        });
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        const result = new Function(`return ${sanitized}`)() as number;

        if (typeof result !== "number" || !isFinite(result)) {
          return JSON.stringify({
            error: "Invalid result",
            expression,
            message: "Expression did not evaluate to a finite number.",
          });
        }

        return JSON.stringify({
          expression,
          result,
          formatted: String(result),
        });
      } catch {
        return JSON.stringify({
          error: "Evaluation error",
          expression,
          message: "Failed to evaluate the expression.",
        });
      }
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
    description: `${t.description} (Cost: ${(parseInt(t.cost, 10) / 1000000).toFixed(4)} USDT)`,
    inputSchema: t.inputSchema,
  }));
}
