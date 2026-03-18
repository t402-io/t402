package io.t402.schemes.evm.erc7710;

import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * Interface for facilitator-side ERC-7710 delegation operations.
 *
 * <p>Implementations should provide methods to:
 * <ul>
 *   <li>Get facilitator wallet addresses</li>
 *   <li>Simulate contract calls (eth_call) for verification</li>
 *   <li>Execute contract write transactions for settlement</li>
 *   <li>Wait for transaction confirmation</li>
 * </ul>
 *
 * <h2>Example Implementation</h2>
 * <pre>{@code
 * public class MyERC7710Signer implements ERC7710FacilitatorSigner {
 *     private final Web3j web3;
 *     private final Credentials credentials;
 *
 *     @Override
 *     public List<String> getAddresses() {
 *         return List.of(credentials.getAddress());
 *     }
 *
 *     @Override
 *     public CompletableFuture<byte[]> simulateContract(
 *             String contractAddress, String abiJson, String functionName, Object... args) {
 *         // Execute eth_call and return result bytes
 *         return CompletableFuture.completedFuture(new byte[0]);
 *     }
 *
 *     @Override
 *     public CompletableFuture<String> writeContract(
 *             String contractAddress, String abiJson, String functionName, Object... args) {
 *         // Send transaction and return tx hash
 *         return CompletableFuture.completedFuture(txHash);
 *     }
 *
 *     @Override
 *     public CompletableFuture<TransactionReceipt> waitForTransactionReceipt(String txHash) {
 *         return CompletableFuture.completedFuture(new TransactionReceipt(true));
 *     }
 * }
 * }</pre>
 */
public interface ERC7710FacilitatorSigner {

    /**
     * Gets the list of facilitator wallet addresses.
     *
     * @return List of 0x-prefixed Ethereum addresses
     */
    List<String> getAddresses();

    /**
     * Simulates a contract call (eth_call) without sending a transaction.
     *
     * <p>Used to verify that a redeemDelegations call would succeed
     * before actually executing it on-chain.</p>
     *
     * @param contractAddress 0x-prefixed contract address
     * @param abiJson ABI JSON string for the contract function
     * @param functionName Name of the function to call
     * @param args Function arguments
     * @return CompletableFuture containing the raw return bytes
     */
    CompletableFuture<byte[]> simulateContract(
            String contractAddress,
            String abiJson,
            String functionName,
            Object... args);

    /**
     * Executes a contract write transaction.
     *
     * <p>Sends a transaction calling the specified function on the contract.</p>
     *
     * @param contractAddress 0x-prefixed contract address
     * @param abiJson ABI JSON string for the contract function
     * @param functionName Name of the function to call
     * @param args Function arguments
     * @return CompletableFuture containing the transaction hash
     */
    CompletableFuture<String> writeContract(
            String contractAddress,
            String abiJson,
            String functionName,
            Object... args);

    /**
     * Waits for a transaction to be confirmed on-chain.
     *
     * @param txHash Transaction hash
     * @return CompletableFuture containing the transaction receipt
     */
    CompletableFuture<TransactionReceipt> waitForTransactionReceipt(String txHash);

    // ============================================================
    // Default Sync Methods
    // ============================================================

    /**
     * Simulates a contract call synchronously.
     *
     * @param contractAddress Contract address
     * @param abiJson ABI JSON string
     * @param functionName Function name
     * @param args Function arguments
     * @return Raw return bytes
     */
    default byte[] simulateContractSync(
            String contractAddress,
            String abiJson,
            String functionName,
            Object... args) {
        return simulateContract(contractAddress, abiJson, functionName, args).join();
    }

    /**
     * Executes a contract write transaction synchronously.
     *
     * @param contractAddress Contract address
     * @param abiJson ABI JSON string
     * @param functionName Function name
     * @param args Function arguments
     * @return Transaction hash
     */
    default String writeContractSync(
            String contractAddress,
            String abiJson,
            String functionName,
            Object... args) {
        return writeContract(contractAddress, abiJson, functionName, args).join();
    }

    /**
     * Waits for a transaction receipt synchronously.
     *
     * @param txHash Transaction hash
     * @return Transaction receipt
     */
    default TransactionReceipt waitForTransactionReceiptSync(String txHash) {
        return waitForTransactionReceipt(txHash).join();
    }

    // ============================================================
    // Transaction Receipt
    // ============================================================

    /**
     * Represents a transaction receipt.
     */
    class TransactionReceipt {

        /** Whether the transaction succeeded. */
        public final boolean success;

        /**
         * Creates a new TransactionReceipt.
         *
         * @param success Whether the transaction was successful
         */
        public TransactionReceipt(boolean success) {
            this.success = success;
        }
    }
}
