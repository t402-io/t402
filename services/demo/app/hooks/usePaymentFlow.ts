"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useDemoContext } from "@/providers/DemoProvider";
import { useChainContext } from "@/providers/ChainProvider";
import { useToast } from "@/providers/ToastProvider";
import { useMultiChainPayment } from "./useMultiChainPayment";
import { encodePaymentHeader } from "@/lib/t402-client";
import { classifyError, getUserFriendlyMessage } from "@/lib/error-helpers";
import { chainIdFromCaip2 } from "@/lib/evm-chains";

export type FlowState =
  | "idle"
  | "requesting"
  | "got-402"
  | "switching-chain"
  | "approving"
  | "signing"
  | "retrying"
  | "verifying"
  | "done"
  | "error";

interface PaymentRequired {
  t402Version: number;
  error?: string;
  resource?: { url: string; description: string; mimeType: string };
  accepts: Array<{
    scheme: string;
    network: string;
    amount: string;
    asset: string;
    payTo: string;
    maxTimeoutSeconds: number;
    extra?: Record<string, unknown>;
  }>;
}

interface SettleResponse {
  success?: boolean;
  transaction?: string;
  network?: string;
  payer?: string;
}

interface FlowResult {
  state: FlowState;
  paymentRequired: PaymentRequired | null;
  settleResponse: SettleResponse | null;
  data: unknown;
  error: string | null;
  requestHeaders: Record<string, string>;
  responseStatus: number | null;
}

export function usePaymentFlow(url: string) {
  const { isDemo, testnet } = useDemoContext();
  const { show } = useToast();
  const { signPayment, isConnected } = useMultiChainPayment();
  const {
    activeFamily, activeNetwork, isChainMatched,
    isSwitchingChain, ensureEvmChain, setPaymentInProgress,
  } = useChainContext();

  // Ref-based snapshots to always read current values inside async execute()
  const activeFamilyRef = useRef(activeFamily);
  const activeNetworkRef = useRef(activeNetwork);
  useEffect(() => { activeFamilyRef.current = activeFamily; }, [activeFamily]);
  useEffect(() => { activeNetworkRef.current = activeNetwork; }, [activeNetwork]);

  const [result, setResult] = useState<FlowResult>({
    state: "idle",
    paymentRequired: null,
    settleResponse: null,
    data: null,
    error: null,
    requestHeaders: {},
    responseStatus: null,
  });

  const execute = useCallback(async () => {
    // Read current values from refs (not stale closure values)
    const currentFamily = activeFamilyRef.current;
    const currentNetwork = activeNetworkRef.current;

    setResult({
      state: "requesting",
      paymentRequired: null,
      settleResponse: null,
      data: null,
      error: null,
      requestHeaders: {},
      responseStatus: null,
    });

    try {
      // Step 1: Initial request
      const headers: Record<string, string> = {
        Accept: "application/json",
        "x-preferred-chain": currentFamily,
        "x-network-mode": testnet ? "testnet" : "mainnet",
      };
      if (currentNetwork) headers["x-preferred-network"] = currentNetwork;
      if (isDemo) headers["x-demo-mode"] = "true";

      const initialResponse = await fetch(url, { headers });

      if (initialResponse.status !== 402) {
        // No payment required — got direct response
        const data = await initialResponse.json();
        setResult((prev) => ({
          ...prev,
          state: "done",
          data,
          responseStatus: initialResponse.status,
        }));
        return;
      }

      // Step 2: Parse 402
      const paymentRequired: PaymentRequired = await initialResponse.json();
      setResult((prev) => ({
        ...prev,
        state: "got-402",
        paymentRequired,
        responseStatus: 402,
      }));

      // Small delay for UX
      await delay(500);

      // Step 3: Validate wallet connection
      if (!isConnected) {
        show("error", "Wallet not connected. Please connect your wallet first.");
        setResult((prev) => ({
          ...prev,
          state: "error",
          error: "Wallet not connected. Please connect your wallet first.",
        }));
        return;
      }

      // Step 3.5: Pre-payment chain validation gate (NEW)
      // Re-read current values in case they changed during the delay
      const networkNow = activeNetworkRef.current;
      const familyNow = activeFamilyRef.current;

      if (familyNow === "evm" && !isDemo && networkNow) {
        const targetChainId = chainIdFromCaip2(networkNow);
        if (targetChainId) {
          setResult((prev) => ({ ...prev, state: "switching-chain" }));
          setPaymentInProgress(true);

          const switched = await ensureEvmChain(targetChainId);
          if (!switched) {
            setPaymentInProgress(false);
            show("error", "Please switch your wallet to the correct chain.");
            setResult((prev) => ({
              ...prev,
              state: "error",
              error: "Chain switch required. Please switch your wallet to the correct chain.",
            }));
            return;
          }
        }
      }

      // Step 4: Sign payment
      setPaymentInProgress(true);
      setResult((prev) => ({ ...prev, state: "signing" }));

      // Pick the accept matching the user's selected network, fall back to first
      const requirements = networkNow
        ? paymentRequired.accepts.find((a) => a.network === networkNow) || paymentRequired.accepts[0]
        : paymentRequired.accepts[0];
      const paymentPayload = await signPayment(requirements);

      // Step 5: Retry with payment
      setResult((prev) => ({ ...prev, state: "retrying" }));

      const encodedPayment = encodePaymentHeader(paymentPayload);
      const retryHeaders: Record<string, string> = {
        Accept: "application/json",
        "x-preferred-chain": familyNow,
        "x-network-mode": testnet ? "testnet" : "mainnet",
        "Payment-Signature": encodedPayment,
      };
      if (networkNow) retryHeaders["x-preferred-network"] = networkNow;
      if (isDemo) retryHeaders["x-demo-mode"] = "true";

      setResult((prev) => ({ ...prev, requestHeaders: retryHeaders }));

      const retryResponse = await fetch(url, { headers: retryHeaders });

      // Step 6: Parse result
      setResult((prev) => ({ ...prev, state: "verifying" }));

      const paymentResponseHeader = retryResponse.headers.get("Payment-Response");
      let settleResponse: SettleResponse | null = null;
      if (paymentResponseHeader) {
        try {
          const padded = paymentResponseHeader.replace(/-/g, "+").replace(/_/g, "/");
          const decoded = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
          settleResponse = JSON.parse(decoded);
        } catch {
          // Ignore parse errors
        }
      }

      const data = await retryResponse.json();

      setPaymentInProgress(false);
      setResult({
        state: "done",
        paymentRequired,
        settleResponse,
        data,
        error: null,
        requestHeaders: retryHeaders,
        responseStatus: retryResponse.status,
      });
    } catch (error) {
      setPaymentInProgress(false);
      const originalMessage = error instanceof Error ? error.message : String(error);
      const type = classifyError(error);
      const friendlyMessage = getUserFriendlyMessage(type, originalMessage);
      show("error", friendlyMessage);
      setResult((prev) => ({
        ...prev,
        state: "error",
        error: originalMessage,
      }));
    }
  }, [url, isDemo, isConnected, testnet, signPayment, show, ensureEvmChain, setPaymentInProgress]);

  const reset = useCallback(() => {
    setPaymentInProgress(false);
    setResult({
      state: "idle",
      paymentRequired: null,
      settleResponse: null,
      data: null,
      error: null,
      requestHeaders: {},
      responseStatus: null,
    });
  }, [setPaymentInProgress]);

  return { ...result, execute, reset };
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
