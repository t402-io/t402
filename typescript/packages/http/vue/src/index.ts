// Components
export { Spinner, spinnerStyles } from "./components/Spinner.js";
export { PaymentButton } from "./components/PaymentButton.js";
export { PaymentStatusDisplay } from "./components/PaymentStatusDisplay.js";
export { PaymentDetails } from "./components/PaymentDetails.js";
export { AddressDisplay } from "./components/AddressDisplay.js";

// Composables
export { usePaymentRequired } from "./composables/usePaymentRequired.js";
export { usePaymentStatus } from "./composables/usePaymentStatus.js";
export { useAsyncPayment } from "./composables/useAsyncPayment.js";

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
  PaymentButtonProps,
  PaymentStatusDisplayProps,
  PaymentDetailsProps,
  SpinnerProps,
  AddressDisplayProps,
  PaymentRequired,
  PaymentRequirements,
} from "./types/index.js";
