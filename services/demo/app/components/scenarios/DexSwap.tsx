"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt, useReadContract, useWriteContract } from "wagmi";
import { useDemoContext } from "@/providers/DemoProvider";
import { useMultiChainPayment } from "@/hooks/useMultiChainPayment";
import { PaymentStatus, parsePaymentResponse, type SettleInfo } from "@/components/shared/PaymentStatus";
import type { FlowState } from "@/hooks/usePaymentFlow";
import { CodeBlock } from "@/components/shared/CodeBlock";
import { Spinner } from "@/components/shared/Spinner";
import { encodePaymentHeader } from "@/lib/t402-client";
import { Repeat, ArrowDown, ChevronDown, CheckCircle, ExternalLink } from "lucide-react";

type State = "idle" | "quoting" | "quoted" | "paying" | "txReady" | "approving" | "executing" | "done" | "error";

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
  minReceived: string;
  rate: string;
  priceImpact: string;
  gasCostUSD: string;
  route: string[];
  estimatedGas: string;
}

interface SwapTxData {
  to: string;
  data: string;
  value: string;
  chainId: number;
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

const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const PARASWAP_ROUTER = "0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57";
// ParaSwap uses TokenTransferProxy for token approvals (NOT the router itself)
const PARASWAP_SPENDER = "0x216b4b4ba9f3e719726886d34a177484278bfcae";
const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
const ARBITRUM_CHAIN_ID = 42161;

const erc20Abi = [
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export function DexSwap() {
  const { isDemo, testnet } = useDemoContext();
  const { signPayment, activeFamily, activeNetwork } = useMultiChainPayment();
  const { address: userAddress, isConnected } = useAccount();

  const [srcToken, setSrcToken] = useState<Token>(TOKENS[0]); // USDT
  const [destToken, setDestToken] = useState<Token>(TOKENS[2]); // ETH
  const [amount, setAmount] = useState("10");
  const [state, setState] = useState<State>("idle");
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [executedQuote, setExecutedQuote] = useState<SwapQuote | null>(null);
  const [swapTx, setSwapTx] = useState<SwapTxData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [swaps, setSwaps] = useState(0);
  const [flowState, setFlowState] = useState<FlowState>("idle");
  const [settle, setSettle] = useState<SettleInfo | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [swapTxHash, setSwapTxHash] = useState<`0x${string}` | undefined>(undefined);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // wagmi hooks for swap execution
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();
  const { data: txReceipt, isLoading: isTxConfirming } = useWaitForTransactionReceipt({
    hash: swapTxHash,
    chainId: ARBITRUM_CHAIN_ID,
  });

  // Check ERC20 allowance for non-ETH source tokens
  const needsApproval = srcToken.address.toLowerCase() !== ETH_ADDRESS.toLowerCase();
  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({
    address: srcToken.address as `0x${string}`,
    abi: erc20Abi,
    functionName: "allowance",
    args: userAddress ? [userAddress, PARASWAP_SPENDER as `0x${string}`] : undefined,
    chainId: ARBITRUM_CHAIN_ID,
    query: {
      enabled: isConnected && !!userAddress && needsApproval && state === "txReady",
    },
  });

  // When tx receipt arrives while executing, transition to done
  useEffect(() => {
    if (txReceipt && state === "executing") {
      setSwaps((n) => n + 1);
      setState("done");
      setFlowState("done");
    }
  }, [txReceipt, state]);

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

  // Determine if sufficient allowance exists
  const hasSufficientAllowance = useMemo(() => {
    if (!needsApproval) return true;
    if (currentAllowance === undefined || !amountInSmallestUnits) return false;
    return currentAllowance >= BigInt(amountInSmallestUnits);
  }, [needsApproval, currentAllowance, amountInSmallestUnits]);

  // Auto-fetch free quote when inputs change (debounced 500ms)
  useEffect(() => {
    // Don't fetch while in later states
    if (state === "paying" || state === "txReady" || state === "approving" || state === "executing" || state === "done") return;

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
    setSwapTx(null);
    setSwapTxHash(undefined);
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
        userAddress: userAddress || undefined,
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

      // If server returned a swap tx, transition to txReady for user to execute
      if (data.swapTx) {
        setSwapTx(data.swapTx);
        setState("txReady");
        setFlowState("done");
      } else {
        // No swap tx (demo mode without real wallet) — show quote result
        setSwaps((n) => n + 1);
        setState("done");
        setFlowState("done");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
      setFlowState("error");
    }
  }, [isDemo, testnet, activeFamily, activeNetwork, signPayment, srcToken, destToken, amountInSmallestUnits, userAddress]);

  const handleApprove = useCallback(async () => {
    if (!swapTx) return;
    setState("approving");
    try {
      const hash = await writeContractAsync({
        address: srcToken.address as `0x${string}`,
        abi: erc20Abi,
        functionName: "approve",
        args: [PARASWAP_SPENDER as `0x${string}`, MAX_UINT256],
        chainId: ARBITRUM_CHAIN_ID,
      });
      // Wait a moment for the approval to be indexed, then refetch allowance
      // We use a simple polling approach
      let attempts = 0;
      while (attempts < 30) {
        await new Promise((r) => setTimeout(r, 2000));
        const result = await refetchAllowance();
        if (result.data && result.data >= BigInt(amountInSmallestUnits || "0")) {
          break;
        }
        attempts++;
      }
      setState("txReady");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
      setFlowState("error");
    }
  }, [swapTx, srcToken, writeContractAsync, refetchAllowance, amountInSmallestUnits]);

  const handleExecuteSwap = useCallback(async () => {
    if (!swapTx) return;
    setState("executing");
    try {
      const hash = await sendTransactionAsync({
        to: swapTx.to as `0x${string}`,
        data: swapTx.data as `0x${string}`,
        value: BigInt(swapTx.value),
        chainId: ARBITRUM_CHAIN_ID,
      });
      setSwapTxHash(hash);
      // Receipt monitoring is handled by useWaitForTransactionReceipt + useEffect
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
      setFlowState("error");
    }
  }, [swapTx, sendTransactionAsync]);

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
    setSwapTx(null);
    setSwapTxHash(undefined);
    setFlowState("idle");
    setSettle(null);
    setError(null);
  };

  // Button label
  const buttonLabel = useMemo(() => {
    const num = parseFloat(amount);
    if (state === "paying") return null; // spinner shown instead
    if (!amount || isNaN(num) || num <= 0) return "Enter an amount";
    return `Swap ${amount} ${srcToken.symbol} \u2192 ${destToken.symbol}`;
  }, [amount, srcToken.symbol, destToken.symbol, state]);

  const isButtonDisabled = state === "paying" || state === "txReady" || state === "approving" || state === "executing" || !amountInSmallestUnits;

  return (
    <>
      {flowState !== "idle" && (
        <PaymentStatus flowState={flowState} settle={settle} family={activeFamily} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Swap form */}
        <div className="flex flex-col gap-4">
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Repeat size={14} style={{ color: "var(--color-scenario-swap)" }} />
                Swap on Arbitrum
              </h4>
              <span className="text-[9px] font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(59,130,246,0.1)", color: "#60A5FA" }}>
                Arbitrum One
              </span>
            </div>

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
                      disabled={state === "paying" || state === "txReady" || state === "approving" || state === "executing"}
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
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "" || /^\d*\.?\d*$/.test(v)) setAmount(v);
                    }}
                    disabled={state === "paying" || state === "txReady" || state === "approving" || state === "executing"}
                    placeholder="0.00"
                    className="flex-1 bg-transparent text-right text-lg font-medium text-white placeholder-[var(--color-text-tertiary)] focus:outline-none min-w-0"
                  />
                </div>
              </div>

              {/* Swap direction button */}
              <div className="flex justify-center -my-1">
                <button
                  onClick={swapTokens}
                  disabled={state === "paying" || state === "txReady" || state === "approving" || state === "executing"}
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
                      disabled={state === "paying" || state === "txReady" || state === "approving" || state === "executing"}
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
                    ) : executedQuote && (state === "done" || state === "txReady") ? (
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
          {quote && (state === "quoted" || state === "paying") && (
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
                  <span className="text-[var(--color-muted)]">Min. received (0.5% slippage)</span>
                  <span className="text-white">{quote.minReceived} {quote.destSymbol}</span>
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
              <p className="text-[10px] text-[var(--color-text-tertiary)] text-right mt-1">
                Powered by ParaSwap · aggregating 10+ DEXes on Arbitrum
              </p>
            </motion.div>
          )}

          {/* Swap Ready card — shown after T402 payment, before swap execution */}
          {state === "txReady" && swapTx && executedQuote && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-5"
            >
              <h5 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <CheckCircle size={14} style={{ color: "var(--color-success)" }} />
                Swap Ready
              </h5>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-[var(--color-success)]">&#10003;</span>
                  <span className="text-[var(--color-muted)]">T402 fee paid (0.01 USDT)</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-muted)]">Swap</span>
                  <span className="text-white font-medium">
                    {amount} {executedQuote.srcSymbol} &rarr; ~{executedQuote.destAmountFormatted} {executedQuote.destSymbol}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-muted)]">Router</span>
                  <span className="text-white font-mono text-xs">
                    {PARASWAP_SPENDER.slice(0, 8)}...{PARASWAP_SPENDER.slice(-4)} (ParaSwap TokenTransferProxy)
                  </span>
                </div>
              </div>

              <div className="flex gap-3 mt-4">
                {needsApproval && !hasSufficientAllowance && (
                  <button
                    onClick={handleApprove}
                    className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2"
                  >
                    Approve {srcToken.symbol}
                  </button>
                )}
                <button
                  onClick={handleExecuteSwap}
                  disabled={needsApproval && !hasSufficientAllowance}
                  className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Execute Swap
                </button>
              </div>
            </motion.div>
          )}

          {/* Approving state */}
          {state === "approving" && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-5 flex flex-col items-center justify-center"
            >
              <Spinner size="md" color="var(--color-brand)" />
              <p className="text-sm text-[var(--color-muted)] mt-3">
                Approving {srcToken.symbol} for ParaSwap router...
              </p>
              <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1">
                Confirm the approval in your wallet
              </p>
            </motion.div>
          )}

          {/* Executing state */}
          {state === "executing" && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-5 flex flex-col items-center justify-center"
            >
              <Spinner size="md" color="var(--color-brand)" />
              <p className="text-sm text-[var(--color-muted)] mt-3">
                {isTxConfirming ? "Waiting for confirmation..." : "Submitting swap transaction..."}
              </p>
              {swapTxHash && (
                <a
                  href={`https://arbiscan.io/tx/${swapTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] mt-1 flex items-center gap-1 hover:underline"
                  style={{ color: "var(--color-info)" }}
                >
                  View on Arbiscan <ExternalLink size={9} />
                </a>
              )}
            </motion.div>
          )}

          {/* Main action button — only shown in pre-payment states */}
          {(state === "idle" || state === "quoting" || state === "quoted" || state === "paying") && (
            <button
              onClick={execute}
              disabled={isButtonDisabled}
              className="btn-primary w-full py-3 min-h-[44px] flex items-center justify-center gap-2"
            >
              {state === "paying" ? (
                <>
                  <Spinner size="sm" color="white" />
                  Processing payment...
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
          )}

          {swaps > 0 && (
            <p className="text-xs text-[var(--color-muted)] text-center">
              {swaps} swap{swaps === 1 ? "" : "s"} executed this session
            </p>
          )}
        </div>

        {/* Right: Result */}
        <div>
          {(state === "idle" || state === "quoting" || state === "quoted") && (
            <div className="glass-card p-4 sm:p-6">
              <h4 className="text-sm font-medium text-white mb-4">How it works</h4>
              <div className="space-y-3">
                {[
                  { step: "1", label: "Live Quote", desc: "ParaSwap aggregates 10+ DEXes on Arbitrum to find the best rate -- free, instant." },
                  { step: "2", label: "Pay via T402", desc: "Click Swap to pay 0.01 USDT via HTTP 402. No API key needed." },
                  { step: "3", label: "Approve & Execute", desc: "Approve the token (if needed), then execute the swap directly from your wallet." },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-3">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                      style={{ background: "var(--color-scenario-swap)", color: "white", opacity: 0.8 }}
                    >
                      {item.step}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-white">{item.label}</p>
                      <p className="text-[10px] text-[var(--color-muted)] leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--color-border)" }}>
                <p className="text-[10px] text-[var(--color-text-tertiary)]">
                  Supported DEXes: Uniswap V2/V3 · PancakeSwap V3 · SushiSwap V3 · CamelotV3 · Balancer · Curve · and more
                </p>
              </div>
            </div>
          )}

          {state === "paying" && (
            <div className="glass-card p-4 sm:p-6 flex flex-col items-center justify-center min-h-[220px] sm:min-h-[320px]">
              <Spinner size="lg" color="var(--color-brand)" />
              <p className="text-sm text-[var(--color-muted)] mt-4">
                Processing T402 payment...
              </p>
            </div>
          )}

          {/* txReady / approving / executing — show quote details on the right */}
          {(state === "txReady" || state === "approving" || state === "executing") && executedQuote && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-5"
            >
              <h4 className="text-sm font-medium text-white mb-4">Swap Details</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-muted)]">Swap</span>
                  <span className="text-white font-medium">
                    {amount} {executedQuote.srcSymbol} &rarr; {executedQuote.destAmountFormatted} {executedQuote.destSymbol}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-muted)]">Rate</span>
                  <span className="text-white font-medium">{executedQuote.rate}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-muted)]">Min. received</span>
                  <span className="text-white">{executedQuote.minReceived} {executedQuote.destSymbol}</span>
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
                          style={{ background: "var(--color-info-dim)", color: "var(--color-info)" }}
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
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
                  <h4 className="text-sm font-medium text-white">
                    {swapTxHash ? "Swap Confirmed" : "Swap Quote Result"}
                  </h4>
                  <span
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                    style={{ background: "var(--color-success-dim)", color: "var(--color-success)" }}
                  >
                    {swapTxHash ? "Swapped" : "Paid 0.01 USDT"}
                  </span>
                </div>

                {!swapTxHash && (
                  <p className="text-[10px] text-[var(--color-muted)] mb-3 -mt-2">
                    This is a real-time DEX quote purchased via T402. Connect a wallet on Arbitrum to execute swaps.
                  </p>
                )}

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--color-muted)]">Swap</span>
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
                  {swapTxHash && (
                    <div
                      className="flex items-center justify-between text-sm pt-2"
                      style={{ borderTop: "1px solid var(--color-border)" }}
                    >
                      <span className="text-[var(--color-muted)]">Tx hash</span>
                      <a
                        href={`https://arbiscan.io/tx/${swapTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white font-mono text-xs flex items-center gap-1 hover:underline"
                      >
                        {swapTxHash.slice(0, 10)}...{swapTxHash.slice(-6)}
                        <ExternalLink size={10} />
                      </a>
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
                code={JSON.stringify(
                  swapTxHash
                    ? { executed: true, quote: executedQuote, swapTxHash }
                    : { executed: true, quote: executedQuote },
                  null, 2
                )}
                language="json"
                label={`${executedQuote.srcSymbol} \u2192 ${executedQuote.destSymbol} \u2014 ${swapTxHash ? "Swap Confirmed" : "Swap Executed"}`}
                labelColor="var(--color-success)"
                showCopyButton
                maxHeight="200px"
              />

              <button
                onClick={reset}
                className="text-xs text-[var(--color-muted)] hover:text-white cursor-pointer"
              >
                {swapTxHash ? "Do another swap" : "Get another quote"}
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
