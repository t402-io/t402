"use client";

import { useEffect, useState } from "react";
import type { FlowState } from "@/hooks/usePaymentFlow";

interface FlowDiagramProps {
  /** Current flow state — highlights the active step */
  state?: FlowState;
  /** If true, auto-animates through steps in a loop */
  autoPlay?: boolean;
  /** Compact mode for inline usage */
  compact?: boolean;
}

const STEPS = [
  { id: "request", label: "Request", sublabel: "GET /resource" },
  { id: "402", label: "402", sublabel: "Payment Required" },
  { id: "sign", label: "Sign", sublabel: "Off-chain auth" },
  { id: "retry", label: "Retry", sublabel: "+ Payment header" },
  { id: "settle", label: "Settle", sublabel: "On-chain tx" },
  { id: "access", label: "Access", sublabel: "200 OK" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

function flowStateToStep(state: FlowState): StepId | null {
  switch (state) {
    case "requesting": return "request";
    case "got-402": return "402";
    case "signing": return "sign";
    case "retrying": return "retry";
    case "verifying": return "settle";
    case "done": return "access";
    default: return null;
  }
}

export function FlowDiagram({ state = "idle", autoPlay = false, compact = false }: FlowDiagramProps) {
  const [autoStep, setAutoStep] = useState(0);

  useEffect(() => {
    if (!autoPlay) return;
    const interval = setInterval(() => {
      setAutoStep((prev) => (prev + 1) % (STEPS.length + 2)); // +2 for pause at end
    }, 1200);
    return () => clearInterval(interval);
  }, [autoPlay]);

  const activeStep = autoPlay
    ? (autoStep < STEPS.length ? STEPS[autoStep].id : null)
    : flowStateToStep(state);

  const activeIndex = activeStep ? STEPS.findIndex((s) => s.id === activeStep) : -1;

  const height = compact ? 80 : 120;
  const nodeRadius = compact ? 16 : 22;
  const fontSize = compact ? 9 : 11;
  const subFontSize = compact ? 7 : 9;

  // Layout constants
  const padding = 40;
  const viewWidth = 620;
  const usableWidth = viewWidth - padding * 2;
  const stepSpacing = usableWidth / (STEPS.length - 1);
  const cy = height / 2;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${viewWidth} ${height}`}
        className="w-full min-w-[400px]"
        role="img"
        aria-label="T402 protocol flow diagram"
      >
        {/* Connection lines */}
        {STEPS.map((_, i) => {
          if (i === STEPS.length - 1) return null;
          const x1 = padding + i * stepSpacing + nodeRadius;
          const x2 = padding + (i + 1) * stepSpacing - nodeRadius;
          const isActive = i < activeIndex;
          const isCurrent = i === activeIndex;

          return (
            <g key={`line-${i}`}>
              {/* Background line */}
              <line
                x1={x1} y1={cy} x2={x2} y2={cy}
                stroke="var(--color-border)"
                strokeWidth={2}
              />
              {/* Active line overlay */}
              {(isActive || isCurrent) && (
                <line
                  x1={x1} y1={cy} x2={x2} y2={cy}
                  stroke="var(--color-brand)"
                  strokeWidth={2}
                  strokeDasharray={isCurrent ? "6 3" : "none"}
                  className={isCurrent ? "animate-pulse" : ""}
                >
                  {isCurrent && (
                    <animate
                      attributeName="stroke-dashoffset"
                      from="9" to="0"
                      dur="0.6s"
                      repeatCount="indefinite"
                    />
                  )}
                </line>
              )}
              {/* Direction arrow */}
              <polygon
                points={`${x2 - 4},${cy - 4} ${x2},${cy} ${x2 - 4},${cy + 4}`}
                fill={isActive || isCurrent ? "var(--color-brand)" : "var(--color-border)"}
              />
            </g>
          );
        })}

        {/* Step nodes */}
        {STEPS.map((step, i) => {
          const cx = padding + i * stepSpacing;
          const isActive = i <= activeIndex;
          const isCurrent = i === activeIndex;

          return (
            <g key={step.id}>
              {/* Glow effect for current step */}
              {isCurrent && (
                <circle
                  cx={cx} cy={cy} r={nodeRadius + 4}
                  fill="none"
                  stroke="var(--color-brand)"
                  strokeWidth={2}
                  opacity={0.3}
                  className="animate-pulse"
                />
              )}
              {/* Node circle */}
              <circle
                cx={cx} cy={cy} r={nodeRadius}
                fill={isActive ? "var(--color-brand)" : "var(--color-surface)"}
                stroke={isActive ? "var(--color-brand)" : "var(--color-border)"}
                strokeWidth={2}
                className="transition-all duration-300"
              />
              {/* Step label */}
              <text
                x={cx} y={cy + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={fontSize}
                fontWeight={600}
                fill={isActive ? "white" : "var(--color-muted)"}
                className="transition-all duration-300 select-none"
                fontFamily="var(--font-mono)"
              >
                {step.label}
              </text>
              {/* Sublabel */}
              {!compact && (
                <text
                  x={cx} y={cy + nodeRadius + 14}
                  textAnchor="middle"
                  fontSize={subFontSize}
                  fill="var(--color-muted)"
                  className="select-none"
                >
                  {step.sublabel}
                </text>
              )}
            </g>
          );
        })}

        {/* Actor labels */}
        {!compact && (
          <>
            <text x={padding} y={12} textAnchor="middle" fontSize={9} fill="var(--color-muted)" className="select-none">
              Client
            </text>
            <text x={padding + stepSpacing} y={12} textAnchor="middle" fontSize={9} fill="var(--color-muted)" className="select-none">
              Server
            </text>
            <text x={padding + 2 * stepSpacing} y={12} textAnchor="middle" fontSize={9} fill="var(--color-muted)" className="select-none">
              Wallet
            </text>
            <text x={padding + 3 * stepSpacing} y={12} textAnchor="middle" fontSize={9} fill="var(--color-muted)" className="select-none">
              Client
            </text>
            <text x={padding + 4 * stepSpacing} y={12} textAnchor="middle" fontSize={9} fill="var(--color-muted)" className="select-none">
              Facilitator
            </text>
            <text x={padding + 5 * stepSpacing} y={12} textAnchor="middle" fontSize={9} fill="var(--color-muted)" className="select-none">
              Server
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
