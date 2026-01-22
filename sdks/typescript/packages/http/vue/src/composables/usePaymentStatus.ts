import { ref, type Ref } from "vue";
import type { PaymentStatus } from "../types/index.js";

interface StatusMessage {
  /** Message text */
  text: string;
  /** Message type */
  type: "info" | "success" | "error" | "warning";
  /** Optional auto-dismiss timeout in ms */
  timeout?: number;
}

interface UsePaymentStatusReturn {
  /** Current payment status */
  status: Ref<PaymentStatus>;
  /** Current status message */
  message: Ref<StatusMessage | null>;
  /** Set the status */
  setStatus: (status: PaymentStatus, message?: string) => void;
  /** Set a success message */
  setSuccess: (message: string, timeout?: number) => void;
  /** Set an error message */
  setError: (message: string) => void;
  /** Set an info message */
  setInfo: (message: string, timeout?: number) => void;
  /** Set a warning message */
  setWarning: (message: string, timeout?: number) => void;
  /** Clear the current message */
  clearMessage: () => void;
  /** Reset to idle state */
  reset: () => void;
}

/**
 * Composable for managing payment status and status messages.
 *
 * @returns State and methods for status management.
 *
 * @example
 * ```vue
 * <script setup>
 * import { usePaymentStatus } from "@t402/vue";
 *
 * const {
 *   status,
 *   message,
 *   setStatus,
 *   setSuccess,
 *   setError,
 * } = usePaymentStatus();
 *
 * const handlePayment = async () => {
 *   setStatus("loading", "Processing payment...");
 *   try {
 *     await processPayment();
 *     setSuccess("Payment successful!", 3000);
 *   } catch (err) {
 *     setError("Payment failed. Please try again.");
 *   }
 * };
 * </script>
 * ```
 */
export function usePaymentStatus(): UsePaymentStatusReturn {
  const status = ref<PaymentStatus>("idle");
  const message = ref<StatusMessage | null>(null);

  const scheduleMessageClear = (timeout?: number) => {
    if (timeout && timeout > 0) {
      setTimeout(() => {
        message.value = null;
      }, timeout);
    }
  };

  const setStatus = (newStatus: PaymentStatus, messageText?: string) => {
    status.value = newStatus;
    if (messageText) {
      const type = newStatus === "error" ? "error" : newStatus === "success" ? "success" : "info";
      message.value = { text: messageText, type };
    }
  };

  const setSuccess = (text: string, timeout?: number) => {
    status.value = "success";
    message.value = { text, type: "success", timeout };
    scheduleMessageClear(timeout);
  };

  const setError = (text: string) => {
    status.value = "error";
    message.value = { text, type: "error" };
  };

  const setInfo = (text: string, timeout?: number) => {
    message.value = { text, type: "info", timeout };
    scheduleMessageClear(timeout);
  };

  const setWarning = (text: string, timeout?: number) => {
    message.value = { text, type: "warning", timeout };
    scheduleMessageClear(timeout);
  };

  const clearMessage = () => {
    message.value = null;
  };

  const reset = () => {
    status.value = "idle";
    message.value = null;
  };

  return {
    status,
    message,
    setStatus,
    setSuccess,
    setError,
    setInfo,
    setWarning,
    clearMessage,
    reset,
  };
}
