"use client";

import { useDemoContext, type DemoMode } from "@/providers/DemoProvider";

export function ModeToggle() {
  const { mode, setMode } = useDemoContext();

  return (
    <div
      className="flex items-center gap-1 rounded-xl p-0.5"
      style={{ background: "#111113", border: "1px solid rgba(255, 255, 255, 0.08)" }}
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
        background: active ? "rgba(255, 255, 255, 0.08)" : "transparent",
        color: active ? "#FAFAFA" : "#71717A",
      }}
      aria-pressed={active}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full shrink-0 ${active ? "animate-pulse" : ""}`}
        style={{ backgroundColor: active ? color : "#71717A" }}
      />
      {label}
    </button>
  );
}
