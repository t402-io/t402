"use client";

import { useEffect, useRef, useState } from "react";

interface MermaidProps {
  chart: string;
  className?: string;
}

export function Mermaid({ chart, className = "" }: MermaidProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function render() {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        themeVariables: {
          darkMode: true,
          background: "#111113",
          primaryColor: "#1a3a2e",
          primaryTextColor: "#FAFAFA",
          primaryBorderColor: "#50AF95",
          secondaryColor: "#1a1a2e",
          secondaryTextColor: "#A1A1AA",
          tertiaryColor: "#0A0A0B",
          lineColor: "#50AF95",
          textColor: "#FAFAFA",
          mainBkg: "#1a3a2e",
          nodeBorder: "#50AF95",
          clusterBkg: "rgba(80,175,149,0.08)",
          clusterBorder: "rgba(80,175,149,0.3)",
          titleColor: "#FAFAFA",
          actorBkg: "#111113",
          actorBorder: "#50AF95",
          actorTextColor: "#FAFAFA",
          actorLineColor: "#50AF95",
          signalColor: "#A1A1AA",
          signalTextColor: "#FAFAFA",
          labelBoxBkgColor: "#111113",
          labelBoxBorderColor: "#50AF95",
          labelTextColor: "#FAFAFA",
          loopTextColor: "#A1A1AA",
          noteBkgColor: "rgba(80,175,149,0.1)",
          noteBorderColor: "#50AF95",
          noteTextColor: "#FAFAFA",
          activationBkgColor: "#1a3a2e",
          activationBorderColor: "#50AF95",
          sequenceNumberColor: "#0A0A0B",
        },
        sequence: {
          actorMargin: 80,
          mirrorActors: false,
          messageMargin: 40,
          boxMargin: 10,
          useMaxWidth: true,
        },
        flowchart: {
          htmlLabels: true,
          curve: "basis",
          useMaxWidth: true,
        },
      });

      const id = `mermaid-${Math.random().toString(36).slice(2, 11)}`;
      try {
        const { svg: rendered } = await mermaid.render(id, chart.trim());
        if (!cancelled) setSvg(rendered);
      } catch {
        // fallback: show raw chart text
        if (!cancelled) setSvg("");
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [chart]);

  if (!svg) {
    return (
      <div
        className={`rounded-xl p-6 font-mono text-sm overflow-x-auto ${className}`}
        style={{ backgroundColor: "#111113", color: "#A1A1AA" }}
      >
        <pre>{chart}</pre>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl p-6 overflow-x-auto [&_svg]:mx-auto [&_svg]:max-w-full ${className}`}
      style={{ backgroundColor: "#111113" }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
