"use client";

import { useDemoContext, type DemoMode } from "@/providers/DemoProvider";

export function ModeToggle() {
  const { mode, setMode } = useDemoContext();

  return (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5">
      <ModeButton
        label="Demo"
        value="demo"
        active={mode === "demo"}
        color="var(--color-warning)"
        onClick={() => setMode("demo")}
      />
      <ModeButton
        label="Live"
        value="live"
        active={mode === "live"}
        color="var(--color-success)"
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
      className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all ${
        active
          ? "bg-white/10 text-white"
          : "text-[var(--color-muted)] hover:text-white/70"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${active ? "animate-pulse" : ""}`}
        style={{ backgroundColor: active ? color : "var(--color-muted)" }}
      />
      {label}
    </button>
  );
}
