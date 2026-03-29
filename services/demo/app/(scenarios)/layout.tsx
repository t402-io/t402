"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { WalletButton } from "@/components/layout/WalletButton";
import { ModeToggle } from "@/components/layout/ModeToggle";
import { FacilitatorBadge } from "@/components/layout/FacilitatorBadge";
import { ChainSelector, ChainMismatchBanner } from "@/components/shared/ChainSelector";
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
  const bottomNavRef = useRef<HTMLDivElement>(null);

  // Auto-scroll active item into view in bottom nav
  useEffect(() => {
    if (!bottomNavRef.current) return;
    const activeEl = bottomNavRef.current.querySelector("[aria-current='page']");
    if (activeEl) {
      activeEl.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
    }
  }, [pathname]);

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      {/* Header */}
      <header
        className="sticky top-0 z-50 border-b border-[var(--color-border)]"
        style={{
          background: "linear-gradient(180deg, rgba(10,10,11,0.95), rgba(10,10,11,0.9))",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "0 1px 0 rgba(80, 175, 149, 0.06)",
        }}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 h-12 sm:h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="flex items-center gap-1 text-[var(--color-muted)] hover:text-white transition-colors"
              aria-label="Back to home"
            >
              <ArrowLeft size={13} />
              <span className="text-xs sm:text-sm font-semibold text-[var(--color-brand)]">T402</span>
            </Link>
            <div className="hidden sm:block">
              <FacilitatorBadge />
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <ChainSelector compact />
            <ModeToggle />
            <WalletButton />
          </div>
        </div>
      </header>

      {/* Chain mismatch warning banner */}
      <ChainMismatchBanner />

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
                    "flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all",
                    isActive
                      ? "bg-[var(--color-surface-active)] text-white"
                      : "text-[var(--color-muted)] hover:text-white hover:bg-[var(--color-surface-hover)]"
                  )}
                  style={isActive ? { borderLeft: "2px solid var(--color-brand)", paddingLeft: "10px" } : undefined}
                >
                  <Icon size={15} style={{ color: isActive ? "var(--color-brand)" : undefined }} aria-hidden="true" />
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
              className="flex items-center justify-center gap-2 text-[11px] font-medium py-2 px-4"
              style={{ background: "rgba(245, 158, 11, 0.06)", color: "var(--color-warning)" }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--color-warning)" }} />
              Demo Mode — Payments are simulated
            </div>
          )}
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="p-4 sm:p-8 lg:p-10 pb-24 lg:pb-10"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Bottom nav (mobile) — improved touch targets & active indicator */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--color-border)] safe-area-bottom"
        style={{
          background: "rgba(10, 10, 11, 0.97)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
        aria-label="Scenario navigation"
      >
        <div ref={bottomNavRef} className="flex items-center overflow-x-auto px-1 py-1 gap-0 scrollbar-hide scroll-smooth">
          {SCENARIOS.map((s) => {
            const Icon = s.icon;
            const isActive = pathname === `/${s.id}`;
            return (
              <Link
                key={s.id}
                href={`/${s.id}`}
                aria-current={isActive ? "page" : undefined}
                className={clsx(
                  "relative shrink-0 flex items-center gap-1 px-2.5 py-2 rounded-md text-[10px] font-medium transition-all active:scale-95",
                  isActive
                    ? "text-white bg-[var(--color-surface-active)]"
                    : "text-[var(--color-muted)]"
                )}
              >
                {isActive && (
                  <span
                    className="absolute top-0 left-2 right-2 h-[2px] rounded-full"
                    style={{ background: "var(--color-brand)" }}
                  />
                )}
                <Icon size={13} style={{ color: isActive ? "var(--color-brand)" : undefined }} aria-hidden="true" />
                <span>{s.title}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
