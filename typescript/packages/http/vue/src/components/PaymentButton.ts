import { defineComponent, h, ref, type PropType, computed } from "vue";
import { Spinner } from "./Spinner.js";

const baseStyles = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  fontWeight: "600",
  borderRadius: "8px",
  cursor: "pointer",
  transition: "all 0.15s ease",
  border: "none",
  fontFamily: "inherit",
};

const variantStyles = {
  primary: {
    backgroundColor: "#2563eb",
    color: "#ffffff",
  },
  secondary: {
    backgroundColor: "#6b7280",
    color: "#ffffff",
  },
  outline: {
    backgroundColor: "transparent",
    color: "#2563eb",
    border: "2px solid #2563eb",
  },
};

const sizeStyles = {
  sm: {
    padding: "8px 16px",
    fontSize: "14px",
  },
  md: {
    padding: "12px 24px",
    fontSize: "16px",
  },
  lg: {
    padding: "16px 32px",
    fontSize: "18px",
  },
};

/**
 * A payment button component with loading state support.
 *
 * @example
 * ```vue
 * <template>
 *   <PaymentButton
 *     @click="handlePayment"
 *     :loading="isProcessing"
 *     variant="primary"
 *     size="lg"
 *   >
 *     Pay $10.00
 *   </PaymentButton>
 * </template>
 * ```
 */
export const PaymentButton = defineComponent({
  name: "T402PaymentButton",
  props: {
    disabled: {
      type: Boolean,
      default: false,
    },
    loading: {
      type: Boolean,
      default: false,
    },
    variant: {
      type: String as PropType<"primary" | "secondary" | "outline">,
      default: "primary",
    },
    size: {
      type: String as PropType<"sm" | "md" | "lg">,
      default: "md",
    },
  },
  emits: ["click"],
  setup(props, { emit, slots }) {
    const isHovered = ref(false);

    const isDisabled = computed(() => props.disabled || props.loading);

    const buttonStyle = computed(() => ({
      ...baseStyles,
      ...variantStyles[props.variant],
      ...sizeStyles[props.size],
      ...(isDisabled.value ? { opacity: "0.6", cursor: "not-allowed" } : {}),
      ...(isHovered.value && !isDisabled.value
        ? { filter: "brightness(1.1)", transform: "translateY(-1px)" }
        : {}),
    }));

    const handleClick = () => {
      if (!isDisabled.value) {
        emit("click");
      }
    };

    return () =>
      h(
        "button",
        {
          type: "button",
          disabled: isDisabled.value,
          style: buttonStyle.value,
          onClick: handleClick,
          onMouseenter: () => (isHovered.value = true),
          onMouseleave: () => (isHovered.value = false),
        },
        [
          props.loading ? h(Spinner, { size: "sm" }) : null,
          slots.default ? slots.default() : "Pay Now",
        ],
      );
  },
});
