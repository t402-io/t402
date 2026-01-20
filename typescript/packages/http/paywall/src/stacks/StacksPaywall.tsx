import { useCallback, useEffect, useState } from "react";

import type { PaymentRequired } from "@t402/core/types";

import { Spinner } from "./Spinner";
import { getNetworkDisplayName } from "../paywallUtils";
import { PaymentProgress, type PaymentStep } from "../components/PaymentProgress";
import { useStacksWallet, formatStacksAddress } from "./stacks/useStacksWallet";
import { useStacksBalance } from "./stacks/useStacksBalance";
import { useStacksSigner } from "./stacks/useStacksSigner";
import { STACKS_NETWORKS, STACKS_WALLETS, type StacksNetwork } from "./stacks/types";
import { isStacksMainnet, getUsdcContractAddress } from "./stacks/rpc";

type StacksPaywallProps = {
  paymentRequired: PaymentRequired;
  onSuccessfulResponse: (response: Response) => Promise<void>;
};

/**
 * Paywall experience for Stacks networks.
 *
 * @param props - Component props.
 * @param props.paymentRequired - Payment required response with accepts array.
 * @param props.onSuccessfulResponse - Callback invoked on successful 402 response.
 * @returns JSX element.
 */
export function StacksPaywall({ paymentRequired, onSuccessfulResponse }: StacksPaywallProps) {
  const [status, setStatus] = useState<string>("");
  const [isPaying, setIsPaying] = useState(false);
  const [hideBalance, setHideBalance] = useState(true);
  const [paymentStep, setPaymentStep] = useState<PaymentStep>("connect");
  const [isProcessing, setIsProcessing] = useState(false);

  const t402 = window.t402;
  const amount = t402.amount;

  const firstRequirement = paymentRequired.accepts[0];
  if (!firstRequirement) {
    throw new Error("No payment requirements in paymentRequired.accepts");
  }

  const network = firstRequirement.network;
  const chainName = getNetworkDisplayName(network);
  const isMainnet = isStacksMainnet(network);
  const targetNetwork: StacksNetwork = isMainnet ? STACKS_NETWORKS.MAINNET : STACKS_NETWORKS.TESTNET;

  const {
    account,
    isConnected,
    isInstalled,
    isConnecting,
    availableWallets,
    selectedWallet,
    connect,
    disconnect,
  } = useStacksWallet(targetNetwork, setStatus);

  const {
    balance,
    formattedBalance,
    isFetching: isFetchingBalance,
    refreshBalance,
    resetBalance,
  } = useStacksBalance({
    address: account?.address || null,
    paymentRequired,
    onStatus: setStatus,
  });

  const stacksSigner = useStacksSigner(account, selectedWallet, targetNetwork);

  // Refresh balance when wallet connects
  useEffect(() => {
    if (account?.address) {
      refreshBalance(account.address);
    }
  }, [account?.address, refreshBalance]);

  // Update payment step based on connection state
  useEffect(() => {
    if (!isConnected) {
      setPaymentStep("connect");
    } else if (paymentStep === "connect") {
      setPaymentStep("sign");
    }
  }, [isConnected, paymentStep]);

  const handleConnect = useCallback(
    async (walletId: "leather" | "xverse") => {
      await connect(walletId);
    },
    [connect],
  );

  const handleDisconnect = useCallback(() => {
    disconnect();
    resetBalance();
    setStatus("");
  }, [disconnect, resetBalance]);

  const handlePayment = useCallback(async () => {
    if (!t402) {
      return;
    }

    if (!stacksSigner || !account?.address) {
      setStatus("Connect a Stacks wallet before paying.");
      return;
    }

    setIsPaying(true);
    setIsProcessing(true);

    try {
      // Check balance
      if (balance === null || balance === 0n) {
        setStatus("Checking sUSDC balance...");
        const latestBalance = await refreshBalance();
        if (!latestBalance || latestBalance === 0n) {
          throw new Error(`Insufficient balance. Make sure you have sUSDC on ${chainName}.`);
        }
      }

      setPaymentStep("sign");
      setStatus("Creating payment signature...");

      // For Stacks, we need to create the payment payload manually
      // since @t402/stacks doesn't exist yet
      const paymentPayload = {
        t402Version: 2,
        scheme: firstRequirement.scheme,
        network: firstRequirement.network,
        from: account.address,
        payTo: firstRequirement.payTo,
        amount: firstRequirement.amount || firstRequirement.maxAmountRequired,
        asset: getUsdcContractAddress(targetNetwork),
        timestamp: Date.now(),
        // Note: In production, this would involve actual signature
        // For now, we create a placeholder that the facilitator would verify
        signature: "pending_stacks_implementation",
      };

      const paymentHeader = btoa(JSON.stringify(paymentPayload));

      setPaymentStep("submit");
      setStatus("Requesting content with payment...");
      const response = await fetch(t402.currentUrl, {
        headers: {
          "PAYMENT-SIGNATURE": paymentHeader,
          "Access-Control-Expose-Headers": "PAYMENT-RESPONSE",
        },
      });

      if (response.ok) {
        setPaymentStep("confirm");
        setIsProcessing(false);
        await onSuccessfulResponse(response);
      } else {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Payment failed.");
      setIsProcessing(false);
    } finally {
      setIsPaying(false);
    }
  }, [
    t402,
    stacksSigner,
    account,
    balance,
    refreshBalance,
    chainName,
    targetNetwork,
    firstRequirement,
    onSuccessfulResponse,
  ]);

  const truncatedAddress = account?.address ? formatStacksAddress(account.address) : "-";

  return (
    <div className="container gap-8">
      <div className="header">
        <h1 className="title">Payment Required</h1>
        <p>
          {paymentRequired.resource?.description && `${paymentRequired.resource.description}.`} To
          access this content, please pay ${amount} {chainName} sUSDC.
        </p>
        {!isMainnet && (
          <p className="instructions">
            Need Stacks Testnet sUSDC?{" "}
            <a
              href="https://explorer.hiro.so/sandbox/faucet?chain=testnet"
              target="_blank"
              rel="noopener noreferrer"
            >
              Get testnet STX <u>here</u>
            </a>{" "}
            and swap for sUSDC.
          </p>
        )}
      </div>

      <div className="content w-full">
        {isConnected && (
          <PaymentProgress
            currentStep={paymentStep}
            isProcessing={isProcessing}
            hasError={!!status && !isPaying}
          />
        )}
        <div className="payment-details">
          <div className="payment-row">
            <span className="payment-label">Wallet:</span>
            <span className="payment-value">{truncatedAddress}</span>
          </div>
          <div className="payment-row">
            <span className="payment-label">Available balance:</span>
            <span className="payment-value">
              {account?.address ? (
                <button className="balance-button" onClick={() => setHideBalance(prev => !prev)}>
                  {!hideBalance && formattedBalance
                    ? `$${formattedBalance} sUSDC`
                    : isFetchingBalance
                      ? "Loading..."
                      : "••••• sUSDC"}
                </button>
              ) : (
                "-"
              )}
            </span>
          </div>
          <div className="payment-row">
            <span className="payment-label">Amount:</span>
            <span className="payment-value">${amount} sUSDC</span>
          </div>
          <div className="payment-row">
            <span className="payment-label">Network:</span>
            <span className="payment-value">{chainName}</span>
          </div>
        </div>

        <div className="cta-container">
          {isConnected ? (
            <button className="button button-secondary" onClick={handleDisconnect}>
              Disconnect
            </button>
          ) : availableWallets.length > 0 ? (
            availableWallets.map(walletId => (
              <button
                key={walletId}
                className="button button-primary"
                onClick={() => handleConnect(walletId)}
                disabled={isConnecting}
              >
                {isConnecting ? <Spinner /> : `Connect ${STACKS_WALLETS[walletId].name}`}
              </button>
            ))
          ) : (
            <button
              className="button button-primary"
              onClick={() => window.open(STACKS_WALLETS.leather.installUrl, "_blank")}
            >
              Install Leather Wallet
            </button>
          )}
          {isConnected && (
            <button className="button button-primary" onClick={handlePayment} disabled={isPaying}>
              {isPaying ? <Spinner /> : "Pay now"}
            </button>
          )}
        </div>

        {!isInstalled && (
          <div className="status">
            Install a Stacks wallet (
            <a
              href={STACKS_WALLETS.leather.installUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Leather
            </a>
            {" or "}
            <a
              href={STACKS_WALLETS.xverse.installUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Xverse
            </a>
            ) to continue, then refresh this page.
          </div>
        )}

        {status && <div className="status">{status}</div>}
      </div>
    </div>
  );
}
