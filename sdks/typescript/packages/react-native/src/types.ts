import type { PaymentRequired, PaymentRequirements } from '@t402/core/types'

/**
 * Configuration for the T402 React Native provider
 */
export interface T402ProviderConfig {
  /** URL of the t402 facilitator service */
  facilitatorUrl: string
  /** Supported CAIP-2 network identifiers */
  networks?: string[]
  /** External signer instance (e.g., from a wallet SDK) */
  signer?: unknown
  /** WDK seed phrase for built-in wallet management */
  wdkSeedPhrase?: string
  /** Chain RPC endpoint configuration (chain name -> RPC URL) */
  chains?: Record<string, string>
}

/**
 * Internal context value provided by T402Provider
 */
export interface T402ContextValue {
  /** Provider configuration */
  config: T402ProviderConfig
  /** External signer if provided */
  signer: unknown | null
  /** Whether the provider is initialized */
  isReady: boolean
}

/**
 * Payment flow state machine
 */
export type PaymentStatus =
  | 'idle'
  | 'loading'
  | 'awaiting_payment'
  | 'signing'
  | 'verifying'
  | 'success'
  | 'error'

/**
 * Current state of a payment operation
 */
export interface PaymentState {
  /** Current step in the payment flow */
  status: PaymentStatus
  /** Error details if status is 'error' */
  error?: Error
  /** Transaction hash after successful payment */
  txHash?: string
  /** The 402 response from the server */
  paymentRequired?: PaymentRequired
}

/**
 * Options for initiating a payment request
 */
export interface PaymentOptions {
  /** URL of the protected resource */
  url: string
  /** HTTP method (default: GET) */
  method?: string
  /** Additional request headers */
  headers?: Record<string, string>
  /** Request body for POST/PUT */
  body?: string
  /** Preferred CAIP-2 network for payment */
  preferredNetwork?: string
}

/**
 * Result of a completed payment attempt
 */
export interface PaymentResult {
  /** Whether the payment succeeded */
  success: boolean
  /** The response from the server after payment */
  response?: Response
  /** Transaction hash if payment was submitted */
  txHash?: string
  /** Error details if payment failed */
  error?: Error
}

/**
 * Return type of the useT402Payment hook
 */
export interface UseT402PaymentReturn {
  /** Current payment state */
  state: PaymentState
  /** Initiate a payment for a protected resource */
  pay: (options: PaymentOptions) => Promise<PaymentResult>
  /** Reset payment state to idle */
  reset: () => void
}

/**
 * Props for the PaymentSheet component
 */
export interface PaymentSheetProps {
  /** Whether the payment sheet is visible */
  visible: boolean
  /** Callback to close the sheet */
  onClose: () => void
  /** Payment requirements from a 402 response */
  paymentRequired?: PaymentRequired
  /** Selected payment requirement to display */
  selectedRequirement?: PaymentRequirements
  /** Callback to initiate payment */
  onPay: () => Promise<void>
  /** Current payment state */
  state: PaymentState
  /** Custom styles for the sheet container */
  style?: Record<string, unknown>
}

export type { PaymentRequired, PaymentRequirements } from '@t402/core/types'
