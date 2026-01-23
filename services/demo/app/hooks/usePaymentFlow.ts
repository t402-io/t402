"use client";

import { useState, useCallback } from "react";
import { useDemoContext } from "@/providers/DemoProvider";
import { useEvmPayment } from "./useEvmPayment";

export type FlowState =
  | "idle"
  | "requesting"
  | "got-402"
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
  const { isDemo } = useDemoContext();
  const { signPayment, isConnected } = useEvmPayment();

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
      };
      if (isDemo) {
        headers["x-demo-mode"] = "true";
      }

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
      if (!isConnected && !isDemo) {
        setResult((prev) => ({
          ...prev,
          state: "error",
          error: "Wallet not connected. Please connect your wallet first.",
        }));
        return;
      }

      setResult((prev) => ({ ...prev, state: "signing" }));

      const requirements = paymentRequired.accepts[0];
      let paymentPayload: unknown;

      if (isDemo) {
        // Mock signing in demo mode
        await delay(800);
        paymentPayload = {
          t402Version: 2,
          scheme: "exact",
          network: requirements.network,
          payload: {
            authorization: {
              from: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD68",
              to: requirements.payTo,
              value: requirements.amount,
              validAfter: 0,
              validBefore: Math.floor(Date.now() / 1000) + 60,
              nonce: "0x" + Array(64).fill("0").map(() => Math.floor(Math.random() * 16).toString(16)).join(""),
            },
            signature: "0x" + Array(130).fill("0").map(() => Math.floor(Math.random() * 16).toString(16)).join(""),
          },
        };
      } else {
        paymentPayload = await signPayment(requirements);
      }

      // Step 4: Retry with payment
      setResult((prev) => ({ ...prev, state: "retrying" }));

      const encodedPayment = btoa(JSON.stringify(paymentPayload));
      const retryHeaders: Record<string, string> = {
        Accept: "application/json",
        "Payment-Signature": encodedPayment,
      };
      if (isDemo) {
        retryHeaders["x-demo-mode"] = "true";
      }

      setResult((prev) => ({ ...prev, requestHeaders: retryHeaders }));

      const retryResponse = await fetch(url, { headers: retryHeaders });

      // Step 5: Parse result
      setResult((prev) => ({ ...prev, state: "verifying" }));

      const paymentResponseHeader = retryResponse.headers.get("Payment-Response");
      let settleResponse: SettleResponse | null = null;
      if (paymentResponseHeader) {
        try {
          settleResponse = JSON.parse(atob(paymentResponseHeader));
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
      setResult((prev) => ({
        ...prev,
        state: "error",
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }, [url, isDemo, isConnected, signPayment]);

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
