package io.t402.schemes.ton;

import java.util.concurrent.CompletableFuture;

/**
 * Optional interface for post-confirmation failure detection.
 *
 * <p>Signers implementing this interface enable the facilitator to verify that
 * the Jetton transfer within a confirmed transaction actually completed,
 * not just that the external message was processed (seqno incremented).
 *
 * <p>This adopts the transaction status tracking pattern from TON Connect v0.0.9 (TEP-46).
 *
 * <h2>Usage</h2>
 * <pre>{@code
 * public class MyTonSigner implements FacilitatorTonSigner, TransactionStatusChecker {
 *     @Override
 *     public CompletableFuture<TransactionStatus> getTransactionStatus(
 *             String txHash, String network) {
 *         // Query TON API for transaction trace and check for failures
 *         return tonClient.getTransactionTrace(txHash)
 *             .thenApply(trace -> trace.hasFailed()
 *                 ? TransactionStatus.FAILED
 *                 : TransactionStatus.CONFIRMED);
 *     }
 *     // ... other FacilitatorTonSigner methods
 * }
 * }</pre>
 */
public interface TransactionStatusChecker {

    /**
     * Gets the status of a transaction by its hash.
     *
     * <p>Used for post-confirmation failure detection: after seqno-based
     * confirmation succeeds, this method verifies whether the Jetton transfer
     * within the transaction actually completed.
     *
     * @param txHash Transaction hash to check
     * @param network Network identifier (CAIP-2 format)
     * @return CompletableFuture containing the transaction status
     */
    CompletableFuture<TransactionStatus> getTransactionStatus(String txHash, String network);
}
