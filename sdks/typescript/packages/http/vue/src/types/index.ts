import type { PaymentRequired, PaymentRequirements } from "@t402/core/types";
import type { Ref, ComputedRef } from "vue";

/**
 * Payment status states
 */
export type PaymentStatus = "idle" | "loading" | "success" | "error";

/**
 * Payment state for composables
 */
export interface PaymentState {
  /** Current payment status */
  status: Ref<PaymentStatus>;
  /** Error message if status is 'error' */
  error: Ref<string | null>;
  /** The payment required response from server */
  paymentRequired: Ref<PaymentRequired | null>;
  /** Currently selected payment requirement */
  selectedRequirement: Ref<PaymentRequirements | null>;
  /** Whether we're in testnet mode */
  isTestnet: ComputedRef<boolean>;
}

/**
 * Props for PaymentButton component
 */
export interface PaymentButtonProps {
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Whether the button is in loading state */
  loading?: boolean;
  /** Button variant */
  variant?: "primary" | "secondary" | "outline";
  /** Button size */
  size?: "sm" | "md" | "lg";
}

/**
 * Props for PaymentStatusDisplay component
 */
export interface PaymentStatusDisplayProps {
  /** Current status */
  status: PaymentStatus;
  /** Message to display */
  message?: string;
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
}

/**
 * Props for Spinner component
 */
export interface SpinnerProps {
  /** Spinner size */
  size?: "sm" | "md" | "lg";
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
}

// Re-export core types for convenience
export type { PaymentRequired, PaymentRequirements } from "@t402/core/types";
