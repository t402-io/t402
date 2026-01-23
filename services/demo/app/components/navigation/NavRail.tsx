"use client";

import { motion } from "motion/react";
import { useNavigation, sections, type SectionId } from "@/providers/NavigationProvider";
import {
  Home,
  FileCode2,
  ArrowLeftRight,
  Globe,
  Code2,
  Zap,
  Activity,
} from "lucide-react";

const sectionIcons: Record<SectionId, React.ComponentType<{ size?: number }>> = {
  overview: Home,
  protocol: FileCode2,
  transports: ArrowLeftRight,
  chains: Globe,
  sdks: Code2,
  advanced: Zap,
  status: Activity,
};

export function NavRail() {
  const { activeSection, setActiveSection, presenterMode } = useNavigation();

  if (presenterMode) return null;

  return (
    <nav className="flex w-16 shrink-0 flex-col items-center border-r border-[var(--color-border)] bg-[var(--color-surface)] py-4 gap-1">
      {sections.map((section, i) => {
        const Icon = sectionIcons[section.id];
        const isActive = activeSection === section.id;

        return (
          <div key={section.id} className="relative group">
            <button
              onClick={() => setActiveSection(section.id)}
              className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
                isActive
                  ? "text-white"
                  : "text-[var(--color-muted)] hover:text-white/70"
              }`}
              title={section.label}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-xl"
                  style={{ backgroundColor: `${section.color}20` }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Icon size={18} />
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r"
                  style={{ backgroundColor: section.color }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
            {/* Tooltip */}
            <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 rounded-lg bg-[var(--color-surface-active)] px-2.5 py-1.5 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 border border-[var(--color-border)]">
              <span className="text-[var(--color-muted)] mr-1.5">{i + 1}</span>
              {section.label}
            </div>
          </div>
        );
      })}

      {/* Bottom: keyboard hint */}
      <div className="mt-auto">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-muted)] text-xs opacity-50">
          ?
        </div>
      </div>
    </nav>
  );
}
