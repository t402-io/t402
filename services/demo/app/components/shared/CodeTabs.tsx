"use client";

import { useState } from "react";
import { CodeBlock } from "./CodeBlock";
import { type Language } from "@/lib/syntax-highlighter";
import clsx from "clsx";

interface CodeTabsProps {
  tabs: { label: string; language: Language; code: string }[];
  className?: string;
}

export function CodeTabs({ tabs, className }: CodeTabsProps) {
  const [active, setActive] = useState(0);
  const safeIndex = Math.min(active, tabs.length - 1);

  return (
    <div
      className={clsx("rounded-2xl overflow-hidden", className)}
      style={{ border: "1px solid var(--color-border)" }}
    >
      <div
        className="flex overflow-x-auto scrollbar-hide"
        role="tablist"
        aria-label="Code language"
        style={{ background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }}
      >
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            role="tab"
            aria-selected={i === safeIndex}
            aria-controls={`code-panel-${i}`}
            onClick={() => setActive(i)}
            className={clsx(
              "shrink-0 px-3 py-2.5 text-xs font-medium transition-colors min-h-[40px]",
              i === safeIndex
                ? "text-white"
                : "hover:text-white"
            )}
            style={{
              background: i === safeIndex ? "var(--color-surface-active)" : "transparent",
              color: i === safeIndex ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div id={`code-panel-${safeIndex}`} role="tabpanel">
        <CodeBlock code={tabs[safeIndex].code} language={tabs[safeIndex].language} />
      </div>
    </div>
  );
}
