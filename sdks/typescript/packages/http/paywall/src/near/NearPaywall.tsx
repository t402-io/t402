import { useCallback, useEffect, useState } from "react";
import type { PaymentRequired } from "@t402/core/types";

import { Spinner } from "./Spinner";
import { getNetworkDisplayName } from "../paywallUtils";
import { PaymentProgress, type PaymentStep } from "../components/PaymentProgress";
import { useNearWallet, type NearWalletId } from "./near/useNearWallet";
import { useNearBalance } from "./near/useNearBalance";
import { useNearSigner } from "./near/useNearSigner";
import { NEAR_NETWORKS, type NearNetwork } from "./near/types";

type NearPaywallProps = {
  paymentRequired: PaymentRequired;
  onSuccessfulResponse: (response: Response) => Promise<void>;
};

/**
 * Get wallet display name
 */
function getWalletDisplayName(walletId: NearWalletId): string {
  switch (walletId) {
    case "mynearwallet":
      return "MyNearWallet";
    case "meteor":
      return "Meteor";
    default:
      return walletId;
  }
}

/**
 * Paywall experience for NEAR networks.
 */
export function NearPaywall({ paymentRequired, onSuccessfulResponse }: NearPaywallProps) {
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
  const isMainnet = network === NEAR_NETWORKS.MAINNET;
  const targetNetwork: NearNetwork = isMainnet
    ? NEAR_NETWORKS.MAINNET
    : NEAR_NETWORKS.TESTNET;

  const {
    account,
    walletId,
    isConnecting,
    error: walletError,
    availableWallets,
    connect,
    disconnect,
  } = useNearWallet(targetNetwork);

  const { balance, formattedBalance, isFetching: isFetchingBalance, refreshBalance, resetBalance } =
    useNearBalance(account?.accountId || null, targetNetwork, setStatus);

  const nearSigner = useNearSigner(account, walletId, targetNetwork);

  // Refresh balance when wallet connects
  useEffect(() => {
    if (account?.accountId) {
      refreshBalance(account.accountId);
    }
  }, [account?.accountId, refreshBalance]);

  // Update payment step based on connection state
  useEffect(() => {
    if (!account) {
      setPaymentStep("connect");
    } else if (paymentStep === "connect") {
      setPaymentStep("sign");
    }
  }, [account, paymentStep]);

  // Handle wallet errors
  useEffect(() => {
    if (walletError) {
      setStatus(walletError);
    }
  }, [walletError]);

  const handleConnect = useCallback(
    async (selectedWalletId: NearWalletId) => {
      setStatus("Connecting to wallet...");
      try {
        await connect(selectedWalletId);
        setStatus("");
      } catch (error) {
        console.error("Failed to connect wallet", error);
        setStatus(error instanceof Error ? error.message : "Failed to connect wallet.");
      }
    },
    [connect],
  );

  const handleDisconnect = useCallback(() => {
    disconnect();
    resetBalance();
    setStatus("");
    setPaymentStep("connect");
  }, [disconnect, resetBalance]);

  const handlePayment = useCallback(async () => {
    if (!t402 || !nearSigner || !account) {
      setStatus("Connect a wallet before paying.");
      return;
    }

    setIsPaying(true);
    setIsProcessing(true);

    try {
      // Check balance
      if (balance === null || balance === 0n) {
        setStatus("Checking USDC balance...");
        const latestBalance = await refreshBalance();
        if (!latestBalance || latestBalance === 0n) {
          throw new Error(`Insufficient balance. Make sure you have USDC on ${chainName}.`);
        }
      }

      setPaymentStep("sign");
      setStatus("Signing transaction...");

      // Convert amount to micro-USDC (6 decimals)
      const amountMicro = BigInt(Math.floor(amount * 1000000));
      const payTo = firstRequirement.payTo;

      // Sign and broadcast the transfer
      const txHash = await nearSigner.signAndBroadcastTransfer({
        recipient: payTo,
        amount: amountMicro,
        memo: `t402 payment for ${t402.currentUrl}`,
      });

      setPaymentStep("submit");
      setStatus("Transaction submitted, requesting content...");

      // Create payment payload
      const paymentPayload = {
        t402Version: 2,
        scheme: firstRequirement.scheme,
        network: firstRequirement.network,
        payload: {
          txHash,
          from: account.accountId,
          to: payTo,
          amount: amountMicro.toString(),
        },
      };

      const paymentHeader = btoa(JSON.stringify(paymentPayload));

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
    nearSigner,
    account,
    balance,
    refreshBalance,
    chainName,
    amount,
    firstRequirement,
    onSuccessfulResponse,
  ]);

  // Clear status when wallet connects
  useEffect(() => {
    if (account) {
      setStatus("");
    }
  }, [account]);

  const truncatedAccountId = account?.accountId
    ? account.accountId.length > 20
      ? `${account.accountId.slice(0, 10)}...${account.accountId.slice(-6)}`
      : account.accountId
    : "-";

  return (
    <div className="container gap-8">
      <div className="header">
        <h1 className="title">Payment Required</h1>
        <p>
          {paymentRequired.resource?.description && `${paymentRequired.resource.description}.`} To
          access this content, please pay ${amount} USDC.
        </p>
        {!isMainnet && (
          <p className="instructions">
            This is a testnet payment. You can get testnet USDC from{" "}
            <a
              href="https://near-faucet.io"
              target="_blank"
              rel="noopener noreferrer"
            >
              NEAR Faucet
            </a>
            .
          </p>
        )}
      </div>

      <div className="content w-full">
        {account && (
          <PaymentProgress
            currentStep={paymentStep}
            isProcessing={isProcessing}
            hasError={!!status && !isPaying}
          />
        )}
        <div className="payment-details">
          <div className="payment-row">
            <span className="payment-label">Wallet:</span>
            <span className="payment-value">
              {account ? `${getWalletDisplayName(walletId!)} - ${truncatedAccountId}` : "-"}
            </span>
          </div>
          <div className="payment-row">
            <span className="payment-label">Available balance:</span>
            <span className="payment-value">
              {account?.accountId ? (
                <button className="balance-button" onClick={() => setHideBalance((prev) => !prev)}>
                  {!hideBalance && formattedBalance
                    ? `$${formattedBalance} USDC`
                    : isFetchingBalance
                      ? "Loading..."
                      : "••••• USDC"}
                </button>
              ) : (
                "-"
              )}
            </span>
          </div>
          <div className="payment-row">
            <span className="payment-label">Amount:</span>
            <span className="payment-value">${amount} USDC</span>
          </div>
          <div className="payment-row">
            <span className="payment-label">Network:</span>
            <span className="payment-value">{chainName}</span>
          </div>
        </div>

        <div className="cta-container">
          {account ? (
            <>
              <button className="button button-secondary" onClick={handleDisconnect}>
                Disconnect
              </button>
              <button className="button button-primary" onClick={handlePayment} disabled={isPaying}>
                {isPaying ? <Spinner /> : "Pay now"}
              </button>
            </>
          ) : (
            <div className="wallet-options">
              {availableWallets.length === 0 ? (
                <p className="instructions">
                  No NEAR wallet detected. Please install{" "}
                  <a href="https://mynearwallet.com/" target="_blank" rel="noopener noreferrer">
                    MyNearWallet
                  </a>{" "}
                  or{" "}
                  <a href="https://meteorwallet.app/" target="_blank" rel="noopener noreferrer">
                    Meteor
                  </a>{" "}
                  wallet.
                </p>
              ) : (
                availableWallets.map((wallet) => (
                  <button
                    key={wallet}
                    className="button button-primary"
                    onClick={() => handleConnect(wallet)}
                    disabled={isConnecting}
                  >
                    {isConnecting ? <Spinner /> : `Connect ${getWalletDisplayName(wallet)}`}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {status && <div className="status">{status}</div>}
      </div>
    </div>
  );
}
