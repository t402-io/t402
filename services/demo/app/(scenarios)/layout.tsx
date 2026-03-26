"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { WalletButton } from "@/components/layout/WalletButton";
import { ModeToggle } from "@/components/layout/ModeToggle";
import { FacilitatorBadge } from "@/components/layout/FacilitatorBadge";
import { ChainSelector } from "@/components/shared/ChainSelector";
import {
  Brain, FileText, Database, Bot,
  Cpu, Radio, Wand2, ArrowLeftRight, Zap,
  Repeat, ArrowLeft,
} from "lucide-react";
import clsx from "clsx";
import { useDemoContext } from "@/providers/DemoProvider";
import type { ReactNode } from "react";

const SCENARIOS = [
  { id: "ai-api", title: "AI API", icon: Brain },
  { id: "content-paywall", title: "Paywall", icon: FileText },
  { id: "data-marketplace", title: "Data Market", icon: Database },
  { id: "agent-to-agent", title: "Agent-to-Agent", icon: Bot },
  { id: "iot-micropayments", title: "IoT", icon: Cpu },
  { id: "streaming-media", title: "Streaming", icon: Radio },
  { id: "mcp-ai-agent", title: "MCP Agent", icon: Wand2 },
  { id: "cross-chain-bridge", title: "Bridge", icon: ArrowLeftRight },
  { id: "gasless-payment", title: "Gasless", icon: Zap },
  { id: "dex-swap", title: "DEX Swap", icon: Repeat },
];

export default function ScenariosLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isDemo } = useDemoContext();

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[rgba(10,10,11,0.9)] backdrop-blur-xl" style={{ boxShadow: "0 1px 0 rgba(80, 175, 149, 0.08)" }}>
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 h-16 flex items-center justify-between overflow-hidden">
          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/"
              className="flex items-center gap-1.5 sm:gap-2 text-[var(--color-muted)] hover:text-white transition-colors"
              aria-label="Back to home"
            >
              <ArrowLeft size={14} />
              <span className="text-sm font-semibold text-[var(--color-brand)]">T402</span>
            </Link>
            <div className="hidden sm:block">
              <FacilitatorBadge />
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
            <div className="hidden xl:block shrink-0">
              <ChainSelector compact />
            </div>
            <div className="shrink-0">
              <ModeToggle />
            </div>
            <div className="shrink min-w-0">
              <WalletButton />
            </div>
          </div>
        </div>
        {/* Mobile/Tablet chain selector */}
        <div className="md:hidden border-t border-[var(--color-border)] px-4 py-2 overflow-x-auto scrollbar-hide">
          <ChainSelector compact />
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar (desktop) */}
        <aside className="hidden lg:block w-56 shrink-0 border-r border-[var(--color-border)] bg-[#0A0A0B] overflow-y-auto">
          <nav className="p-3 space-y-0.5" aria-label="Scenarios">
            {SCENARIOS.map((s) => {
              const Icon = s.icon;
              const isActive = pathname === `/${s.id}`;
              return (
                <Link
                  key={s.id}
                  href={`/${s.id}`}
                  aria-current={isActive ? "page" : undefined}
                  className={clsx(
                    "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                    isActive
                      ? "bg-[var(--color-surface-active)] text-white"
                      : "text-[var(--color-muted)] hover:text-white hover:bg-[var(--color-surface-hover)]"
                  )}
                  style={isActive ? { borderLeft: "2px solid var(--color-brand)", paddingLeft: "10px" } : undefined}
                >
                  <Icon size={14} style={{ color: isActive ? "var(--color-brand)" : undefined }} aria-hidden="true" />
                  <span>{s.title}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main id="main-content" className="flex-1 overflow-y-auto" role="main">
          {isDemo && (
            <div
              className="text-center text-[10px] font-medium py-1.5 px-4"
              style={{ background: "var(--color-warning-dim)", color: "var(--color-warning)" }}
            >
              Demo Mode — Payments are simulated. Switch to Live for real wallet transactions.
            </div>
          )}
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="p-6 sm:p-8 lg:p-10 pb-24 lg:pb-10"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Bottom nav (mobile) */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--color-border)] bg-[rgba(10,10,11,0.97)] backdrop-blur-xl safe-area-bottom"
        aria-label="Scenario navigation"
      >
        <div className="flex items-center overflow-x-auto px-2 py-2 gap-1 scrollbar-hide scroll-smooth">
          {SCENARIOS.map((s) => {
            const Icon = s.icon;
            const isActive = pathname === `/${s.id}`;
            return (
              <Link
                key={s.id}
                href={`/${s.id}`}
                aria-current={isActive ? "page" : undefined}
                className={clsx(
                  "shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-medium transition-colors",
                  isActive
                    ? "text-white bg-[var(--color-surface-active)]"
                    : "text-[var(--color-muted)]"
                )}
              >
                <Icon size={14} style={{ color: isActive ? "var(--color-brand)" : undefined }} aria-hidden="true" />
                <span>{s.title}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
