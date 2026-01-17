package io.t402.schemes.upto;

import com.fasterxml.jackson.annotation.JsonAnyGetter;
import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.HashMap;
import java.util.Map;

/**
 * Extra fields for the Up-To payment scheme.
 * <p>
 * Contains billing configuration and EIP-712 domain parameters (for EVM).
 * </p>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UptoExtra {

    /** Billing unit type (e.g., "token", "request", "second", "byte"). */
    public String unit;

    /** Price per unit in smallest denomination. */
    @JsonProperty("unitPrice")
    public String unitPrice;

    /** EIP-712 domain name (for EVM). */
    public String name;

    /** EIP-712 domain version (for EVM). */
    public String version;

    /** Router contract address (for EVM). */
    @JsonProperty("routerAddress")
    public String routerAddress;

    /** Additional fields not explicitly defined. */
    private Map<String, Object> additionalFields = new HashMap<>();

    /** Default constructor for Jackson. */
    public UptoExtra() {}

    /**
     * Creates a new UptoExtra with billing unit configuration.
     *
     * @param unit billing unit type
     * @param unitPrice price per unit
     */
    public UptoExtra(String unit, String unitPrice) {
        this.unit = unit;
        this.unitPrice = unitPrice;
    }

    /**
     * Creates a new UptoExtra with EIP-712 domain parameters.
     *
     * @param name EIP-712 domain name
     * @param version EIP-712 domain version
     * @param routerAddress router contract address
     */
    public UptoExtra(String name, String version, String routerAddress) {
        this.name = name;
        this.version = version;
        this.routerAddress = routerAddress;
    }

    /**
     * Builder-style method to set name.
     *
     * @param name EIP-712 domain name
     * @return this instance for chaining
     */
    public UptoExtra withName(String name) {
        this.name = name;
        return this;
    }

    /**
     * Builder-style method to set version.
     *
     * @param version EIP-712 domain version
     * @return this instance for chaining
     */
    public UptoExtra withVersion(String version) {
        this.version = version;
        return this;
    }

    /**
     * Builder-style method to set router address.
     *
     * @param routerAddress router contract address
     * @return this instance for chaining
     */
    public UptoExtra withRouterAddress(String routerAddress) {
        this.routerAddress = routerAddress;
        return this;
    }

    /**
     * Gets additional fields not explicitly defined.
     *
     * @return map of additional fields
     */
    @JsonAnyGetter
    public Map<String, Object> getAdditionalFields() {
        return additionalFields;
    }

    /**
     * Sets an additional field.
     *
     * @param key field name
     * @param value field value
     */
    @JsonAnySetter
    public void setAdditionalField(String key, Object value) {
        additionalFields.put(key, value);
    }
}
