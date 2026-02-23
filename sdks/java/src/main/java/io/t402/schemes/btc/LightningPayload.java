package io.t402.schemes.btc;

import java.util.HashMap;
import java.util.Map;

/**
 * Represents a Lightning Network payment payload.
 *
 * <p>Contains the preimage (proof of payment), payment hash, and BOLT11 invoice.
 */
public class LightningPayload {

    private final String paymentHash;
    private final String preimage;
    private final String bolt11Invoice;

    /**
     * Creates a LightningPayload.
     *
     * @param paymentHash SHA-256 hash of the preimage (hex)
     * @param preimage Payment preimage (hex)
     * @param bolt11Invoice BOLT11 invoice that was paid
     */
    public LightningPayload(String paymentHash, String preimage, String bolt11Invoice) {
        this.paymentHash = paymentHash;
        this.preimage = preimage;
        this.bolt11Invoice = bolt11Invoice;
    }

    /**
     * Creates a LightningPayload from a map.
     *
     * @param data Map containing payload data
     * @return LightningPayload instance
     */
    public static LightningPayload fromMap(Map<String, Object> data) {
        if (data == null) {
            return new LightningPayload(null, null, null);
        }
        return new LightningPayload(
            (String) data.get("paymentHash"),
            (String) data.get("preimage"),
            (String) data.get("bolt11Invoice")
        );
    }

    /**
     * Converts this payload to a map.
     *
     * @return Map representation
     */
    public Map<String, Object> toMap() {
        Map<String, Object> map = new HashMap<>();
        map.put("paymentHash", paymentHash);
        map.put("preimage", preimage);
        map.put("bolt11Invoice", bolt11Invoice);
        return map;
    }

    public String getPaymentHash() {
        return paymentHash;
    }

    public String getPreimage() {
        return preimage;
    }

    public String getBolt11Invoice() {
        return bolt11Invoice;
    }
}
