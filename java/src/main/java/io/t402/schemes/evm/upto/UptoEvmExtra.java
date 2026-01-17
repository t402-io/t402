package io.t402.schemes.evm.upto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * EVM-specific extra fields for the Up-To scheme.
 * <p>
 * Contains EIP-712 domain parameters for permit signing and billing configuration.
 * </p>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UptoEvmExtra {

    /** EIP-712 domain name (token name). */
    public String name;

    /** EIP-712 domain version. */
    public String version;

    /** Upto router contract address. */
    @JsonProperty("routerAddress")
    public String routerAddress;

    /** Billing unit type (e.g., "token", "request"). */
    public String unit;

    /** Price per unit in smallest denomination. */
    @JsonProperty("unitPrice")
    public String unitPrice;

    /** Default constructor for Jackson. */
    public UptoEvmExtra() {}

    /**
     * Creates a new UptoEvmExtra with EIP-712 domain parameters.
     *
     * @param name EIP-712 domain name
     * @param version EIP-712 domain version
     */
    public UptoEvmExtra(String name, String version) {
        this.name = name;
        this.version = version;
    }

    /**
     * Creates a new UptoEvmExtra with full EIP-712 parameters.
     *
     * @param name EIP-712 domain name
     * @param version EIP-712 domain version
     * @param routerAddress router contract address
     */
    public UptoEvmExtra(String name, String version, String routerAddress) {
        this.name = name;
        this.version = version;
        this.routerAddress = routerAddress;
    }

    /**
     * Builder-style method to set billing unit.
     *
     * @param unit billing unit type
     * @return this instance for chaining
     */
    public UptoEvmExtra withUnit(String unit) {
        this.unit = unit;
        return this;
    }

    /**
     * Builder-style method to set unit price.
     *
     * @param unitPrice price per unit
     * @return this instance for chaining
     */
    public UptoEvmExtra withUnitPrice(String unitPrice) {
        this.unitPrice = unitPrice;
        return this;
    }

    /**
     * Builder-style method to set router address.
     *
     * @param routerAddress router contract address
     * @return this instance for chaining
     */
    public UptoEvmExtra withRouterAddress(String routerAddress) {
        this.routerAddress = routerAddress;
        return this;
    }
}
