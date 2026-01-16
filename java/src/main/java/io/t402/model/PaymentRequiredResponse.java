package io.t402.model;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * HTTP 402 response body returned by a t402-enabled server.
 * <p>
 * This response signals that payment is required to access a resource and includes:
 * <ul>
 *   <li>Resource information describing what the client is paying for</li>
 *   <li>A list of acceptable payment methods</li>
 *   <li>Optional error message explaining why payment is required</li>
 *   <li>Optional protocol extensions</li>
 * </ul>
 * </p>
 *
 * <h3>Example v2 Response</h3>
 * <pre>{@code
 * {
 *   "t402Version": 2,
 *   "error": "Payment required",
 *   "resource": {
 *     "url": "https://api.example.com/premium-data",
 *     "description": "Premium market data",
 *     "mimeType": "application/json"
 *   },
 *   "accepts": [
 *     {
 *       "scheme": "exact",
 *       "network": "eip155:8453",
 *       "amount": "10000",
 *       "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
 *       "payTo": "0x...",
 *       "maxTimeoutSeconds": 60
 *     }
 *   ]
 * }
 * }</pre>
 *
 * @see ResourceInfo
 * @see PaymentRequirements
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PaymentRequiredResponse {

    /** Protocol version (2 for v2). */
    public int t402Version = 2;

    /** Human-readable error message explaining why payment is required. */
    public String error;

    /** Information about the protected resource (v2). */
    public ResourceInfo resource;

    /** List of acceptable payment methods. */
    public List<PaymentRequirements> accepts = new ArrayList<>();

    /** Protocol extensions data (v2). */
    public Map<String, Object> extensions;

    /** Default constructor. */
    public PaymentRequiredResponse() {}

    /**
     * Creates a PaymentRequiredResponse with resource info and accepts list.
     *
     * @param resource information about the protected resource
     * @param accepts list of acceptable payment methods
     */
    public PaymentRequiredResponse(ResourceInfo resource, List<PaymentRequirements> accepts) {
        this.resource = resource;
        this.accepts = accepts != null ? accepts : new ArrayList<>();
    }

    /**
     * Builder-style method to set the error message.
     *
     * @param error human-readable error message
     * @return this instance for chaining
     */
    public PaymentRequiredResponse withError(String error) {
        this.error = error;
        return this;
    }

    /**
     * Builder-style method to set extensions.
     *
     * @param extensions protocol extensions data
     * @return this instance for chaining
     */
    public PaymentRequiredResponse withExtensions(Map<String, Object> extensions) {
        this.extensions = extensions;
        return this;
    }

    /**
     * Builder-style method to add a payment requirement.
     *
     * @param requirement acceptable payment method to add
     * @return this instance for chaining
     */
    public PaymentRequiredResponse addAccepts(PaymentRequirements requirement) {
        this.accepts.add(requirement);
        return this;
    }
}
