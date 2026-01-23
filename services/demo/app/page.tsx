"use client";

import { motion } from "motion/react";
import { WalletButton } from "@/components/layout/WalletButton";
import { ModeToggle } from "@/components/layout/ModeToggle";
import { FacilitatorBadge } from "@/components/layout/FacilitatorBadge";
import { HeroPlayground } from "@/components/playground/HeroPlayground";
import { AiApiScenario } from "@/components/scenarios/AiApiScenario";
import { ContentPaywall } from "@/components/scenarios/ContentPaywall";
import { DataMarketplace } from "@/components/scenarios/DataMarketplace";
import { AgentToAgent } from "@/components/scenarios/AgentToAgent";

const SCENARIOS = [
  {
    id: "ai-api",
    title: "AI API Monetization",
    subtitle: "Pay-per-query AI with USDT micropayments",
    description: "No API keys. No subscriptions. Agents and users pay 0.001 USDT per query — instantly settled on-chain.",
    cost: "0.001 USDT/query",
    component: AiApiScenario,
  },
  {
    id: "content",
    title: "Content Paywall",
    subtitle: "Unlock premium content with a single micropayment",
    description: "Replace subscription fatigue with one-time payments. Readers pay only for what they read.",
    cost: "0.01 USDT/article",
    component: ContentPaywall,
  },
  {
    id: "data",
    title: "Data Marketplace",
    subtitle: "Purchase real-time data feeds on demand",
    description: "Pay-per-request market data. No monthly minimums, no rate limit keys — just USDT micropayments.",
    cost: "0.001 USDT/request",
    component: DataMarketplace,
  },
  {
    id: "a2a",
    title: "Agent-to-Agent",
    subtitle: "Autonomous agent commerce via T402",
    description: "AI agents delegate tasks and pay each other automatically. No human in the loop — pure machine-to-machine payments.",
    cost: "0.001 USDT/task",
    component: AgentToAgent,
  },
];

export default function DemoPage() {
  return (
    <div className="min-h-screen">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-background)]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="https://t402.io" className="text-sm font-semibold text-[var(--color-brand)] hover:opacity-80 transition-opacity">
              T402
            </a>
            <span className="text-xs text-[var(--color-muted)]">demo</span>
            <FacilitatorBadge />
          </div>
          <div className="flex items-center gap-3">
            <ModeToggle />
            <WalletButton />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="min-h-[calc(100vh-56px)] flex flex-col items-center justify-center px-4 sm:px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-4">
            <span className="text-[var(--color-brand)]">HTTP 402</span> Payments
          </h1>
          <p className="text-lg sm:text-xl text-[var(--color-muted)] max-w-2xl mx-auto mb-2">
            Pay for web resources with USDT — no API keys, no subscriptions.
          </p>
          <p className="text-sm text-[var(--color-muted)]">
            Request → 402 → Sign → Settle → Access. Under 3 seconds.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full"
        >
          <HeroPlayground />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="mt-16 text-center"
        >
          <p className="text-xs text-[var(--color-muted)] mb-2">Explore real-world scenarios</p>
          <div className="animate-bounce text-[var(--color-muted)]">↓</div>
        </motion.div>
      </section>

      {/* Scenario Sections */}
      {SCENARIOS.map((scenario, i) => {
        const Component = scenario.component;
        return (
          <section
            key={scenario.id}
            id={scenario.id}
            className={`py-20 px-4 sm:px-6 ${i % 2 === 0 ? "" : "bg-[var(--color-surface)]/30"}`}
          >
            <div className="max-w-5xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.4 }}
                className="mb-10"
              >
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-2xl sm:text-3xl font-bold">{scenario.title}</h2>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--color-brand-dim)] text-[var(--color-brand)]">
                    {scenario.cost}
                  </span>
                </div>
                <p className="text-sm text-[var(--color-muted)] max-w-xl">
                  {scenario.description}
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.4, delay: 0.1 }}
              >
                <Component />
              </motion.div>
            </div>
          </section>
        );
      })}

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] py-12 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-[var(--color-brand)]">T402</span>
            <span className="text-xs text-[var(--color-muted)]">HTTP-native payments with USDT</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="https://t402.io" className="text-xs text-[var(--color-muted)] hover:text-white transition-colors">
              Website
            </a>
            <a href="https://docs.t402.io" className="text-xs text-[var(--color-muted)] hover:text-white transition-colors">
              Docs
            </a>
            <a href="https://github.com/t402-io/t402" className="text-xs text-[var(--color-muted)] hover:text-white transition-colors">
              GitHub
            </a>
            <a href="https://facilitator.t402.io" className="text-xs text-[var(--color-muted)] hover:text-white transition-colors">
              Facilitator
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
