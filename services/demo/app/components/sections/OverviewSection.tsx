"use client";

import { motion } from "motion/react";
import { useNavigation, sections } from "@/providers/NavigationProvider";
import { useFacilitatorStatus } from "@/hooks/useFacilitatorStatus";
import {
  FileCode2,
  ArrowLeftRight,
  Globe,
  Code2,
  Zap,
  Activity,
} from "lucide-react";
import type { SectionId } from "@/providers/NavigationProvider";

const featureCards: Array<{
  section: SectionId;
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  description: string;
  color: string;
}> = [
  { section: "protocol", icon: FileCode2, title: "Protocol Flow", description: "Interactive HTTP 402 sequence diagram", color: "#3B82F6" },
  { section: "transports", icon: ArrowLeftRight, title: "Transports", description: "HTTP, MCP, and A2A demos", color: "#8B5CF6" },
  { section: "chains", icon: Globe, title: "Chain Atlas", description: "25+ supported blockchains", color: "#10B981" },
  { section: "sdks", icon: Code2, title: "SDK Gallery", description: "TypeScript, Python, Go, Java", color: "#06B6D4" },
  { section: "advanced", icon: Zap, title: "Advanced", description: "Gasless, Bridge, Multisig, Paywall", color: "#F59E0B" },
  { section: "status", icon: Activity, title: "Live Status", description: "Facilitator dashboard", color: "#50AF95" },
];

export default function OverviewSection() {
  const { setActiveSection } = useNavigation();
  const { online, supportedNetworks } = useFacilitatorStatus();

  return (
    <div className="flex h-full flex-col items-center justify-center p-8">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-10"
      >
        <h1
          className="font-bold tracking-tight text-white mb-3"
          style={{ fontSize: "var(--text-hero)" }}
        >
          T402 Protocol
        </h1>
        <p className="text-lg text-[var(--color-muted)] max-w-xl mx-auto">
          HTTP-Native Payments for USDT — Request, Sign, Settle
        </p>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="flex gap-6 mb-12"
      >
        <StatCard value={supportedNetworks || 25} label="Chains" />
        <StatCard value={4} label="SDKs" />
        <StatCard value={3} label="Transports" />
        <StatusDot online={online} />
      </motion.div>

      {/* Feature Cards Grid */}
      <div className="grid grid-cols-3 gap-4 max-w-3xl w-full">
        {featureCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.button
              key={card.section}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.08, duration: 0.4 }}
              onClick={() => setActiveSection(card.section)}
              className="glass-card p-5 text-left group hover:border-white/10 transition-all cursor-pointer"
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg mb-3"
                style={{ backgroundColor: `${card.color}15` }}
              >
                <Icon size={18} />
              </div>
              <div className="text-sm font-medium text-white mb-1">{card.title}</div>
              <div className="text-xs text-[var(--color-muted)]">{card.description}</div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="glass-card px-6 py-4 text-center">
      <div className="text-2xl font-bold text-white">{value}+</div>
      <div className="text-xs text-[var(--color-muted)] mt-0.5">{label}</div>
    </div>
  );
}

function StatusDot({ online }: { online: boolean }) {
  return (
    <div className="glass-card px-6 py-4 text-center">
      <div className="flex items-center justify-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${online ? "bg-green-400" : "bg-red-400"}`} />
        <span className="text-sm font-medium text-white">{online ? "Online" : "Offline"}</span>
      </div>
      <div className="text-xs text-[var(--color-muted)] mt-0.5">Facilitator</div>
    </div>
  );
}
