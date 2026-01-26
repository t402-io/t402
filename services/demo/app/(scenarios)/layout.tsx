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
  ArrowLeft,
} from "lucide-react";
import clsx from "clsx";
import type { ReactNode } from "react";

const SCENARIOS = [
  { id: "ai-api", title: "AI API", icon: Brain, color: "var(--color-scenario-ai)" },
  { id: "content-paywall", title: "Paywall", icon: FileText, color: "var(--color-scenario-content)" },
  { id: "data-marketplace", title: "Data Market", icon: Database, color: "var(--color-scenario-data)" },
  { id: "agent-to-agent", title: "Agent-to-Agent", icon: Bot, color: "var(--color-scenario-agent)" },
  { id: "iot-micropayments", title: "IoT", icon: Cpu, color: "var(--color-scenario-iot)" },
  { id: "streaming-media", title: "Streaming", icon: Radio, color: "var(--color-scenario-stream)" },
  { id: "mcp-ai-agent", title: "MCP Agent", icon: Wand2, color: "var(--color-scenario-mcp)" },
  { id: "cross-chain-bridge", title: "Bridge", icon: ArrowLeftRight, color: "var(--color-scenario-bridge)" },
  { id: "gasless-payment", title: "Gasless", icon: Zap, color: "var(--color-scenario-gasless)" },
];

export default function ScenariosLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[rgba(10,10,11,0.9)] backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
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
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden md:block">
              <ChainSelector compact />
            </div>
            <ModeToggle />
            <WalletButton />
          </div>
        </div>
        {/* Mobile/Tablet chain selector */}
        <div className="md:hidden border-t border-[var(--color-border)] px-4 py-2 overflow-x-auto scrollbar-hide">
          <ChainSelector compact />
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar (desktop) */}
        <aside className="hidden lg:block w-56 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] overflow-y-auto">
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
                >
                  <Icon size={14} style={{ color: isActive ? s.color : undefined }} aria-hidden="true" />
                  <span>{s.title}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto" role="main">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
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
        {/* Scroll fade indicators */}
        <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-[rgba(10,10,11,0.97)] to-transparent pointer-events-none z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-[rgba(10,10,11,0.97)] to-transparent pointer-events-none z-10" />
        <div className="flex items-center overflow-x-auto px-3 py-2.5 gap-1 scrollbar-hide scroll-smooth snap-x snap-mandatory">
          {SCENARIOS.map((s) => {
            const Icon = s.icon;
            const isActive = pathname === `/${s.id}`;
            return (
              <Link
                key={s.id}
                href={`/${s.id}`}
                aria-current={isActive ? "page" : undefined}
                className={clsx(
                  "shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-medium transition-all min-w-[56px] snap-center active:scale-95",
                  isActive
                    ? "text-white bg-[var(--color-surface-active)]"
                    : "text-[var(--color-muted)] active:bg-[var(--color-surface)]"
                )}
              >
                <Icon size={16} style={{ color: isActive ? s.color : undefined }} aria-hidden="true" />
                <span className="truncate max-w-[48px]">{s.title}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
