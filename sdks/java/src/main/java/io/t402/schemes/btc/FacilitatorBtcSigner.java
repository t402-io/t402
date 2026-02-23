package io.t402.schemes.btc;

import java.util.List;

/**
 * Interface for facilitator-side Bitcoin on-chain operations.
 *
 * <p>Implementations handle PSBT verification, broadcast, and confirmation
 * for on-chain Bitcoin settlement.
 */
public interface FacilitatorBtcSigner {

    /**
     * Gets the facilitator's Bitcoin addresses.
     *
     * @return List of Bitcoin addresses
     */
    List<String> getAddresses();

    /**
     * Verifies a signed PSBT against expected payment details.
     *
     * @param signedPsbt Base64-encoded signed PSBT
     * @param expectedPayTo Expected recipient address
     * @param expectedAmount Expected amount in satoshis
     * @return Verification result
     * @throws Exception if verification encounters an error
     */
    VerifyResult verifyPsbt(String signedPsbt, String expectedPayTo, String expectedAmount)
        throws Exception;

    /**
     * Finalizes and broadcasts a signed PSBT.
     *
     * @param signedPsbt Base64-encoded signed PSBT
     * @return Transaction ID
     * @throws Exception if broadcast fails
     */
    String broadcastPsbt(String signedPsbt) throws Exception;

    /**
     * Waits for a transaction to be confirmed.
     *
     * @param txId Transaction ID
     * @param confirmations Number of confirmations to wait for
     * @return Confirmation result
     * @throws Exception if confirmation check fails
     */
    ConfirmationResult waitForConfirmation(String txId, int confirmations) throws Exception;

    /**
     * Result of PSBT verification.
     */
    class VerifyResult {
        private final boolean valid;
        private final String reason;
        private final String payer;

        public VerifyResult(boolean valid, String reason, String payer) {
            this.valid = valid;
            this.reason = reason;
            this.payer = payer;
        }

        public boolean isValid() {
            return valid;
        }

        public String getReason() {
            return reason;
        }

        public String getPayer() {
            return payer;
        }
    }

    /**
     * Result of waiting for transaction confirmation.
     */
    class ConfirmationResult {
        private final boolean confirmed;
        private final String blockHash;
        private final int confirmations;

        public ConfirmationResult(boolean confirmed, String blockHash, int confirmations) {
            this.confirmed = confirmed;
            this.blockHash = blockHash;
            this.confirmations = confirmations;
        }

        public boolean isConfirmed() {
            return confirmed;
        }

        public String getBlockHash() {
            return blockHash;
        }

        public int getConfirmations() {
            return confirmations;
        }
    }
}
