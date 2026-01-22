"use client";

import { useCallback, useState } from "react";
import type { PaymentRequired, PaymentRequirements } from "@t402/core/types";
import {
  isEvmNetwork,
  isSvmNetwork,
  isTonNetwork,
  isTronNetwork,
  isStacksNetwork,
} from "./paywallUtils";
import { EvmPaywall } from "./evm/EvmPaywall";
import { SolanaPaywall } from "./svm/SolanaPaywall";
import { TonPaywall } from "./ton/TonPaywall";
import { TronPaywall } from "./tron/TronPaywall";
import { StacksPaywall } from "./stacks/StacksPaywall";
import { NetworkSelector } from "./components/NetworkSelector";

/**
 * Main Paywall App Component
 *
 * @returns The PaywallApp component
 */
export function PaywallApp() {
  const t402 = window.t402;
  const paymentRequired: PaymentRequired = t402.paymentRequired;
  const [selectedRequirement, setSelectedRequirement] = useState<PaymentRequirements | null>(null);

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

  const handleNetworkSelect = useCallback((requirement: PaymentRequirements) => {
    setSelectedRequirement(requirement);
  }, []);

  const handleBackToSelector = useCallback(() => {
    setSelectedRequirement(null);
  }, []);

  if (!paymentRequired || !paymentRequired.accepts || paymentRequired.accepts.length === 0) {
    return (
      <div className="container">
        <div className="header">
          <h1 className="title">Payment Required</h1>
          <p className="subtitle">Loading payment details...</p>
        </div>
      </div>
    );
  }

  // Show network selector if multiple options and none selected
  const hasMultipleNetworks = paymentRequired.accepts.length > 1;
  if (hasMultipleNetworks && !selectedRequirement) {
    return (
      <div className="container">
        <NetworkSelector accepts={paymentRequired.accepts} onSelect={handleNetworkSelect} />
      </div>
    );
  }

  // Use selected requirement or first one if only single option
  const activeRequirement = selectedRequirement || paymentRequired.accepts[0];
  const network = activeRequirement.network;

  // Create modified paymentRequired with only the selected option
  const filteredPaymentRequired: PaymentRequired = {
    ...paymentRequired,
    accepts: [activeRequirement],
  };

  // Render back button for multi-network mode
  const BackButton = hasMultipleNetworks ? (
    <button
      className="back-button"
      onClick={handleBackToSelector}
      aria-label="Go back to network selection"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="M12.5 15L7.5 10L12.5 5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Change network
    </button>
  ) : null;

  if (isEvmNetwork(network)) {
    return (
      <>
        {BackButton}
        <EvmPaywall
          paymentRequired={filteredPaymentRequired}
          onSuccessfulResponse={handleSuccessfulResponse}
        />
      </>
    );
  }

  if (isSvmNetwork(network)) {
    return (
      <>
        {BackButton}
        <SolanaPaywall
          paymentRequired={filteredPaymentRequired}
          onSuccessfulResponse={handleSuccessfulResponse}
        />
      </>
    );
  }

  if (isTonNetwork(network)) {
    return (
      <>
        {BackButton}
        <TonPaywall
          paymentRequired={filteredPaymentRequired}
          onSuccessfulResponse={handleSuccessfulResponse}
        />
      </>
    );
  }

  if (isTronNetwork(network)) {
    return (
      <>
        {BackButton}
        <TronPaywall
          paymentRequired={filteredPaymentRequired}
          onSuccessfulResponse={handleSuccessfulResponse}
        />
      </>
    );
  }

  if (isStacksNetwork(network)) {
    return (
      <>
        {BackButton}
        <StacksPaywall
          paymentRequired={filteredPaymentRequired}
          onSuccessfulResponse={handleSuccessfulResponse}
        />
      </>
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
