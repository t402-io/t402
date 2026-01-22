import { useState, useEffect, useCallback } from "react";

/**
 * Transaction status states
 */
export type TxStatus = "pending" | "confirming" | "confirmed" | "failed";

export interface TransactionStatusProps {
  /**
   * Transaction hash
   */
  txHash: string;
  /**
   * Network identifier (CAIP-2 format)
   */
  network: string;
  /**
   * Number of confirmations required (default: 1)
   */
  requiredConfirmations?: number;
  /**
   * Callback when transaction is confirmed
   */
  onConfirmed?: () => void;
  /**
   * Callback when transaction fails
   */
  onFailed?: (error: string) => void;
}

/**
 * Get block explorer URL for a transaction
 */
function getExplorerUrl(txHash: string, network: string): string | null {
  // EVM chains
  if (network.startsWith("eip155:")) {
    const chainId = parseInt(network.split(":")[1]);
    const explorers: Record<number, string> = {
      1: "https://etherscan.io/tx/",
      8453: "https://basescan.org/tx/",
      84532: "https://sepolia.basescan.org/tx/",
      42161: "https://arbiscan.io/tx/",
      421614: "https://sepolia.arbiscan.io/tx/",
      10: "https://optimistic.etherscan.io/tx/",
      11155420: "https://sepolia-optimism.etherscan.io/tx/",
      137: "https://polygonscan.com/tx/",
    };
    const baseUrl = explorers[chainId];
    return baseUrl ? `${baseUrl}${txHash}` : null;
  }

  // Solana
  if (network.startsWith("solana:")) {
    const ref = network.split(":")[1];
    const isDevnet = ref === "EtWTRABZaYq6iMfeYKouRu166VU2xqa1";
    const cluster = isDevnet ? "?cluster=devnet" : "";
    return `https://solscan.io/tx/${txHash}${cluster}`;
  }

  // TON
  if (network.startsWith("ton:")) {
    const ref = network.split(":")[1];
    const isTestnet = ref === "testnet";
    return isTestnet
      ? `https://testnet.tonscan.org/tx/${txHash}`
      : `https://tonscan.org/tx/${txHash}`;
  }

  // TRON
  if (network.startsWith("tron:")) {
    const ref = network.split(":")[1];
    if (ref === "nile") return `https://nile.tronscan.org/#/transaction/${txHash}`;
    if (ref === "shasta") return `https://shasta.tronscan.org/#/transaction/${txHash}`;
    return `https://tronscan.org/#/transaction/${txHash}`;
  }

  // Stacks
  if (network.startsWith("stacks:")) {
    const chainId = network.split(":")[1];
    const isTestnet = chainId === "2147483648";
    return isTestnet
      ? `https://explorer.hiro.so/txid/${txHash}?chain=testnet`
      : `https://explorer.hiro.so/txid/${txHash}`;
  }

  // Cosmos/Noble
  if (network.startsWith("cosmos:")) {
    const chainId = network.split(":")[1];
    if (chainId === "noble-1") return `https://www.mintscan.io/noble/tx/${txHash}`;
    if (chainId === "grand-1") return `https://testnet.mintscan.io/noble-testnet/tx/${txHash}`;
    return null;
  }

  // NEAR
  if (network.startsWith("near:")) {
    const ref = network.split(":")[1];
    const isTestnet = ref === "testnet";
    return isTestnet
      ? `https://testnet.nearblocks.io/txns/${txHash}`
      : `https://nearblocks.io/txns/${txHash}`;
  }

  return null;
}

/**
 * Truncate transaction hash for display
 */
function truncateHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

/**
 * Copy icon SVG
 */
function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M2 10V3a1 1 0 011-1h7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Check icon SVG
 */
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M11.5 4L5.5 10L2.5 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * External link icon SVG
 */
function ExternalLinkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M9 6.5v3a1 1 0 01-1 1H2.5a1 1 0 01-1-1V4a1 1 0 011-1H6M8 1.5h2.5m0 0V4m0-2.5L6 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Spinner for pending state
 */
function StatusSpinner() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className="tx-status-spinner"
      aria-hidden="true"
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="24"
        strokeDashoffset="12"
      />
    </svg>
  );
}

/**
 * Transaction status display component.
 * Shows transaction hash, explorer link, and confirmation status.
 */
export function TransactionStatus({
  txHash,
  network,
  requiredConfirmations = 1,
  onConfirmed,
  onFailed,
}: TransactionStatusProps) {
  const [status, setStatus] = useState<TxStatus>("pending");
  const [confirmations, setConfirmations] = useState(0);
  const [copied, setCopied] = useState(false);

  const explorerUrl = getExplorerUrl(txHash, network);

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(txHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = txHash;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [txHash]);

  // Simulate confirmation polling (in a real implementation, this would poll the blockchain)
  useEffect(() => {
    if (status === "confirmed" || status === "failed") return;

    // For demo purposes, simulate confirmation after a delay
    // In production, this would poll the blockchain for actual confirmation status
    const timer = setTimeout(() => {
      if (confirmations < requiredConfirmations) {
        setConfirmations(prev => prev + 1);
        setStatus("confirming");
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [confirmations, requiredConfirmations, status]);

  // Check if confirmed or failed
  useEffect(() => {
    if (confirmations >= requiredConfirmations && status !== "confirmed") {
      setStatus("confirmed");
      onConfirmed?.();
    }
    if (status === "failed") {
      onFailed?.("Transaction failed");
    }
  }, [confirmations, requiredConfirmations, status, onConfirmed, onFailed]);

  const getStatusText = () => {
    switch (status) {
      case "pending":
        return "Waiting for confirmation...";
      case "confirming":
        return `${confirmations}/${requiredConfirmations} confirmation${confirmations !== 1 ? "s" : ""}`;
      case "confirmed":
        return "Transaction confirmed";
      case "failed":
        return "Transaction failed";
      default:
        return "";
    }
  };

  const getStatusClass = () => {
    switch (status) {
      case "confirmed":
        return "tx-status-success";
      case "failed":
        return "tx-status-error";
      default:
        return "tx-status-pending";
    }
  };

  return (
    <div className="tx-status-container" role="status" aria-live="polite">
      <div className="tx-status-header">
        <span className="tx-status-label">Transaction</span>
        <div className={`tx-status-badge ${getStatusClass()}`}>
          {status === "pending" || status === "confirming" ? (
            <StatusSpinner />
          ) : status === "confirmed" ? (
            <CheckIcon />
          ) : null}
          <span>{getStatusText()}</span>
        </div>
      </div>

      <div className="tx-hash-row">
        <code className="tx-hash">{truncateHash(txHash)}</code>
        <div className="tx-hash-actions">
          <button
            className="tx-action-button"
            onClick={copyToClipboard}
            title={copied ? "Copied!" : "Copy transaction hash"}
            aria-label={copied ? "Copied to clipboard" : "Copy transaction hash"}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </button>
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="tx-action-button"
              title="View on explorer"
              aria-label="View transaction on block explorer"
            >
              <ExternalLinkIcon />
            </a>
          )}
        </div>
      </div>

      {status === "confirming" && (
        <div
          className="tx-confirmations-bar"
          role="progressbar"
          aria-valuenow={confirmations}
          aria-valuemax={requiredConfirmations}
        >
          <div
            className="tx-confirmations-progress"
            style={{ width: `${(confirmations / requiredConfirmations) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Hook to manage transaction status
 */
export function useTransactionStatus() {
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txNetwork, setTxNetwork] = useState<string | null>(null);

  const setTransaction = useCallback((hash: string, network: string) => {
    setTxHash(hash);
    setTxNetwork(network);
  }, []);

  const clearTransaction = useCallback(() => {
    setTxHash(null);
    setTxNetwork(null);
  }, []);

  return {
    txHash,
    txNetwork,
    setTransaction,
    clearTransaction,
    hasTransaction: txHash !== null,
  };
}
