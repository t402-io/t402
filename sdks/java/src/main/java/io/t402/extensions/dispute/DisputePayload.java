package io.t402.extensions.dispute;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Canonical dispute payload fields for EIP-712 signing.
 */
public class DisputePayload {
    private final int version;
    private final String receiptHash;
    private final String reason;
    private final String requestedAmount;
    private final long validUntil;
    private final List<String> evidence;

    public DisputePayload(int version, String receiptHash, String reason,
                          String requestedAmount, long validUntil,
                          List<String> evidence) {
        this.version = version;
        this.receiptHash = receiptHash;
        this.reason = reason;
        this.requestedAmount = requestedAmount;
        this.validUntil = validUntil;
        this.evidence = evidence == null
            ? List.of()
            : Collections.unmodifiableList(new ArrayList<>(evidence));
    }

    public int getVersion() { return version; }
    public String getReceiptHash() { return receiptHash; }
    public String getReason() { return reason; }
    public String getRequestedAmount() { return requestedAmount; }
    public long getValidUntil() { return validUntil; }
    public List<String> getEvidence() { return evidence; }

    public Map<String, Object> toMap() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("version", version);
        m.put("receiptHash", receiptHash);
        m.put("reason", reason);
        m.put("requestedAmount", requestedAmount);
        m.put("validUntil", validUntil);
        if (!evidence.isEmpty()) {
            m.put("evidence", evidence);
        }
        return m;
    }

    @SuppressWarnings("unchecked")
    public static DisputePayload fromMap(Map<String, Object> map) {
        List<String> ev = (List<String>) map.getOrDefault("evidence", List.of());
        return new DisputePayload(
            ((Number) map.get("version")).intValue(),
            (String) map.get("receiptHash"),
            (String) map.get("reason"),
            (String) map.get("requestedAmount"),
            ((Number) map.get("validUntil")).longValue(),
            ev
        );
    }
}
