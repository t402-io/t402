"use client";

import { useDemoContext, type DemoMode } from "@/providers/DemoProvider";

export function ModeToggle() {
  const { mode, setMode, testnet, setTestnet } = useDemoContext();

  return (
    <div className="flex items-center gap-0.5 sm:gap-1">
      {/* Demo / Live toggle */}
      <div
        className="flex items-center gap-1 rounded-xl p-0.5"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <ModeButton
          label="Demo"
          active={mode === "demo"}
          color="#F59E0B"
          onClick={() => setMode("demo")}
          title="Simulated wallet — no real funds needed"
        />
        <ModeButton
          label="Live"
          active={mode === "live"}
          color="#10B981"
          onClick={() => setMode("live")}
          title="Connect real wallet"
        />
      </div>
      {/* Testnet / Mainnet toggle */}
      <div
        className="flex items-center gap-1 rounded-xl p-0.5"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <ModeButton
          label="Testnet"
          active={testnet}
          color="#6366F1"
          onClick={() => setTestnet(true)}
          title="Use testnet tokens (free)"
        />
        <ModeButton
          label="Mainnet"
          active={!testnet}
          color="#EF4444"
          onClick={() => setTestnet(false)}
          title="Use real mainnet tokens"
        />
      </div>
    </div>
  );
}

function ModeButton({
  label,
  active,
  color,
  onClick,
  title,
}: {
  label: string;
  active: boolean;
  color: string;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex items-center gap-1 sm:gap-1.5 rounded-lg px-1.5 sm:px-2.5 py-1 text-[9px] sm:text-[11px] font-medium transition-all`}
      style={{
        background: active ? "var(--color-border)" : "transparent",
        color: active ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
      }}
      aria-pressed={active}
    >
      <span
        className={`h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full shrink-0 ${active ? "animate-pulse" : ""}`}
        style={{ backgroundColor: active ? color : "var(--color-text-tertiary)" }}
      />
      {label}
    </button>
  );
}
