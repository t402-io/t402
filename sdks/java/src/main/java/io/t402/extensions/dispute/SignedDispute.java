package io.t402.extensions.dispute;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * A signed dispute envelope. EIP-712 carries a payload; JWS variant
 * carries only signature.
 */
public class SignedDispute {
    private final String format;
    private final String signature;
    private final DisputePayload payload;
    private final String signer;

    public SignedDispute(String format, String signature,
                         DisputePayload payload, String signer) {
        this.format = format;
        this.signature = signature;
        this.payload = payload;
        this.signer = signer == null ? "" : signer;
    }

    public String getFormat() { return format; }
    public String getSignature() { return signature; }
    public DisputePayload getPayload() { return payload; }
    /** Explicit signer address when signed by a delegate. */
    public String getSigner() { return signer; }

    public Map<String, Object> toMap() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("format", format);
        m.put("signature", signature);
        if (payload != null) {
            m.put("payload", payload.toMap());
        }
        if (!signer.isEmpty()) {
            m.put("signer", signer);
        }
        return m;
    }

    @SuppressWarnings("unchecked")
    public static SignedDispute fromMap(Map<String, Object> map) {
        DisputePayload payload = null;
        if (map.get("payload") instanceof Map<?, ?> p) {
            payload = DisputePayload.fromMap((Map<String, Object>) p);
        }
        return new SignedDispute(
            (String) map.get("format"),
            (String) map.get("signature"),
            payload,
            (String) map.getOrDefault("signer", "")
        );
    }
}
