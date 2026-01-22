import type { PaymentRequirements } from "@t402/core/types";
import { getNetworkDisplayName, getNetworkIcon } from "../paywallUtils";

interface NetworkSelectorProps {
  accepts: PaymentRequirements[];
  onSelect: (requirement: PaymentRequirements) => void;
}

/**
 * Network selector component for multi-network payment options.
 * Displays available payment networks and allows user to choose.
 */
export function NetworkSelector({ accepts, onSelect }: NetworkSelectorProps) {
  return (
    <div className="network-selector" role="listbox" aria-label="Select payment network">
      <div className="network-selector-header">
        <h2 className="network-selector-title">Choose Payment Network</h2>
        <p className="network-selector-subtitle">
          Select your preferred network to complete the payment
        </p>
      </div>
      <div className="network-options">
        {accepts.map((req, index) => {
          const networkName = getNetworkDisplayName(req.network);
          const icon = getNetworkIcon(req.network);
          const amount = formatAmount(req);

          return (
            <button
              key={`${req.network}-${req.scheme}-${index}`}
              className="network-option"
              onClick={() => onSelect(req)}
              role="option"
              aria-label={`Pay ${amount} on ${networkName}`}
            >
              <div className="network-option-icon" aria-hidden="true">
                {icon}
              </div>
              <div className="network-option-info">
                <span className="network-option-name">{networkName}</span>
                <span className="network-option-amount">{amount} USDT</span>
              </div>
              <div className="network-option-arrow" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M7.5 5L12.5 10L7.5 15"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Format the amount from payment requirements
 */
function formatAmount(req: PaymentRequirements): string {
  // Get decimals based on network (most USDT uses 6 decimals)
  const decimals = getDecimals(req.network);
  const rawAmount = req.amount || req.maxAmountRequired || "0";
  const amount = parseFloat(rawAmount) / Math.pow(10, decimals);
  return amount.toFixed(2);
}

/**
 * Get token decimals for a network
 */
function getDecimals(_network: string): number {
  // TON, TRON, Solana USDT all use 6 decimals
  // EVM USDT0 uses 6 decimals
  return 6;
}
