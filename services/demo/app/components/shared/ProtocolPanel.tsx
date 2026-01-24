"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { CodeBlock } from "./CodeBlock";
import { type Language } from "@/lib/syntax-highlighter";
import clsx from "clsx";

interface ProtocolPanelProps {
  title?: string;
  sections: { label: string; content: string; language?: Language }[];
  className?: string;
  defaultOpen?: boolean;
}

export function ProtocolPanel({ title = "Protocol Details", sections, className, defaultOpen = false }: ProtocolPanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={clsx("border border-[var(--color-border)] rounded-xl overflow-hidden", className)}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs font-medium text-[var(--color-muted)] hover:text-white transition-colors bg-[var(--color-surface)]"
        aria-expanded={open}
      >
        <span>{title}</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div className="divide-y divide-[var(--color-border)]">
          {sections.map((section) => (
            <div key={section.label} className="px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-[var(--color-muted)] mb-2">{section.label}</p>
              <CodeBlock code={section.content} language={section.language || "json"} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
