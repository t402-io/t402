"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt, useReadContract, useWriteContract, useSwitchChain } from "wagmi";
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

// Multi-chain token registry
const CHAIN_TOKENS: Record<string, Token[]> = {
  ethereum: [
    { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
    { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
    { symbol: "ETH", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 },
    { symbol: "WBTC", address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", decimals: 8 },
    { symbol: "DAI", address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18 },
    { symbol: "LINK", address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", decimals: 18 },
  ],
  arbitrum: [
    { symbol: "USDT", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 },
    { symbol: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
    { symbol: "ETH", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 },
    { symbol: "WBTC", address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", decimals: 8 },
    { symbol: "ARB", address: "0x912CE59144191C1204E64559FE8253a0e49E6548", decimals: 18 },
    { symbol: "LINK", address: "0xf97f4df75117a78c1A5a0DBb814Af92458539FB4", decimals: 18 },
    { symbol: "UNI", address: "0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0", decimals: 18 },
    { symbol: "DAI", address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", decimals: 18 },
  ],
  optimism: [
    { symbol: "USDT", address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", decimals: 6 },
    { symbol: "USDC", address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", decimals: 6 },
    { symbol: "ETH", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 },
    { symbol: "WBTC", address: "0x68f180fcCe6836688e9084f035309E29Bf0A2095", decimals: 8 },
    { symbol: "OP", address: "0x4200000000000000000000000000000000000042", decimals: 18 },
    { symbol: "DAI", address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", decimals: 18 },
  ],
  polygon: [
    { symbol: "USDT", address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 },
    { symbol: "USDC", address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6 },
    { symbol: "MATIC", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 },
    { symbol: "WBTC", address: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6", decimals: 8 },
    { symbol: "DAI", address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", decimals: 18 },
  ],
  bsc: [
    { symbol: "USDT", address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 },
    { symbol: "USDC", address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18 },
    { symbol: "BNB", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 },
    { symbol: "BTCB", address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c", decimals: 18 },
    { symbol: "DAI", address: "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3", decimals: 18 },
  ],
  avalanche: [
    { symbol: "USDT", address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", decimals: 6 },
    { symbol: "USDC", address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", decimals: 6 },
    { symbol: "AVAX", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 },
    { symbol: "WBTC", address: "0x50b7545627a5162F82A992c33b87aDc75187B218", decimals: 8 },
    { symbol: "DAI", address: "0xd586E7F844cEa2F87f50152665BCbc2C279D8d70", decimals: 18 },
  ],
  base: [
    { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
    { symbol: "ETH", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 },
    { symbol: "DAI", address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", decimals: 18 },
  ],
};

const CHAIN_NAMES: Record<string, string> = {
  ethereum: "Ethereum",
  arbitrum: "Arbitrum",
  optimism: "Optimism",
  polygon: "Polygon",
  bsc: "BNB Chain",
  avalanche: "Avalanche",
  base: "Base",
};

const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  arbitrum: 42161,
  optimism: 10,
  polygon: 137,
  bsc: 56,
  avalanche: 43114,
  base: 8453,
};

// CAIP-2 network IDs for T402 payment — so fee is paid on the same chain as swap
const CHAIN_CAIP2: Record<string, string> = {
  ethereum: "eip155:1",
  arbitrum: "eip155:42161",
  optimism: "eip155:10",
  polygon: "eip155:137",
  bsc: "eip155:56",
  avalanche: "eip155:43114",
  base: "eip155:8453",
};

// Native token symbol per chain (the token at 0xEeee...EEeE)
const CHAIN_NATIVE: Record<string, string> = {
  ethereum: "ETH",
  arbitrum: "ETH",
  optimism: "ETH",
  polygon: "MATIC",
  bsc: "BNB",
  avalanche: "AVAX",
  base: "ETH",
};

const PARASWAP_SPENDERS: Record<string, string> = {
  ethereum: "0x216b4b4ba9f3e719726886d34a177484278bfcae",
  arbitrum: "0x216b4b4ba9f3e719726886d34a177484278bfcae",
  optimism: "0x216b4b4ba9f3e719726886d34a177484278bfcae",
  polygon: "0x216b4b4ba9f3e719726886d34a177484278bfcae",
  bsc: "0x216b4b4ba9f3e719726886d34a177484278bfcae",
  avalanche: "0x216b4b4ba9f3e719726886d34a177484278bfcae",
  base: "0x93aAAe79a53759cD164340E4C8766E4Db5331cD7",
};

const CHAIN_EXPLORERS: Record<string, string> = {
  ethereum: "https://etherscan.io",
  arbitrum: "https://arbiscan.io",
  optimism: "https://optimistic.etherscan.io",
  polygon: "https://polygonscan.com",
  bsc: "https://bscscan.com",
  avalanche: "https://snowtrace.io",
  base: "https://basescan.org",
};

const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const PARASWAP_ROUTER = "0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57";
const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

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

function getDefaultTokens(chainKey: string): { src: Token; dest: Token } {
  const tokens = CHAIN_TOKENS[chainKey] || CHAIN_TOKENS.arbitrum;
  const nativeSymbol = CHAIN_NATIVE[chainKey] || "ETH";
  const src = tokens[0]; // First token (USDT or USDC)
  const dest = tokens.find(t => t.symbol === nativeSymbol) || tokens[1];
  return { src, dest };
}

export function DexSwap() {
  const { isDemo, testnet } = useDemoContext();
  const { signPayment, activeFamily, activeNetwork } = useMultiChainPayment();
  const { address: userAddress, isConnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  const [chain, setChain] = useState("arbitrum");
  const tokens = useMemo(() => CHAIN_TOKENS[chain] || CHAIN_TOKENS.arbitrum, [chain]);
  const chainId = CHAIN_IDS[chain] || 42161;
  const chainName = CHAIN_NAMES[chain] || "Arbitrum";
  const spender = PARASWAP_SPENDERS[chain] || PARASWAP_SPENDERS.arbitrum;
  const explorerUrl = CHAIN_EXPLORERS[chain] || CHAIN_EXPLORERS.arbitrum;

  const [srcToken, setSrcToken] = useState<Token>(CHAIN_TOKENS.arbitrum[0]); // USDT
  const [destToken, setDestToken] = useState<Token>(CHAIN_TOKENS.arbitrum[2]); // ETH
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
    chainId,
  });

  // Check ERC20 allowance for non-ETH source tokens
  const needsApproval = srcToken.address.toLowerCase() !== ETH_ADDRESS.toLowerCase();
  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({
    address: srcToken.address as `0x${string}`,
    abi: erc20Abi,
    functionName: "allowance",
    args: userAddress ? [userAddress, spender as `0x${string}`] : undefined,
    chainId,
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

  // Handle chain change: reset tokens to defaults for new chain
  const handleChainChange = useCallback(async (newChain: string) => {
    setChain(newChain);
    const defaults = getDefaultTokens(newChain);
    setSrcToken(defaults.src);
    setDestToken(defaults.dest);
    setQuote(null);
    setExecutedQuote(null);
    setSwapTx(null);
    setSwapTxHash(undefined);
    setError(null);
    setState("idle");
    setFlowState("idle");
    setSettle(null);

    // Switch wagmi chain if connected
    if (isConnected && switchChainAsync) {
      const targetChainId = CHAIN_IDS[newChain];
      if (targetChainId) {
        try {
          await switchChainAsync({ chainId: targetChainId });
        } catch {
          // User may reject chain switch — that's OK
        }
      }
    }
  }, [isConnected, switchChainAsync]);

  // Tokens available for dest (exclude srcToken)
  const destOptions = useMemo(
    () => tokens.filter((t) => t.address !== srcToken.address),
    [tokens, srcToken]
  );

  // Tokens available for src (exclude destToken)
  const srcOptions = useMemo(
    () => tokens.filter((t) => t.address !== destToken.address),
    [tokens, destToken]
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
          chainKey: chain,
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
  }, [srcToken, destToken, amountInSmallestUnits, chain]); // eslint-disable-line react-hooks/exhaustive-deps

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
        "x-preferred-chain": "evm",
        "x-network-mode": "mainnet",
        "x-preferred-network": CHAIN_CAIP2[chain] || "eip155:42161",
      };
      if (isDemo) headers["x-demo-mode"] = "true";

      const body = JSON.stringify({
        srcToken: srcToken.address,
        destToken: destToken.address,
        amount: amountInSmallestUnits,
        srcDecimals: srcToken.decimals,
        destDecimals: destToken.decimals,
        userAddress: userAddress || undefined,
        chainKey: chain,
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
        "x-preferred-chain": "evm",
        "x-network-mode": "mainnet",
        "x-preferred-network": CHAIN_CAIP2[chain] || "eip155:42161",
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

      // If server returned a swap tx, auto-execute (approve if needed → swap)
      if (data.swapTx) {
        setSwapTx(data.swapTx);
        setExecutedQuote(data.quote);
        setFlowState("done");

        // Auto-execute: approve if needed, then swap — all in one flow
        try {
          // Ensure correct chain
          if (switchChainAsync && chainId) {
            try { await switchChainAsync({ chainId }); } catch { /* user may reject */ }
          }

          // Check allowance and approve if needed (skip for native token)
          const isNative = srcToken.address.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
          if (!isNative) {
            setState("approving");
            const allowanceResult = await refetchAllowance();
            const currentAllowance = allowanceResult.data ?? BigInt(0);
            if (currentAllowance < BigInt(amountInSmallestUnits || "0")) {
              await writeContractAsync({
                address: srcToken.address as `0x${string}`,
                abi: erc20Abi,
                functionName: "approve",
                args: [spender as `0x${string}`, MAX_UINT256],
                chainId,
              });
              // Poll for allowance confirmation
              for (let i = 0; i < 15; i++) {
                await new Promise((r) => setTimeout(r, 2000));
                const result = await refetchAllowance();
                if (result.data && result.data >= BigInt(amountInSmallestUnits || "0")) break;
              }
            }
          }

          // Execute swap
          setState("executing");
          const hash = await sendTransactionAsync({
            to: data.swapTx.to as `0x${string}`,
            data: data.swapTx.data as `0x${string}`,
            value: BigInt(data.swapTx.value),
            chainId,
          });
          setSwapTxHash(hash);
          // Receipt handled by useWaitForTransactionReceipt + useEffect
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
          setState("error");
          setFlowState("error");
        }
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
  }, [isDemo, testnet, activeFamily, activeNetwork, signPayment, srcToken, destToken, amountInSmallestUnits, userAddress, chain]);

  const handleApprove = useCallback(async () => {
    if (!swapTx) return;
    setState("approving");
    try {
      // Ensure wallet is on the correct chain before approve
      if (switchChainAsync && chainId) {
        try { await switchChainAsync({ chainId }); } catch { /* user may reject */ }
      }
      const hash = await writeContractAsync({
        address: srcToken.address as `0x${string}`,
        abi: erc20Abi,
        functionName: "approve",
        args: [spender as `0x${string}`, MAX_UINT256],
        chainId,
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
  }, [swapTx, srcToken, writeContractAsync, refetchAllowance, amountInSmallestUnits, spender, chainId, switchChainAsync]);

  const handleExecuteSwap = useCallback(async () => {
    if (!swapTx) return;
    setState("executing");
    try {
      // Ensure wallet is on the correct chain before swap
      if (switchChainAsync && chainId) {
        try { await switchChainAsync({ chainId }); } catch { /* user may reject */ }
      }
      const hash = await sendTransactionAsync({
        to: swapTx.to as `0x${string}`,
        data: swapTx.data as `0x${string}`,
        value: BigInt(swapTx.value),
        chainId,
      });
      setSwapTxHash(hash);
      // Receipt monitoring is handled by useWaitForTransactionReceipt + useEffect
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
      setFlowState("error");
    }
  }, [swapTx, sendTransactionAsync, chainId, switchChainAsync]);

  const handleSrcChange = (symbol: string) => {
    const token = tokens.find((t) => t.symbol === symbol);
    if (token) {
      setSrcToken(token);
      // If new src equals current dest, swap them
      if (token.address === destToken.address) {
        setDestToken(srcToken);
      }
    }
  };

  const handleDestChange = (symbol: string) => {
    const token = tokens.find((t) => t.symbol === symbol);
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
  const isSwapActive = state === "paying" || state === "txReady" || state === "approving" || state === "executing";

  return (
    <>
      {flowState !== "idle" && (
        <PaymentStatus flowState={flowState} settle={settle} family={activeFamily} />
      )}

      <div className="max-w-lg mx-auto space-y-4">
        {/* Swap form — hidden when done */}
        {state !== "done" && (
          <>
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Repeat size={14} style={{ color: "var(--color-scenario-swap)" }} />
                  Swap on {chainName}
                </h4>
                <span className="text-[9px] font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(59,130,246,0.1)", color: "#60A5FA" }}>
                  {chainName}
                </span>
              </div>

              {/* Chain selector */}
              <div
                className="rounded-lg p-3 mb-3"
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
              >
                <label className="text-[10px] uppercase tracking-wider text-[var(--color-muted)] mb-1.5 block">
                  Network
                </label>
                <div className="relative">
                  <select
                    value={chain}
                    onChange={(e) => handleChainChange(e.target.value)}
                    disabled={isSwapActive}
                    className="w-full appearance-none bg-[var(--color-surface-active)] text-white text-sm font-medium px-3 py-2 pr-7 rounded-lg border border-[var(--color-border)] cursor-pointer focus:outline-none focus:border-[var(--color-brand)]"
                  >
                    <option value="arbitrum">Arbitrum</option>
                    <option value="ethereum">Ethereum</option>
                    <option value="optimism">Optimism</option>
                    <option value="polygon">Polygon</option>
                    <option value="bsc">BNB Chain</option>
                    <option value="avalanche">Avalanche</option>
                    <option value="base">Base</option>
                  </select>
                  <ChevronDown
                    size={12}
                    className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-muted)]"
                  />
                </div>
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
                        disabled={isSwapActive}
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
                      disabled={isSwapActive}
                      placeholder="0.00"
                      className="flex-1 bg-transparent text-right text-lg font-medium text-white placeholder-[var(--color-text-tertiary)] focus:outline-none min-w-0"
                    />
                  </div>
                </div>

                {/* Swap direction button */}
                <div className="flex justify-center -my-1">
                  <button
                    onClick={swapTokens}
                    disabled={isSwapActive}
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
                        disabled={isSwapActive}
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
                      ) : executedQuote && (state === "txReady") ? (
                        <span className="text-white">{executedQuote.destAmountFormatted}</span>
                      ) : (
                        <span className="text-[var(--color-text-tertiary)]">&mdash;</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Compact quote preview inside the card */}
              {quote && (state === "quoted" || state === "paying") && (
                <div className="pt-3 mt-3 space-y-1.5" style={{ borderTop: "1px solid var(--color-border)" }}>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[var(--color-muted)]">Rate</span>
                    <span className="text-white">{quote.rate}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[var(--color-muted)]">Min. received</span>
                    <span className="text-white">{quote.minReceived} {quote.destSymbol}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[var(--color-muted)]">Impact</span>
                    <span className="text-white">{quote.priceImpact}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[var(--color-muted)]">Route</span>
                    <span className="text-white">{quote.route.join(" \u2192 ")}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[var(--color-muted)]">T402 fee</span>
                    <span className="text-white">0.01 USDT</span>
                  </div>
                </div>
              )}
            </div>

            {/* txReady is now a transient state — auto-executes, no manual card needed */}

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
                    href={`${explorerUrl}/tx/${swapTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] mt-1 flex items-center gap-1 hover:underline"
                    style={{ color: "var(--color-info)" }}
                  >
                    View on Explorer <ExternalLink size={9} />
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

            <p className="text-[10px] text-center text-[var(--color-text-tertiary)]">
              Powered by ParaSwap &middot; 10+ DEXes &middot; {chainName}
            </p>

            {swaps > 0 && (
              <p className="text-xs text-[var(--color-muted)] text-center">
                {swaps} swap{swaps === 1 ? "" : "s"} executed this session
              </p>
            )}
          </>
        )}

        {/* Result — replaces the form when done */}
        {state === "done" && executedQuote && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
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
                  This is a real-time DEX quote purchased via T402. Connect a wallet on {chainName} to execute swaps.
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
                      href={`${explorerUrl}/tx/${swapTxHash}`}
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
              className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
            >
              {swapTxHash ? "Do another swap" : "Get another quote"}
            </button>
          </motion.div>
        )}

        {/* Error state */}
        {state === "error" && (
          <div className="glass-card p-4 text-center">
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
    </>
  );
}
