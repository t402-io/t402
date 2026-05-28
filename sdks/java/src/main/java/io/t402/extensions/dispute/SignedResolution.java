package io.t402.extensions.dispute;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * A signed resolution envelope.
 */
public class SignedResolution {
    private final String format;
    private final String signature;
    private final ResolutionPayload payload;

    public SignedResolution(String format, String signature,
                            ResolutionPayload payload) {
        this.format = format;
        this.signature = signature;
        this.payload = payload;
    }

    public String getFormat() { return format; }
    public String getSignature() { return signature; }
    public ResolutionPayload getPayload() { return payload; }

    public Map<String, Object> toMap() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("format", format);
        m.put("signature", signature);
        if (payload != null) {
            m.put("payload", payload.toMap());
        }
        return m;
    }

    @SuppressWarnings("unchecked")
    public static SignedResolution fromMap(Map<String, Object> map) {
        ResolutionPayload payload = null;
        if (map.get("payload") instanceof Map<?, ?> p) {
            payload = ResolutionPayload.fromMap((Map<String, Object>) p);
        }
        return new SignedResolution(
            (String) map.get("format"),
            (String) map.get("signature"),
            payload
        );
    }
}
