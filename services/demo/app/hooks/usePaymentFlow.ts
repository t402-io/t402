"use client";

import { useState, useCallback } from "react";
import { useDemoContext } from "@/providers/DemoProvider";
import { useToast } from "@/providers/ToastProvider";
import { useMultiChainPayment } from "./useMultiChainPayment";
import { encodePaymentHeader } from "@/lib/t402-client";
import { classifyError, getUserFriendlyMessage } from "@/lib/error-helpers";

export type FlowState =
  | "idle"
  | "requesting"
  | "got-402"
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
  const { signPayment, isConnected, activeFamily, activeNetwork } = useMultiChainPayment();

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
        "x-preferred-chain": activeFamily,
        "x-network-mode": testnet ? "testnet" : "mainnet",
      };
      if (activeNetwork) headers["x-preferred-network"] = activeNetwork;
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

      // Step 3: Sign payment
      if (!isConnected) {
        show("error", "Wallet not connected. Please connect your wallet first.");
        setResult((prev) => ({
          ...prev,
          state: "error",
          error: "Wallet not connected. Please connect your wallet first.",
        }));
        return;
      }

      setResult((prev) => ({ ...prev, state: "signing" }));

      // Pick the accept matching the user's selected network, fall back to first
      const requirements = activeNetwork
        ? paymentRequired.accepts.find((a) => a.network === activeNetwork) || paymentRequired.accepts[0]
        : paymentRequired.accepts[0];
      const paymentPayload = await signPayment(requirements);

      // Step 4: Retry with payment
      setResult((prev) => ({ ...prev, state: "retrying" }));

      const encodedPayment = encodePaymentHeader(paymentPayload);
      const retryHeaders: Record<string, string> = {
        Accept: "application/json",
        "x-preferred-chain": activeFamily,
        "x-network-mode": testnet ? "testnet" : "mainnet",
        "Payment-Signature": encodedPayment,
      };
      if (activeNetwork) retryHeaders["x-preferred-network"] = activeNetwork;
      if (isDemo) retryHeaders["x-demo-mode"] = "true";

      setResult((prev) => ({ ...prev, requestHeaders: retryHeaders }));

      const retryResponse = await fetch(url, { headers: retryHeaders });

      // Step 5: Parse result
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
  }, [url, isDemo, isConnected, activeFamily, activeNetwork, testnet, signPayment, show]);

  const reset = useCallback(() => {
    setResult({
      state: "idle",
      paymentRequired: null,
      settleResponse: null,
      data: null,
      error: null,
      requestHeaders: {},
      responseStatus: null,
    });
  }, []);

  return { ...result, execute, reset };
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
