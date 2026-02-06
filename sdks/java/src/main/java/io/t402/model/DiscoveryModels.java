package io.t402.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Bazaar discovery API models.
 * <p>
 * Contains all request/response types for the resource discovery endpoints.
 * </p>
 */
public final class DiscoveryModels {

    private DiscoveryModels() {}

    /**
     * A single payment option for a discovery resource.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PaymentOption {
        public String scheme;
        public String network;
        public String amount;
        public String asset;
        @JsonProperty("payTo")
        public String payTo;
        @JsonProperty("maxTimeoutSeconds")
        public int maxTimeoutSeconds = 3600;
        public Map<String, Object> extra;

        public PaymentOption() {}

        public PaymentOption(String scheme, String network, String amount,
                             String asset, String payTo, int maxTimeoutSeconds) {
            this.scheme = scheme;
            this.network = network;
            this.amount = amount;
            this.asset = asset;
            this.payTo = payTo;
            this.maxTimeoutSeconds = maxTimeoutSeconds;
        }
    }

    /**
     * Optional metadata about a discovery resource.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ResourceMetadata {
        public String category;
        public String provider;
        public String description;
        public List<String> tags;
        public Map<String, String> custom;

        public ResourceMetadata() {}
    }

    /**
     * A single resource item in the discovery response.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class DiscoveryItem {
        public String id;
        public String resource;
        public String type;
        @JsonProperty("t402Version")
        public int t402Version;
        public List<PaymentOption> accepts;
        @JsonProperty("lastUpdated")
        public long lastUpdated;
        public ResourceMetadata metadata;

        public DiscoveryItem() {}
    }

    /**
     * Pagination metadata in a list response.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PaginationInfo {
        public int limit;
        public int offset;
        public int total;

        public PaginationInfo() {}
    }

    /**
     * Response from GET /discovery/resources.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class DiscoveryResponse {
        @JsonProperty("t402Version")
        public int t402Version;
        public List<DiscoveryItem> items;
        public PaginationInfo pagination;

        public DiscoveryResponse() {}
    }

    /**
     * Query parameters for listing resources.
     */
    public static class ListResourcesParams {
        public String type;
        public String network;
        public String scheme;
        public String category;
        public String provider;
        public Integer limit;
        public Integer offset;

        public ListResourcesParams() {}
    }

    /**
     * Request body for POST /discovery/register.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class RegisterResourceRequest {
        public String resource;
        public String type;
        @JsonProperty("t402Version")
        public int t402Version = 2;
        public List<PaymentOption> accepts;
        public ResourceMetadata metadata;

        public RegisterResourceRequest() {}

        public RegisterResourceRequest(String resource, String type, List<PaymentOption> accepts) {
            this.resource = resource;
            this.type = type;
            this.accepts = accepts;
        }
    }

    /**
     * Response from POST /discovery/register.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class RegisterResourceResponse {
        public String id;
        public String resource;
        public String type;
        @JsonProperty("t402Version")
        public int t402Version;
        @JsonProperty("createdAt")
        public String createdAt;

        public RegisterResourceResponse() {}
    }

    /**
     * Request body for PUT /discovery/resources/:id.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class UpdateResourceRequest {
        public List<PaymentOption> accepts;
        public ResourceMetadata metadata;
        public Boolean active;

        public UpdateResourceRequest() {}
    }
}
