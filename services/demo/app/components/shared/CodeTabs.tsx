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

  return (
    <div
      className={clsx("rounded-2xl overflow-hidden", className)}
      style={{ border: "1px solid var(--color-border)" }}
    >
      <div
        className="flex overflow-x-auto scrollbar-hide"
        style={{ background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }}
      >
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => setActive(i)}
            className={clsx(
              "shrink-0 px-3 py-2.5 text-xs font-medium transition-colors min-h-[40px]",
              i === active
                ? "text-white"
                : "hover:text-white"
            )}
            style={{
              background: i === active ? "var(--color-surface-active)" : "transparent",
              color: i === active ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <CodeBlock code={tabs[active].code} language={tabs[active].language} />
    </div>
  );
}
