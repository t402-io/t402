import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import type { PaymentRequired, PaymentRequirements } from "@t402/core/types";
import type {
  PaymentState,
  PaymentContextValue,
  PaymentProviderProps,
  PaymentStatus,
} from "../types/index.js";
import { choosePaymentRequirement, isTestnetNetwork } from "../utils/index.js";

const initialState: PaymentState = {
  status: "idle",
  error: null,
  paymentRequired: null,
  selectedRequirement: null,
  isTestnet: false,
};

const PaymentContext = createContext<PaymentContextValue | null>(null);

/**
 * Payment context provider for t402 payment state management.
 *
 * @param props - Provider props including children and initial state.
 * @returns The provider component wrapping children.
 *
 * @example
 * ```tsx
 * import { PaymentProvider } from "@t402/react";
 *
 * function App() {
 *   return (
 *     <PaymentProvider testnet={true}>
 *       <PaymentFlow />
 *     </PaymentProvider>
 *   );
 * }
 * ```
 */
export function PaymentProvider({
  children,
  initialPaymentRequired,
  testnet = false,
}: PaymentProviderProps) {
  const [state, setState] = useState<PaymentState>(() => {
    if (initialPaymentRequired) {
      const selectedRequirement = choosePaymentRequirement(
        initialPaymentRequired.accepts,
        testnet,
      );
      const detectedTestnet = isTestnetNetwork(selectedRequirement.network);

      return {
        status: "idle",
        error: null,
        paymentRequired: initialPaymentRequired,
        selectedRequirement,
        isTestnet: testnet || detectedTestnet,
      };
    }
    return { ...initialState, isTestnet: testnet };
  });

  const setPaymentRequired = useCallback(
    (data: PaymentRequired) => {
      const selectedRequirement = choosePaymentRequirement(data.accepts, state.isTestnet);
      const detectedTestnet = isTestnetNetwork(selectedRequirement.network);

      setState(prev => ({
        ...prev,
        paymentRequired: data,
        selectedRequirement,
        isTestnet: prev.isTestnet || detectedTestnet,
        error: null,
      }));
    },
    [state.isTestnet],
  );

  const selectRequirement = useCallback((requirement: PaymentRequirements) => {
    setState(prev => ({
      ...prev,
      selectedRequirement: requirement,
      isTestnet: isTestnetNetwork(requirement.network),
    }));
  }, []);

  const setStatus = useCallback((status: PaymentStatus) => {
    setState(prev => ({
      ...prev,
      status,
      error: status === "error" ? prev.error : null,
    }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({
      ...prev,
      error,
      status: error ? "error" : prev.status,
    }));
  }, []);

  const reset = useCallback(() => {
    setState({ ...initialState, isTestnet: testnet });
  }, [testnet]);

  const value = useMemo<PaymentContextValue>(
    () => ({
      ...state,
      setPaymentRequired,
      selectRequirement,
      setStatus,
      setError,
      reset,
    }),
    [state, setPaymentRequired, selectRequirement, setStatus, setError, reset],
  );

  return <PaymentContext.Provider value={value}>{children}</PaymentContext.Provider>;
}

/**
 * Hook to access the payment context.
 *
 * @returns The payment context value.
 * @throws Error if used outside of PaymentProvider.
 *
 * @example
 * ```tsx
 * import { usePaymentContext } from "@t402/react";
 *
 * function PaymentFlow() {
 *   const { status, selectedRequirement, setStatus } = usePaymentContext();
 *
 *   const handlePayment = async () => {
 *     setStatus("loading");
 *     // ... payment logic
 *   };
 *
 *   return <button onClick={handlePayment}>Pay</button>;
 * }
 * ```
 */
export function usePaymentContext(): PaymentContextValue {
  const context = useContext(PaymentContext);

  if (!context) {
    throw new Error("usePaymentContext must be used within a PaymentProvider");
  }

  return context;
}

export { PaymentContext };
