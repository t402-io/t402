package io.t402.schemes.spark;

import java.util.HashMap;
import java.util.Map;

/**
 * Represents a Spark payment proof.
 *
 * <p>Contains the payment type and type-specific fields:
 * <ul>
 *   <li><b>spark</b> — {@code transferId} for direct Spark transfer lookup</li>
 *   <li><b>lightning</b> — {@code preimage} and {@code paymentHash} for
 *       SHA-256 preimage verification</li>
 * </ul>
 */
public class SparkPayload {

    private final String paymentType;
    private final String transferId;
    private final String preimage;
    private final String paymentHash;

    /**
     * Creates a new SparkPayload.
     *
     * @param paymentType Type of payment ("spark" or "lightning")
     * @param transferId Transfer ID (for Spark transfers, may be null)
     * @param preimage Lightning preimage (for Lightning payments, may be null)
     * @param paymentHash Lightning payment hash (for verification, may be null)
     */
    public SparkPayload(String paymentType, String transferId, String preimage, String paymentHash) {
        this.paymentType = paymentType;
        this.transferId = transferId;
        this.preimage = preimage;
        this.paymentHash = paymentHash;
    }

    /**
     * Creates a SparkPayload from a map.
     *
     * @param data Map containing payload data
     * @return SparkPayload instance
     */
    public static SparkPayload fromMap(Map<String, Object> data) {
        if (data == null) {
            return new SparkPayload(null, null, null, null);
        }
        return new SparkPayload(
            (String) data.get("paymentType"),
            (String) data.get("transferId"),
            (String) data.get("preimage"),
            (String) data.get("paymentHash")
        );
    }

    /**
     * Converts this payload to a map.
     *
     * @return Map representation
     */
    public Map<String, Object> toMap() {
        Map<String, Object> map = new HashMap<>();
        map.put("paymentType", paymentType);
        if (transferId != null) {
            map.put("transferId", transferId);
        }
        if (preimage != null) {
            map.put("preimage", preimage);
        }
        if (paymentHash != null) {
            map.put("paymentHash", paymentHash);
        }
        return map;
    }

    public String getPaymentType() {
        return paymentType;
    }

    public String getTransferId() {
        return transferId;
    }

    public String getPreimage() {
        return preimage;
    }

    public String getPaymentHash() {
        return paymentHash;
    }
}
