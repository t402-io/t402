import { useCallback, useEffect, useState } from "react";
import { Address } from "@ton/core";

import { registerExactTonScheme } from "@t402/ton/exact/client";
import { t402Client } from "@t402/core/client";
import type { PaymentRequired } from "@t402/core/types";

import { Spinner } from "./Spinner";
import { getNetworkDisplayName } from "../paywallUtils";
import { PaymentProgress, type PaymentStep } from "../components/PaymentProgress";
import { useTonBalance } from "./ton/useTonBalance";
import { useTonSigner, createGetJettonWalletAddress } from "./ton/useTonSigner";
import { TON_NETWORKS, type TonNetwork } from "./ton/types";

type TonPaywallProps = {
  paymentRequired: PaymentRequired;
  onSuccessfulResponse: (response: Response) => Promise<void>;
};

/**
 * Load the TonConnect provider component dynamically.
 * Tries @ton/appkit-react (AppKitProvider) first, falls back to @tonconnect/ui-react.
 */
let providerModulePromise: Promise<{
  Provider: React.ComponentType<{ children: React.ReactNode; manifestUrl?: string }>;
  useTonConnectUI: () => [
    {
      openModal: () => Promise<void>;
      disconnect: () => Promise<void>;
    },
  ];
  useTonWallet: () => { account?: { address: string; chain?: string } } | null;
}> | null = null;

function loadProviderModule() {
  if (!providerModulePromise) {
    providerModulePromise = (async () => {
      // @tonconnect/ui-react is the stable fallback
      const tonconnect = await import("@tonconnect/ui-react");
      return {
        Provider: tonconnect.TonConnectUIProvider as unknown as React.ComponentType<{
          children: React.ReactNode;
          manifestUrl?: string;
        }>,
        useTonConnectUI: tonconnect.useTonConnectUI as unknown as () => [
          { openModal: () => Promise<void>; disconnect: () => Promise<void> },
        ],
        useTonWallet: tonconnect.useTonWallet as unknown as () => {
          account?: { address: string; chain?: string };
        } | null,
      };
    })();
  }
  return providerModulePromise;
}

/**
 * Inner paywall component that uses TonConnect hooks
 */
function TonPaywallInner({ paymentRequired, onSuccessfulResponse }: TonPaywallProps) {
  const [providerModule, setProviderModule] = useState<Awaited<
    ReturnType<typeof loadProviderModule>
  > | null>(null);

  useEffect(() => {
    loadProviderModule().then(setProviderModule);
  }, []);

  if (!providerModule) {
    return null;
  }

  return (
    <TonPaywallContent
      paymentRequired={paymentRequired}
      onSuccessfulResponse={onSuccessfulResponse}
      providerModule={providerModule}
    />
  );
}

function TonPaywallContent({
  paymentRequired,
  onSuccessfulResponse,
  providerModule,
}: TonPaywallProps & {
  providerModule: Awaited<ReturnType<typeof loadProviderModule>>;
}) {
  const [tonConnectUI] = providerModule.useTonConnectUI();
  const wallet = providerModule.useTonWallet();
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
  const isMainnet = network === TON_NETWORKS.MAINNET;
  const targetNetwork: TonNetwork = isMainnet ? TON_NETWORKS.MAINNET : TON_NETWORKS.TESTNET;

  // Get wallet address in friendly format
  const walletAddress = wallet?.account?.address
    ? Address.parse(wallet.account.address).toString({ bounceable: false })
    : null;

  const {
    balance,
    formattedBalance,
    isFetching: isFetchingBalance,
    refreshBalance,
    resetBalance,
  } = useTonBalance({
    address: walletAddress,
    paymentRequired,
    onStatus: setStatus,
  });

  const tonSigner = useTonSigner(wallet, targetNetwork);

  // Refresh balance when wallet connects
  useEffect(() => {
    if (walletAddress) {
      refreshBalance(walletAddress);
    }
  }, [walletAddress, refreshBalance]);

  // Update payment step based on connection state
  useEffect(() => {
    if (!wallet) {
      setPaymentStep("connect");
    } else if (paymentStep === "connect") {
      setPaymentStep("sign");
    }
  }, [wallet, paymentStep]);

  const handleConnect = useCallback(async () => {
    setStatus("Connecting to wallet...");
    try {
      await tonConnectUI.openModal();
    } catch (error) {
      console.error("Failed to connect wallet", error);
      setStatus(error instanceof Error ? error.message : "Failed to connect wallet.");
    }
  }, [tonConnectUI]);

  const handleDisconnect = useCallback(async () => {
    try {
      await tonConnectUI.disconnect();
      resetBalance();
      setStatus("");
    } catch (error) {
      console.error("Failed to disconnect", error);
      setStatus(error instanceof Error ? error.message : "Failed to disconnect.");
    }
  }, [tonConnectUI, resetBalance]);

  const handlePayment = useCallback(async () => {
    if (!t402) {
      return;
    }

    if (!tonSigner || !walletAddress) {
      setStatus("Connect a TON wallet before paying.");
      return;
    }

    setIsPaying(true);
    setIsProcessing(true);

    try {
      // Check balance
      if (balance === null || balance === 0n) {
        setStatus("Checking USDT balance...");
        const latestBalance = await refreshBalance();
        if (!latestBalance || latestBalance === 0n) {
          throw new Error(`Insufficient balance. Make sure you have USDT on ${chainName}.`);
        }
      }

      setPaymentStep("sign");
      setStatus("Creating payment signature...");

      const client = new t402Client();
      registerExactTonScheme(client, {
        signer: tonSigner,
        getJettonWalletAddress: createGetJettonWalletAddress(targetNetwork),
      });

      const paymentPayload = await client.createPaymentPayload(paymentRequired);

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
    tonSigner,
    walletAddress,
    balance,
    refreshBalance,
    chainName,
    targetNetwork,
    paymentRequired,
    onSuccessfulResponse,
  ]);

  // Clear status when wallet connects
  useEffect(() => {
    if (wallet) {
      setStatus("");
    }
  }, [wallet]);

  const truncatedAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : "-";

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
            Need TON Testnet USDT?{" "}
            <a href="https://t.me/testgiver_ton_bot" target="_blank" rel="noopener noreferrer">
              Get testnet TON <u>here</u>
            </a>{" "}
            and use a testnet DEX.
          </p>
        )}
      </div>

      <div className="content w-full">
        {wallet && (
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
              {walletAddress ? (
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
          {wallet ? (
            <button className="button button-secondary" onClick={handleDisconnect}>
              Disconnect
            </button>
          ) : (
            <button className="button button-primary" onClick={handleConnect}>
              Connect wallet
            </button>
          )}
          {wallet && (
            <button className="button button-primary" onClick={handlePayment} disabled={isPaying}>
              {isPaying ? <Spinner /> : "Pay now"}
            </button>
          )}
        </div>

        {status && <div className="status">{status}</div>}
      </div>
    </div>
  );
}

/**
 * Paywall experience for TON networks.
 *
 * @param props - Component props.
 * @param props.paymentRequired - Payment required response with accepts array.
 * @param props.onSuccessfulResponse - Callback invoked on successful 402 response.
 * @returns JSX element.
 */
export function TonPaywall({ paymentRequired, onSuccessfulResponse }: TonPaywallProps) {
  const t402 = window.t402;
  const manifestUrl = t402.tonConnectManifestUrl || "https://t402.io/tonconnect-manifest.json";
  const [ProviderComponent, setProviderComponent] = useState<React.ComponentType<{
    children: React.ReactNode;
    manifestUrl?: string;
  }> | null>(null);

  useEffect(() => {
    loadProviderModule().then(mod => setProviderComponent(() => mod.Provider));
  }, []);

  if (!ProviderComponent) {
    return null;
  }

  return (
    <ProviderComponent manifestUrl={manifestUrl}>
      <TonPaywallInner
        paymentRequired={paymentRequired}
        onSuccessfulResponse={onSuccessfulResponse}
      />
    </ProviderComponent>
  );
}
