package io.t402.schemes.btc.lightning;

import io.t402.schemes.btc.BtcConstants;
import io.t402.schemes.btc.ClientLightningSigner;
import io.t402.schemes.btc.LightningPayload;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Client scheme for Lightning Network payments.
 *
 * <p>Pays BOLT11 invoices and returns the preimage as proof of payment.
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * ClientLightningSigner signer = new MyLndSigner(lndClient);
 * LightningClientScheme scheme = new LightningClientScheme(signer);
 *
 * Map<String, Object> requirements = Map.of(
 *     "network", BtcConstants.LIGHTNING_MAINNET,
 *     "payTo", "node_pubkey",
 *     "amount", "1000",
 *     "extra", Map.of("bolt11Invoice", "lnbc...")
 * );
 *
 * Map<String, Object> payload = scheme.createPaymentPayloadSync(requirements);
 * }</pre>
 */
public class LightningClientScheme {

    /** The scheme identifier. */
    public static final String SCHEME = BtcConstants.SCHEME_EXACT;

    /** CAIP family pattern for Lightning networks. */
    public static final String CAIP_FAMILY = BtcConstants.CAIP_FAMILY_LIGHTNING;

    private final ClientLightningSigner signer;

    /**
     * Creates a new LightningClientScheme with the given signer.
     *
     * @param signer Client signer for Lightning payments
     */
    public LightningClientScheme(ClientLightningSigner signer) {
        if (signer == null) {
            throw new IllegalArgumentException("Signer cannot be null");
        }
        this.signer = signer;
    }

    /**
     * Gets the node's public key.
     *
     * @return Lightning node public key (hex)
     */
    public String getNodePubKey() {
        return signer.getNodePubKey();
    }

    /**
     * Creates a payment payload by paying a BOLT11 invoice.
     *
     * @param requirements Payment requirements map (must include extra.bolt11Invoice)
     * @return CompletableFuture containing payment payload map
     */
    @SuppressWarnings("unchecked")
    public CompletableFuture<Map<String, Object>> createPaymentPayload(Map<String, Object> requirements) {
        return CompletableFuture.supplyAsync(() -> {
            String network = (String) requirements.get("network");
            int t402Version = ((Number) requirements.getOrDefault("t402Version", 2)).intValue();

            // Extract BOLT11 invoice from extra
            String bolt11Invoice = null;
            Object extra = requirements.get("extra");
            if (extra instanceof Map) {
                bolt11Invoice = (String) ((Map<String, Object>) extra).get("bolt11Invoice");
            }

            if (bolt11Invoice == null || bolt11Invoice.isEmpty()) {
                throw new IllegalArgumentException(
                    "BOLT11 invoice is required in requirements.extra.bolt11Invoice");
            }

            if (!BtcConstants.validateBolt11Invoice(bolt11Invoice)) {
                throw new IllegalArgumentException("Invalid BOLT11 invoice format");
            }

            try {
                ClientLightningSigner.LightningPaymentResult paymentResult =
                    signer.payInvoice(bolt11Invoice);

                LightningPayload payload = new LightningPayload(
                    paymentResult.getPaymentHash(),
                    paymentResult.getPreimage(),
                    bolt11Invoice
                );

                Map<String, Object> result = new HashMap<>();
                result.put("t402Version", t402Version);
                result.put("scheme", SCHEME);
                result.put("network", network);
                result.put("payload", payload.toMap());

                return result;
            } catch (IllegalArgumentException e) {
                throw e;
            } catch (Exception e) {
                throw new RuntimeException("Failed to pay invoice: " + e.getMessage(), e);
            }
        });
    }

    /**
     * Creates a payment payload synchronously.
     *
     * @param requirements Payment requirements map
     * @return Payment payload map
     */
    public Map<String, Object> createPaymentPayloadSync(Map<String, Object> requirements) {
        return createPaymentPayload(requirements).join();
    }
}
