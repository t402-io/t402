"use client";

import Link from "next/link";
import { WalletButton } from "@/components/layout/WalletButton";
import { ModeToggle } from "@/components/layout/ModeToggle";
import { FacilitatorBadge } from "@/components/layout/FacilitatorBadge";
import { ScenarioCard } from "@/components/shared/ScenarioCard";
import { ChainLogo } from "@/components/shared/ChainLogo";
import { FlowDiagram } from "@/components/shared/FlowDiagram";
import { CHAIN_FAMILIES, CHAIN_CONFIGS } from "@/lib/testnet-config";
import {
  Brain, FileText, Database, Bot,
  Cpu, Radio, Wand2, ArrowLeftRight, Zap,
  ArrowRight,
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
    <div id="main-content" className="min-h-screen">
      {/* Header */}
      <header
        className="sticky top-0 z-50 backdrop-blur-xl"
        style={{
          background: "rgba(10, 10, 11, 0.85)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
          boxShadow: "0 1px 0 rgba(80, 175, 149, 0.08)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="text-base font-bold tracking-tight" style={{ color: "var(--color-brand)" }}>T402</span>
            <span className="hidden sm:inline text-xs font-medium" style={{ color: "var(--color-text-tertiary)" }}>demo</span>
            <div className="hidden sm:block">
              <FacilitatorBadge />
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <ModeToggle />
            <WalletButton />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative min-h-[80vh] flex flex-col items-center justify-center px-4 sm:px-6 py-24 overflow-hidden">
        <div className="text-center mb-14">
          <span
            className="inline-block text-[10px] font-semibold tracking-[0.25em] uppercase mb-5 px-3 py-1 rounded-full"
            style={{ color: "var(--color-brand)", background: "var(--color-brand-dim)", border: "1px solid rgba(80, 175, 149, 0.15)" }}
          >
            INTERACTIVE DEMO
          </span>
          <h1 className="text-5xl md:text-6xl lg:text-8xl font-bold tracking-tight mb-5">
            <span style={{ color: "var(--color-brand)" }}>44 Networks.</span>{" "}
            <span className="text-white">1 Header.</span>
          </h1>
          <p className="text-xl sm:text-2xl max-w-2xl mx-auto mb-4 text-[var(--color-muted)]">
            HTTP-native USDT payments for APIs, content, AI agents, and IoT.
          </p>
          <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>
            Request &rarr; 402 &rarr; Sign &rarr; Settle &rarr; Access. Under 3 seconds.
          </p>
        </div>

        {/* Chain logos */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-10 px-4 max-w-sm sm:max-w-none">
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
            className="px-5 py-3 text-sm hover:text-white transition-colors rounded-xl min-h-[44px] flex items-center"
            style={{ color: "var(--color-muted)", border: "1px solid rgba(255, 255, 255, 0.15)" }}
          >
            Read Docs
          </a>
        </div>
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
          <div
            className="rounded-2xl p-4 sm:p-5 text-left overflow-hidden"
            style={{ background: "var(--color-background)", border: "1px solid rgba(255, 255, 255, 0.08)" }}
          >
            <pre className="text-[11px] sm:text-xs overflow-x-auto font-mono leading-relaxed" style={{ color: "var(--color-code-text)" }}>
{`import { t402 } from '@t402/express';

app.get('/api/premium', t402({
  scheme: 'exact',
  network: 'eip155:8453',
  amount: '1000',  // 0.001 USDT
}), (req, res) => {
  res.json({ data: 'Premium content' });
});`}
            </pre>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-1">
            <a href="https://www.npmjs.com/org/t402" className="text-xs hover:opacity-70 transition-opacity px-3 py-2 min-h-[44px] flex items-center" style={{ color: "var(--color-muted)" }}>npm</a>
            <a href="https://pypi.org/project/t402" className="text-xs hover:opacity-70 transition-opacity px-3 py-2 min-h-[44px] flex items-center" style={{ color: "var(--color-muted)" }}>PyPI</a>
            <a href="https://pkg.go.dev/github.com/t402-io/t402/sdks/go" className="text-xs hover:opacity-70 transition-opacity px-3 py-2 min-h-[44px] flex items-center" style={{ color: "var(--color-muted)" }}>Go</a>
            <a href="https://central.sonatype.com/artifact/io.t402/t402" className="text-xs hover:opacity-70 transition-opacity px-3 py-2 min-h-[44px] flex items-center" style={{ color: "var(--color-muted)" }}>Maven</a>
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
              <a href="https://t402.io" className="text-xs hover:text-white transition-colors px-3 py-2 min-h-[44px] flex items-center" style={{ color: "var(--color-muted)" }}>Website</a>
              <a href="https://docs.t402.io" className="text-xs hover:text-white transition-colors px-3 py-2 min-h-[44px] flex items-center" style={{ color: "var(--color-muted)" }}>Docs</a>
              <a href="https://github.com/t402-io/t402" className="text-xs hover:text-white transition-colors px-3 py-2 min-h-[44px] flex items-center" style={{ color: "var(--color-muted)" }}>GitHub</a>
              <a href="https://facilitator.t402.io" className="text-xs hover:text-white transition-colors px-3 py-2 min-h-[44px] flex items-center" style={{ color: "var(--color-muted)" }}>API</a>
            </div>
          </div>
          <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.06)" }} className="pt-6 text-center">
            <p className="text-[10px] tracking-wide" style={{ color: "var(--color-text-tertiary)" }}>
              &copy; {new Date().getFullYear()} T402 Protocol. HTTP-native stablecoin payments.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
