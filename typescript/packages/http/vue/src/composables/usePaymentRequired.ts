import { ref, type Ref } from "vue";
import type { PaymentRequired } from "@t402/core/types";
import type { PaymentStatus } from "../types/index.js";

interface UsePaymentRequiredOptions {
  /** Callback when payment is successful */
  onSuccess?: (response: Response) => void;
  /** Callback when payment fails */
  onError?: (error: Error) => void;
}

interface UsePaymentRequiredReturn {
  /** The payment required data from a 402 response */
  paymentRequired: Ref<PaymentRequired | null>;
  /** Current status of the fetch operation */
  status: Ref<PaymentStatus>;
  /** Error message if status is 'error' */
  error: Ref<string | null>;
  /** Fetch a resource and capture 402 response */
  fetchResource: (url: string, options?: RequestInit) => Promise<Response | null>;
  /** Reset the state */
  reset: () => void;
}

/**
 * Composable to fetch a resource and capture 402 Payment Required responses.
 *
 * @param options - Configuration options.
 * @returns State and methods for handling 402 responses.
 *
 * @example
 * ```vue
 * <script setup>
 * import { usePaymentRequired } from "@t402/vue";
 *
 * const { paymentRequired, status, fetchResource } = usePaymentRequired({
 *   onSuccess: (response) => console.log("Access granted!"),
 * });
 *
 * const handleFetch = async () => {
 *   const response = await fetchResource("/api/protected");
 *   if (response?.ok) {
 *     const data = await response.json();
 *     // Handle successful response
 *   }
 * };
 * </script>
 * ```
 */
export function usePaymentRequired(options: UsePaymentRequiredOptions = {}): UsePaymentRequiredReturn {
  const { onSuccess, onError } = options;

  const paymentRequired = ref<PaymentRequired | null>(null);
  const status = ref<PaymentStatus>("idle");
  const error = ref<string | null>(null);

  const fetchResource = async (url: string, fetchOptions?: RequestInit): Promise<Response | null> => {
    status.value = "loading";
    error.value = null;
    paymentRequired.value = null;

    try {
      const response = await fetch(url, fetchOptions);

      if (response.status === 402) {
        const data = (await response.json()) as PaymentRequired;
        paymentRequired.value = data;
        status.value = "idle";
        return null;
      }

      if (response.ok) {
        status.value = "success";
        onSuccess?.(response);
        return response;
      }

      throw new Error(`Request failed with status ${response.status}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      error.value = errorMessage;
      status.value = "error";
      onError?.(err instanceof Error ? err : new Error(errorMessage));
      return null;
    }
  };

  const reset = () => {
    paymentRequired.value = null;
    status.value = "idle";
    error.value = null;
  };

  return {
    paymentRequired,
    status,
    error,
    fetchResource,
    reset,
  };
}
