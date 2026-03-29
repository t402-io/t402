"use client";

import { useDemoContext } from "@/providers/DemoProvider";

export function ModeToggle() {
  const { mode, setMode, testnet, setTestnet } = useDemoContext();

  return (
    <div className="flex items-center gap-0.5">
      {/* Demo / Live — single compact toggle */}
      <div
        className="flex items-center rounded-md p-[2px]"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <ToggleBtn
          label="Demo"
          active={mode === "demo"}
          color="#F59E0B"
          onClick={() => setMode("demo")}
        />
        <ToggleBtn
          label="Live"
          active={mode === "live"}
          color="#10B981"
          onClick={() => setMode("live")}
        />
      </div>

      {/* Testnet / Mainnet — dot toggle on mobile, full buttons on desktop */}
      <button
        onClick={() => setTestnet(!testnet)}
        className="flex items-center gap-1 rounded-md px-1.5 py-[5px] sm:hidden"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        title={testnet ? "Testnet — tap for Mainnet" : "Mainnet — tap for Testnet"}
      >
        <span
          className="h-[5px] w-[5px] rounded-full"
          style={{ backgroundColor: testnet ? "#6366F1" : "#EF4444" }}
        />
        <span className="text-[8px] font-bold" style={{ color: testnet ? "#6366F1" : "#EF4444" }}>
          {testnet ? "T" : "M"}
        </span>
      </button>
      <div
        className="hidden sm:flex items-center rounded-md p-[2px]"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <ToggleBtn label="Testnet" active={testnet} color="#6366F1" onClick={() => setTestnet(true)} />
        <ToggleBtn label="Mainnet" active={!testnet} color="#EF4444" onClick={() => setTestnet(false)} />
      </div>
    </div>
  );
}

function ToggleBtn({ label, active, color, onClick }: { label: string; active: boolean; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-[3px] rounded-[4px] px-[6px] py-[3px] text-[9px] sm:text-[10px] font-semibold transition-all leading-none"
      style={{
        background: active ? "var(--color-border)" : "transparent",
        color: active ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
      }}
      aria-pressed={active}
    >
      <span
        className={`h-[5px] w-[5px] rounded-full shrink-0 ${active ? "animate-pulse" : ""}`}
        style={{ backgroundColor: active ? color : "var(--color-text-tertiary)" }}
      />
      {label}
    </button>
  );
}
