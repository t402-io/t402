import { defineComponent, h, type PropType, computed } from "vue";
import { Spinner } from "./Spinner.js";
import type { PaymentStatus } from "../types/index.js";

const statusStyles = {
  idle: {
    backgroundColor: "#f3f4f6",
    color: "#374151",
    borderColor: "#d1d5db",
  },
  loading: {
    backgroundColor: "#eff6ff",
    color: "#1d4ed8",
    borderColor: "#93c5fd",
  },
  success: {
    backgroundColor: "#f0fdf4",
    color: "#166534",
    borderColor: "#86efac",
  },
  error: {
    backgroundColor: "#fef2f2",
    color: "#dc2626",
    borderColor: "#fca5a5",
  },
};

const baseStyles = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "12px 16px",
  borderRadius: "8px",
  borderWidth: "1px",
  borderStyle: "solid",
  fontSize: "14px",
  fontWeight: "500",
};

const icons: Record<PaymentStatus, string> = {
  idle: "○",
  loading: "",
  success: "✓",
  error: "✕",
};

const defaultMessages: Record<PaymentStatus, string> = {
  idle: "Ready to pay",
  loading: "Processing...",
  success: "Payment successful",
  error: "Payment failed",
};

/**
 * A component to display payment status with appropriate styling.
 *
 * @example
 * ```vue
 * <template>
 *   <PaymentStatusDisplay
 *     :status="status"
 *     message="Processing payment..."
 *   />
 * </template>
 * ```
 */
export const PaymentStatusDisplay = defineComponent({
  name: "T402PaymentStatusDisplay",
  props: {
    status: {
      type: String as PropType<PaymentStatus>,
      required: true,
    },
    message: {
      type: String,
      default: undefined,
    },
  },
  setup(props) {
    const combinedStyle = computed(() => ({
      ...baseStyles,
      ...statusStyles[props.status],
    }));

    const displayMessage = computed(() => props.message || defaultMessages[props.status]);

    return () =>
      h(
        "div",
        {
          role: "status",
          "aria-live": "polite",
          style: combinedStyle.value,
        },
        [
          props.status === "loading"
            ? h(Spinner, { size: "sm" })
            : h("span", { style: { fontSize: "16px" } }, icons[props.status]),
          h("span", displayMessage.value),
        ],
      );
  },
});
