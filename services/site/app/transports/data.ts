/**
 * Transport Data for t402
 */

export interface Transport {
  id: string;
  name: string;
  tagline: string;
  description: string;
  icon: "http" | "mcp" | "a2a";
  color: string;
  mechanism: string;
  dataFormat: string;
  sdkSupport: string[];
  useCases: string[];
  codeExample: { title: string; language: string; code: string };
  specUrl: string;
  badge?: "new" | "beta";
}

export const transports: Transport[] = [
  {
    id: "http",
    name: "HTTP",
    tagline: "Standard web APIs and services",
    description:
      "The original t402 transport. Uses HTTP 402 status codes and custom headers to enable payment flows over standard REST APIs, webhooks, and web services.",
    icon: "http",
    color: "#3B82F6",
    mechanism: "HTTP 402 status code + PAYMENT-REQUIRED header",
    dataFormat: "Base64-encoded PaymentRequired in headers",
    sdkSupport: ["TypeScript", "Go", "Python", "Java"],
    useCases: [
      "REST API monetization",
      "Premium content paywalls",
      "Webhook payment gating",
      "SaaS per-request billing",
    ],
    codeExample: {
      title: "Express Middleware",
      language: "typescript",
      code: `import { paymentMiddleware } from "@t402/express";
import { ExactEvmServer } from "@t402/evm/exact/server";

app.use(paymentMiddleware({
  "GET /api/data": {
    price: "$0.01",
    network: "eip155:8453",
    schemes: [new ExactEvmServer({ payTo: "0x..." })],
  },
}));`,
    },
    specUrl: "https://docs.t402.io/getting-started/quickstart",
  },
  {
    id: "mcp",
    name: "MCP",
    tagline: "AI agents and LLM tool calls",
    description:
      "Payment flows over the Model Context Protocol using JSON-RPC error responses. Enables AI agents and MCP clients to pay for tools and resources autonomously.",
    icon: "mcp",
    color: "#8B5CF6",
    mechanism: "JSON-RPC error with code 402",
    dataFormat: "PaymentRequired in error.data field",
    sdkSupport: ["TypeScript", "Go", "Python", "Java"],
    useCases: [
      "AI agent tool monetization",
      "LLM resource access",
      "Autonomous agent payments",
      "MCP server monetization",
    ],
    codeExample: {
      title: "MCP Server Tool",
      language: "typescript",
      code: `import { T402McpServer } from "@t402/mcp";

const server = new T402McpServer({
  tools: {
    "financial_analysis": {
      price: "$0.05",
      network: "eip155:8453",
      handler: async (params) => {
        return analyzeMarket(params);
      },
    },
  },
});`,
    },
    specUrl: "https://docs.t402.io/sdks/typescript/mcp",
    badge: "new",
  },
  {
    id: "a2a",
    name: "A2A",
    tagline: "Agent-to-agent service commerce",
    description:
      "Payment coordination over the Agent-to-Agent protocol using task-based state management. Agents negotiate and settle payments within multi-agent workflows.",
    icon: "a2a",
    color: "#EC4899",
    mechanism: "Task state input-required + payment metadata",
    dataFormat: "PaymentRequired in t402.payment.required metadata",
    sdkSupport: ["TypeScript", "Go", "Python", "Java"],
    useCases: [
      "Multi-agent service meshes",
      "Agent-to-agent commerce",
      "Autonomous service discovery",
      "Decentralized AI marketplaces",
    ],
    codeExample: {
      title: "A2A Agent Handler",
      language: "typescript",
      code: `import { T402A2AAgent } from "@t402/mcp";

const agent = new T402A2AAgent({
  skills: [{
    id: "image-generation",
    price: "$0.10",
    network: "eip155:8453",
    handler: async (task) => {
      return generateImage(task.params);
    },
  }],
});`,
    },
    specUrl: "https://docs.t402.io/getting-started/quickstart",
    badge: "new",
  },
];

export const comparisonRows = [
  {
    label: "Signaling",
    http: "HTTP 402 status code",
    mcp: "JSON-RPC error code 402",
    a2a: "Task state: input-required",
  },
  {
    label: "Data Format",
    http: "Base64 headers",
    mcp: "JSON in error.data",
    a2a: "JSON in task metadata",
  },
  {
    label: "Client Type",
    http: "Web apps, mobile, CLI",
    mcp: "AI agents, LLM clients",
    a2a: "Autonomous agents",
  },
  {
    label: "Best For",
    http: "APIs, webhooks, paywalls",
    mcp: "Tool monetization",
    a2a: "Agent commerce",
  },
  {
    label: "SDK Support",
    http: "TS, Go, Python, Java",
    mcp: "TS, Go, Python, Java",
    a2a: "TS, Go, Python, Java",
  },
];
