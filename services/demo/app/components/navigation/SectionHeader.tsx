"use client";

import { motion, AnimatePresence } from "motion/react";
import { useNavigation, sections } from "@/providers/NavigationProvider";
import { FacilitatorBadge } from "@/components/layout/FacilitatorBadge";
import { ModeToggle } from "@/components/layout/ModeToggle";
import { WalletButton } from "@/components/layout/WalletButton";
import { Maximize2, Minimize2 } from "lucide-react";

export function SectionHeader() {
  const { activeSection, presenterMode, togglePresenterMode } = useNavigation();
  const current = sections.find((s) => s.id === activeSection);

  return (
    <header className="flex h-12 shrink-0 items-center border-b border-[var(--color-border)] px-5 gap-4">
      {/* Left: Logo + badge */}
      <div className="flex items-center gap-2.5">
        <span className="text-sm font-semibold text-white tracking-tight">T402</span>
        <span className="rounded-md bg-[var(--color-brand)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-brand)]">
          Demo
        </span>
      </div>

      {/* Center: Section title */}
      <div className="flex-1 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.span
            key={activeSection}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="text-sm font-medium"
            style={{ color: current?.color }}
          >
            {current?.label}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-3">
        <FacilitatorBadge />
        <ModeToggle />
        <WalletButton />
        <button
          onClick={togglePresenterMode}
          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-muted)] hover:text-white transition-colors"
          title={presenterMode ? "Exit presenter (F)" : "Presenter mode (F)"}
        >
          {presenterMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>
    </header>
  );
}
