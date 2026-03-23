"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Play, RotateCcw, Copy, Check, ChevronDown } from "lucide-react";
import { WalletButton } from "@/components/layout/WalletButton";
import { ModeToggle } from "@/components/layout/ModeToggle";
import { ChainSelector } from "@/components/shared/ChainSelector";
import { useMultiChainPayment } from "@/hooks/useMultiChainPayment";
import { useDemoContext } from "@/providers/DemoProvider";
import { encodePaymentHeader } from "@/lib/t402-client";

type FlowStep = "idle" | "requesting" | "got-402" | "signing" | "retrying" | "done";

interface HttpExchange {
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
  };
  response?: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
  };
}

const ENDPOINTS = [
  { label: "AI Query", path: "/api/demo/ai-query", method: "POST", body: '{"prompt":"What is T402?"}' },
  { label: "Content", path: "/api/demo/content", method: "GET", body: undefined },
  { label: "Market Data", path: "/api/demo/market-data", method: "GET", body: undefined },
  { label: "IoT Sensor", path: "/api/demo/iot-data", method: "GET", body: undefined },
  { label: "Agent Task", path: "/api/demo/a2a-task", method: "POST", body: '{"task":"analyze","input":"test data"}' },
  { label: "MCP Tool", path: "/api/demo/mcp-tool", method: "POST", body: '{"method":"tools/call","params":{"name":"get_weather","arguments":{"city":"Tokyo"}}}' },
];

export default function PlaygroundPage() {
  const { signPayment, activeFamily } = useMultiChainPayment();
  const { isDemo, testnet } = useDemoContext();

  const [selectedEndpoint, setSelectedEndpoint] = useState(0);
  const [step, setStep] = useState<FlowStep>("idle");
  const [initialExchange, setInitialExchange] = useState<HttpExchange | null>(null);
  const [retryExchange, setRetryExchange] = useState<HttpExchange | null>(null);
  const [paymentPayload, setPaymentPayload] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const endpoint = ENDPOINTS[selectedEndpoint];

  const copyToClipboard = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const reset = useCallback(() => {
    setStep("idle");
    setInitialExchange(null);
    setRetryExchange(null);
    setPaymentPayload(null);
    setError(null);
  }, []);

  const executeFlow = useCallback(async () => {
    reset();
    setStep("requesting");

    try {
      const headers: Record<string, string> = {
        "Accept": "application/json",
        "x-preferred-chain": activeFamily,
        "x-network-mode": testnet ? "testnet" : "mainnet",
      };
      if (isDemo) headers["x-demo-mode"] = "true";
      if (endpoint.body) headers["Content-Type"] = "application/json";

      const request = {
        method: endpoint.method,
        url: endpoint.path,
        headers,
        body: endpoint.body,
      };

      // Step 1: Initial request → 402
      const res = await fetch(endpoint.path, {
        method: endpoint.method,
        headers,
        body: endpoint.body,
      });

      const responseHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => { responseHeaders[k] = v; });
      const responseBody = await res.text();

      setInitialExchange({
        request,
        response: {
          status: res.status,
          statusText: res.statusText,
          headers: responseHeaders,
          body: responseBody,
        },
      });

      if (res.status !== 402) {
        setStep("done");
        return;
      }

      setStep("got-402");

      // Step 2: Sign payment
      await new Promise((r) => setTimeout(r, 800));
      setStep("signing");

      const paymentRequired = JSON.parse(responseBody);
      const requirements = paymentRequired.accepts[0];
      const payload = await signPayment(requirements);
      const encodedPayload = encodePaymentHeader(payload);
      setPaymentPayload(JSON.stringify(payload, null, 2));

      // Step 3: Retry with payment
      setStep("retrying");

      const retryHeaders: Record<string, string> = {
        ...headers,
        "Payment-Signature": encodedPayload,
      };

      const retryRequest = {
        method: endpoint.method,
        url: endpoint.path,
        headers: retryHeaders,
        body: endpoint.body,
      };

      const retryRes = await fetch(endpoint.path, {
        method: endpoint.method,
        headers: retryHeaders,
        body: endpoint.body,
      });

      const retryResponseHeaders: Record<string, string> = {};
      retryRes.headers.forEach((v, k) => { retryResponseHeaders[k] = v; });
      const retryBody = await retryRes.text();

      setRetryExchange({
        request: retryRequest,
        response: {
          status: retryRes.status,
          statusText: retryRes.statusText,
          headers: retryResponseHeaders,
          body: retryBody,
        },
      });

      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setStep("done");
    }
  }, [endpoint, activeFamily, isDemo, signPayment, reset]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header
        className="sticky top-0 z-50 backdrop-blur-xl"
        style={{
          background: "rgba(10, 10, 11, 0.8)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 hover:text-white transition-colors"
              style={{ color: "var(--color-muted)" }}
            >
              <ArrowLeft size={14} />
              <span className="text-sm font-semibold" style={{ color: "var(--color-brand)" }}>T402</span>
            </Link>
            <span className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>/</span>
            <span className="text-sm font-medium text-white">Playground</span>
          </div>
          <div className="flex items-center gap-3">
            <ChainSelector compact />
            <ModeToggle />
            <WalletButton />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        {/* Title */}
        <div className="mb-8">
          <span
            className="inline-block text-xs font-semibold tracking-[0.2em] uppercase mb-3"
            style={{ color: "var(--color-brand)" }}
          >
            PLAYGROUND
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Protocol Playground</h1>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Execute T402 payment flows step-by-step. Watch the HTTP 402 handshake in real time.
          </p>
        </div>

        {/* Controls */}
        <div className="glass-card p-4 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Endpoint selector */}
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider mb-1.5 block" style={{ color: "var(--color-text-tertiary)" }}>
                Endpoint
              </label>
              <div className="relative">
                <select
                  value={selectedEndpoint}
                  onChange={(e) => { setSelectedEndpoint(Number(e.target.value)); reset(); }}
                  className="w-full appearance-none rounded-xl px-3 py-2 text-sm text-white pr-8 focus:outline-none"
                  aria-label="Select API endpoint"
                  style={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  {ENDPOINTS.map((ep, i) => (
                    <option key={ep.path} value={i}>
                      {ep.method} {ep.path} — {ep.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--color-text-tertiary)" }} />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-4 sm:pt-0">
              <button
                onClick={executeFlow}
                disabled={step !== "idle" && step !== "done"}
                className="btn-primary flex items-center gap-2 px-4 py-3 text-sm min-h-[44px]"
              >
                <Play size={14} />
                Execute Flow
              </button>
              {step !== "idle" && (
                <button
                  onClick={reset}
                  className="flex items-center gap-2 px-3 py-3 text-sm hover:text-white rounded-xl transition-colors min-h-[44px]"
                  style={{ color: "var(--color-muted)", border: "1px solid var(--color-border-hover)" }}
                >
                  <RotateCcw size={14} />
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Flow Timeline */}
        <div className="mb-6">
          <FlowTimeline step={step} />
        </div>

        {/* Exchanges */}
        <div className="space-y-6">
          <AnimatePresence mode="popLayout">
            {/* Step 1: Initial Request → 402 */}
            {initialExchange && (
              <motion.div
                key="initial"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <ExchangePanel
                  title="Step 1: Initial Request → 402 Payment Required"
                  exchange={initialExchange}
                  onCopy={copyToClipboard}
                  copied={copied}
                />
              </motion.div>
            )}

            {/* Step 2: Payment Payload */}
            {paymentPayload && (
              <motion.div
                key="payload"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="glass-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-white">Step 2: Signed Payment Payload</h3>
                    <CopyButton
                      text={paymentPayload}
                      id="payload"
                      onCopy={copyToClipboard}
                      copied={copied}
                    />
                  </div>
                  <pre
                    className="rounded-xl p-3 overflow-x-auto text-xs font-mono max-h-48 overflow-y-auto"
                    style={{ background: "var(--color-surface)", color: "var(--color-code-text)", border: "1px solid var(--color-border)" }}
                  >
                    {paymentPayload}
                  </pre>
                </div>
              </motion.div>
            )}

            {/* Step 3: Retry → Success */}
            {retryExchange && (
              <motion.div
                key="retry"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <ExchangePanel
                  title="Step 3: Retry with Payment → Resource Access"
                  exchange={retryExchange}
                  onCopy={copyToClipboard}
                  copied={copied}
                  highlight
                />
              </motion.div>
            )}

            {/* Error */}
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="glass-card p-4" style={{ borderColor: "var(--color-error)" }}>
                  <p className="text-sm" style={{ color: "#EF4444" }}>{error}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function FlowTimeline({ step }: { step: FlowStep }) {
  const steps = [
    { id: "requesting", label: "Request" },
    { id: "got-402", label: "402 Received" },
    { id: "signing", label: "Sign Payment" },
    { id: "retrying", label: "Retry" },
    { id: "done", label: "Complete" },
  ];

  const currentIndex = steps.findIndex((s) => s.id === step);

  return (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
      {steps.map((s, i) => {
        const isActive = s.id === step;
        const isPast = currentIndex > i;
        return (
          <div key={s.id} className="flex items-center gap-1 shrink-0">
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={{
                background: isActive ? "var(--color-brand)" : isPast ? "var(--color-surface-active)" : "var(--color-surface)",
                color: isActive ? "var(--color-background)" : isPast ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
              }}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${isActive ? "animate-pulse" : ""}`}
                style={{
                  background: isActive ? "var(--color-background)" : isPast ? "var(--color-success)" : "var(--color-text-tertiary)",
                }}
              />
              {s.label}
            </div>
            {i < steps.length - 1 && (
              <div
                className="w-4 h-px"
                style={{ background: isPast ? "var(--color-brand)" : "var(--color-border)" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ExchangePanel({
  title,
  exchange,
  onCopy,
  copied,
  highlight,
}: {
  title: string;
  exchange: HttpExchange;
  onCopy: (text: string, id: string) => void;
  copied: string | null;
  highlight?: boolean;
}) {
  const [showRequestHeaders, setShowRequestHeaders] = useState(false);

  return (
    <div
      className="glass-card p-4"
      style={highlight ? { borderColor: "var(--color-success)" } : undefined}
    >
      <h3 className="text-sm font-medium text-white mb-4">{title}</h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Request */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>Request</span>
            <button
              onClick={() => setShowRequestHeaders(!showRequestHeaders)}
              className="text-[10px] hover:underline"
              style={{ color: "var(--color-brand)" }}
            >
              {showRequestHeaders ? "Hide" : "Show"} Headers
            </button>
          </div>
          <div
            className="rounded-xl p-3 space-y-2"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <div className="text-xs font-mono">
              <span style={{ color: "var(--syn-keyword)" }}>{exchange.request.method}</span>{" "}
              <span style={{ color: "var(--syn-string)" }}>{exchange.request.url}</span>
            </div>
            {showRequestHeaders && (
              <div className="text-xs font-mono space-y-0.5 pt-2" style={{ color: "var(--color-code-text-dim)", borderTop: "1px solid var(--color-border)" }}>
                {Object.entries(exchange.request.headers).map(([k, v]) => (
                  <div key={k}>
                    <span style={{ color: "var(--syn-property)" }}>{k}</span>:{" "}
                    <span style={{ color: "var(--syn-string)" }}>
                      {k === "Payment-Signature" ? v.slice(0, 24) + "..." : v}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {exchange.request.body && (
              <div style={{ borderTop: "1px solid var(--color-border)" }} className="pt-2">
                <pre className="text-xs font-mono whitespace-pre-wrap" style={{ color: "var(--color-code-text)" }}>
                  {formatJson(exchange.request.body)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Response */}
        {exchange.response && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>Response</span>
              <CopyButton
                text={exchange.response.body}
                id={`resp-${exchange.response.status}`}
                onCopy={onCopy}
                copied={copied}
              />
            </div>
            <div
              className="rounded-xl p-3 space-y-2"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            >
              <div className="text-xs font-mono">
                <span
                  className="font-bold"
                  style={{
                    color: exchange.response.status === 402 ? "#F59E0B" :
                      exchange.response.status >= 200 && exchange.response.status < 300 ? "var(--color-success)" :
                      "#EF4444"
                  }}
                >
                  {exchange.response.status}
                </span>{" "}
                <span style={{ color: "var(--color-code-text-dim)" }}>{exchange.response.statusText}</span>
              </div>
              <div style={{ borderTop: "1px solid var(--color-border)" }} className="pt-2">
                <pre className="text-xs font-mono whitespace-pre-wrap max-h-48 overflow-y-auto" style={{ color: "var(--color-code-text)" }}>
                  {formatJson(exchange.response.body)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CopyButton({
  text,
  id,
  onCopy,
  copied,
}: {
  text: string;
  id: string;
  onCopy: (text: string, id: string) => void;
  copied: string | null;
}) {
  return (
    <button
      onClick={() => onCopy(text, id)}
      className="flex items-center gap-1 text-[10px] hover:text-white transition-colors"
      style={{ color: "var(--color-muted)" }}
    >
      {copied === id ? <Check size={10} style={{ color: "var(--color-success)" }} /> : <Copy size={10} />}
      {copied === id ? "Copied" : "Copy"}
    </button>
  );
}

function formatJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}
