import { useCallback, useEffect, useState } from "react";

import { registerExactTronScheme } from "@t402/tron/exact/client";
import { t402Client } from "@t402/core/client";
import type { PaymentRequired } from "@t402/core/types";

import { Spinner } from "./Spinner";
import { getNetworkDisplayName } from "../paywallUtils";
import { useTronWallet, formatTronAddress } from "./tron/useTronWallet";
import { useTronBalance } from "./tron/useTronBalance";
import { useTronSigner } from "./tron/useTronSigner";
import { TRON_NETWORKS, type TronNetwork } from "./tron/types";
import { isTronMainnet } from "./tron/rpc";

type TronPaywallProps = {
  paymentRequired: PaymentRequired;
  onSuccessfulResponse: (response: Response) => Promise<void>;
};

/**
 * Paywall experience for TRON networks.
 *
 * @param props - Component props.
 * @param props.paymentRequired - Payment required response with accepts array.
 * @param props.onSuccessfulResponse - Callback invoked on successful 402 response.
 * @returns JSX element.
 */
export function TronPaywall({ paymentRequired, onSuccessfulResponse }: TronPaywallProps) {
  const [status, setStatus] = useState<string>("");
  const [isPaying, setIsPaying] = useState(false);
  const [hideBalance, setHideBalance] = useState(true);

  const t402 = window.t402;
  const amount = t402.amount;

  const firstRequirement = paymentRequired.accepts[0];
  if (!firstRequirement) {
    throw new Error("No payment requirements in paymentRequired.accepts");
  }

  const network = firstRequirement.network;
  const chainName = getNetworkDisplayName(network);
  const isMainnet = isTronMainnet(network);
  const targetNetwork: TronNetwork = isMainnet ? TRON_NETWORKS.MAINNET : TRON_NETWORKS.NILE;

  const {
    address,
    isConnected,
    isInstalled,
    isConnecting,
    connect,
    disconnect,
  } = useTronWallet(setStatus);

  const {
    balance,
    formattedBalance,
    isFetching: isFetchingBalance,
    refreshBalance,
    resetBalance,
  } = useTronBalance({
    address,
    paymentRequired,
    onStatus: setStatus,
  });

  const tronSigner = useTronSigner(address, targetNetwork);

  // Refresh balance when wallet connects
  useEffect(() => {
    if (address) {
      refreshBalance(address);
    }
  }, [address, refreshBalance]);

  const handleConnect = useCallback(async () => {
    await connect();
  }, [connect]);

  const handleDisconnect = useCallback(() => {
    disconnect();
    resetBalance();
    setStatus("");
  }, [disconnect, resetBalance]);

  const handlePayment = useCallback(async () => {
    if (!t402) {
      return;
    }

    if (!tronSigner || !address) {
      setStatus("Connect a TRON wallet before paying.");
      return;
    }

    setIsPaying(true);

    try {
      // Check balance
      if (balance === null || balance === 0n) {
        setStatus("Checking USDT balance...");
        const latestBalance = await refreshBalance();
        if (!latestBalance || latestBalance === 0n) {
          throw new Error(`Insufficient balance. Make sure you have USDT on ${chainName}.`);
        }
      }

      setStatus("Creating payment signature...");

      const client = new t402Client();
      registerExactTronScheme(client, {
        signer: tronSigner,
      });

      const paymentPayload = await client.createPaymentPayload(paymentRequired);

      const paymentHeader = btoa(JSON.stringify(paymentPayload));

      setStatus("Requesting content with payment...");
      const response = await fetch(t402.currentUrl, {
        headers: {
          "PAYMENT-SIGNATURE": paymentHeader,
          "Access-Control-Expose-Headers": "PAYMENT-RESPONSE",
        },
      });

      if (response.ok) {
        await onSuccessfulResponse(response);
      } else {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Payment failed.");
    } finally {
      setIsPaying(false);
    }
  }, [
    t402,
    tronSigner,
    address,
    balance,
    refreshBalance,
    chainName,
    paymentRequired,
    onSuccessfulResponse,
  ]);

  const truncatedAddress = address ? formatTronAddress(address) : "-";

  return (
    <div className="container gap-8">
      <div className="header">
        <h1 className="title">Payment Required</h1>
        <p>
          {paymentRequired.resource?.description && `${paymentRequired.resource.description}.`} To
          access this content, please pay ${amount} {chainName} USDT.
        </p>
        {!isMainnet && (
          <p className="instructions">
            Need TRON Testnet USDT?{" "}
            <a
              href="https://nileex.io/join/getJoinPage"
              target="_blank"
              rel="noopener noreferrer"
            >
              Get testnet TRX <u>here</u>
            </a>{" "}
            and swap for USDT.
          </p>
        )}
      </div>

      <div className="content w-full">
        <div className="payment-details">
          <div className="payment-row">
            <span className="payment-label">Wallet:</span>
            <span className="payment-value">{truncatedAddress}</span>
          </div>
          <div className="payment-row">
            <span className="payment-label">Available balance:</span>
            <span className="payment-value">
              {address ? (
                <button className="balance-button" onClick={() => setHideBalance(prev => !prev)}>
                  {!hideBalance && formattedBalance
                    ? `$${formattedBalance} USDT`
                    : isFetchingBalance
                      ? "Loading..."
                      : "••••• USDT"}
                </button>
              ) : (
                "-"
              )}
            </span>
          </div>
          <div className="payment-row">
            <span className="payment-label">Amount:</span>
            <span className="payment-value">${amount} USDT</span>
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
          ) : (
            <button
              className="button button-primary"
              onClick={handleConnect}
              disabled={isConnecting}
            >
              {isConnecting ? <Spinner /> : "Connect wallet"}
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
            Install{" "}
            <a
              href="https://www.tronlink.org/"
              target="_blank"
              rel="noopener noreferrer"
            >
              TronLink wallet
            </a>{" "}
            to continue, then refresh this page.
          </div>
        )}

        {status && <div className="status">{status}</div>}
      </div>
    </div>
  );
}
