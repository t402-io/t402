"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { usePaymentFlow, type FlowState } from "@/hooks/usePaymentFlow";
import { useDemoContext } from "@/providers/DemoProvider";
import { Play, Pause, RotateCcw } from "lucide-react";

const steps = [
  { label: "GET Request", desc: "Client requests protected resource", arrow: "Client → Server" },
  { label: "402 Response", desc: "Server returns PaymentRequired", arrow: "Server → Client" },
  { label: "Sign EIP-3009", desc: "Off-chain authorization (gasless)", arrow: "Client signs" },
  { label: "Retry + Sig", desc: "Re-send with PAYMENT-SIGNATURE", arrow: "Client → Server" },
  { label: "Verify & Settle", desc: "Facilitator settles on-chain", arrow: "Server → Facilitator" },
  { label: "200 OK", desc: "Resource delivered to client", arrow: "Server → Client" },
];

const stateToStep: Record<FlowState, number> = {
  idle: -1,
  requesting: 0,
  "got-402": 1,
  signing: 2,
  retrying: 3,
  verifying: 4,
  done: 5,
  error: -1,
};

const stepData = [
  { title: "Initial Request", content: `GET /api/demo/market-data HTTP/1.1\nAccept: application/json` },
  { title: "402 Payment Required", content: `HTTP/1.1 402 Payment Required\nPayment-Required: (base64)\n\n{\n  "t402Version": 2,\n  "accepts": [{\n    "scheme": "exact",\n    "network": "eip155:84532",\n    "amount": "1000",\n    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",\n    "payTo": "0xC88f67e776f16DcFBf42e6bDda1B82604448899B"\n  }]\n}` },
  { title: "EIP-3009 Signature", content: `// TransferWithAuthorization\n{\n  from: "0x742d...bD68",\n  to: "0xC88f67...899B",\n  value: 1000,\n  validAfter: 0,\n  validBefore: 1737654321,\n  nonce: "0x7f3a...9c2e"\n}\n// → wallet.signTypedData()` },
  { title: "Retry with Payment", content: `GET /api/demo/market-data HTTP/1.1\nPayment-Signature: (base64 PaymentPayload)\nAccept: application/json` },
  { title: "Facilitator Response", content: `POST facilitator.t402.io/verify → ✓\nPOST facilitator.t402.io/settle → {\n  "success": true,\n  "transaction": "0xabc123...",\n  "network": "eip155:84532"\n}` },
  { title: "Resource Delivered", content: `HTTP/1.1 200 OK\nPayment-Response: (base64 SettleResponse)\nContent-Type: application/json\n\n{\n  "ticker": "BTC",\n  "price": 98542.50,\n  "change24h": "+2.3%"\n}` },
];

export default function ProtocolSection() {
  const { isDemo } = useDemoContext();
  const flow = usePaymentFlow("/api/demo/market-data");
  const [activeStep, setActiveStep] = useState(-1);
  const [playing, setPlaying] = useState(false);

  const currentStep = flow.state !== "idle" && flow.state !== "error" ? stateToStep[flow.state] : activeStep;

  // Auto-play animation
  useEffect(() => {
    if (!playing) return;
    if (activeStep >= steps.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setActiveStep((s) => s + 1), 1500);
    return () => clearTimeout(timer);
  }, [playing, activeStep]);

  const handlePlay = useCallback(() => {
    if (activeStep >= steps.length - 1) setActiveStep(-1);
    setPlaying(true);
    setActiveStep(0);
  }, [activeStep]);

  const handleReset = useCallback(() => {
    setPlaying(false);
    setActiveStep(-1);
    flow.reset();
  }, [flow]);

  return (
    <div className="flex h-full">
      {/* Left: Sequence Diagram */}
      <div className="flex flex-1 flex-col p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-[var(--text-section)] font-bold text-white">HTTP 402 Flow</h2>
            <p className="text-sm text-[var(--color-muted)]">
              {isDemo ? "Demo mode" : "Live mode — real wallet signing"}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={flow.state === "idle" || flow.state === "done" || flow.state === "error" ? flow.execute : handlePlay}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
            >
              {playing ? <Pause size={14} /> : <Play size={14} />}
              {flow.state === "idle" ? "Send Request" : flow.state === "done" ? "Run Again" : playing ? "Pause" : "Play"}
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-muted)] hover:text-white transition-colors"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>

        {/* Sequence diagram visualization */}
        <div className="flex-1 flex flex-col justify-center">
          <svg viewBox="0 0 600 360" className="w-full max-w-2xl mx-auto" style={{ maxHeight: "calc(100% - 60px)" }}>
            {/* Swim lane labels */}
            <text x="100" y="25" fill="white" fontSize="13" fontWeight="600" textAnchor="middle">Client</text>
            <text x="300" y="25" fill="white" fontSize="13" fontWeight="600" textAnchor="middle">Server</text>
            <text x="500" y="25" fill="white" fontSize="13" fontWeight="600" textAnchor="middle">Facilitator</text>

            {/* Swim lane lines */}
            <line x1="100" y1="40" x2="100" y2="340" stroke="#2A2A2D" strokeWidth="1" strokeDasharray="4 4" />
            <line x1="300" y1="40" x2="300" y2="340" stroke="#2A2A2D" strokeWidth="1" strokeDasharray="4 4" />
            <line x1="500" y1="40" x2="500" y2="340" stroke="#2A2A2D" strokeWidth="1" strokeDasharray="4 4" />

            {/* Arrows for each step */}
            {steps.map((step, i) => {
              const y = 70 + i * 48;
              const isActive = i === currentStep;
              const isDone = i < currentStep;
              const color = isActive ? "#3B82F6" : isDone ? "#50AF95" : "#2A2A2D";
              const opacity = i <= currentStep ? 1 : 0.3;

              // Arrow coordinates based on step
              const arrows: Array<[number, number, number, number]> = [
                [110, y, 290, y],       // Client → Server
                [290, y, 110, y],       // Server → Client
                [85, y, 115, y],        // Client self (sign)
                [110, y, 290, y],       // Client → Server
                [310, y, 490, y],       // Server → Facilitator
                [290, y, 110, y],       // Server → Client
              ];

              const [x1, y1, x2, y2] = arrows[i];

              return (
                <g key={i} opacity={opacity}>
                  <motion.line
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={color}
                    strokeWidth={isActive ? 2 : 1.5}
                    initial={false}
                    animate={{ opacity: i <= currentStep ? 1 : 0.3 }}
                    markerEnd={i !== 2 ? "url(#arrow)" : undefined}
                  />
                  <text
                    x={(x1 + x2) / 2}
                    y={y1 - 8}
                    fill={isActive ? "#3B82F6" : isDone ? "#50AF95" : "#71717A"}
                    fontSize="10"
                    textAnchor="middle"
                  >
                    {step.label}
                  </text>
                  {/* Step number circle */}
                  <circle
                    cx={i === 2 ? 70 : i === 4 ? 500 : x1}
                    cy={y}
                    r={8}
                    fill={isDone ? "#50AF9520" : isActive ? "#3B82F620" : "transparent"}
                    stroke={color}
                    strokeWidth={1}
                  />
                  <text
                    x={i === 2 ? 70 : i === 4 ? 500 : x1}
                    y={y + 3.5}
                    fill={color}
                    fontSize="8"
                    textAnchor="middle"
                  >
                    {i + 1}
                  </text>
                </g>
              );
            })}

            {/* Arrow marker */}
            <defs>
              <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6" fill="none" stroke="currentColor" strokeWidth="1" />
              </marker>
            </defs>
          </svg>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 mt-4">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => { setPlaying(false); setActiveStep(i); }}
                className={`h-2 w-2 rounded-full transition-all ${
                  i === currentStep ? "bg-blue-500 scale-125" : i < currentStep ? "bg-[var(--color-brand)]" : "bg-[var(--color-border)]"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right: HTTP Inspector */}
      <div className="w-[420px] shrink-0 border-l border-[var(--color-border)] flex flex-col">
        <div className="border-b border-[var(--color-border)] px-5 py-3">
          <span className="text-xs text-[var(--color-muted)]">
            {currentStep >= 0 ? `Step ${currentStep + 1}/6: ${steps[currentStep]?.label}` : "Click Play to animate"}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {currentStep >= 0 && currentStep < stepData.length ? (
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="text-sm font-medium text-white mb-3">{stepData[currentStep].title}</div>
              <pre className="rounded-xl border border-[var(--color-border)] bg-[var(--color-code-bg)] p-4 text-[var(--text-code)] text-gray-300 leading-relaxed overflow-x-auto whitespace-pre-wrap">
                {stepData[currentStep].content}
              </pre>
              <p className="mt-4 text-sm text-[var(--color-muted)]">{steps[currentStep].desc}</p>
            </motion.div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">
              Press Play or Space to start the animation
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
