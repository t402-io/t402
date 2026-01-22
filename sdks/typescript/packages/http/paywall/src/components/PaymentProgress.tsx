/**
 * Payment progress states
 */
export type PaymentStep = "connect" | "sign" | "submit" | "confirm";

export interface PaymentProgressProps {
  /**
   * Current step in the payment flow
   */
  currentStep: PaymentStep;
  /**
   * Whether the current step is in progress (shows spinner)
   */
  isProcessing?: boolean;
  /**
   * Optional error state
   */
  hasError?: boolean;
}

const STEPS: { key: PaymentStep; label: string }[] = [
  { key: "connect", label: "Connect" },
  { key: "sign", label: "Sign" },
  { key: "submit", label: "Submit" },
  { key: "confirm", label: "Confirm" },
];

/**
 * Get the index of a step
 */
function getStepIndex(step: PaymentStep): number {
  return STEPS.findIndex((s) => s.key === step);
}

/**
 * Check icon SVG
 */
function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M11.5 4L5.5 10L2.5 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Small spinner for in-progress state
 */
function MiniSpinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      className="progress-spinner"
      aria-hidden="true"
    >
      <circle
        cx="7"
        cy="7"
        r="5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="20"
        strokeDashoffset="10"
      />
    </svg>
  );
}

/**
 * Payment progress indicator component.
 * Shows the current step in the payment flow with visual feedback.
 */
export function PaymentProgress({
  currentStep,
  isProcessing = false,
  hasError = false,
}: PaymentProgressProps) {
  const currentIndex = getStepIndex(currentStep);

  return (
    <div
      className="payment-progress"
      role="progressbar"
      aria-valuenow={currentIndex + 1}
      aria-valuemin={1}
      aria-valuemax={STEPS.length}
      aria-label={`Payment progress: ${STEPS[currentIndex].label}`}
    >
      {STEPS.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isPending = index > currentIndex;

        let stepClass = "progress-step";
        if (isCompleted) stepClass += " completed";
        if (isCurrent) stepClass += " current";
        if (isCurrent && isProcessing) stepClass += " processing";
        if (isCurrent && hasError) stepClass += " error";
        if (isPending) stepClass += " pending";

        return (
          <div key={step.key} className={stepClass}>
            <div className="progress-step-indicator">
              {isCompleted ? (
                <CheckIcon />
              ) : isCurrent && isProcessing ? (
                <MiniSpinner />
              ) : (
                <span className="progress-step-number">{index + 1}</span>
              )}
            </div>
            <span className="progress-step-label">{step.label}</span>
            {index < STEPS.length - 1 && (
              <div
                className={`progress-connector ${isCompleted ? "completed" : ""}`}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Hook to manage payment progress state
 */
export function usePaymentProgress() {
  return {
    /**
     * Determine the current step based on wallet and payment state
     */
    getStep: (params: {
      isConnected: boolean;
      isSigning: boolean;
      isSubmitting: boolean;
      isConfirmed: boolean;
    }): PaymentStep => {
      if (params.isConfirmed) return "confirm";
      if (params.isSubmitting) return "submit";
      if (params.isSigning) return "sign";
      if (params.isConnected) return "sign";
      return "connect";
    },
  };
}
