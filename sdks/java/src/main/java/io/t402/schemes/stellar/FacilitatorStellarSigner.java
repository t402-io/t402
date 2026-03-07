package io.t402.schemes.stellar;

import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * Interface for facilitator-side Stellar operations.
 * <p>
 * Provides methods to:
 * <ul>
 *   <li>Get available signer addresses</li>
 *   <li>Verify payment authorization signatures</li>
 *   <li>Send and confirm transactions</li>
 * </ul>
 * </p>
 *
 * <h2>Example Implementation</h2>
 * <pre>{@code
 * public class MyStellarFacilitatorSigner implements FacilitatorStellarSigner {
 *     private final StellarServer server;
 *     private final List<String> managedAddresses;
 *
 *     @Override
 *     public List<String> getAddresses() {
 *         return managedAddresses;
 *     }
 *
 *     @Override
 *     public CompletableFuture<Boolean> verifySignature(
 *             StellarAuthorization authorization, String signature, String network) {
 *         return CompletableFuture.completedFuture(verify(authorization, signature));
 *     }
 *
 *     @Override
 *     public CompletableFuture<String> sendTransaction(
 *             StellarAuthorization authorization, String signature, String network) {
 *         return server.submitTransaction(authorization, signature);
 *     }
 *     // ... other methods
 * }
 * }</pre>
 */
public interface FacilitatorStellarSigner {

    /**
     * Gets all available facilitator addresses (G-accounts).
     *
     * @return List of Stellar addresses managed by this facilitator
     */
    List<String> getAddresses();

    /**
     * Verifies a payment authorization signature.
     *
     * @param authorization Authorization parameters that were signed
     * @param signature Base64-encoded signature to verify
     * @param network Network identifier (CAIP-2 format)
     * @return CompletableFuture containing true if signature is valid
     */
    CompletableFuture<Boolean> verifySignature(
        StellarAuthorization authorization,
        String signature,
        String network
    );

    /**
     * Submits a Soroban token transfer transaction to the network.
     *
     * @param authorization Authorization containing transfer details
     * @param signature Client's signature authorizing the transfer
     * @param network Network identifier (CAIP-2 format)
     * @return CompletableFuture containing transaction hash
     */
    CompletableFuture<String> sendTransaction(
        StellarAuthorization authorization,
        String signature,
        String network
    );

    /**
     * Waits for transaction confirmation (ledger inclusion).
     *
     * @param txHash Transaction hash to confirm
     * @param network Network identifier (CAIP-2 format)
     * @return CompletableFuture containing true if confirmed
     */
    CompletableFuture<Boolean> confirmTransaction(String txHash, String network);

    /**
     * Checks the token balance for an address.
     *
     * @param address Address to check (G-account)
     * @param tokenContract Token contract address (C-account)
     * @param network Network identifier (CAIP-2 format)
     * @return CompletableFuture containing balance in atomic units
     */
    CompletableFuture<String> getBalance(String address, String tokenContract, String network);

    /**
     * Verifies signature synchronously.
     *
     * @param authorization Authorization parameters
     * @param signature Signature to verify
     * @param network Network identifier
     * @return true if signature is valid
     */
    default boolean verifySignatureSync(
            StellarAuthorization authorization, String signature, String network) {
        return verifySignature(authorization, signature, network).join();
    }

    /**
     * Sends and confirms a transaction in one call.
     *
     * @param authorization Authorization containing transfer details
     * @param signature Client's signature
     * @param network Network identifier
     * @return CompletableFuture containing transaction hash if confirmed
     */
    default CompletableFuture<String> sendAndConfirmTransaction(
            StellarAuthorization authorization, String signature, String network) {
        return sendTransaction(authorization, signature, network)
            .thenCompose(txHash ->
                confirmTransaction(txHash, network)
                    .thenApply(confirmed -> {
                        if (!confirmed) {
                            throw new StellarTransactionException(
                                "Transaction not confirmed: " + txHash);
                        }
                        return txHash;
                    })
            );
    }
}
