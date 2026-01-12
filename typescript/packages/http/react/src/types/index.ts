import type { PaymentRequired, PaymentRequirements } from "@t402/core/types";

/**
 * Payment status states
 */
export type PaymentStatus = "idle" | "loading" | "success" | "error";

/**
 * Payment context state
 */
export interface PaymentState {
  /** Current payment status */
  status: PaymentStatus;
  /** Error message if status is 'error' */
  error: string | null;
  /** The payment required response from server */
  paymentRequired: PaymentRequired | null;
  /** Currently selected payment requirement */
  selectedRequirement: PaymentRequirements | null;
  /** Whether we're in testnet mode */
  isTestnet: boolean;
}

/**
 * Payment context actions
 */
export interface PaymentActions {
  /** Set the payment required data */
  setPaymentRequired: (data: PaymentRequired) => void;
  /** Select a specific payment requirement */
  selectRequirement: (requirement: PaymentRequirements) => void;
  /** Set the payment status */
  setStatus: (status: PaymentStatus) => void;
  /** Set an error message */
  setError: (error: string | null) => void;
  /** Reset the payment state */
  reset: () => void;
}

/**
 * Complete payment context value
 */
export interface PaymentContextValue extends PaymentState, PaymentActions {}

/**
 * Props for PaymentProvider
 */
export interface PaymentProviderProps {
  /** Child components */
  children: React.ReactNode;
  /** Initial payment required data */
  initialPaymentRequired?: PaymentRequired;
  /** Whether to default to testnet mode */
  testnet?: boolean;
}

/**
 * Props for PaymentButton component
 */
export interface PaymentButtonProps {
  /** Click handler */
  onClick?: () => void | Promise<void>;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Whether the button is in loading state */
  loading?: boolean;
  /** Button text */
  children?: React.ReactNode;
  /** Additional CSS class names */
  className?: string;
  /** Button variant */
  variant?: "primary" | "secondary" | "outline";
  /** Button size */
  size?: "sm" | "md" | "lg";
}

/**
 * Props for PaymentStatus component
 */
export interface PaymentStatusProps {
  /** Current status */
  status: PaymentStatus;
  /** Message to display */
  message?: string;
  /** Additional CSS class names */
  className?: string;
}

/**
 * Props for PaymentDetails component
 */
export interface PaymentDetailsProps {
  /** Payment requirements to display */
  requirement: PaymentRequirements;
  /** Whether to show the network name */
  showNetwork?: boolean;
  /** Whether to show the asset */
  showAsset?: boolean;
  /** Whether to show the recipient address */
  showRecipient?: boolean;
  /** Additional CSS class names */
  className?: string;
}

/**
 * Props for Spinner component
 */
export interface SpinnerProps {
  /** Spinner size */
  size?: "sm" | "md" | "lg";
  /** Additional CSS class names */
  className?: string;
}

/**
 * Props for AddressDisplay component
 */
export interface AddressDisplayProps {
  /** The address to display */
  address: string;
  /** Number of characters to show at start */
  startChars?: number;
  /** Number of characters to show at end */
  endChars?: number;
  /** Whether to show copy button */
  copyable?: boolean;
  /** Additional CSS class names */
  className?: string;
}

// Re-export core types for convenience
export type { PaymentRequired, PaymentRequirements } from "@t402/core/types";
