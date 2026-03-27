"use client";

import { useState } from "react";
import { CodeTabs } from "./CodeTabs";
import { getExamplesForScenario, getServerExamplesForScenario, type ScenarioId } from "@/lib/sdk-examples";
import { Code2, Server, ChevronDown } from "lucide-react";
import clsx from "clsx";

interface SdkExamplesProps {
  scenarioId: ScenarioId;
  className?: string;
}

export function SdkExamples({ scenarioId, className }: SdkExamplesProps) {
  const clientExamples = getExamplesForScenario(scenarioId);
  const serverExamples = getServerExamplesForScenario(scenarioId);
  const [view, setView] = useState<"client" | "server">("client");
  const [isExpanded, setIsExpanded] = useState(false);

  if (clientExamples.length === 0 && serverExamples.length === 0) return null;

  const hasServer = serverExamples.length > 0;
  const examples = view === "client" ? clientExamples : serverExamples;

  return (
    <div className={clsx("mt-6", className)}>
      {/* Collapsible header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl transition-colors hover:bg-[var(--color-surface-hover)]"
        aria-expanded={isExpanded}
      >
        <span className="text-xs font-medium text-[var(--color-muted)] flex items-center gap-2">
          <Code2 size={13} style={{ color: "var(--color-brand)" }} />
          SDK Integration
        </span>
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
          style={{ color: "var(--color-text-tertiary)" }}
        />
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="mt-2 animate-slide-up">
          {hasServer && (
            <div className="flex items-center gap-0.5 rounded-xl p-0.5 mb-3 w-fit" role="group" aria-label="Code view" style={{ background: "var(--color-surface)" }}>
              <button
                onClick={() => setView("client")}
                aria-pressed={view === "client"}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: view === "client" ? "var(--color-surface-active)" : "transparent",
                  color: view === "client" ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                }}
              >
                <Code2 size={12} aria-hidden="true" />
                Client
              </button>
              <button
                onClick={() => setView("server")}
                aria-pressed={view === "server"}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: view === "server" ? "var(--color-surface-active)" : "transparent",
                  color: view === "server" ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                }}
              >
                <Server size={12} aria-hidden="true" />
                Server
              </button>
            </div>
          )}
          {examples.length > 0 && <CodeTabs tabs={examples} />}
        </div>
      )}
    </div>
  );
}
