import React from "react";
import type { PaymentStatusProps } from "../types/index.js";
import { Spinner } from "./Spinner.js";

const statusStyles: Record<string, React.CSSProperties> = {
  idle: {
    backgroundColor: "#f3f4f6",
    color: "#374151",
    borderColor: "#d1d5db",
  },
  loading: {
    backgroundColor: "#eff6ff",
    color: "#1d4ed8",
    borderColor: "#93c5fd",
  },
  success: {
    backgroundColor: "#f0fdf4",
    color: "#166534",
    borderColor: "#86efac",
  },
  error: {
    backgroundColor: "#fef2f2",
    color: "#dc2626",
    borderColor: "#fca5a5",
  },
};

const baseStyles: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "12px 16px",
  borderRadius: "8px",
  border: "1px solid",
  fontSize: "14px",
  fontWeight: 500,
};

const icons: Record<string, string> = {
  idle: "○",
  loading: "",
  success: "✓",
  error: "✕",
};

/**
 * A component to display payment status with appropriate styling.
 *
 * @param props - Component props.
 * @returns The status display element.
 *
 * @example
 * ```tsx
 * import { PaymentStatus } from "@t402/react";
 *
 * function PaymentFlow() {
 *   const [status, setStatus] = useState("idle");
 *
 *   return (
 *     <PaymentStatus
 *       status={status}
 *       message={status === "loading" ? "Processing payment..." : undefined}
 *     />
 *   );
 * }
 * ```
 */
export function PaymentStatus({ status, message, className = "" }: PaymentStatusProps) {
  const statusStyle = statusStyles[status] || statusStyles.idle;

  const defaultMessages: Record<string, string> = {
    idle: "Ready to pay",
    loading: "Processing...",
    success: "Payment successful",
    error: "Payment failed",
  };

  const displayMessage = message || defaultMessages[status];

  return (
    <div
      style={{ ...baseStyles, ...statusStyle }}
      className={className}
      role="status"
      aria-live="polite"
    >
      {status === "loading" ? (
        <Spinner size="sm" />
      ) : (
        <span style={{ fontSize: "16px" }}>{icons[status]}</span>
      )}
      <span>{displayMessage}</span>
    </div>
  );
}
