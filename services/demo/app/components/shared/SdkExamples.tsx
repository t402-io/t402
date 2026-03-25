"use client";

import { useState } from "react";
import { CodeTabs } from "./CodeTabs";
import { getExamplesForScenario, getServerExamplesForScenario, type ScenarioId } from "@/lib/sdk-examples";
import { Code2, Server } from "lucide-react";
import clsx from "clsx";

interface SdkExamplesProps {
  scenarioId: ScenarioId;
  className?: string;
}

export function SdkExamples({ scenarioId, className }: SdkExamplesProps) {
  const clientExamples = getExamplesForScenario(scenarioId);
  const serverExamples = getServerExamplesForScenario(scenarioId);
  const [view, setView] = useState<"client" | "server">("client");

  if (clientExamples.length === 0 && serverExamples.length === 0) return null;

  const hasServer = serverExamples.length > 0;
  const examples = view === "client" ? clientExamples : serverExamples;

  return (
    <div className={clsx("mt-8", className)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-white flex items-center gap-2">
          <Code2 size={14} style={{ color: "var(--color-brand)" }} />
          SDK Integration
        </h3>
        {hasServer && (
          <div
            className="flex items-center gap-0.5 rounded-xl p-0.5"
            role="group"
            aria-label="Code view"
            style={{ background: "var(--color-surface)" }}
          >
            <button
              onClick={() => setView("client")}
              aria-pressed={view === "client"}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors min-h-[36px]"
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
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors min-h-[36px]"
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
      </div>
      {examples.length > 0 && <CodeTabs tabs={examples} />}
    </div>
  );
}
