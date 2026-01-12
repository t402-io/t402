import React, { useState, useCallback } from "react";
import type { PaymentButtonProps } from "../types/index.js";
import { Spinner } from "./Spinner.js";

const baseStyles: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  fontWeight: 600,
  borderRadius: "8px",
  cursor: "pointer",
  transition: "all 0.15s ease",
  border: "none",
  fontFamily: "inherit",
};

const variantStyles: Record<string, React.CSSProperties> = {
  primary: {
    backgroundColor: "#2563eb",
    color: "#ffffff",
  },
  secondary: {
    backgroundColor: "#6b7280",
    color: "#ffffff",
  },
  outline: {
    backgroundColor: "transparent",
    color: "#2563eb",
    border: "2px solid #2563eb",
  },
};

const sizeStyles: Record<string, React.CSSProperties> = {
  sm: {
    padding: "8px 16px",
    fontSize: "14px",
  },
  md: {
    padding: "12px 24px",
    fontSize: "16px",
  },
  lg: {
    padding: "16px 32px",
    fontSize: "18px",
  },
};

const disabledStyles: React.CSSProperties = {
  opacity: 0.6,
  cursor: "not-allowed",
};

/**
 * A payment button component with loading state support.
 *
 * @param props - Component props.
 * @returns The button element.
 *
 * @example
 * ```tsx
 * import { PaymentButton } from "@t402/react";
 *
 * function PaymentFlow() {
 *   const [loading, setLoading] = useState(false);
 *
 *   const handlePayment = async () => {
 *     setLoading(true);
 *     await processPayment();
 *     setLoading(false);
 *   };
 *
 *   return (
 *     <PaymentButton
 *       onClick={handlePayment}
 *       loading={loading}
 *       variant="primary"
 *       size="lg"
 *     >
 *       Pay $10.00
 *     </PaymentButton>
 *   );
 * }
 * ```
 */
export function PaymentButton({
  onClick,
  disabled = false,
  loading = false,
  children = "Pay Now",
  className = "",
  variant = "primary",
  size = "md",
}: PaymentButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = useCallback(async () => {
    if (disabled || loading || !onClick) return;
    await onClick();
  }, [disabled, loading, onClick]);

  const isDisabled = disabled || loading;

  const combinedStyles: React.CSSProperties = {
    ...baseStyles,
    ...variantStyles[variant],
    ...sizeStyles[size],
    ...(isDisabled ? disabledStyles : {}),
    ...(isHovered && !isDisabled
      ? { filter: "brightness(1.1)", transform: "translateY(-1px)" }
      : {}),
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDisabled}
      className={className}
      style={combinedStyles}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}
