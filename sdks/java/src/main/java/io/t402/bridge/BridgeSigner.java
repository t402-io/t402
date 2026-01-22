package io.t402.bridge;

import io.t402.bridge.BridgeTypes.TransactionReceipt;
import java.math.BigInteger;
import java.util.concurrent.CompletableFuture;

/**
 * Interface for signing bridge transactions.
 *
 * <p>Implementations must provide contract read/write capabilities
 * for interacting with USDT0 OFT contracts.
 */
public interface BridgeSigner {

    /**
     * Get the signer's address.
     *
     * @return 0x-prefixed Ethereum address
     */
    String getAddress();

    /**
     * Read data from a contract.
     *
     * @param contractAddress Contract address
     * @param functionName Function name
     * @param args Function arguments
     * @return Contract return value
     * @throws Exception if call fails
     */
    Object readContract(String contractAddress, String functionName, Object... args) throws Exception;

    /**
     * Write to a contract (send transaction).
     *
     * @param contractAddress Contract address
     * @param functionName Function name
     * @param value Native value to send (in wei)
     * @param args Function arguments
     * @return Transaction hash
     * @throws Exception if call fails
     */
    String writeContract(
            String contractAddress, String functionName, BigInteger value, Object... args) throws Exception;

    /**
     * Wait for a transaction receipt.
     *
     * @param txHash Transaction hash
     * @return Transaction receipt
     * @throws Exception if wait fails
     */
    TransactionReceipt waitForTransactionReceipt(String txHash) throws Exception;

    /**
     * Read data from a contract asynchronously.
     *
     * @param contractAddress Contract address
     * @param functionName Function name
     * @param args Function arguments
     * @return CompletableFuture with contract return value
     */
    default CompletableFuture<Object> readContractAsync(
            String contractAddress, String functionName, Object... args) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                return readContract(contractAddress, functionName, args);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });
    }

    /**
     * Write to a contract asynchronously.
     *
     * @param contractAddress Contract address
     * @param functionName Function name
     * @param value Native value to send
     * @param args Function arguments
     * @return CompletableFuture with transaction hash
     */
    default CompletableFuture<String> writeContractAsync(
            String contractAddress, String functionName, BigInteger value, Object... args) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                return writeContract(contractAddress, functionName, value, args);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });
    }
}
