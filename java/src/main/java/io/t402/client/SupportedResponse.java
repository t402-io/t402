package io.t402.client;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;
import java.util.Map;

/**
 * Response from the facilitator's /supported endpoint.
 * <p>
 * Contains information about supported payment schemes, networks, extensions, and signers.
 * </p>
 *
 * <h3>Example Response</h3>
 * <pre>{@code
 * {
 *   "kinds": [
 *     { "t402Version": 2, "scheme": "exact", "network": "eip155:8453" },
 *     { "t402Version": 2, "scheme": "exact", "network": "eip155:84532" }
 *   ],
 *   "extensions": [],
 *   "signers": {
 *     "eip155:*": ["0x1234..."],
 *     "solana:*": ["CKPKJWNdJ..."]
 *   }
 * }
 * }</pre>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SupportedResponse {

    /** List of supported payment kinds (scheme + network combinations). */
    public List<Kind> kinds;

    /** List of supported extension identifiers. */
    public List<String> extensions;

    /**
     * Map of CAIP-2 patterns to signer addresses.
     * <p>
     * Keys are CAIP-2 patterns like "eip155:*" (all EVM chains) or "solana:*" (all Solana chains).
     * Values are lists of signer addresses that the facilitator uses on those networks.
     * </p>
     */
    public Map<String, List<String>> signers;

    /** Default constructor for Jackson. */
    public SupportedResponse() {}

    /**
     * Creates a SupportedResponse with the specified kinds.
     *
     * @param kinds list of supported payment kinds
     */
    public SupportedResponse(List<Kind> kinds) {
        this.kinds = kinds;
    }

    /**
     * Checks if a specific scheme and network combination is supported.
     *
     * @param scheme the payment scheme to check
     * @param network the network to check in CAIP-2 format
     * @return true if the combination is supported
     */
    public boolean supports(String scheme, String network) {
        if (kinds == null) {
            return false;
        }
        return kinds.stream().anyMatch(k ->
            scheme.equals(k.scheme) && network.equals(k.network)
        );
    }

    /**
     * Gets the signer addresses for a specific network.
     *
     * @param network the network in CAIP-2 format (e.g., "eip155:8453")
     * @return list of signer addresses, or null if not found
     */
    public List<String> getSignersForNetwork(String network) {
        if (signers == null) {
            return null;
        }

        // Try exact match first
        if (signers.containsKey(network)) {
            return signers.get(network);
        }

        // Try wildcard match (e.g., "eip155:*" for "eip155:8453")
        String[] parts = network.split(":");
        if (parts.length == 2) {
            String wildcardKey = parts[0] + ":*";
            if (signers.containsKey(wildcardKey)) {
                return signers.get(wildcardKey);
            }
        }

        return null;
    }
}
