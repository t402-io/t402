import type { Metadata } from "next";
import Link from "next/link";
import { NavBar } from "../../components/NavBar";
import { Footer } from "../../components/Footer";
import { Mermaid } from "../../components/Mermaid";

const pageTitle = "AI Agent Payments with MCP Integration";
const pageDescription =
  "How autonomous AI agents use the Model Context Protocol to discover, authorize, and execute payments without human intervention. Build AI-powered services that monetize via T402.";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: "/writing/ai-agents-mcp",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: pageDescription,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  headline: pageTitle,
  description: pageDescription,
  datePublished: "2026-01-22",
  author: { "@type": "Organization", name: "T402 Team", url: "https://t402.io" },
  publisher: { "@type": "Organization", name: "T402", url: "https://t402.io" },
  url: "https://t402.io/writing/ai-agents-mcp",
  keywords: ["AI", "MCP", "Agents", "Model Context Protocol"],
};

export default function AiAgentsMcpPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0A0A0B", color: "#FAFAFA" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <NavBar />

      <div className="flex-1">
        <article>
          {/* Dark Header */}
          <header className="py-24 md:py-32" style={{ backgroundColor: "#0A0A0B" }}>
            <div className="max-w-3xl mx-auto px-6">
              <div className="mb-6 flex flex-wrap gap-2">
                {["AI", "MCP", "Agents"].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md px-3 py-1 text-sm font-medium"
                    style={{ backgroundColor: "rgba(80,175,149,0.1)", color: "#50AF95" }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <h1
                className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight mb-6"
                style={{ color: "#FAFAFA" }}
              >
                AI Agent Payments with MCP Integration
              </h1>
              <div className="flex items-center gap-4 text-sm" style={{ color: "#A1A1AA" }}>
                <span>January 22, 2026</span>
                <span style={{ color: "rgba(255,255,255,0.2)" }}>|</span>
                <span>T402 Team</span>
              </div>
            </div>
          </header>

          {/* Light Article Body */}
          <section style={{ backgroundColor: "#F7FAF9" }} className="py-16 md:py-20">
            <div className="max-w-3xl mx-auto px-6 space-y-10" style={{ lineHeight: "1.8" }}>
              {/* TL;DR */}
              <div
                className="rounded-2xl p-6"
                style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}
              >
                <p className="text-base" style={{ color: "#4A5568" }}>
                  <strong style={{ color: "#1A1A2E" }}>TL;DR</strong>: T402&apos;s MCP server (<code className="font-mono text-sm px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(80,175,149,0.1)", color: "#50AF95" }}>@t402/mcp</code>) gives AI agents the ability to discover paid APIs, authorize payments, and access resources — all through standard Model Context Protocol tool calls. Agents can autonomously pay for weather data, compute, or any T402-protected service.
                </p>
              </div>

              {/* Why AI Agents Need Payments */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>Why AI Agents Need Payments</h2>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  As AI agents become more autonomous, they need to interact with the real economy. An agent researching a topic might need premium data. An agent completing a task might need compute resources. An agent booking travel might need to make purchases.
                </p>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  Today, this requires human intervention at every payment step. T402&apos;s MCP integration changes that — agents can discover what services cost, decide if the value is worth the price, and pay autonomously within budget constraints.
                </p>
              </section>

              {/* MCP Overview */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>The Model Context Protocol</h2>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  MCP (Model Context Protocol) is a standard for giving AI models access to external tools and resources. It defines a JSON-RPC interface where models can:
                </p>
                <ul className="list-disc pl-5 space-y-2 text-base" style={{ color: "#4A5568" }}>
                  <li><strong style={{ color: "#1A1A2E" }}>Discover tools</strong>: Learn what capabilities are available</li>
                  <li><strong style={{ color: "#1A1A2E" }}>Call tools</strong>: Execute actions with structured parameters</li>
                  <li><strong style={{ color: "#1A1A2E" }}>Read resources</strong>: Access data sources</li>
                </ul>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  T402 extends MCP with payment capabilities. When a tool requires payment, the agent receives a 402-equivalent response with payment requirements, signs an authorization, and retries — all within the MCP tool call lifecycle.
                </p>
              </section>

              {/* How It Works */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>How T402 + MCP Works</h2>
                <Mermaid chart={`
sequenceDiagram
  participant Agent as AI Agent
  participant MCP as MCP Server
  participant API as Paid API

  Agent->>MCP: tools/call { tool: "weather" }
  MCP->>API: GET /weather
  API-->>MCP: 402 + accepts
  MCP-->>Agent: PaymentRequired { accepts: [...] }

  Agent->>MCP: tools/call { tool: "t402_pay" }
  Note right of Agent: amount: "10000"<br/>network: "eip155:8453"
  MCP->>API: GET + X-Payment
  API-->>MCP: 200 + data
  MCP-->>Agent: { temperature: 22 }
`} />
                <p className="text-base" style={{ color: "#4A5568" }}>
                  The MCP server exposes T402 payment as a tool. When the agent encounters a 402 response, it can autonomously decide to pay based on its budget constraints and task requirements.
                </p>
              </section>

              {/* Available Tools */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>MCP Tools Provided</h2>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  The <code className="font-mono text-sm px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(80,175,149,0.1)", color: "#50AF95" }}>@t402/mcp</code> server exposes these tools to AI agents:
                </p>
                <div className="space-y-3">
                  {[
                    { name: "t402_fetch", desc: "Fetch a URL with automatic 402 payment handling. Discovers payment requirements, signs authorization, and returns the resource." },
                    { name: "t402_check_price", desc: "Check what a URL costs without paying. Returns payment requirements so the agent can decide before committing." },
                    { name: "t402_balance", desc: "Check the agent\u2019s wallet balance across supported networks. Helps agents budget their spending." },
                    { name: "t402_history", desc: "View recent payment history. Enables agents to track spending and avoid duplicate payments." },
                  ].map((tool) => (
                    <div
                      key={tool.name}
                      className="rounded-2xl p-4"
                      style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}
                    >
                      <p className="font-mono text-sm font-medium" style={{ color: "#50AF95" }}>{tool.name}</p>
                      <p className="mt-1 text-sm" style={{ color: "#4A5568" }}>{tool.desc}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Budget Controls */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>Budget Controls</h2>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  Autonomous payments require guardrails. T402&apos;s MCP server supports configurable budget controls:
                </p>
                <ul className="list-disc pl-5 space-y-2 text-base" style={{ color: "#4A5568" }}>
                  <li><strong style={{ color: "#1A1A2E" }}>Per-request limit</strong>: Maximum amount the agent can spend on a single request</li>
                  <li><strong style={{ color: "#1A1A2E" }}>Session budget</strong>: Total spending cap for the current session</li>
                  <li><strong style={{ color: "#1A1A2E" }}>Domain allowlist</strong>: Restrict which domains the agent can pay</li>
                  <li><strong style={{ color: "#1A1A2E" }}>Network preference</strong>: Preferred chains for payment (cost optimization)</li>
                  <li><strong style={{ color: "#1A1A2E" }}>Approval mode</strong>: Require human approval above a threshold</li>
                </ul>
                <div
                  className="rounded-xl p-4 font-mono text-sm"
                  style={{ backgroundColor: "#111113", color: "#FAFAFA" }}
                >
                  <p style={{ color: "#A1A1AA" }}>// MCP server configuration</p>
                  <p>{"{"}</p>
                  <p>{"  "}&quot;budget&quot;: {"{"}</p>
                  <p>{"    "}&quot;perRequest&quot;: &quot;0.10&quot;,</p>
                  <p>{"    "}&quot;sessionTotal&quot;: &quot;5.00&quot;,</p>
                  <p>{"    "}&quot;approvalThreshold&quot;: &quot;1.00&quot;</p>
                  <p>{"  "}{"}"}</p>
                  <p>{"}"}</p>
                </div>
              </section>

              {/* Use Cases */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>Use Cases</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    { title: "Research Agents", desc: "Agents that gather data from premium APIs (weather, financial, scientific) and pay per query." },
                    { title: "Code Generation", desc: "Agents that use paid compute services for testing, compilation, or deployment." },
                    { title: "Content Creation", desc: "Agents that purchase stock images, music, or reference materials for creative work." },
                    { title: "Agent-to-Agent", desc: "Agents that hire other agents for specialized subtasks, creating an AI service economy." },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="rounded-2xl p-4"
                      style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}
                    >
                      <p className="font-medium mb-2" style={{ color: "#1A1A2E" }}>{item.title}</p>
                      <p className="text-sm" style={{ color: "#A1A1AA" }}>{item.desc}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Bazaar Discovery */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>Bazaar: Service Discovery for Agents</h2>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  T402&apos;s Bazaar extension enables agents to discover paid services programmatically. Instead of hardcoding API endpoints, agents can query the Bazaar registry to find services that match their needs:
                </p>
                <div
                  className="rounded-xl p-4 font-mono text-sm overflow-x-auto"
                  style={{ backgroundColor: "#111113", color: "#FAFAFA" }}
                >
                  <p style={{ color: "#A1A1AA" }}>// Agent discovers available paid weather APIs</p>
                  <p>const services = await bazaar.search({"{"}</p>
                  <p>{"  "}category: &apos;weather&apos;,</p>
                  <p>{"  "}maxPrice: &apos;0.01&apos;,</p>
                  <p>{"  "}network: &apos;eip155:8453&apos;</p>
                  <p>{"}"});</p>
                </div>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  This creates an open marketplace where service providers register their APIs and agents discover them based on price, capability, and reliability. No API key management, no billing accounts — just sign and pay.
                </p>
              </section>
            </div>
          </section>

          {/* CTA */}
          <section style={{ backgroundColor: "#FFFFFF" }} className="py-24 md:py-32">
            <div className="max-w-3xl mx-auto px-6 text-center">
              <h2 className="mb-4 text-2xl font-bold sm:text-3xl" style={{ color: "#1A1A2E" }}>
                Build AI-Powered Payments
              </h2>
              <p className="mx-auto mb-8 max-w-xl" style={{ color: "#4A5568" }}>
                Add the T402 MCP server to your AI agent stack and enable autonomous payments.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  href="https://docs.t402.io/sdks/typescript/mcp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-medium transition-all hover:opacity-90"
                  style={{ backgroundColor: "#50AF95", color: "#0A0A0B" }}
                >
                  MCP Documentation
                </Link>
                <Link
                  href="https://demo.t402.io/mcp-ai-agent"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-medium transition-all hover:opacity-90"
                  style={{ backgroundColor: "#FFFFFF", color: "#1A1A2E", border: "1px solid rgba(0,0,0,0.08)" }}
                >
                  Live Demo
                </Link>
              </div>
            </div>
          </section>
        </article>
      </div>

      <Footer />
    </div>
  );
}
