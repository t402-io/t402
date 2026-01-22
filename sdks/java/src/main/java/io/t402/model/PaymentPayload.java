package io.t402.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import io.t402.util.Json;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;

/**
 * Payment payload sent by clients in the X-PAYMENT header.
 * <p>
 * In the v2 protocol, PaymentPayload includes:
 * <ul>
 *   <li>Resource information identifying what is being paid for</li>
 *   <li>The accepted payment requirements (chosen from server's accepts list)</li>
 *   <li>Scheme-specific payload data (signature, authorization, etc.)</li>
 *   <li>Optional protocol extensions</li>
 * </ul>
 * </p>
 *
 * <h3>Example v2 Payload</h3>
 * <pre>{@code
 * {
 *   "t402Version": 2,
 *   "resource": {
 *     "url": "https://api.example.com/premium-data",
 *     "description": "Premium market data",
 *     "mimeType": "application/json"
 *   },
 *   "accepted": {
 *     "scheme": "exact",
 *     "network": "eip155:8453",
 *     "amount": "10000",
 *     "asset": "0x...",
 *     "payTo": "0x...",
 *     "maxTimeoutSeconds": 60
 *   },
 *   "payload": {
 *     "signature": "0x...",
 *     "authorization": { ... }
 *   }
 * }
 * }</pre>
 *
 * @see ResourceInfo
 * @see PaymentRequirements
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PaymentPayload {

    /** Protocol version (2 for v2). */
    public int t402Version = 2;

    /** Information about the resource being accessed (v2). */
    public ResourceInfo resource;

    /** The payment requirements accepted by the client (v2). */
    public PaymentRequirements accepted;

    /** Scheme-specific payment data (signature, authorization, etc.). */
    public Map<String, Object> payload;

    /** Protocol extensions data (v2). */
    public Map<String, Object> extensions;

    // ========== Deprecated v1 fields (for backward compatibility during deserialization) ==========

    /**
     * @deprecated Use {@code accepted.scheme} instead (v2).
     */
    @Deprecated
    public String scheme;

    /**
     * @deprecated Use {@code accepted.network} instead (v2).
     */
    @Deprecated
    public String network;

    /** Default constructor. */
    public PaymentPayload() {}

    /**
     * Creates a v2 PaymentPayload.
     *
     * @param resource information about the resource being accessed
     * @param accepted the payment requirements accepted by the client
     * @param payload scheme-specific payment data
     */
    public PaymentPayload(ResourceInfo resource, PaymentRequirements accepted, Map<String, Object> payload) {
        this.t402Version = 2;
        this.resource = resource;
        this.accepted = accepted;
        this.payload = payload;
    }

    /**
     * Builder-style method to set extensions.
     *
     * @param extensions protocol extensions data
     * @return this instance for chaining
     */
    public PaymentPayload withExtensions(Map<String, Object> extensions) {
        this.extensions = extensions;
        return this;
    }

    /**
     * Gets the effective scheme, supporting both v1 and v2 formats.
     *
     * @return the payment scheme
     */
    @JsonIgnore
    public String getEffectiveScheme() {
        if (accepted != null && accepted.scheme != null) {
            return accepted.scheme;
        }
        return scheme;
    }

    /**
     * Gets the effective network, supporting both v1 and v2 formats.
     *
     * @return the network identifier
     */
    @JsonIgnore
    public String getEffectiveNetwork() {
        if (accepted != null && accepted.network != null) {
            return accepted.network;
        }
        return network;
    }

    /**
     * Serializes and base64-encodes for the X-PAYMENT header.
     *
     * @return base64-encoded JSON string
     */
    public String toHeader() {
        try {
            String json = Json.MAPPER.writeValueAsString(this);
            return Base64.getEncoder().encodeToString(json.getBytes(StandardCharsets.UTF_8));
        } catch (IOException e) {
            throw new IllegalStateException("Unable to encode payment header", e);
        }
    }

    /**
     * Decodes a PaymentPayload from the X-PAYMENT header.
     *
     * @param header base64-encoded JSON string
     * @return decoded PaymentPayload
     * @throws IOException if decoding fails
     */
    public static PaymentPayload fromHeader(String header) throws IOException {
        byte[] decoded = Base64.getDecoder().decode(header);
        return Json.MAPPER.readValue(decoded, PaymentPayload.class);
    }

    /**
     * Creates a v2 PaymentPayload builder.
     *
     * @return a new builder instance
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder for creating PaymentPayload instances.
     */
    public static class Builder {
        private ResourceInfo resource;
        private PaymentRequirements accepted;
        private Map<String, Object> payload;
        private Map<String, Object> extensions;

        public Builder resource(ResourceInfo resource) {
            this.resource = resource;
            return this;
        }

        public Builder resource(String url, String description, String mimeType) {
            this.resource = new ResourceInfo(url, description, mimeType);
            return this;
        }

        public Builder accepted(PaymentRequirements accepted) {
            this.accepted = accepted;
            return this;
        }

        public Builder payload(Map<String, Object> payload) {
            this.payload = payload;
            return this;
        }

        public Builder extensions(Map<String, Object> extensions) {
            this.extensions = extensions;
            return this;
        }

        public PaymentPayload build() {
            PaymentPayload pp = new PaymentPayload(resource, accepted, payload);
            pp.extensions = extensions;
            return pp;
        }
    }
}
