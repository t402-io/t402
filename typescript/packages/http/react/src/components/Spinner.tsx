import React from "react";
import type { SpinnerProps } from "../types/index.js";

const sizeClasses = {
  sm: { width: 16, height: 16, borderWidth: 2 },
  md: { width: 24, height: 24, borderWidth: 3 },
  lg: { width: 32, height: 32, borderWidth: 4 },
};

/**
 * A simple loading spinner component.
 *
 * @param props - Component props.
 * @returns The spinner element.
 *
 * @example
 * ```tsx
 * import { Spinner } from "@t402/react";
 *
 * function LoadingState() {
 *   return (
 *     <div>
 *       <Spinner size="md" />
 *       <span>Loading...</span>
 *     </div>
 *   );
 * }
 * ```
 */
export function Spinner({ size = "md", className = "" }: SpinnerProps) {
  const { width, height, borderWidth } = sizeClasses[size];

  const spinnerStyle: React.CSSProperties = {
    width,
    height,
    border: `${borderWidth}px solid #e5e7eb`,
    borderTopColor: "#3b82f6",
    borderRadius: "50%",
    animation: "t402-spin 0.8s linear infinite",
    display: "inline-block",
  };

  return (
    <>
      <style>
        {`@keyframes t402-spin { to { transform: rotate(360deg); } }`}
      </style>
      <span
        style={spinnerStyle}
        className={className}
        role="status"
        aria-label="Loading"
      />
    </>
  );
}
