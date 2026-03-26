"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { useDemoContext } from "@/providers/DemoProvider";
import { useMultiChainPayment } from "@/hooks/useMultiChainPayment";
import { PaymentStatus, parsePaymentResponse, type SettleInfo } from "@/components/shared/PaymentStatus";
import type { FlowState } from "@/hooks/usePaymentFlow";
import { CodeBlock } from "@/components/shared/CodeBlock";
import { Spinner } from "@/components/shared/Spinner";
import { encodePaymentHeader } from "@/lib/t402-client";
import { Repeat, ArrowDown, ChevronDown } from "lucide-react";

type State = "idle" | "quoting" | "quoted" | "paying" | "swapping" | "done" | "error";

interface Token {
  symbol: string;
  address: string;
  decimals: number;
}

interface SwapQuote {
  srcSymbol: string;
  srcAmount: string;
  destSymbol: string;
  destAmount: string;
  destAmountFormatted: string;
  rate: string;
  priceImpact: string;
  gasCostUSD: string;
  route: string[];
  estimatedGas: string;
}

const TOKENS: Token[] = [
  { symbol: "USDT", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 },
  { symbol: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
  { symbol: "ETH", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 },
  { symbol: "WBTC", address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", decimals: 8 },
  { symbol: "ARB", address: "0x912CE59144191C1204E64559FE8253a0e49E6548", decimals: 18 },
  { symbol: "LINK", address: "0xf97f4df75117a78c1A5a0DBb814Af92458539FB4", decimals: 18 },
  { symbol: "UNI", address: "0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0", decimals: 18 },
  { symbol: "DAI", address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", decimals: 18 },
];

export function DexSwap() {
  const { isDemo, testnet } = useDemoContext();
  const { signPayment, activeFamily, activeNetwork } = useMultiChainPayment();

  const [srcToken, setSrcToken] = useState<Token>(TOKENS[0]); // USDT
  const [destToken, setDestToken] = useState<Token>(TOKENS[2]); // ETH
  const [amount, setAmount] = useState("10");
  const [state, setState] = useState<State>("idle");
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [executedQuote, setExecutedQuote] = useState<SwapQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [swaps, setSwaps] = useState(0);
  const [flowState, setFlowState] = useState<FlowState>("idle");
  const [settle, setSettle] = useState<SettleInfo | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tokens available for dest (exclude srcToken)
  const destOptions = useMemo(
    () => TOKENS.filter((t) => t.address !== srcToken.address),
    [srcToken]
  );

  // Tokens available for src (exclude destToken)
  const srcOptions = useMemo(
    () => TOKENS.filter((t) => t.address !== destToken.address),
    [destToken]
  );

  // Convert user amount to smallest units
  const amountInSmallestUnits = useMemo(() => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return null;
    return (BigInt(Math.round(num * Math.pow(10, srcToken.decimals)))).toString();
  }, [amount, srcToken]);

  // Auto-fetch free quote when inputs change (debounced 500ms)
  useEffect(() => {
    // Don't fetch while paying/swapping/done
    if (state === "paying" || state === "swapping" || state === "done") return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    if (!amountInSmallestUnits) {
      setQuote(null);
      if (state === "quoted" || state === "quoting") setState("idle");
      return;
    }

    setQuoteLoading(true);

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        setState((prev) => (prev === "idle" || prev === "quoted" || prev === "error") ? "quoting" : prev);

        const params = new URLSearchParams({
          srcToken: srcToken.address,
          destToken: destToken.address,
          amount: amountInSmallestUnits,
          srcDecimals: String(srcToken.decimals),
          destDecimals: String(destToken.decimals),
        });

        const res = await fetch(`/api/demo/swap?${params}`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => null);
          throw new Error(errBody?.error || `Quote failed (${res.status})`);
        }

        const data = await res.json();
        setQuote(data.quote);
        setQuoteLoading(false);
        setState("quoted");
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setQuote(null);
        setQuoteLoading(false);
        // Don't go to full error state for quote failures - just show idle
        setState("idle");
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [srcToken, destToken, amountInSmallestUnits]); // eslint-disable-line react-hooks/exhaustive-deps

  const execute = useCallback(async () => {
    if (!amountInSmallestUnits) return;

    setState("paying");
    setExecutedQuote(null);
    setError(null);
    setFlowState("requesting");
    setSettle(null);

    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-preferred-chain": activeFamily,
        "x-network-mode": testnet ? "testnet" : "mainnet",
        ...(activeNetwork ? { "x-preferred-network": activeNetwork } : {}),
      };
      if (isDemo) headers["x-demo-mode"] = "true";

      const body = JSON.stringify({
        srcToken: srcToken.address,
        destToken: destToken.address,
        amount: amountInSmallestUnits,
        srcDecimals: srcToken.decimals,
        destDecimals: destToken.decimals,
      });

      // Step 1: Get 402
      const initialResponse = await fetch("/api/demo/swap", {
        method: "POST",
        headers,
        body,
      });

      if (initialResponse.status !== 402) {
        throw new Error(`Unexpected status: ${initialResponse.status}`);
      }

      setFlowState("got-402");
      const paymentRequired = await initialResponse.json();
      const requirements = paymentRequired.accepts?.[0];
      if (!requirements) throw new Error("No payment options available");

      // Step 2: Sign via multi-chain hook
      setFlowState("signing");
      const paymentPayload = await signPayment(requirements, (step) => {
        if (step === "approving") setFlowState("approving");
        if (step === "signing") setFlowState("signing");
      });

      // Step 3: Retry with payment — execute the swap
      const retryHeaders: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-preferred-chain": activeFamily,
        "x-network-mode": testnet ? "testnet" : "mainnet",
        ...(activeNetwork ? { "x-preferred-network": activeNetwork } : {}),
        "Payment-Signature": encodePaymentHeader(paymentPayload),
      };
      if (isDemo) retryHeaders["x-demo-mode"] = "true";

      setState("swapping");
      setFlowState("retrying");
      const retryResponse = await fetch("/api/demo/swap", {
        method: "POST",
        headers: retryHeaders,
        body,
      });

      setFlowState("verifying");
      setSettle(parsePaymentResponse(retryResponse));

      if (!retryResponse.ok) {
        const errBody = await retryResponse.json().catch(() => null);
        const reason = errBody?.reason || errBody?.error || `status ${retryResponse.status}`;
        throw new Error(reason);
      }

      const data = await retryResponse.json();
      setExecutedQuote(data.quote);
      setSwaps((n) => n + 1);
      setState("done");
      setFlowState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
      setFlowState("error");
    }
  }, [isDemo, testnet, activeFamily, activeNetwork, signPayment, srcToken, destToken, amountInSmallestUnits]);

  const handleSrcChange = (symbol: string) => {
    const token = TOKENS.find((t) => t.symbol === symbol);
    if (token) {
      setSrcToken(token);
      // If new src equals current dest, swap them
      if (token.address === destToken.address) {
        setDestToken(srcToken);
      }
    }
  };

  const handleDestChange = (symbol: string) => {
    const token = TOKENS.find((t) => t.symbol === symbol);
    if (token) {
      setDestToken(token);
      if (token.address === srcToken.address) {
        setSrcToken(destToken);
      }
    }
  };

  const swapTokens = () => {
    setSrcToken(destToken);
    setDestToken(srcToken);
  };

  const reset = () => {
    setState("idle");
    setQuote(null);
    setExecutedQuote(null);
    setFlowState("idle");
    setSettle(null);
    setError(null);
  };

  // Button label
  const buttonLabel = useMemo(() => {
    const num = parseFloat(amount);
    if (state === "paying") return null; // spinner shown instead
    if (state === "swapping") return null;
    if (!amount || isNaN(num) || num <= 0) return "Enter an amount";
    return `Swap ${amount} ${srcToken.symbol} \u2192 ${destToken.symbol}`;
  }, [amount, srcToken.symbol, destToken.symbol, state]);

  const isButtonDisabled = state === "paying" || state === "swapping" || !amountInSmallestUnits;

  return (
    <>
      {flowState !== "idle" && (
        <PaymentStatus flowState={flowState} settle={settle} family={activeFamily} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Swap form */}
        <div className="flex flex-col gap-4">
          <div className="glass-card p-5">
            <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
              <Repeat size={14} style={{ color: "var(--color-scenario-swap)" }} />
              Swap on Arbitrum
            </h4>

            {/* From token */}
            <div className="space-y-3">
              <div
                className="rounded-lg p-3"
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
              >
                <label className="text-[10px] uppercase tracking-wider text-[var(--color-muted)] mb-1.5 block">
                  From
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <select
                      value={srcToken.symbol}
                      onChange={(e) => handleSrcChange(e.target.value)}
                      disabled={state === "paying" || state === "swapping"}
                      className="appearance-none bg-[var(--color-surface-active)] text-white text-sm font-medium px-3 py-2 pr-7 rounded-lg border border-[var(--color-border)] cursor-pointer focus:outline-none focus:border-[var(--color-brand)]"
                    >
                      {srcOptions.map((t) => (
                        <option key={t.symbol} value={t.symbol}>
                          {t.symbol}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={12}
                      className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-muted)]"
                    />
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={state === "paying" || state === "swapping"}
                    placeholder="0.00"
                    className="flex-1 bg-transparent text-right text-lg font-medium text-white placeholder-[var(--color-text-tertiary)] focus:outline-none min-w-0"
                  />
                </div>
              </div>

              {/* Swap direction button */}
              <div className="flex justify-center -my-1">
                <button
                  onClick={swapTokens}
                  disabled={state === "paying" || state === "swapping"}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-[var(--color-surface-active)] cursor-pointer"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                  aria-label="Swap tokens"
                >
                  <ArrowDown size={14} className="text-[var(--color-muted)]" />
                </button>
              </div>

              {/* To token */}
              <div
                className="rounded-lg p-3"
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
              >
                <label className="text-[10px] uppercase tracking-wider text-[var(--color-muted)] mb-1.5 block">
                  To
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <select
                      value={destToken.symbol}
                      onChange={(e) => handleDestChange(e.target.value)}
                      disabled={state === "paying" || state === "swapping"}
                      className="appearance-none bg-[var(--color-surface-active)] text-white text-sm font-medium px-3 py-2 pr-7 rounded-lg border border-[var(--color-border)] cursor-pointer focus:outline-none focus:border-[var(--color-brand)]"
                    >
                      {destOptions.map((t) => (
                        <option key={t.symbol} value={t.symbol}>
                          {t.symbol}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={12}
                      className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-muted)]"
                    />
                  </div>
                  <div className="flex-1 text-right text-lg font-medium">
                    {quoteLoading ? (
                      <span className="inline-flex items-center gap-1.5 text-[var(--color-text-tertiary)]">
                        <Spinner size="sm" color="var(--color-muted)" />
                      </span>
                    ) : quote && (state === "quoted" || state === "quoting") ? (
                      <span className="text-white">{quote.destAmountFormatted}</span>
                    ) : executedQuote && state === "done" ? (
                      <span className="text-white">{executedQuote.destAmountFormatted}</span>
                    ) : (
                      <span className="text-[var(--color-text-tertiary)]">&mdash;</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Live Quote preview — shown when quote loaded, before payment */}
          {quote && (state === "quoted" || state === "paying" || state === "swapping") && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-4"
            >
              <h5 className="text-xs font-medium text-[var(--color-muted)] mb-3 uppercase tracking-wider">
                Live Quote
              </h5>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-muted)]">Rate</span>
                  <span className="text-white font-medium">{quote.rate}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-muted)]">You receive</span>
                  <span className="text-white font-medium">~{quote.destAmountFormatted} {quote.destSymbol}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-muted)]">Price impact</span>
                  <span className="text-white">{quote.priceImpact}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-muted)]">Est. gas</span>
                  <span className="text-white">{quote.gasCostUSD}</span>
                </div>
                {quote.route.length > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--color-muted)]">Route</span>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {quote.route.map((r, i) => (
                        <span
                          key={i}
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                          style={{ background: "var(--color-info-dim)", color: "var(--color-info)" }}
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-muted)]">T402 fee</span>
                  <span className="text-white">0.01 USDT</span>
                </div>
              </div>
            </motion.div>
          )}

          <button
            onClick={execute}
            disabled={isButtonDisabled}
            className="btn-primary w-full py-3 min-h-[44px] flex items-center justify-center gap-2"
          >
            {state === "paying" || state === "swapping" ? (
              <>
                <Spinner size="sm" color="white" />
                {state === "paying" ? "Processing payment..." : "Executing swap..."}
              </>
            ) : (
              <span className="flex flex-col items-center">
                <span>{buttonLabel}</span>
                {amountInSmallestUnits && (
                  <span className="text-[10px] opacity-70">(0.01 USDT fee via T402)</span>
                )}
              </span>
            )}
          </button>

          {swaps > 0 && (
            <p className="text-xs text-[var(--color-muted)] text-center">
              {swaps} swap{swaps === 1 ? "" : "s"} executed this session
            </p>
          )}
        </div>

        {/* Right: Result */}
        <div>
          {(state === "idle" || state === "quoting" || state === "quoted") && (
            <div className="glass-card p-4 sm:p-6 flex flex-col items-center justify-center min-h-[220px] sm:min-h-[320px] text-center">
              <Repeat size={32} className="mb-3" style={{ color: "var(--color-scenario-swap)" }} />
              <p className="text-sm text-[var(--color-muted)]">
                {state === "quoted"
                  ? "Quote ready — click Swap to execute via T402"
                  : "Select tokens and enter an amount to get a live quote"}
              </p>
              <p className="text-xs text-[var(--color-muted)] mt-2">
                Powered by ParaSwap — aggregating 10+ DEXes on Arbitrum
              </p>
            </div>
          )}

          {(state === "paying" || state === "swapping") && (
            <div className="glass-card p-4 sm:p-6 flex flex-col items-center justify-center min-h-[220px] sm:min-h-[320px]">
              <Spinner size="lg" color="var(--color-brand)" />
              <p className="text-sm text-[var(--color-muted)] mt-4">
                {state === "paying" ? "Processing T402 payment..." : "Executing swap..."}
              </p>
            </div>
          )}

          {state === "done" && executedQuote && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Swap confirmed card */}
              <div className="glass-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-medium text-white">Swap Confirmed</h4>
                  <span
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                    style={{ background: "var(--color-success-dim)", color: "var(--color-success)" }}
                  >
                    Executed
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--color-muted)]">Swapped</span>
                    <span className="text-white font-medium">
                      {amount} {executedQuote.srcSymbol} &rarr; {executedQuote.destAmountFormatted} {executedQuote.destSymbol}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--color-muted)]">Rate</span>
                    <span className="text-white font-medium">{executedQuote.rate}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--color-muted)]">Price impact</span>
                    <span className="text-white">{executedQuote.priceImpact}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--color-muted)]">Est. gas</span>
                    <span className="text-white">{executedQuote.gasCostUSD}</span>
                  </div>
                  {executedQuote.route.length > 0 && (
                    <div className="pt-2" style={{ borderTop: "1px solid var(--color-border)" }}>
                      <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)] mb-1.5 block">
                        Route
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {executedQuote.route.map((r, i) => (
                          <span
                            key={i}
                            className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                            style={{
                              background: "var(--color-info-dim)",
                              color: "var(--color-info)",
                            }}
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div
                    className="flex items-center justify-between text-sm pt-2"
                    style={{ borderTop: "1px solid var(--color-border)" }}
                  >
                    <span className="text-[var(--color-muted)]">T402 fee</span>
                    <span className="text-white">0.01 USDT (settled on-chain)</span>
                  </div>
                </div>
              </div>

              {/* Raw JSON */}
              <CodeBlock
                code={JSON.stringify({ executed: true, quote: executedQuote }, null, 2)}
                language="json"
                label={`${executedQuote.srcSymbol} \u2192 ${executedQuote.destSymbol} \u2014 Swap Executed`}
                labelColor="var(--color-success)"
                showCopyButton
                maxHeight="200px"
              />

              <button
                onClick={reset}
                className="text-xs text-[var(--color-muted)] hover:text-white cursor-pointer"
              >
                Get another quote
              </button>
            </motion.div>
          )}

          {state === "error" && (
            <div className="glass-card p-4 sm:p-6 text-center">
              <p className="text-sm text-[var(--color-error)]">{error}</p>
              <button
                onClick={reset}
                className="mt-3 text-xs text-[var(--color-muted)] hover:text-white cursor-pointer min-h-[36px]"
              >
                Reset
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
