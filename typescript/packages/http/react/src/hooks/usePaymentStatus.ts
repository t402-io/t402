import { useState, useCallback } from "react";
import type { PaymentStatus } from "../types/index.js";

interface StatusMessage {
  /** Message text */
  text: string;
  /** Message type */
  type: "info" | "success" | "error" | "warning";
  /** Optional auto-dismiss timeout in ms */
  timeout?: number;
}

interface UsePaymentStatusResult {
  /** Current payment status */
  status: PaymentStatus;
  /** Current status message */
  message: StatusMessage | null;
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
 * Hook for managing payment status and status messages.
 *
 * @returns State and methods for status management.
 *
 * @example
 * ```tsx
 * import { usePaymentStatus } from "@t402/react";
 *
 * function PaymentFlow() {
 *   const {
 *     status,
 *     message,
 *     setStatus,
 *     setSuccess,
 *     setError,
 *   } = usePaymentStatus();
 *
 *   const handlePayment = async () => {
 *     setStatus("loading", "Processing payment...");
 *     try {
 *       await processPayment();
 *       setSuccess("Payment successful!", 3000);
 *     } catch (err) {
 *       setError("Payment failed. Please try again.");
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       {message && <StatusMessage message={message} />}
 *       <button onClick={handlePayment} disabled={status === "loading"}>
 *         Pay Now
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function usePaymentStatus(): UsePaymentStatusResult {
  const [status, setStatusState] = useState<PaymentStatus>("idle");
  const [message, setMessage] = useState<StatusMessage | null>(null);

  const scheduleMessageClear = useCallback((timeout?: number) => {
    if (timeout && timeout > 0) {
      setTimeout(() => {
        setMessage(null);
      }, timeout);
    }
  }, []);

  const setStatus = useCallback(
    (newStatus: PaymentStatus, messageText?: string) => {
      setStatusState(newStatus);
      if (messageText) {
        const type = newStatus === "error" ? "error" : newStatus === "success" ? "success" : "info";
        setMessage({ text: messageText, type });
      }
    },
    [],
  );

  const setSuccess = useCallback(
    (text: string, timeout?: number) => {
      setStatusState("success");
      setMessage({ text, type: "success", timeout });
      scheduleMessageClear(timeout);
    },
    [scheduleMessageClear],
  );

  const setError = useCallback((text: string) => {
    setStatusState("error");
    setMessage({ text, type: "error" });
  }, []);

  const setInfo = useCallback(
    (text: string, timeout?: number) => {
      setMessage({ text, type: "info", timeout });
      scheduleMessageClear(timeout);
    },
    [scheduleMessageClear],
  );

  const setWarning = useCallback(
    (text: string, timeout?: number) => {
      setMessage({ text, type: "warning", timeout });
      scheduleMessageClear(timeout);
    },
    [scheduleMessageClear],
  );

  const clearMessage = useCallback(() => {
    setMessage(null);
  }, []);

  const reset = useCallback(() => {
    setStatusState("idle");
    setMessage(null);
  }, []);

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
