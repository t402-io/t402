"use client";

import { useDemoContext, type DemoMode } from "@/providers/DemoProvider";

export function ModeToggle() {
  const { mode, setMode } = useDemoContext();

  return (
    <div
      className="flex items-center gap-1 rounded-xl p-0.5"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <ModeButton
        label="Demo"
        value="demo"
        active={mode === "demo"}
        color="#F59E0B"
        onClick={() => setMode("demo")}
      />
      <ModeButton
        label="Live"
        value="live"
        active={mode === "live"}
        color="#10B981"
        onClick={() => setMode("live")}
      />
    </div>
  );
}

function ModeButton({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  value: DemoMode;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 sm:gap-1.5 rounded-lg px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-medium transition-all`}
      style={{
        background: active ? "var(--color-border)" : "transparent",
        color: active ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
      }}
      aria-pressed={active}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full shrink-0 ${active ? "animate-pulse" : ""}`}
        style={{ backgroundColor: active ? color : "var(--color-text-tertiary)" }}
      />
      {label}
    </button>
  );
}
