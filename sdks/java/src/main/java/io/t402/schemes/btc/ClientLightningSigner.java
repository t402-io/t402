package io.t402.schemes.btc;

/**
 * Interface for client-side Lightning Network payment operations.
 *
 * <p>Implementations handle BOLT11 invoice payments and return
 * the preimage as proof of payment.
 *
 * <h2>Example Implementation</h2>
 * <pre>{@code
 * public class MyLndSigner implements ClientLightningSigner {
 *     private final LndClient lnd;
 *
 *     @Override
 *     public LightningPaymentResult payInvoice(String bolt11Invoice) {
 *         PaymentResponse resp = lnd.sendPaymentSync(bolt11Invoice);
 *         return new LightningPaymentResult(
 *             bytesToHex(resp.getPreimage()),
 *             bytesToHex(resp.getPaymentHash())
 *         );
 *     }
 *
 *     @Override
 *     public String getNodePubKey() { return lnd.getInfo().getIdentityPubkey(); }
 * }
 * }</pre>
 */
public interface ClientLightningSigner {

    /**
     * Pays a BOLT11 invoice and returns the preimage and payment hash.
     *
     * @param bolt11Invoice BOLT11 invoice to pay
     * @return Payment result containing preimage and payment hash
     * @throws Exception if payment fails
     */
    LightningPaymentResult payInvoice(String bolt11Invoice) throws Exception;

    /**
     * Gets the Lightning node's public key as a hex string.
     *
     * @return Hex-encoded node public key
     */
    String getNodePubKey();

    /**
     * Result of a Lightning invoice payment.
     */
    class LightningPaymentResult {
        private final String preimage;
        private final String paymentHash;

        public LightningPaymentResult(String preimage, String paymentHash) {
            this.preimage = preimage;
            this.paymentHash = paymentHash;
        }

        public String getPreimage() {
            return preimage;
        }

        public String getPaymentHash() {
            return paymentHash;
        }
    }
}
