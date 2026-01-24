import type { Metadata } from "next";
import Link from "next/link";
import { NavBar } from "../../components/NavBar";
import { Footer } from "../../components/Footer";

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

export default function AiAgentsMcpPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <NavBar />

      <div className="flex-1">
        <article className="pb-20">
          <header className="max-w-4xl mx-auto px-4 sm:px-6 md:px-10 lg:px-16 pt-12 sm:pt-16 md:pt-20">
            <div className="mb-6 flex flex-wrap gap-2">
              <span className="rounded-md bg-brand/10 px-3 py-1 text-sm font-medium text-brand">
                AI
              </span>
              <span className="rounded-md bg-brand/10 px-3 py-1 text-sm font-medium text-brand">
                MCP
              </span>
              <span className="rounded-md bg-brand/10 px-3 py-1 text-sm font-medium text-brand">
                Agents
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-4">
              AI Agent Payments with MCP Integration
            </h1>
            <p className="text-base text-foreground-tertiary mb-2">January 22, 2026</p>
            <p className="text-base text-foreground-tertiary mb-8">By: T402 Team</p>
          </header>

          <section className="max-w-4xl mx-auto px-4 sm:px-6 md:px-10 lg:px-16 space-y-8">
            {/* TL;DR */}
            <div className="rounded-xl border border-border bg-background-secondary p-6">
              <p className="text-base leading-relaxed text-foreground-secondary">
                <strong className="text-foreground">TL;DR</strong>: T402&apos;s MCP server (<code>@t402/mcp</code>) gives AI agents the ability to discover paid APIs, authorize payments, and access resources — all through standard Model Context Protocol tool calls. Agents can autonomously pay for weather data, compute, or any T402-protected service.
              </p>
            </div>

            {/* Why AI Agents Need Payments */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">Why AI Agents Need Payments</h2>
              <p className="text-base leading-relaxed text-foreground-secondary">
                As AI agents become more autonomous, they need to interact with the real economy. An agent researching a topic might need premium data. An agent completing a task might need compute resources. An agent booking travel might need to make purchases.
              </p>
              <p className="text-base leading-relaxed text-foreground-secondary">
                Today, this requires human intervention at every payment step. T402&apos;s MCP integration changes that — agents can discover what services cost, decide if the value is worth the price, and pay autonomously within budget constraints.
              </p>
            </section>

            {/* MCP Overview */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">The Model Context Protocol</h2>
              <p className="text-base leading-relaxed text-foreground-secondary">
                MCP (Model Context Protocol) is a standard for giving AI models access to external tools and resources. It defines a JSON-RPC interface where models can:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-base leading-relaxed text-foreground-secondary">
                <li><strong className="text-foreground">Discover tools</strong>: Learn what capabilities are available</li>
                <li><strong className="text-foreground">Call tools</strong>: Execute actions with structured parameters</li>
                <li><strong className="text-foreground">Read resources</strong>: Access data sources</li>
              </ul>
              <p className="text-base leading-relaxed text-foreground-secondary">
                T402 extends MCP with payment capabilities. When a tool requires payment, the agent receives a 402-equivalent response with payment requirements, signs an authorization, and retries — all within the MCP tool call lifecycle.
              </p>
            </section>

            {/* How It Works */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">How T402 + MCP Works</h2>

              <div className="rounded-xl border border-border bg-background-tertiary p-6 font-mono text-sm overflow-x-auto">
                <pre className="text-foreground-secondary">{`AI Agent                    MCP Server              Paid API
   │                           │                      │
   │── tools/call ────────────▶│                      │
   │   { tool: "weather" }     │── GET /weather ─────▶│
   │                           │◀── 402 + accepts ────│
   │◀── PaymentRequired ───────│                      │
   │   { accepts: [...] }      │                      │
   │                           │                      │
   │── tools/call ────────────▶│                      │
   │   { tool: "t402_pay",     │                      │
   │     amount: "10000",      │                      │
   │     network: "eip155:8453"│                      │
   │   }                       │                      │
   │                           │── GET + X-Payment ──▶│
   │                           │◀── 200 + data ───────│
   │◀── { temperature: 22 } ───│                      │`}</pre>
              </div>

              <p className="text-base leading-relaxed text-foreground-secondary">
                The MCP server exposes T402 payment as a tool. When the agent encounters a 402 response, it can autonomously decide to pay based on its budget constraints and task requirements.
              </p>
            </section>

            {/* Available Tools */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">MCP Tools Provided</h2>
              <p className="text-base leading-relaxed text-foreground-secondary">
                The <code>@t402/mcp</code> server exposes these tools to AI agents:
              </p>

              <div className="space-y-3">
                <div className="rounded-lg border border-border bg-background-secondary p-4">
                  <p className="font-mono text-sm font-medium text-brand">t402_fetch</p>
                  <p className="mt-1 text-sm text-foreground-secondary">Fetch a URL with automatic 402 payment handling. Discovers payment requirements, signs authorization, and returns the resource.</p>
                </div>
                <div className="rounded-lg border border-border bg-background-secondary p-4">
                  <p className="font-mono text-sm font-medium text-brand">t402_check_price</p>
                  <p className="mt-1 text-sm text-foreground-secondary">Check what a URL costs without paying. Returns payment requirements so the agent can decide before committing.</p>
                </div>
                <div className="rounded-lg border border-border bg-background-secondary p-4">
                  <p className="font-mono text-sm font-medium text-brand">t402_balance</p>
                  <p className="mt-1 text-sm text-foreground-secondary">Check the agent&apos;s wallet balance across supported networks. Helps agents budget their spending.</p>
                </div>
                <div className="rounded-lg border border-border bg-background-secondary p-4">
                  <p className="font-mono text-sm font-medium text-brand">t402_history</p>
                  <p className="mt-1 text-sm text-foreground-secondary">View recent payment history. Enables agents to track spending and avoid duplicate payments.</p>
                </div>
              </div>
            </section>

            {/* Budget Controls */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">Budget Controls</h2>
              <p className="text-base leading-relaxed text-foreground-secondary">
                Autonomous payments require guardrails. T402&apos;s MCP server supports configurable budget controls:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-base leading-relaxed text-foreground-secondary">
                <li><strong className="text-foreground">Per-request limit</strong>: Maximum amount the agent can spend on a single request</li>
                <li><strong className="text-foreground">Session budget</strong>: Total spending cap for the current session</li>
                <li><strong className="text-foreground">Domain allowlist</strong>: Restrict which domains the agent can pay</li>
                <li><strong className="text-foreground">Network preference</strong>: Preferred chains for payment (cost optimization)</li>
                <li><strong className="text-foreground">Approval mode</strong>: Require human approval above a threshold</li>
              </ul>

              <div className="rounded-lg border border-border bg-background-tertiary p-4 font-mono text-sm">
                <p className="text-foreground-tertiary">// MCP server configuration</p>
                <p className="text-foreground">{"{"}</p>
                <p className="text-foreground">{"  "}&quot;budget&quot;: {"{"}</p>
                <p className="text-foreground">{"    "}&quot;perRequest&quot;: &quot;0.10&quot;,</p>
                <p className="text-foreground">{"    "}&quot;sessionTotal&quot;: &quot;5.00&quot;,</p>
                <p className="text-foreground">{"    "}&quot;approvalThreshold&quot;: &quot;1.00&quot;</p>
                <p className="text-foreground">{"  "}{"}"}</p>
                <p className="text-foreground">{"}"}</p>
              </div>
            </section>

            {/* Use Cases */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">Use Cases</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-background-secondary p-4">
                  <p className="font-medium text-foreground mb-2">Research Agents</p>
                  <p className="text-sm text-foreground-tertiary">Agents that gather data from premium APIs (weather, financial, scientific) and pay per query.</p>
                </div>
                <div className="rounded-lg border border-border bg-background-secondary p-4">
                  <p className="font-medium text-foreground mb-2">Code Generation</p>
                  <p className="text-sm text-foreground-tertiary">Agents that use paid compute services for testing, compilation, or deployment.</p>
                </div>
                <div className="rounded-lg border border-border bg-background-secondary p-4">
                  <p className="font-medium text-foreground mb-2">Content Creation</p>
                  <p className="text-sm text-foreground-tertiary">Agents that purchase stock images, music, or reference materials for creative work.</p>
                </div>
                <div className="rounded-lg border border-border bg-background-secondary p-4">
                  <p className="font-medium text-foreground mb-2">Agent-to-Agent</p>
                  <p className="text-sm text-foreground-tertiary">Agents that hire other agents for specialized subtasks, creating an AI service economy.</p>
                </div>
              </div>
            </section>

            {/* Bazaar Discovery */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">Bazaar: Service Discovery for Agents</h2>
              <p className="text-base leading-relaxed text-foreground-secondary">
                T402&apos;s Bazaar extension enables agents to discover paid services programmatically. Instead of hardcoding API endpoints, agents can query the Bazaar registry to find services that match their needs:
              </p>

              <div className="rounded-lg border border-border bg-background-tertiary p-4 font-mono text-sm overflow-x-auto">
                <p className="text-foreground-tertiary">// Agent discovers available paid weather APIs</p>
                <p className="text-foreground">const services = await bazaar.search({"{"}</p>
                <p className="text-foreground">{"  "}category: &apos;weather&apos;,</p>
                <p className="text-foreground">{"  "}maxPrice: &apos;0.01&apos;,</p>
                <p className="text-foreground">{"  "}network: &apos;eip155:8453&apos;</p>
                <p className="text-foreground">{"}"});</p>
              </div>

              <p className="text-base leading-relaxed text-foreground-secondary">
                This creates an open marketplace where service providers register their APIs and agents discover them based on price, capability, and reliability. No API key management, no billing accounts — just sign and pay.
              </p>
            </section>

            {/* CTA */}
            <section className="mt-12 rounded-2xl border border-border bg-background-secondary p-8 text-center">
              <h2 className="mb-4 text-2xl font-bold text-foreground">Build AI-Powered Payments</h2>
              <p className="mx-auto mb-6 max-w-xl text-foreground-secondary">
                Add the T402 MCP server to your AI agent stack and enable autonomous payments.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  href="https://docs.t402.io/sdks/typescript/mcp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-brand px-6 py-3 text-base font-medium transition-colors hover:bg-brand-secondary"
                  style={{ color: "#0A0A0B" }}
                >
                  MCP Documentation
                </Link>
                <Link
                  href="https://demo.t402.io/mcp-ai-agent"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-background-tertiary px-6 py-3 text-base font-medium text-foreground transition-colors hover:bg-border"
                >
                  Live Demo
                </Link>
              </div>
            </section>
          </section>
        </article>
      </div>

      <Footer />
    </div>
  );
}
