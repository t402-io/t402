package io.t402.extensions.dispute;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Canonical resolution payload fields for EIP-712 signing.
 */
public class ResolutionPayload {
    private final int version;
    private final String disputeHash;
    private final String verdict;
    private final String settledAmount;
    private final String arbiter;
    private final long issuedAt;
    private final String refundTransaction;

    public ResolutionPayload(int version, String disputeHash, String verdict,
                             String settledAmount, String arbiter,
                             long issuedAt, String refundTransaction) {
        this.version = version;
        this.disputeHash = disputeHash;
        this.verdict = verdict;
        this.settledAmount = settledAmount;
        this.arbiter = arbiter;
        this.issuedAt = issuedAt;
        this.refundTransaction = refundTransaction == null ? "" : refundTransaction;
    }

    public int getVersion() { return version; }
    public String getDisputeHash() { return disputeHash; }
    public String getVerdict() { return verdict; }
    public String getSettledAmount() { return settledAmount; }
    public String getArbiter() { return arbiter; }
    public long getIssuedAt() { return issuedAt; }
    public String getRefundTransaction() { return refundTransaction; }

    public Map<String, Object> toMap() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("version", version);
        m.put("disputeHash", disputeHash);
        m.put("verdict", verdict);
        m.put("settledAmount", settledAmount);
        m.put("arbiter", arbiter);
        m.put("issuedAt", issuedAt);
        if (!refundTransaction.isEmpty()) {
            m.put("refundTransaction", refundTransaction);
        }
        return m;
    }

    public static ResolutionPayload fromMap(Map<String, Object> map) {
        return new ResolutionPayload(
            ((Number) map.get("version")).intValue(),
            (String) map.get("disputeHash"),
            (String) map.get("verdict"),
            (String) map.get("settledAmount"),
            (String) map.get("arbiter"),
            ((Number) map.get("issuedAt")).longValue(),
            (String) map.getOrDefault("refundTransaction", "")
        );
    }
}
