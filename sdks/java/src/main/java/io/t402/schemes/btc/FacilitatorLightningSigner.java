package io.t402.schemes.btc;

import java.util.List;

/**
 * Interface for facilitator-side Lightning Network verification.
 *
 * <p>Implementations handle payment lookup for Lightning settlement.
 * Lightning payments are atomic (settle-on-pay), so verification
 * confirms the payment was already received.
 */
public interface FacilitatorLightningSigner {

    /**
     * Gets the facilitator's Lightning node public keys.
     *
     * @return List of node public keys (hex)
     */
    List<String> getAddresses();

    /**
     * Looks up a payment by its payment hash.
     *
     * @param paymentHash Hex-encoded payment hash
     * @return Payment lookup result
     * @throws Exception if lookup fails
     */
    PaymentLookupResult lookupPayment(String paymentHash) throws Exception;

    /**
     * Result of a Lightning payment lookup.
     */
    class PaymentLookupResult {
        private final boolean settled;
        private final String amountSats;
        private final String preimage;

        public PaymentLookupResult(boolean settled, String amountSats, String preimage) {
            this.settled = settled;
            this.amountSats = amountSats;
            this.preimage = preimage;
        }

        public boolean isSettled() {
            return settled;
        }

        public String getAmountSats() {
            return amountSats;
        }

        public String getPreimage() {
            return preimage;
        }
    }
}
