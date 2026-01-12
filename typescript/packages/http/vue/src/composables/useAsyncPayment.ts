import { ref, computed, type Ref, type ComputedRef } from "vue";
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

interface UseAsyncPaymentReturn<T> {
  /** Execute the payment */
  execute: () => Promise<T | null>;
  /** Current payment status */
  status: Ref<PaymentStatus>;
  /** Result of successful payment */
  result: Ref<T | null>;
  /** Error message if payment failed */
  error: Ref<string | null>;
  /** Whether payment is in progress */
  isLoading: ComputedRef<boolean>;
  /** Whether payment succeeded */
  isSuccess: ComputedRef<boolean>;
  /** Whether payment failed */
  isError: ComputedRef<boolean>;
  /** Reset the state */
  reset: () => void;
}

/**
 * Composable for managing async payment operations with loading states.
 *
 * @param options - Configuration including the payment function and callbacks.
 * @returns State and methods for managing the async payment.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useAsyncPayment } from "@t402/vue";
 *
 * const { execute, isLoading, isSuccess, error } = useAsyncPayment({
 *   paymentFn: async () => {
 *     const response = await fetch("/api/protected", {
 *       headers: { "X-Payment": paymentPayload },
 *     });
 *     return response.json();
 *   },
 *   onSuccess: (data) => console.log("Payment succeeded:", data),
 *   onError: (err) => console.error("Payment failed:", err),
 * });
 * </script>
 *
 * <template>
 *   <button @click="execute" :disabled="isLoading">
 *     {{ isLoading ? "Processing..." : "Pay Now" }}
 *   </button>
 * </template>
 * ```
 */
export function useAsyncPayment<T>(options: UseAsyncPaymentOptions<T>): UseAsyncPaymentReturn<T> {
  const { paymentFn, onSuccess, onError, onStart } = options;

  const status = ref<PaymentStatus>("idle");
  const result = ref<T | null>(null) as Ref<T | null>;
  const error = ref<string | null>(null);

  const isLoading = computed(() => status.value === "loading");
  const isSuccess = computed(() => status.value === "success");
  const isError = computed(() => status.value === "error");

  const execute = async (): Promise<T | null> => {
    status.value = "loading";
    error.value = null;
    onStart?.();

    try {
      const paymentResult = await paymentFn();
      result.value = paymentResult;
      status.value = "success";
      onSuccess?.(paymentResult);
      return paymentResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Payment failed";
      error.value = errorMessage;
      status.value = "error";
      onError?.(err instanceof Error ? err : new Error(errorMessage));
      return null;
    }
  };

  const reset = () => {
    status.value = "idle";
    result.value = null;
    error.value = null;
  };

  return {
    execute,
    status,
    result,
    error,
    isLoading,
    isSuccess,
    isError,
    reset,
  };
}
