package io.t402.extensions.dispute;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Server-declared dispute terms in the 402 response.
 */
public class DisputeTermsInfo {
    private final String arbiter;
    private final String arbiterScheme;
    private final long disputeWindow;
    private final List<String> supportedReasons;
    private final List<String> evidenceUriSchemes; // null means use default

    public DisputeTermsInfo(String arbiter, String arbiterScheme,
                            long disputeWindow, List<String> supportedReasons,
                            List<String> evidenceUriSchemes) {
        this.arbiter = arbiter;
        this.arbiterScheme = arbiterScheme;
        this.disputeWindow = disputeWindow;
        this.supportedReasons = supportedReasons == null
            ? List.of()
            : Collections.unmodifiableList(new ArrayList<>(supportedReasons));
        this.evidenceUriSchemes = evidenceUriSchemes == null
            ? null
            : Collections.unmodifiableList(new ArrayList<>(evidenceUriSchemes));
    }

    public String getArbiter() { return arbiter; }
    public String getArbiterScheme() { return arbiterScheme; }
    public long getDisputeWindow() { return disputeWindow; }
    public List<String> getSupportedReasons() { return supportedReasons; }
    public List<String> getEvidenceUriSchemes() { return evidenceUriSchemes; }

    public Map<String, Object> toMap() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("arbiter", arbiter);
        m.put("arbiterScheme", arbiterScheme);
        m.put("disputeWindow", disputeWindow);
        m.put("supportedReasons", supportedReasons);
        if (evidenceUriSchemes != null) {
            m.put("evidenceUriSchemes", evidenceUriSchemes);
        }
        return m;
    }

    @SuppressWarnings("unchecked")
    public static DisputeTermsInfo fromMap(Map<String, Object> map) {
        List<String> ev = (List<String>) map.get("evidenceUriSchemes");
        return new DisputeTermsInfo(
            (String) map.get("arbiter"),
            (String) map.get("arbiterScheme"),
            ((Number) map.get("disputeWindow")).longValue(),
            (List<String>) map.get("supportedReasons"),
            ev
        );
    }
}
