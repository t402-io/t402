import React from "react";
import type { PaymentDetailsProps } from "../types/index.js";
import {
  formatTokenAmount,
  getNetworkDisplayName,
  getAssetDisplayName,
  truncateAddress,
} from "../utils/index.js";

const containerStyles: React.CSSProperties = {
  backgroundColor: "#f9fafb",
  borderRadius: "12px",
  padding: "16px",
  border: "1px solid #e5e7eb",
};

const rowStyles: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "8px 0",
  borderBottom: "1px solid #e5e7eb",
};

const lastRowStyles: React.CSSProperties = {
  ...rowStyles,
  borderBottom: "none",
};

const labelStyles: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "14px",
};

const valueStyles: React.CSSProperties = {
  color: "#111827",
  fontSize: "14px",
  fontWeight: 500,
};

const amountStyles: React.CSSProperties = {
  color: "#111827",
  fontSize: "20px",
  fontWeight: 700,
};

/**
 * A component to display payment requirement details.
 *
 * @param props - Component props.
 * @returns The payment details element.
 *
 * @example
 * ```tsx
 * import { PaymentDetails } from "@t402/react";
 *
 * function PaymentFlow({ requirement }) {
 *   return (
 *     <PaymentDetails
 *       requirement={requirement}
 *       showNetwork={true}
 *       showAsset={true}
 *       showRecipient={true}
 *     />
 *   );
 * }
 * ```
 */
export function PaymentDetails({
  requirement,
  showNetwork = true,
  showAsset = true,
  showRecipient = false,
  className = "",
}: PaymentDetailsProps) {
  const formattedAmount = formatTokenAmount(requirement.amount);
  const assetName = getAssetDisplayName(requirement.asset);
  const networkName = getNetworkDisplayName(requirement.network);
  const truncatedAddress = truncateAddress(requirement.payTo);

  return (
    <div style={containerStyles} className={className}>
      {/* Amount row - always shown */}
      <div style={rowStyles}>
        <span style={labelStyles}>Amount</span>
        <span style={amountStyles}>
          {formattedAmount} {assetName}
        </span>
      </div>

      {/* Network row */}
      {showNetwork && (
        <div style={rowStyles}>
          <span style={labelStyles}>Network</span>
          <span style={valueStyles}>{networkName}</span>
        </div>
      )}

      {/* Asset row */}
      {showAsset && (
        <div style={rowStyles}>
          <span style={labelStyles}>Asset</span>
          <span style={valueStyles}>{assetName}</span>
        </div>
      )}

      {/* Recipient row */}
      {showRecipient && (
        <div style={lastRowStyles}>
          <span style={labelStyles}>Recipient</span>
          <span style={{ ...valueStyles, fontFamily: "monospace" }} title={requirement.payTo}>
            {truncatedAddress}
          </span>
        </div>
      )}
    </div>
  );
}
