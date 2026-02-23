package io.t402.schemes.btc;

import java.util.HashMap;
import java.util.Map;

/**
 * Represents a Bitcoin on-chain PSBT payment payload.
 *
 * <p>Contains the signed PSBT and optionally the broadcast transaction ID.
 */
public class PSBTPayload {

    private final String signedPsbt;
    private final String txId;

    /**
     * Creates a PSBTPayload with only a signed PSBT.
     *
     * @param signedPsbt Base64-encoded signed PSBT
     */
    public PSBTPayload(String signedPsbt) {
        this(signedPsbt, null);
    }

    /**
     * Creates a PSBTPayload with signed PSBT and transaction ID.
     *
     * @param signedPsbt Base64-encoded signed PSBT
     * @param txId Transaction ID after broadcast (may be null)
     */
    public PSBTPayload(String signedPsbt, String txId) {
        this.signedPsbt = signedPsbt;
        this.txId = txId;
    }

    /**
     * Creates a PSBTPayload from a map.
     *
     * @param data Map containing payload data
     * @return PSBTPayload instance
     */
    public static PSBTPayload fromMap(Map<String, Object> data) {
        if (data == null) {
            return new PSBTPayload(null);
        }
        String signedPsbt = (String) data.get("signedPsbt");
        String txId = (String) data.get("txId");
        return new PSBTPayload(signedPsbt, txId);
    }

    /**
     * Converts this payload to a map.
     *
     * @return Map representation
     */
    public Map<String, Object> toMap() {
        Map<String, Object> map = new HashMap<>();
        map.put("signedPsbt", signedPsbt);
        if (txId != null) {
            map.put("txId", txId);
        }
        return map;
    }

    public String getSignedPsbt() {
        return signedPsbt;
    }

    public String getTxId() {
        return txId;
    }
}
