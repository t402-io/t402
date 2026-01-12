import { defineComponent, h, type PropType, computed } from "vue";
import type { PaymentRequirements } from "@t402/core/types";
import {
  formatTokenAmount,
  getNetworkDisplayName,
  getAssetDisplayName,
  truncateAddress,
} from "../utils/index.js";

const containerStyles = {
  backgroundColor: "#f9fafb",
  borderRadius: "12px",
  padding: "16px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "#e5e7eb",
};

const rowStyles = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "8px 0",
  borderBottomWidth: "1px",
  borderBottomStyle: "solid",
  borderBottomColor: "#e5e7eb",
};

const lastRowStyles = {
  ...rowStyles,
  borderBottomWidth: "0",
};

const labelStyles = {
  color: "#6b7280",
  fontSize: "14px",
};

const valueStyles = {
  color: "#111827",
  fontSize: "14px",
  fontWeight: "500",
};

const amountStyles = {
  color: "#111827",
  fontSize: "20px",
  fontWeight: "700",
};

/**
 * A component to display payment requirement details.
 *
 * @example
 * ```vue
 * <template>
 *   <PaymentDetails
 *     :requirement="requirement"
 *     show-network
 *     show-asset
 *     show-recipient
 *   />
 * </template>
 * ```
 */
export const PaymentDetails = defineComponent({
  name: "T402PaymentDetails",
  props: {
    requirement: {
      type: Object as PropType<PaymentRequirements>,
      required: true,
    },
    showNetwork: {
      type: Boolean,
      default: true,
    },
    showAsset: {
      type: Boolean,
      default: true,
    },
    showRecipient: {
      type: Boolean,
      default: false,
    },
  },
  setup(props) {
    const formattedAmount = computed(() => formatTokenAmount(props.requirement.amount));
    const assetName = computed(() => getAssetDisplayName(props.requirement.asset));
    const networkName = computed(() => getNetworkDisplayName(props.requirement.network));
    const truncatedAddress = computed(() => truncateAddress(props.requirement.payTo));

    return () => {
      const rows = [];

      // Amount row - always shown
      rows.push(
        h("div", { style: rowStyles }, [
          h("span", { style: labelStyles }, "Amount"),
          h("span", { style: amountStyles }, `${formattedAmount.value} ${assetName.value}`),
        ]),
      );

      // Network row
      if (props.showNetwork) {
        rows.push(
          h("div", { style: rowStyles }, [
            h("span", { style: labelStyles }, "Network"),
            h("span", { style: valueStyles }, networkName.value),
          ]),
        );
      }

      // Asset row
      if (props.showAsset) {
        rows.push(
          h("div", { style: rowStyles }, [
            h("span", { style: labelStyles }, "Asset"),
            h("span", { style: valueStyles }, assetName.value),
          ]),
        );
      }

      // Recipient row
      if (props.showRecipient) {
        rows.push(
          h("div", { style: lastRowStyles }, [
            h("span", { style: labelStyles }, "Recipient"),
            h(
              "span",
              {
                style: { ...valueStyles, fontFamily: "monospace" },
                title: props.requirement.payTo,
              },
              truncatedAddress.value,
            ),
          ]),
        );
      }

      return h("div", { style: containerStyles }, rows);
    };
  },
});
