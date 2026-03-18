package io.t402.extensions.offerreceipt;

import java.util.HashMap;
import java.util.Map;

/**
 * Canonical receipt payload fields for EIP-712 signing.
 */
public class ReceiptPayload {
    private final int version;
    private final String network;
    private final String resourceUrl;
    private final String payer;
    private final long issuedAt;
    private final String transaction;

    public ReceiptPayload(int version, String network, String resourceUrl,
                          String payer, long issuedAt, String transaction) {
        this.version = version;
        this.network = network;
        this.resourceUrl = resourceUrl;
        this.payer = payer;
        this.issuedAt = issuedAt;
        this.transaction = transaction != null ? transaction : "";
    }

    public int getVersion() { return version; }
    public String getNetwork() { return network; }
    public String getResourceUrl() { return resourceUrl; }
    public String getPayer() { return payer; }
    public long getIssuedAt() { return issuedAt; }
    public String getTransaction() { return transaction; }

    public Map<String, Object> toMap() {
        Map<String, Object> map = new HashMap<>();
        map.put("version", version);
        map.put("network", network);
        map.put("resourceUrl", resourceUrl);
        map.put("payer", payer);
        map.put("issuedAt", issuedAt);
        map.put("transaction", transaction);
        return map;
    }

    public static ReceiptPayload fromMap(Map<String, Object> map) {
        return new ReceiptPayload(
            ((Number) map.get("version")).intValue(),
            (String) map.get("network"),
            (String) map.get("resourceUrl"),
            (String) map.get("payer"),
            ((Number) map.get("issuedAt")).longValue(),
            (String) map.getOrDefault("transaction", "")
        );
    }
}
