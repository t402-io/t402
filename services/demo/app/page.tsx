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
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[rgba(10,10,11,0.8)] backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="text-sm font-semibold text-[var(--color-brand)]">T402</span>
            <span className="hidden sm:inline text-xs text-[var(--color-muted)]">demo</span>
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
      <section className="relative min-h-[70vh] flex flex-col items-center justify-center px-4 sm:px-6 py-20 overflow-hidden">
        <div className="hero-glow" />
        <div className="relative z-10 text-center mb-12">
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight mb-4">
            <span className="text-gradient-brand">32 Chains.</span>{" "}
            <span className="text-white">1 Header.</span>
          </h1>
          <p className="text-lg sm:text-xl text-[var(--color-muted)] max-w-2xl mx-auto mb-3">
            HTTP-native USDT payments for APIs, content, AI agents, and IoT.
          </p>
          <p className="text-sm text-[var(--color-muted)]">
            Request → 402 → Sign → Settle → Access. Under 3 seconds.
          </p>
        </div>

        {/* Chain logos */}
        <div className="relative z-10 flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-10 px-4 max-w-sm sm:max-w-none">
          {CHAIN_FAMILIES.map((family) => (
            <div key={family} className="flex flex-col items-center gap-1">
              <div className="[&_svg]:w-5 [&_svg]:h-5 sm:[&_svg]:w-6 sm:[&_svg]:h-6">
                <ChainLogo family={family} size={24} />
              </div>
              <span className="text-[8px] sm:text-[9px] text-[var(--color-muted)]">{CHAIN_CONFIGS[family].label}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="relative z-10 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          <Link href="/ai-api" className="btn-primary px-5 py-3 text-sm flex items-center gap-2 min-h-[44px]">
            Try a Scenario <ArrowRight size={14} />
          </Link>
          <Link
            href="/playground"
            className="px-5 py-3 text-sm text-white hover:text-[var(--color-brand)] transition-colors border border-[var(--color-border)] rounded-xl min-h-[44px] flex items-center"
          >
            Playground
          </Link>
          <a
            href="https://docs.t402.io"
            className="px-5 py-3 text-sm text-[var(--color-muted)] hover:text-white transition-colors border border-[var(--color-border)] rounded-xl min-h-[44px] flex items-center"
          >
            Read Docs
          </a>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-4 sm:px-6 border-t border-[var(--color-border)]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl sm:text-2xl font-bold text-center mb-6">How T402 Works</h2>
          <div className="glass-card p-4 sm:p-6 mb-10">
            <FlowDiagram autoPlay />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {FLOW_STEPS.map((item) => (
              <div key={item.step} className="glass-card-interactive p-4 sm:p-5 text-center">
                <div className="w-10 h-10 rounded-full bg-[var(--color-brand-dim)] text-[var(--color-brand)] flex items-center justify-center text-sm font-bold mx-auto mb-3">
                  {item.step}
                </div>
                <h3 className="text-sm font-semibold mb-2">{item.title}</h3>
                <p className="text-[11px] sm:text-xs text-[var(--color-muted)] leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Scenario Grid */}
      <section className="py-16 px-4 sm:px-6 border-t border-[var(--color-border)] bg-[rgba(20,20,21,0.3)]">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-xl sm:text-2xl font-bold text-center mb-3">Interactive Scenarios</h2>
          <p className="text-sm text-[var(--color-muted)] text-center mb-10">
            Explore real-world payment flows across {CHAIN_FAMILIES.length} blockchain families
          </p>
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
      <section className="py-16 px-4 sm:px-6 border-t border-[var(--color-border)]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-xl sm:text-2xl font-bold mb-4">Integrate in Minutes</h2>
          <p className="text-sm text-[var(--color-muted)] mb-8">
            Add T402 payments to any HTTP API with a single middleware.
          </p>
          <div className="glass-card p-4 sm:p-5 text-left overflow-hidden">
            <pre className="text-[11px] sm:text-xs text-[var(--color-code-text)] overflow-x-auto font-mono leading-relaxed">
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
            <a href="https://www.npmjs.com/org/t402" className="text-xs text-[var(--color-muted)] hover:text-white transition-colors px-3 py-2 min-h-[44px] flex items-center">npm</a>
            <a href="https://pypi.org/project/t402" className="text-xs text-[var(--color-muted)] hover:text-white transition-colors px-3 py-2 min-h-[44px] flex items-center">PyPI</a>
            <a href="https://pkg.go.dev/github.com/t402-io/t402/sdks/go" className="text-xs text-[var(--color-muted)] hover:text-white transition-colors px-3 py-2 min-h-[44px] flex items-center">Go</a>
            <a href="https://central.sonatype.com/artifact/io.t402/t402" className="text-xs text-[var(--color-muted)] hover:text-white transition-colors px-3 py-2 min-h-[44px] flex items-center">Maven</a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] py-8 sm:py-12 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-sm font-semibold text-[var(--color-brand)]">T402</span>
            <span className="text-[11px] sm:text-xs text-[var(--color-muted)]">HTTP-native payments</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-0">
            <a href="https://t402.io" className="text-xs text-[var(--color-muted)] hover:text-white transition-colors px-3 py-2 min-h-[44px] flex items-center">Website</a>
            <a href="https://docs.t402.io" className="text-xs text-[var(--color-muted)] hover:text-white transition-colors px-3 py-2 min-h-[44px] flex items-center">Docs</a>
            <a href="https://github.com/t402-io/t402" className="text-xs text-[var(--color-muted)] hover:text-white transition-colors px-3 py-2 min-h-[44px] flex items-center">GitHub</a>
            <a href="https://facilitator.t402.io" className="text-xs text-[var(--color-muted)] hover:text-white transition-colors px-3 py-2 min-h-[44px] flex items-center">API</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
