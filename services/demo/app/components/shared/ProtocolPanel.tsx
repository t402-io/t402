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
    <div
      className={clsx("rounded-2xl overflow-hidden", className)}
      style={{ border: "1px solid rgba(255, 255, 255, 0.08)" }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-xs font-medium hover:text-white transition-colors min-h-[44px]"
        style={{ background: "#111113", color: "#A1A1AA" }}
        aria-expanded={open}
      >
        <span>{title}</span>
        {open ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
      </button>
      {open && (
        <div>
          {sections.map((section) => (
            <div
              key={section.label}
              className="px-3 sm:px-4 py-3"
              style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}
            >
              <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "#71717A" }}>{section.label}</p>
              <CodeBlock code={section.content} language={section.language || "json"} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
