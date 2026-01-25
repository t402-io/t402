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
  const { isDemo } = useDemoContext();

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
      <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[rgba(10,10,11,0.9)] backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-[var(--color-muted)] hover:text-white transition-colors"
            >
              <ArrowLeft size={14} />
              <span className="text-sm font-semibold text-[var(--color-brand)]">T402</span>
            </Link>
            <span className="text-xs text-[var(--color-muted)]">/</span>
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
          <h1 className="text-2xl font-bold text-white mb-2">Protocol Playground</h1>
          <p className="text-sm text-[var(--color-muted)]">
            Execute T402 payment flows step-by-step. Watch the HTTP 402 handshake in real time.
          </p>
        </div>

        {/* Controls */}
        <div className="glass-card p-4 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Endpoint selector */}
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider text-[var(--color-muted)] mb-1.5 block">
                Endpoint
              </label>
              <div className="relative">
                <select
                  value={selectedEndpoint}
                  onChange={(e) => { setSelectedEndpoint(Number(e.target.value)); reset(); }}
                  className="w-full appearance-none bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-white pr-8 focus:outline-none focus:border-[var(--color-brand)]"
                >
                  {ENDPOINTS.map((ep, i) => (
                    <option key={ep.path} value={i}>
                      {ep.method} {ep.path} — {ep.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] pointer-events-none" />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-4 sm:pt-0">
              <button
                onClick={executeFlow}
                disabled={step !== "idle" && step !== "done"}
                className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"
              >
                <Play size={14} />
                Execute Flow
              </button>
              {step !== "idle" && (
                <button
                  onClick={reset}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-muted)] hover:text-white border border-[var(--color-border)] rounded-lg transition-colors"
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
                  <pre className="bg-[var(--color-code-bg)] rounded-lg p-3 overflow-x-auto text-xs font-mono text-[var(--color-code-text)] max-h-48 overflow-y-auto">
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
                <div className="glass-card p-4 border-[var(--color-error)]">
                  <p className="text-sm text-[var(--color-error)]">{error}</p>
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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                isActive
                  ? "bg-[var(--color-brand)] text-white"
                  : isPast
                  ? "bg-[var(--color-surface-active)] text-white"
                  : "bg-[var(--color-surface)] text-[var(--color-muted)]"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${
                isActive ? "bg-white animate-pulse" : isPast ? "bg-[var(--color-success)]" : "bg-[var(--color-muted)]"
              }`} />
              {s.label}
            </div>
            {i < steps.length - 1 && (
              <div className={`w-4 h-px ${isPast ? "bg-[var(--color-brand)]" : "bg-[var(--color-border)]"}`} />
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
    <div className={`glass-card p-4 ${highlight ? "border-[var(--color-success)]" : ""}`}>
      <h3 className="text-sm font-medium text-white mb-4">{title}</h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Request */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">Request</span>
            <button
              onClick={() => setShowRequestHeaders(!showRequestHeaders)}
              className="text-[10px] text-[var(--color-brand)] hover:underline"
            >
              {showRequestHeaders ? "Hide" : "Show"} Headers
            </button>
          </div>
          <div className="bg-[var(--color-code-bg)] rounded-lg p-3 space-y-2">
            <div className="text-xs font-mono">
              <span className="text-[var(--syn-keyword)]">{exchange.request.method}</span>{" "}
              <span className="text-[var(--syn-string)]">{exchange.request.url}</span>
            </div>
            {showRequestHeaders && (
              <div className="text-xs font-mono text-[var(--color-code-text-dim)] border-t border-[var(--color-border)] pt-2 space-y-0.5">
                {Object.entries(exchange.request.headers).map(([k, v]) => (
                  <div key={k}>
                    <span className="text-[var(--syn-property)]">{k}</span>:{" "}
                    <span className="text-[var(--syn-string)]">
                      {k === "Payment-Signature" ? v.slice(0, 24) + "..." : v}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {exchange.request.body && (
              <div className="border-t border-[var(--color-border)] pt-2">
                <pre className="text-xs font-mono text-[var(--color-code-text)] whitespace-pre-wrap">
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
              <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">Response</span>
              <CopyButton
                text={exchange.response.body}
                id={`resp-${exchange.response.status}`}
                onCopy={onCopy}
                copied={copied}
              />
            </div>
            <div className="bg-[var(--color-code-bg)] rounded-lg p-3 space-y-2">
              <div className="text-xs font-mono">
                <span className={`font-bold ${
                  exchange.response.status === 402 ? "text-[var(--color-warning)]" :
                  exchange.response.status >= 200 && exchange.response.status < 300 ? "text-[var(--color-success)]" :
                  "text-[var(--color-error)]"
                }`}>
                  {exchange.response.status}
                </span>{" "}
                <span className="text-[var(--color-code-text-dim)]">{exchange.response.statusText}</span>
              </div>
              <div className="border-t border-[var(--color-border)] pt-2">
                <pre className="text-xs font-mono text-[var(--color-code-text)] whitespace-pre-wrap max-h-48 overflow-y-auto">
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
      className="flex items-center gap-1 text-[10px] text-[var(--color-muted)] hover:text-white transition-colors"
    >
      {copied === id ? <Check size={10} className="text-[var(--color-success)]" /> : <Copy size={10} />}
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
