package io.t402.schemes.upto;

import java.util.Map;

/**
 * Utility functions for the Up-To payment scheme.
 */
public final class UptoUtils {

    private UptoUtils() {}

    /**
     * Checks if the given data represents Up-To payment requirements.
     *
     * @param data map containing payment requirements data
     * @return true if the data is for the upto scheme with maxAmount
     */
    public static boolean isUptoPaymentRequirements(Map<String, Object> data) {
        if (data == null) {
            return false;
        }

        Object scheme = data.get("scheme");
        if (!(scheme instanceof String) || !UptoConstants.SCHEME.equals(scheme)) {
            return false;
        }

        return data.containsKey("maxAmount");
    }

    /**
     * Creates an UptoPaymentRequirements with defaults.
     *
     * @param network blockchain network in CAIP-2 format
     * @param maxAmount maximum authorized amount
     * @param asset token contract address
     * @param payTo recipient address
     * @return a new UptoPaymentRequirements with default values
     */
    public static UptoPaymentRequirements createPaymentRequirements(
            String network, String maxAmount, String asset, String payTo) {
        return new UptoPaymentRequirements(network, maxAmount, asset, payTo,
            UptoConstants.DEFAULT_MAX_TIMEOUT_SECONDS);
    }

    /**
     * Creates a settlement with optional usage details.
     *
     * @param settleAmount the amount to settle
     * @return a new UptoSettlement
     */
    public static UptoSettlement createSettlement(String settleAmount) {
        return new UptoSettlement(settleAmount);
    }

    /**
     * Creates a settlement with usage details.
     *
     * @param settleAmount the amount to settle
     * @param unitsConsumed number of units consumed
     * @param unitPrice price per unit
     * @param unitType type of unit
     * @return a new UptoSettlement with usage details
     */
    public static UptoSettlement createSettlement(String settleAmount,
            int unitsConsumed, String unitPrice, String unitType) {
        return new UptoSettlement(settleAmount)
            .withUsageDetails(new UptoUsageDetails(unitsConsumed, unitPrice, unitType));
    }
}
