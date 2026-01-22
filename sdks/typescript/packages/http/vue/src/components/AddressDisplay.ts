import { defineComponent, h, ref, computed } from "vue";
import { truncateAddress } from "../utils/index.js";

const containerStyles = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  fontFamily: "monospace",
  fontSize: "14px",
};

const addressStyles = {
  color: "#374151",
};

const buttonStyles = {
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "4px",
  borderRadius: "4px",
  color: "#6b7280",
  transition: "all 0.15s ease",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const copiedButtonStyles = {
  ...buttonStyles,
  color: "#22c55e",
};

/**
 * A component to display blockchain addresses with optional copy functionality.
 *
 * @example
 * ```vue
 * <template>
 *   <AddressDisplay
 *     address="0x1234567890abcdef1234567890abcdef12345678"
 *     copyable
 *     :start-chars="6"
 *     :end-chars="4"
 *   />
 * </template>
 * ```
 */
export const AddressDisplay = defineComponent({
  name: "T402AddressDisplay",
  props: {
    address: {
      type: String,
      required: true,
    },
    startChars: {
      type: Number,
      default: 6,
    },
    endChars: {
      type: Number,
      default: 4,
    },
    copyable: {
      type: Boolean,
      default: false,
    },
  },
  setup(props) {
    const copied = ref(false);

    const displayAddress = computed(() =>
      truncateAddress(props.address, props.startChars, props.endChars),
    );

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(props.address);
        copied.value = true;
        setTimeout(() => (copied.value = false), 2000);
      } catch {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = props.address;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        copied.value = true;
        setTimeout(() => (copied.value = false), 2000);
      }
    };

    // Copy icon SVG
    const copyIcon = () =>
      h(
        "svg",
        {
          width: "16",
          height: "16",
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "2",
        },
        [
          h("rect", { x: "9", y: "9", width: "13", height: "13", rx: "2", ry: "2" }),
          h("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" }),
        ],
      );

    // Checkmark icon SVG
    const checkIcon = () =>
      h(
        "svg",
        {
          width: "16",
          height: "16",
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "2",
        },
        [h("polyline", { points: "20 6 9 17 4 12" })],
      );

    return () =>
      h("span", { style: containerStyles, title: props.address }, [
        h("span", { style: addressStyles }, displayAddress.value),
        props.copyable
          ? h(
              "button",
              {
                type: "button",
                onClick: handleCopy,
                style: copied.value ? copiedButtonStyles : buttonStyles,
                "aria-label": copied.value ? "Copied" : "Copy address",
              },
              [copied.value ? checkIcon() : copyIcon()],
            )
          : null,
      ]);
  },
});
