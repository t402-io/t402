"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Globe, Bot, Link2 } from "lucide-react";
import { HttpTransport } from "@/components/transports/HttpTransport";
import { McpTransport } from "@/components/transports/McpTransport";
import { A2aTransport } from "@/components/transports/A2aTransport";

type TransportId = "http" | "mcp" | "a2a";

const transports = [
  { id: "http" as const, icon: Globe, label: "HTTP", desc: "REST + Headers", color: "#3B82F6" },
  { id: "mcp" as const, icon: Bot, label: "MCP", desc: "JSON-RPC 402", color: "#8B5CF6" },
  { id: "a2a" as const, icon: Link2, label: "A2A", desc: "Task Messages", color: "#EC4899" },
];

export default function TransportsSection() {
  const [active, setActive] = useState<TransportId>("http");

  return (
    <div className="flex h-full flex-col">
      {/* Transport selector */}
      <div className="flex gap-3 border-b border-[var(--color-border)] px-6 py-4">
        {transports.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={`relative flex items-center gap-3 rounded-xl border px-5 py-3 transition-all cursor-pointer ${
                isActive
                  ? "border-white/10 bg-white/5 text-white"
                  : "border-[var(--color-border)] text-[var(--color-muted)] hover:text-white hover:border-white/10"
              }`}
            >
              <Icon size={18} style={{ color: isActive ? t.color : undefined }} />
              <div className="text-left">
                <div className="text-sm font-medium">{t.label}</div>
                <div className="text-xs text-[var(--color-muted)]">{t.desc}</div>
              </div>
              {isActive && (
                <motion.div
                  layoutId="transport-active"
                  className="absolute inset-0 rounded-xl border-2"
                  style={{ borderColor: `${t.color}50` }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Transport content */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            {active === "http" && <HttpTransport />}
            {active === "mcp" && <McpTransport />}
            {active === "a2a" && <A2aTransport />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
