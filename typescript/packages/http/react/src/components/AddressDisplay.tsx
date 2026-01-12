import React, { useState, useCallback } from "react";
import type { AddressDisplayProps } from "../types/index.js";
import { truncateAddress } from "../utils/index.js";

const containerStyles: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  fontFamily: "monospace",
  fontSize: "14px",
};

const addressStyles: React.CSSProperties = {
  color: "#374151",
};

const buttonStyles: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "4px",
  borderRadius: "4px",
  color: "#6b7280",
  transition: "all 0.15s ease",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const copiedStyles: React.CSSProperties = {
  ...buttonStyles,
  color: "#22c55e",
};

/**
 * A component to display blockchain addresses with optional copy functionality.
 *
 * @param props - Component props.
 * @returns The address display element.
 *
 * @example
 * ```tsx
 * import { AddressDisplay } from "@t402/react";
 *
 * function WalletInfo() {
 *   return (
 *     <AddressDisplay
 *       address="0x1234567890abcdef1234567890abcdef12345678"
 *       copyable={true}
 *       startChars={6}
 *       endChars={4}
 *     />
 *   );
 * }
 * ```
 */
export function AddressDisplay({
  address,
  startChars = 6,
  endChars = 4,
  copyable = false,
  className = "",
}: AddressDisplayProps) {
  const [copied, setCopied] = useState(false);

  const displayAddress = truncateAddress(address, startChars, endChars);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = address;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [address]);

  return (
    <span style={containerStyles} className={className} title={address}>
      <span style={addressStyles}>{displayAddress}</span>
      {copyable && (
        <button
          type="button"
          onClick={handleCopy}
          style={copied ? copiedStyles : buttonStyles}
          aria-label={copied ? "Copied" : "Copy address"}
        >
          {copied ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
      )}
    </span>
  );
}
