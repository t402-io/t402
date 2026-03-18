package io.t402.extensions.offerreceipt;

import java.util.Map;

/**
 * Canonical offer payload fields for EIP-712 signing.
 */
public class OfferPayload {
    private final int version;
    private final String resourceUrl;
    private final String scheme;
    private final String network;
    private final String asset;
    private final String payTo;
    private final String amount;
    private final long validUntil;

    public OfferPayload(int version, String resourceUrl, String scheme,
                        String network, String asset, String payTo,
                        String amount, long validUntil) {
        this.version = version;
        this.resourceUrl = resourceUrl;
        this.scheme = scheme;
        this.network = network;
        this.asset = asset;
        this.payTo = payTo;
        this.amount = amount;
        this.validUntil = validUntil;
    }

    public int getVersion() { return version; }
    public String getResourceUrl() { return resourceUrl; }
    public String getScheme() { return scheme; }
    public String getNetwork() { return network; }
    public String getAsset() { return asset; }
    public String getPayTo() { return payTo; }
    public String getAmount() { return amount; }
    public long getValidUntil() { return validUntil; }

    public Map<String, Object> toMap() {
        return Map.of(
            "version", version,
            "resourceUrl", resourceUrl,
            "scheme", scheme,
            "network", network,
            "asset", asset,
            "payTo", payTo,
            "amount", amount,
            "validUntil", validUntil
        );
    }

    @SuppressWarnings("unchecked")
    public static OfferPayload fromMap(Map<String, Object> map) {
        return new OfferPayload(
            ((Number) map.get("version")).intValue(),
            (String) map.get("resourceUrl"),
            (String) map.get("scheme"),
            (String) map.get("network"),
            (String) map.get("asset"),
            (String) map.get("payTo"),
            (String) map.get("amount"),
            map.containsKey("validUntil") ? ((Number) map.get("validUntil")).longValue() : 0
        );
    }
}
