// Components
export { Spinner } from "./components/Spinner.js";
export { PaymentButton } from "./components/PaymentButton.js";
export { PaymentStatus as PaymentStatusDisplay } from "./components/PaymentStatus.js";
export { PaymentDetails } from "./components/PaymentDetails.js";
export { AddressDisplay } from "./components/AddressDisplay.js";

// Hooks
export { usePaymentRequired } from "./hooks/usePaymentRequired.js";
export { usePaymentStatus } from "./hooks/usePaymentStatus.js";
export { useAsyncPayment } from "./hooks/useAsyncPayment.js";

// Providers
export { PaymentProvider, usePaymentContext, PaymentContext } from "./providers/PaymentProvider.js";

// Utilities
export {
  // Network detection
  isEvmNetwork,
  isSvmNetwork,
  isTonNetwork,
  isTronNetwork,
  isTestnetNetwork,
  getNetworkDisplayName,
  // Payment helpers
  normalizePaymentRequirements,
  getPreferredNetworks,
  choosePaymentRequirement,
  // Formatters
  truncateAddress,
  formatTokenAmount,
  getAssetDisplayName,
  // Constants
  EVM_CHAIN_IDS,
  SOLANA_NETWORK_REFS,
  TON_NETWORK_REFS,
  TRON_NETWORK_REFS,
} from "./utils/index.js";

// Types
export type {
  PaymentStatus,
  PaymentState,
  PaymentActions,
  PaymentContextValue,
  PaymentProviderProps,
  PaymentButtonProps,
  PaymentStatusProps,
  PaymentDetailsProps,
  SpinnerProps,
  AddressDisplayProps,
  PaymentRequired,
  PaymentRequirements,
} from "./types/index.js";
