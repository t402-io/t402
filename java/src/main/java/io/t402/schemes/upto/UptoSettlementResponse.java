package io.t402.schemes.upto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Response from a settlement operation.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UptoSettlementResponse {

    /** Whether settlement was successful. */
    public boolean success;

    /** On-chain transaction hash (if applicable). */
    @JsonProperty("transactionHash")
    public String transactionHash;

    /** Actual amount that was settled. */
    @JsonProperty("settledAmount")
    public String settledAmount;

    /** Maximum amount that was authorized. */
    @JsonProperty("maxAmount")
    public String maxAmount;

    /** Block number of the transaction (if on-chain). */
    @JsonProperty("blockNumber")
    public Long blockNumber;

    /** Gas consumed by the transaction (if on-chain). */
    @JsonProperty("gasUsed")
    public String gasUsed;

    /** Error message if settlement failed. */
    public String error;

    /** Default constructor for Jackson. */
    public UptoSettlementResponse() {}

    /**
     * Creates a successful settlement response.
     *
     * @param settledAmount the amount that was settled
     * @param maxAmount the maximum authorized amount
     * @return a new successful response
     */
    public static UptoSettlementResponse success(String settledAmount, String maxAmount) {
        UptoSettlementResponse response = new UptoSettlementResponse();
        response.success = true;
        response.settledAmount = settledAmount;
        response.maxAmount = maxAmount;
        return response;
    }

    /**
     * Creates a successful settlement response with transaction details.
     *
     * @param settledAmount the amount that was settled
     * @param maxAmount the maximum authorized amount
     * @param transactionHash the on-chain transaction hash
     * @return a new successful response
     */
    public static UptoSettlementResponse success(String settledAmount, String maxAmount,
                                                  String transactionHash) {
        UptoSettlementResponse response = success(settledAmount, maxAmount);
        response.transactionHash = transactionHash;
        return response;
    }

    /**
     * Creates a failed settlement response.
     *
     * @param maxAmount the maximum authorized amount
     * @param error the error message
     * @return a new failed response
     */
    public static UptoSettlementResponse failure(String maxAmount, String error) {
        UptoSettlementResponse response = new UptoSettlementResponse();
        response.success = false;
        response.settledAmount = "0";
        response.maxAmount = maxAmount;
        response.error = error;
        return response;
    }

    /**
     * Builder-style method to set block number.
     *
     * @param blockNumber the block number
     * @return this instance for chaining
     */
    public UptoSettlementResponse withBlockNumber(long blockNumber) {
        this.blockNumber = blockNumber;
        return this;
    }

    /**
     * Builder-style method to set gas used.
     *
     * @param gasUsed the gas used
     * @return this instance for chaining
     */
    public UptoSettlementResponse withGasUsed(String gasUsed) {
        this.gasUsed = gasUsed;
        return this;
    }
}
