package io.t402.client;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.Map;

/**
 * Identifies a payment scheme+network pair that a facilitator supports.
 * <p>
 * In v2, Kind includes the protocol version and optional extra configuration.
 * </p>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class Kind {

    /** Protocol version (2 for v2). */
    public int t402Version = 2;

    /** Payment scheme identifier (e.g., "exact"). */
    public String scheme;

    /** Network identifier in CAIP-2 format (e.g., "eip155:8453"). */
    public String network;

    /** Additional scheme-specific configuration. */
    public Map<String, Object> extra;

    /** Default constructor for Jackson deserialization. */
    public Kind() {}

    /**
     * Creates a new Kind with the specified scheme and network.
     *
     * @param scheme the payment scheme identifier
     * @param network the network identifier in CAIP-2 format
     */
    public Kind(String scheme, String network) {
        this.scheme = scheme;
        this.network = network;
    }

    /**
     * Creates a new Kind with all fields.
     *
     * @param t402Version protocol version
     * @param scheme the payment scheme identifier
     * @param network the network identifier in CAIP-2 format
     */
    public Kind(int t402Version, String scheme, String network) {
        this.t402Version = t402Version;
        this.scheme = scheme;
        this.network = network;
    }
}
