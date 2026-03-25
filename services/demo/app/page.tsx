import Link from "next/link";
import { HomeHeader } from "@/components/layout/HomeHeader";
import { ScenarioCard } from "@/components/shared/ScenarioCard";
import { ChainLogo } from "@/components/shared/ChainLogo";
import { FlowDiagram } from "@/components/shared/FlowDiagram";
import { HomeCodeExample } from "@/components/shared/HomeCodeExample";
import { LiveStats } from "@/components/shared/LiveStats";
import { InlineDemo } from "@/components/shared/InlineDemo";
import { CHAIN_FAMILIES, CHAIN_CONFIGS } from "@/lib/testnet-config";
import {
  Brain, FileText, Database, Bot,
  Cpu, Radio, Wand2, ArrowLeftRight, Zap,
  ArrowRight, KeyRound, Coins, Globe,
} from "lucide-react";

const SCENARIOS = [
  {
    id: "ai-api",
    title: "AI API Monetization",
    description: "No API keys. No subscriptions. Agents and users pay 0.001 USDT per query — instantly settled on-chain.",
    cost: "0.001 USDT/query",
    icon: <Brain size={18} />,
    accentColor: "var(--color-scenario-ai)",
  },
  {
    id: "content-paywall",
    title: "Content Paywall",
    description: "Replace subscription fatigue with one-time payments. Readers pay only for what they read.",
    cost: "0.01 USDT/article",
    icon: <FileText size={18} />,
    accentColor: "var(--color-scenario-content)",
  },
  {
    id: "data-marketplace",
    title: "Data Marketplace",
    description: "Pay-per-request market data. No monthly minimums — just USDT micropayments.",
    cost: "0.001 USDT/request",
    icon: <Database size={18} />,
    accentColor: "var(--color-scenario-data)",
  },
  {
    id: "agent-to-agent",
    title: "Agent-to-Agent",
    description: "AI agents delegate tasks and pay each other automatically. Pure machine-to-machine payments.",
    cost: "0.001 USDT/task",
    icon: <Bot size={18} />,
    accentColor: "var(--color-scenario-agent)",
  },
  {
    id: "iot-micropayments",
    title: "IoT Micropayments",
    description: "Sensor data on demand. Pay per reading — temperature, humidity, GPS coordinates.",
    cost: "0.0001 USDT/reading",
    icon: <Cpu size={18} />,
    accentColor: "var(--color-scenario-iot)",
  },
  {
    id: "streaming-media",
    title: "Streaming Media",
    description: "Pay-per-second audio streaming. No subscriptions, just listen and pay as you go.",
    cost: "0.001 USDT/10s",
    icon: <Radio size={18} />,
    accentColor: "var(--color-scenario-stream)",
  },
  {
    id: "mcp-ai-agent",
    title: "MCP AI Agent",
    description: "AI agent autonomously pays for tools and resources via Model Context Protocol.",
    cost: "0.001 USDT/tool",
    icon: <Wand2 size={18} />,
    accentColor: "var(--color-scenario-mcp)",
  },
  {
    id: "cross-chain-bridge",
    title: "Cross-Chain Bridge",
    description: "Pay on one chain, settle on another. LayerZero USDT0 enables seamless cross-chain payments.",
    cost: "0.01 USDT/bridge",
    icon: <ArrowLeftRight size={18} />,
    accentColor: "var(--color-scenario-bridge)",
  },
  {
    id: "gasless-payment",
    title: "Gasless Payment",
    description: "No ETH needed. ERC-4337 account abstraction handles gas — users only pay USDT.",
    cost: "0.001 USDT",
    icon: <Zap size={18} />,
    accentColor: "var(--color-scenario-gasless)",
  },
];

const FLOW_STEPS = [
  { step: "1", title: "Request", description: "Client requests a protected resource. Server responds HTTP 402." },
  { step: "2", title: "Sign", description: "Client signs a USDT authorization off-chain. No gas needed." },
  { step: "3", title: "Settle", description: "Facilitator verifies and settles on-chain. Client gets the resource." },
];

export default function HomePage() {
  return (
    <div id="main-content" className="min-h-screen overflow-x-hidden">
      {/* Testnet Banner */}
      <div className="text-center text-[10px] font-medium py-1.5" style={{ background: "var(--color-warning-dim)", color: "var(--color-warning)" }}>
        Testnet Demo — No real funds required. Connect any testnet wallet to try.
      </div>

      {/* Header (client island — wallet/mode/facilitator need browser APIs) */}
      <HomeHeader />

      {/* Hero */}
      <section className="relative min-h-[80vh] flex flex-col items-center justify-center px-4 sm:px-6 py-24 overflow-hidden">
        <div className="text-center mb-14">
          <span
            className="inline-block text-[10px] font-semibold tracking-[0.25em] uppercase mb-5 px-3 py-1 rounded-full"
            style={{ color: "var(--color-brand)", background: "var(--color-brand-dim)", border: "1px solid rgba(80, 175, 149, 0.15)" }}
          >
            HTTP 402 PAYMENT PROTOCOL
          </span>
          <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-7xl font-bold tracking-tight mb-5">
            <span className="text-white">Your API should accept payments.</span>
            <br />
            <span style={{ color: "var(--color-brand)" }}>Without Stripe. Without API keys.</span>
          </h1>
          <p className="text-lg sm:text-xl max-w-2xl mx-auto mb-4 text-[var(--color-muted)]">
            T402 turns any HTTP endpoint into a paid resource. USDT micropayments across 44 networks — settled on-chain in under 3 seconds.
          </p>
          <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>
            Request &rarr; 402 &rarr; Sign &rarr; Settle &rarr; Access
          </p>
        </div>

        {/* Chain logos */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 mb-10 px-2 sm:px-4 max-w-xs sm:max-w-none">
          {CHAIN_FAMILIES.map((family) => (
            <div key={family} className="flex flex-col items-center gap-1">
              <div className="[&_svg]:w-5 [&_svg]:h-5 sm:[&_svg]:w-6 sm:[&_svg]:h-6">
                <ChainLogo family={family} size={24} />
              </div>
              <span className="text-[8px] sm:text-[9px]" style={{ color: "var(--color-text-tertiary)" }}>{CHAIN_CONFIGS[family].label}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          <Link href="/ai-api" className="btn-primary px-5 py-3 text-sm flex items-center gap-2 min-h-[44px]">
            Try a Scenario <ArrowRight size={14} />
          </Link>
          <Link
            href="/playground"
            className="px-5 py-3 text-sm text-white hover:text-[var(--color-brand)] transition-colors rounded-xl min-h-[44px] flex items-center"
            style={{ border: "1px solid rgba(255, 255, 255, 0.15)" }}
          >
            Playground
          </Link>
          <a
            href="https://docs.t402.io"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-3 text-sm hover:text-white transition-colors rounded-xl min-h-[44px] flex items-center"
            style={{ color: "var(--color-muted)", border: "1px solid rgba(255, 255, 255, 0.15)" }}
          >
            Read Docs
          </a>
        </div>

        {/* Inline Demo */}
        <div className="mt-8 flex justify-center">
          <InlineDemo />
        </div>
      </section>

      {/* Why T402 */}
      <section
        className="py-20 px-4 sm:px-6"
        style={{ background: "var(--color-surface)", borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <span
              className="inline-block text-xs font-semibold tracking-[0.2em] uppercase mb-3"
              style={{ color: "var(--color-brand)" }}
            >
              WHY T402
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold">Payment Without Friction</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: <KeyRound size={18} />, title: "No API Keys", description: "No accounts, no dashboards, no API key management. Any HTTP client can pay." },
              { icon: <Coins size={18} />, title: "Micropayments", description: "Sub-cent payments with no minimum. Pay 0.001 USDT per API call — impossible with credit cards." },
              { icon: <Bot size={18} />, title: "Machine-Native", description: "AI agents and IoT devices pay autonomously. No human in the loop required." },
              { icon: <Globe size={18} />, title: "Any Chain", description: "10 blockchain families, 44 networks. Users pay from whatever wallet they already have." },
            ].map((card) => (
              <div
                key={card.title}
                className="card-static p-5 sm:p-6"
                style={{ background: "var(--color-background)" }}
              >
                <div className="mb-3" style={{ color: "var(--color-brand)" }}>
                  {card.icon}
                </div>
                <h3 className="text-sm font-semibold mb-2">{card.title}</h3>
                <p className="text-xs leading-relaxed text-[var(--color-muted)]">{card.description}</p>
              </div>
            ))}
          </div>

          {/* Comparison */}
          <div
            className="mt-10 rounded-2xl overflow-x-auto max-w-2xl mx-auto"
            style={{ border: "1px solid var(--color-border)" }}
          >
            <table className="w-full text-xs min-w-[360px]">
              <thead>
                <tr style={{ background: "var(--color-surface)" }}>
                  <th className="text-left px-2 sm:px-4 py-3 font-medium" style={{ color: "var(--color-muted)" }}></th>
                  <th className="text-center px-2 sm:px-4 py-3 font-semibold" style={{ color: "var(--color-brand)" }}>T402</th>
                  <th className="text-center px-2 sm:px-4 py-3 font-medium" style={{ color: "var(--color-muted)" }}>Stripe</th>
                  <th className="text-center px-2 sm:px-4 py-3 font-medium" style={{ color: "var(--color-muted)" }}>x402</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Minimum payment", "$0.0001", "$0.50+", "$0.01"],
                  ["Transaction fee", "Gas only", "2.9% + $0.30", "Gas only"],
                  ["Setup required", "None", "KYC + Dashboard", "Coinbase account"],
                  ["Chains supported", "44 (10 families)", "\u2014", "EVM only"],
                  ["Machine-to-machine", "Native", "API key required", "Limited"],
                  ["Protocol", "HTTP 402 (open)", "Proprietary", "HTTP 402"],
                ].map(([label, t402, stripe, x402], i) => (
                  <tr
                    key={i}
                    style={{
                      background: i % 2 === 0 ? "var(--color-background)" : "var(--color-surface)",
                      borderTop: "1px solid var(--color-border)",
                    }}
                  >
                    <td className="px-2 sm:px-4 py-2.5 font-medium text-white whitespace-nowrap">{label}</td>
                    <td className="px-2 sm:px-4 py-2.5 text-center" style={{ color: "var(--color-brand)" }}>{t402}</td>
                    <td className="px-2 sm:px-4 py-2.5 text-center" style={{ color: "var(--color-muted)" }}>{stripe}</td>
                    <td className="px-2 sm:px-4 py-2.5 text-center" style={{ color: "var(--color-muted)" }}>{x402}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Live Stats */}
      <section className="py-12 px-4 sm:px-6" style={{ borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}>
        <LiveStats />
      </section>

      {/* How It Works */}
      <section
        className="py-20 px-4 sm:px-6"
        style={{ background: "var(--color-surface)", borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <span
              className="inline-block text-xs font-semibold tracking-[0.2em] uppercase mb-3"
              style={{ color: "var(--color-brand)" }}
            >
              PROTOCOL
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold">How T402 Works</h2>
          </div>
          <div className="card-static p-4 sm:p-6 mb-10" style={{ background: "var(--color-background)" }}>
            <FlowDiagram autoPlay />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {FLOW_STEPS.map((item) => (
              <div key={item.step} className="card-static p-5 sm:p-6 text-center" style={{ background: "var(--color-background)" }}>
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold mx-auto mb-4"
                  style={{ background: "var(--color-brand-dim)", color: "var(--color-brand)", border: "1px solid rgba(80, 175, 149, 0.2)" }}
                >
                  {item.step}
                </div>
                <h3 className="text-sm font-semibold mb-2">{item.title}</h3>
                <p className="text-xs leading-relaxed text-[var(--color-muted)]">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Scenario Grid */}
      <section
        className="py-20 px-4 sm:px-6"
        style={{ borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span
              className="inline-block text-xs font-semibold tracking-[0.2em] uppercase mb-3"
              style={{ color: "var(--color-brand)" }}
            >
              EXPLORE
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">Interactive Scenarios</h2>
            <p className="text-sm text-[var(--color-muted)]">
              Explore real-world payment flows across {CHAIN_FAMILIES.length} blockchain families
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SCENARIOS.map((s) => (
              <ScenarioCard
                key={s.id}
                id={s.id}
                title={s.title}
                description={s.description}
                cost={s.cost}
                icon={s.icon}
                accentColor={s.accentColor}
                href={`/${s.id}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Developer Quick Start */}
      <section
        className="py-20 px-4 sm:px-6"
        style={{ background: "var(--color-surface)", borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}
      >
        <div className="max-w-3xl mx-auto text-center">
          <span
            className="inline-block text-xs font-semibold tracking-[0.2em] uppercase mb-3"
            style={{ color: "var(--color-brand)" }}
          >
            DEVELOPERS
          </span>
          <h2 className="text-xl sm:text-2xl font-bold mb-4">Integrate in Minutes</h2>
          <p className="text-sm mb-8 text-[var(--color-muted)]">
            Add T402 payments to any HTTP API with a single middleware.
          </p>
          <div className="text-left">
            <HomeCodeExample />
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-1">
            <a href="https://www.npmjs.com/org/t402" target="_blank" rel="noopener noreferrer" className="text-xs hover:opacity-70 transition-opacity px-3 py-2 min-h-[44px] flex items-center" style={{ color: "var(--color-muted)" }}>npm</a>
            <a href="https://pypi.org/project/t402" target="_blank" rel="noopener noreferrer" className="text-xs hover:opacity-70 transition-opacity px-3 py-2 min-h-[44px] flex items-center" style={{ color: "var(--color-muted)" }}>PyPI</a>
            <a href="https://pkg.go.dev/github.com/t402-io/t402/sdks/go" target="_blank" rel="noopener noreferrer" className="text-xs hover:opacity-70 transition-opacity px-3 py-2 min-h-[44px] flex items-center" style={{ color: "var(--color-muted)" }}>Go</a>
            <a href="https://central.sonatype.com/artifact/io.t402/t402" target="_blank" rel="noopener noreferrer" className="text-xs hover:opacity-70 transition-opacity px-3 py-2 min-h-[44px] flex items-center" style={{ color: "var(--color-muted)" }}>Maven</a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="py-12 sm:py-16 px-4 sm:px-6"
        style={{ borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}
      >
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 sm:gap-8 mb-8">
            <div className="flex flex-col items-center sm:items-start gap-1">
              <span className="text-base font-bold tracking-tight" style={{ color: "var(--color-brand)" }}>T402</span>
              <span className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>The Official Payment Protocol for USDT</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
              <a href="https://t402.io" target="_blank" rel="noopener noreferrer" className="text-xs hover:text-white transition-colors px-3 py-2 min-h-[44px] flex items-center" style={{ color: "var(--color-muted)" }}>Website</a>
              <a href="https://docs.t402.io" target="_blank" rel="noopener noreferrer" className="text-xs hover:text-white transition-colors px-3 py-2 min-h-[44px] flex items-center" style={{ color: "var(--color-muted)" }}>Docs</a>
              <a href="https://github.com/t402-io/t402" target="_blank" rel="noopener noreferrer" className="text-xs hover:text-white transition-colors px-3 py-2 min-h-[44px] flex items-center" style={{ color: "var(--color-muted)" }}>GitHub</a>
              <a href="https://docs.t402.io/api" target="_blank" rel="noopener noreferrer" className="text-xs hover:text-white transition-colors px-3 py-2 min-h-[44px] flex items-center" style={{ color: "var(--color-muted)" }}>API</a>
            </div>
          </div>
          <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.06)" }} className="pt-6 text-center">
            <p className="text-[10px] tracking-wide" style={{ color: "var(--color-text-tertiary)" }}>
              &copy; {new Date().getFullYear()} T402 Protocol. HTTP-native stablecoin payments.
            </p>
            <span className="text-[10px] tracking-wide" style={{ color: "var(--color-text-tertiary)" }}>MIT License</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
