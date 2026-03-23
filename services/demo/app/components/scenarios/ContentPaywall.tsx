"use client";

import { useState, useCallback } from "react";
import { motion } from "motion/react";
import { useDemoContext } from "@/providers/DemoProvider";
import { useMultiChainPayment } from "@/hooks/useMultiChainPayment";
import { PaymentStatus, parsePaymentResponse, type SettleInfo } from "@/components/shared/PaymentStatus";
import type { FlowState } from "@/hooks/usePaymentFlow";
import { CodeBlock } from "@/components/shared/CodeBlock";
import { Spinner } from "@/components/shared/Spinner";
import { encodePaymentHeader } from "@/lib/t402-client";
import { classifyError, getUserFriendlyMessage, getErrorAction } from "@/lib/error-helpers";
import { Lock } from "lucide-react";

type State = "locked" | "paying" | "unlocked" | "error";

interface Article {
  title: string;
  author: string;
  readTime: string;
  content: Array<{ type: string; text: string }>;
}

export function ContentPaywall() {
  const { isDemo } = useDemoContext();
  const { signPayment, activeFamily } = useMultiChainPayment();
  const [state, setState] = useState<State>("locked");
  const [article, setArticle] = useState<Article | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showProtocol, setShowProtocol] = useState(false);
  const [flowState, setFlowState] = useState<FlowState>("idle");
  const [settle, setSettle] = useState<SettleInfo | null>(null);

  const unlock = useCallback(async () => {
    setState("paying");
    setError(null);
    setFlowState("requesting");
    setSettle(null);

    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
        "x-preferred-chain": activeFamily,
      };
      if (isDemo) headers["x-demo-mode"] = "true";

      // Step 1: Get 402
      const initialResponse = await fetch("/api/demo/content", { headers });

      if (initialResponse.status !== 402) {
        throw new Error(`Unexpected status: ${initialResponse.status}`);
      }

      setFlowState("got-402");
      const paymentRequired = await initialResponse.json();
      const requirements = paymentRequired.accepts?.[0];
      if (!requirements) throw new Error("No payment options available");

      // Step 2: Sign via multi-chain hook & retry
      setFlowState("signing");
      const paymentPayload = await signPayment(requirements);

      const retryHeaders: Record<string, string> = {
        Accept: "application/json",
        "x-preferred-chain": activeFamily,
        "Payment-Signature": encodePaymentHeader(paymentPayload),
      };
      if (isDemo) retryHeaders["x-demo-mode"] = "true";

      setFlowState("retrying");
      const retryResponse = await fetch("/api/demo/content", { headers: retryHeaders });

      setFlowState("verifying");
      setSettle(parsePaymentResponse(retryResponse));

      if (!retryResponse.ok) {
        const errBody = await retryResponse.json().catch(() => null);
        const reason = errBody?.reason || errBody?.error || `status ${retryResponse.status}`;
        throw new Error(reason);
      }

      const data = await retryResponse.json();
      setArticle(data.article);
      setState("unlocked");
      setFlowState("done");
    } catch (err) {
      const originalMessage = err instanceof Error ? err.message : String(err);
      setError(originalMessage);
      setState("error");
      setFlowState("error");
    }
  }, [isDemo, activeFamily, signPayment]);

  return (
    <div className="max-w-3xl mx-auto">
      {flowState !== "idle" && (
        <PaymentStatus flowState={flowState} settle={settle} family={activeFamily} />
      )}

      {state === "locked" && (
        <div className="glass-card overflow-hidden">
          {/* Article preview */}
          <div className="p-4 sm:p-6 pb-4">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4">
              <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--color-info-dim)] text-[var(--color-info)]">
                Premium Article
              </span>
              <span className="text-xs text-[var(--color-muted)]">5 min read</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">The Future of Machine-to-Machine Payments</h3>
            <p className="text-sm text-[var(--color-muted)] leading-relaxed">
              As AI agents become increasingly autonomous, they need the ability to pay for resources on behalf of their users...
            </p>
          </div>

          {/* Paywall overlay */}
          <div className="relative">
            <div className="h-20 sm:h-24 bg-gradient-to-b from-transparent to-[var(--color-surface)]" />
            <div className="bg-[var(--color-surface)] p-4 sm:p-6 text-center border-t border-[var(--color-border)]">
              <Lock size={28} className="mb-3" style={{ color: "var(--color-scenario-content)" }} />
              <p className="text-sm text-[var(--color-muted)] mb-4">
                Unlock this article for <span className="text-white font-medium">0.01 USDT</span>
              </p>
              <button
                onClick={unlock}
                className="btn-primary px-6 py-3 min-h-[44px]"
              >
                Pay & Read
              </button>
              <p className="text-xs text-[var(--color-muted)] mt-3">
                No subscription. No account. Just pay once.
              </p>
            </div>
          </div>
        </div>
      )}

      {state === "paying" && (
        <div className="glass-card p-8 sm:p-12 text-center">
          <Spinner size="lg" color="var(--color-brand)" />
          <p className="text-sm text-[var(--color-muted)] mt-4">Processing payment...</p>
          <p className="text-xs text-[var(--color-muted)] mt-1">Signing USDT authorization & settling on-chain</p>
        </div>
      )}

      {state === "unlocked" && article && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--color-success-dim)] text-[var(--color-success)]">
                Unlocked — 0.01 USDT paid
              </span>
              <button
                onClick={() => setShowProtocol(!showProtocol)}
                className="text-xs text-[var(--color-muted)] hover:text-white cursor-pointer"
              >
                {showProtocol ? "Hide" : "Show"} protocol
              </button>
            </div>

            <h3 className="text-xl font-semibold mb-1">{article.title}</h3>
            <p className="text-xs text-[var(--color-muted)] mb-6">
              By {article.author} · {article.readTime}
            </p>

            <div className="space-y-4">
              {article.content.map((block, i) =>
                block.type === "heading" ? (
                  <h4 key={i} className="text-base font-semibold mt-6">{block.text}</h4>
                ) : (
                  <p key={i} className="text-sm text-[var(--color-code-text)] leading-relaxed">{block.text}</p>
                )
              )}
            </div>
          </div>

          {showProtocol && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-4"
            >
              <CodeBlock
                code={`GET /api/demo/content HTTP/1.1
← 402 Payment Required
  { "amount": "10000", "asset": "USDT", "network": "eip155:84532" }

→ Payment-Signature: <base64 EIP-3009 authorization>
← 200 OK
  { "article": { "title": "...", "content": [...] } }`}
                language="http"
                label="Protocol Flow"
                labelColor="var(--color-brand)"
                showCopyButton
              />
            </motion.div>
          )}

          <button
            onClick={() => { setState("locked"); setArticle(null); setFlowState("idle"); setSettle(null); }}
            className="mt-4 text-xs text-[var(--color-muted)] hover:text-white cursor-pointer"
          >
            Reset demo
          </button>
        </motion.div>
      )}

      {state === "error" && (
        <div className="glass-card p-8 text-center">
          <p className="text-sm text-[var(--color-error)]">
            {error ? getUserFriendlyMessage(classifyError(error), error) : "An unknown error occurred."}
          </p>
          {error && (
            <p className="text-[10px] mt-1" style={{ color: "var(--color-muted)" }}>
              {getErrorAction(classifyError(error), activeFamily) || "Try again or switch to Demo mode."}
            </p>
          )}
          <button
            onClick={() => { setState("locked"); setFlowState("idle"); setSettle(null); }}
            className="mt-3 text-xs text-[var(--color-muted)] hover:text-white cursor-pointer"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
}
