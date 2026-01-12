import { useState, useCallback } from "react";
import type { PaymentRequired } from "@t402/core/types";
import type { PaymentStatus } from "../types/index.js";

interface UsePaymentRequiredOptions {
  /** Callback when payment is successful */
  onSuccess?: (response: Response) => void;
  /** Callback when payment fails */
  onError?: (error: Error) => void;
}

interface UsePaymentRequiredResult {
  /** The payment required data from a 402 response */
  paymentRequired: PaymentRequired | null;
  /** Current status of the fetch operation */
  status: PaymentStatus;
  /** Error message if status is 'error' */
  error: string | null;
  /** Fetch a resource and capture 402 response */
  fetchResource: (url: string, options?: RequestInit) => Promise<Response | null>;
  /** Reset the state */
  reset: () => void;
}

/**
 * Hook to fetch a resource and capture 402 Payment Required responses.
 *
 * @param options - Configuration options.
 * @returns State and methods for handling 402 responses.
 *
 * @example
 * ```tsx
 * import { usePaymentRequired } from "@t402/react";
 *
 * function ProtectedResource() {
 *   const { paymentRequired, status, fetchResource } = usePaymentRequired({
 *     onSuccess: (response) => console.log("Access granted!"),
 *   });
 *
 *   const handleFetch = async () => {
 *     const response = await fetchResource("/api/protected");
 *     if (response && response.ok) {
 *       const data = await response.json();
 *       // Handle successful response
 *     }
 *   };
 *
 *   if (paymentRequired) {
 *     return <PaymentUI data={paymentRequired} />;
 *   }
 *
 *   return <button onClick={handleFetch}>Access Resource</button>;
 * }
 * ```
 */
export function usePaymentRequired(options: UsePaymentRequiredOptions = {}): UsePaymentRequiredResult {
  const { onSuccess, onError } = options;

  const [paymentRequired, setPaymentRequired] = useState<PaymentRequired | null>(null);
  const [status, setStatus] = useState<PaymentStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const fetchResource = useCallback(
    async (url: string, fetchOptions?: RequestInit): Promise<Response | null> => {
      setStatus("loading");
      setError(null);
      setPaymentRequired(null);

      try {
        const response = await fetch(url, fetchOptions);

        if (response.status === 402) {
          const data = (await response.json()) as PaymentRequired;
          setPaymentRequired(data);
          setStatus("idle");
          return null;
        }

        if (response.ok) {
          setStatus("success");
          onSuccess?.(response);
          return response;
        }

        throw new Error(`Request failed with status ${response.status}`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        setStatus("error");
        onError?.(err instanceof Error ? err : new Error(errorMessage));
        return null;
      }
    },
    [onSuccess, onError],
  );

  const reset = useCallback(() => {
    setPaymentRequired(null);
    setStatus("idle");
    setError(null);
  }, []);

  return {
    paymentRequired,
    status,
    error,
    fetchResource,
    reset,
  };
}
