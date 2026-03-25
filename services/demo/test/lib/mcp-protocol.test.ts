import { describe, it, expect } from "vitest";
import {
  parseRequest,
  getTool,
  listTools,
  createPaymentRequiredError,
  createToolResponse,
  createErrorResponse,
  MCP_TOOLS,
} from "../../app/lib/mcp-protocol";

describe("parseRequest", () => {
  it("parses valid JSON-RPC request", () => {
    const body = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "get_weather" },
    };

    const { request, payment, error } = parseRequest(body);
    expect(error).toBeNull();
    expect(request).not.toBeNull();
    expect(request?.method).toBe("tools/call");
  });

  it("extracts payment from _meta", () => {
    const body = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "get_weather",
        _meta: {
          "t402/payment": {
            t402Version: 2,
            resource: { url: "test" },
            accepted: {},
            payload: { signature: "0x..." },
          },
        },
      },
    };

    const { payment } = parseRequest(body);
    expect(payment).not.toBeNull();
    expect(payment?.t402Version).toBe(2);
  });

  it("returns error for invalid JSON-RPC version", () => {
    const body = {
      jsonrpc: "1.0",
      id: 1,
      method: "test",
    };

    const { error } = parseRequest(body);
    expect(error).toBe("Invalid JSON-RPC version");
  });

  it("returns error for missing id", () => {
    const body = {
      jsonrpc: "2.0",
      method: "test",
    };

    const { error } = parseRequest(body);
    expect(error).toBe("Missing request ID");
  });

  it("returns error for missing method", () => {
    const body = {
      jsonrpc: "2.0",
      id: 1,
    };

    const { error } = parseRequest(body);
    expect(error).toBe("Missing method");
  });
});

describe("getTool", () => {
  it("returns tool by name", () => {
    const tool = getTool("get_weather");
    expect(tool).not.toBeNull();
    expect(tool?.name).toBe("get_weather");
  });

  it("returns null for unknown tool", () => {
    const tool = getTool("unknown-tool");
    expect(tool).toBeNull();
  });
});

describe("listTools", () => {
  it("returns all tools", () => {
    const tools = listTools();
    expect(tools.length).toBe(MCP_TOOLS.length);
  });

  it("includes cost in description", () => {
    const tools = listTools();
    for (const tool of tools) {
      expect(tool.description).toContain("USDT");
    }
  });
});

describe("createPaymentRequiredError", () => {
  it("creates 402 error response", () => {
    const tool = getTool("get_weather")!;
    const accepts = [{ scheme: "exact", network: "eip155:84532", amount: "1000", asset: "0x...", payTo: "0x..." }];

    const response = createPaymentRequiredError(1, tool, accepts);

    expect(response.jsonrpc).toBe("2.0");
    expect(response.id).toBe(1);
    expect(response.error?.code).toBe(402);
    expect(response.error?.data).toHaveProperty("t402Version", 2);
    expect(response.error?.data).toHaveProperty("accepts");
  });
});

describe("createToolResponse", () => {
  it("creates success response", () => {
    const response = createToolResponse(1, '{"result": "test"}');

    expect(response.jsonrpc).toBe("2.0");
    expect(response.id).toBe(1);
    expect(response.result?.content[0].text).toBe('{"result": "test"}');
  });

  it("includes payment response in _meta", () => {
    const paymentResponse = {
      success: true,
      transaction: "0x123",
      network: "eip155:84532",
      payer: "0xUser",
    };

    const response = createToolResponse(1, "result", paymentResponse);
    expect(response.result?._meta?.["t402/payment-response"]).toEqual(paymentResponse);
  });
});

describe("createErrorResponse", () => {
  it("creates error response", () => {
    const response = createErrorResponse(1, -32601, "Method not found");

    expect(response.jsonrpc).toBe("2.0");
    expect(response.id).toBe(1);
    expect(response.error?.code).toBe(-32601);
    expect(response.error?.message).toBe("Method not found");
  });
});

describe("MCP_TOOLS", () => {
  it("has get_weather tool", () => {
    const tool = MCP_TOOLS.find((t) => t.name === "get_weather");
    expect(tool).toBeDefined();
  });

  it("has web_search tool", () => {
    const tool = MCP_TOOLS.find((t) => t.name === "web_search");
    expect(tool).toBeDefined();
  });

  it("has calculate tool", () => {
    const tool = MCP_TOOLS.find((t) => t.name === "calculate");
    expect(tool).toBeDefined();
  });

  it("all tools have execute function", () => {
    for (const tool of MCP_TOOLS) {
      expect(typeof tool.execute).toBe("function");
    }
  });

  it("all tools have cost", () => {
    for (const tool of MCP_TOOLS) {
      expect(tool.cost).toMatch(/^\d+$/);
    }
  });
});

describe("Tool execution", () => {
  it("get_weather tool returns JSON with weather data", async () => {
    const tool = getTool("get_weather")!;
    const result = await tool.execute({ city: "Tokyo" });
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty("city");
    expect(parsed).toHaveProperty("temperature");
    expect(parsed).toHaveProperty("humidity");
    expect(parsed).toHaveProperty("conditions");
  });

  it("web_search tool returns JSON with results", async () => {
    const tool = getTool("web_search")!;
    const result = await tool.execute({ query: "T402 protocol" });
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty("results");
    expect(parsed.results).toHaveLength(3);
    expect(parsed.results[0]).toHaveProperty("title");
    expect(parsed.results[0]).toHaveProperty("snippet");
    expect(parsed.results[0]).toHaveProperty("url");
  });

  it("calculate tool returns JSON with result", async () => {
    const tool = getTool("calculate")!;
    const result = await tool.execute({ expression: "42 * 1337" });
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty("expression", "42 * 1337");
    expect(parsed).toHaveProperty("result", 56154);
    expect(parsed).toHaveProperty("formatted", "56154");
  });

  it("calculate tool rejects invalid expressions", async () => {
    const tool = getTool("calculate")!;
    const result = await tool.execute({ expression: "require('fs')" });
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty("error", "Invalid expression");
  });
});
