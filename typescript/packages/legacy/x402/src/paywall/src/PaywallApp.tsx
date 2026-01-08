"use client";

import { useCallback, useMemo } from "react";
import type { PaymentRequirements } from "../../types/verify";
import { choosePaymentRequirement, isEvmNetwork, isSvmNetwork } from "./paywallUtils";
import { EvmPaywall } from "./EvmPaywall";
import { SolanaPaywall } from "./SolanaPaywall";

/**
 * Main Paywall App Component
 *
 * @returns The PaywallApp component
 */
export function PaywallApp() {
  const t402 = window.t402;
  const testnet = t402.testnet ?? true;

  const paymentRequirement = useMemo<PaymentRequirements>(() => {
    return choosePaymentRequirement(t402.paymentRequirements, testnet);
  }, [testnet, t402.paymentRequirements]);

  const handleSuccessfulResponse = useCallback(async (response: Response) => {
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("text/html")) {
      document.documentElement.innerHTML = await response.text();
    } else {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.location.href = url;
    }
  }, []);

  if (!paymentRequirement) {
    return (
      <div className="container">
        <div className="header">
          <h1 className="title">Payment Required</h1>
          <p className="subtitle">Loading payment details...</p>
        </div>
      </div>
    );
  }

  if (isEvmNetwork(paymentRequirement.network)) {
    return (
      <EvmPaywall
        paymentRequirement={paymentRequirement}
        onSuccessfulResponse={handleSuccessfulResponse}
      />
    );
  }

  if (isSvmNetwork(paymentRequirement.network)) {
    return (
      <SolanaPaywall
        paymentRequirement={paymentRequirement}
        onSuccessfulResponse={handleSuccessfulResponse}
      />
    );
  }

  return (
    <div className="container">
      <div className="header">
        <h1 className="title">Payment Required</h1>
        <p className="subtitle">
          Unsupported network configuration for this paywall. Please contact the application
          developer.
        </p>
      </div>
    </div>
  );
}
