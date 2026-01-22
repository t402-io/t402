import { defineComponent, h, type PropType } from "vue";

const sizeConfig = {
  sm: { width: "16px", height: "16px", borderWidth: "2px" },
  md: { width: "24px", height: "24px", borderWidth: "3px" },
  lg: { width: "32px", height: "32px", borderWidth: "4px" },
};

/**
 * A simple loading spinner component.
 *
 * @example
 * ```vue
 * <template>
 *   <Spinner size="md" />
 * </template>
 * ```
 */
export const Spinner = defineComponent({
  name: "T402Spinner",
  props: {
    size: {
      type: String as PropType<"sm" | "md" | "lg">,
      default: "md",
    },
  },
  setup(props) {
    return () => {
      const config = sizeConfig[props.size];
      return h("span", {
        role: "status",
        "aria-label": "Loading",
        style: {
          width: config.width,
          height: config.height,
          borderWidth: config.borderWidth,
          borderStyle: "solid",
          borderColor: "#e5e7eb",
          borderTopColor: "#3b82f6",
          borderRadius: "50%",
          animation: "t402-spin 0.8s linear infinite",
          display: "inline-block",
        },
      });
    };
  },
});

// CSS keyframes for the spinner animation
export const spinnerStyles = `
@keyframes t402-spin {
  to { transform: rotate(360deg); }
}
`;
