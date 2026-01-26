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
    <div className={clsx("rounded-xl overflow-hidden border border-[var(--color-border)]", className)}>
      <div className="flex overflow-x-auto scrollbar-hide border-b border-[var(--color-border)] bg-[var(--color-code-bg)]">
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => setActive(i)}
            className={clsx(
              "shrink-0 px-3 py-2.5 text-xs font-medium transition-colors min-h-[40px]",
              i === active
                ? "text-white bg-[var(--color-surface-active)]"
                : "text-[var(--color-muted)] hover:text-white"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <CodeBlock code={tabs[active].code} language={tabs[active].language} />
    </div>
  );
}
