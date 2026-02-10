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
          <Code2 size={14} style={{ color: "#50AF95" }} />
          SDK Integration
        </h3>
        {hasServer && (
          <div
            className="flex items-center gap-0.5 rounded-xl p-0.5"
            style={{ background: "#111113" }}
          >
            <button
              onClick={() => setView("client")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors min-h-[36px]"
              style={{
                background: view === "client" ? "#222224" : "transparent",
                color: view === "client" ? "#FAFAFA" : "#71717A",
              }}
            >
              <Code2 size={12} aria-hidden="true" />
              Client
            </button>
            <button
              onClick={() => setView("server")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors min-h-[36px]"
              style={{
                background: view === "server" ? "#222224" : "transparent",
                color: view === "server" ? "#FAFAFA" : "#71717A",
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
