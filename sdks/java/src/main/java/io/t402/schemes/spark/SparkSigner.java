package io.t402.schemes.spark;

/**
 * Interface for Spark facilitator operations.
 *
 * <p>Implementations handle Spark transfer lookups and address management
 * for the facilitator scheme.
 */
public interface SparkSigner {

    /**
     * Looks up a Spark transfer by ID.
     *
     * @param transferId Transfer identifier
     * @return Transfer details
     * @throws Exception if the transfer is not found or lookup fails
     */
    TransferInfo getTransfer(String transferId) throws Exception;

    /**
     * Returns the facilitator's Spark address.
     *
     * @return Spark address
     */
    String getAddress();
}
