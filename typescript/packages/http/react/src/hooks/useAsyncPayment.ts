import { useState, useCallback, useRef } from "react";
import type { PaymentStatus } from "../types/index.js";

interface UseAsyncPaymentOptions<T> {
  /** The async payment function to execute */
  paymentFn: () => Promise<T>;
  /** Callback on successful payment */
  onSuccess?: (result: T) => void;
  /** Callback on payment error */
  onError?: (error: Error) => void;
  /** Callback when payment starts */
  onStart?: () => void;
}

interface UseAsyncPaymentResult<T> {
  /** Execute the payment */
  execute: () => Promise<T | null>;
  /** Current payment status */
  status: PaymentStatus;
  /** Result of successful payment */
  result: T | null;
  /** Error message if payment failed */
  error: string | null;
  /** Whether payment is in progress */
  isLoading: boolean;
  /** Whether payment succeeded */
  isSuccess: boolean;
  /** Whether payment failed */
  isError: boolean;
  /** Reset the state */
  reset: () => void;
}

/**
 * Hook for managing async payment operations with loading states.
 *
 * @param options - Configuration including the payment function and callbacks.
 * @returns State and methods for managing the async payment.
 *
 * @example
 * ```tsx
 * import { useAsyncPayment } from "@t402/react";
 *
 * function PaymentButton({ paymentPayload }) {
 *   const { execute, isLoading, isSuccess, error } = useAsyncPayment({
 *     paymentFn: async () => {
 *       const response = await fetch("/api/protected", {
 *         headers: { "X-Payment": paymentPayload },
 *       });
 *       return response.json();
 *     },
 *     onSuccess: (data) => console.log("Payment succeeded:", data),
 *     onError: (err) => console.error("Payment failed:", err),
 *   });
 *
 *   return (
 *     <button onClick={execute} disabled={isLoading}>
 *       {isLoading ? "Processing..." : "Pay Now"}
 *     </button>
 *   );
 * }
 * ```
 */
export function useAsyncPayment<T>(options: UseAsyncPaymentOptions<T>): UseAsyncPaymentResult<T> {
  const { paymentFn, onSuccess, onError, onStart } = options;

  const [status, setStatus] = useState<PaymentStatus>("idle");
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Use ref to track if component is mounted
  const isMountedRef = useRef(true);

  const execute = useCallback(async (): Promise<T | null> => {
    setStatus("loading");
    setError(null);
    onStart?.();

    try {
      const paymentResult = await paymentFn();

      if (isMountedRef.current) {
        setResult(paymentResult);
        setStatus("success");
        onSuccess?.(paymentResult);
      }

      return paymentResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Payment failed";

      if (isMountedRef.current) {
        setError(errorMessage);
        setStatus("error");
      }

      onError?.(err instanceof Error ? err : new Error(errorMessage));
      return null;
    }
  }, [paymentFn, onSuccess, onError, onStart]);

  const reset = useCallback(() => {
    setStatus("idle");
    setResult(null);
    setError(null);
  }, []);

  return {
    execute,
    status,
    result,
    error,
    isLoading: status === "loading",
    isSuccess: status === "success",
    isError: status === "error",
    reset,
  };
}
