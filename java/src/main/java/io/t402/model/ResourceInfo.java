package io.t402.model;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Describes a protected resource in the t402 v2 protocol.
 * <p>
 * ResourceInfo is used in both PaymentRequired responses and PaymentPayload requests
 * to identify the resource being accessed or paid for.
 * </p>
 *
 * @see PaymentRequiredResponse
 * @see PaymentPayload
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ResourceInfo {

    /** URL of the protected resource. */
    public String url;

    /** Human-readable description of the resource. */
    public String description;

    /** MIME type of the expected response. */
    public String mimeType;

    /** Default constructor for Jackson. */
    public ResourceInfo() {}

    /**
     * Constructor with all fields.
     *
     * @param url URL of the protected resource
     * @param description human-readable description
     * @param mimeType MIME type of the expected response
     */
    public ResourceInfo(String url, String description, String mimeType) {
        this.url = url;
        this.description = description;
        this.mimeType = mimeType;
    }

    /**
     * Creates a ResourceInfo with just the URL.
     *
     * @param url URL of the protected resource
     * @return a new ResourceInfo instance
     */
    public static ResourceInfo of(String url) {
        return new ResourceInfo(url, null, null);
    }

    /**
     * Creates a ResourceInfo with URL and MIME type.
     *
     * @param url URL of the protected resource
     * @param mimeType MIME type of the expected response
     * @return a new ResourceInfo instance
     */
    public static ResourceInfo of(String url, String mimeType) {
        return new ResourceInfo(url, null, mimeType);
    }
}
