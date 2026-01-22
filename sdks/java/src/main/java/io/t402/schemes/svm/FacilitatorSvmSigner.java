package io.t402.schemes.svm;

import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * Interface for facilitator-side SVM operations.
 * <p>
 * Extends client signer with RPC capabilities for:
 * <ul>
 *   <li>Signing transactions (as fee payer)</li>
 *   <li>Simulating transactions</li>
 *   <li>Sending and confirming transactions</li>
 * </ul>
 * </p>
 *
 * <h2>Example Implementation</h2>
 * <pre>{@code
 * public class MyFacilitatorSigner implements FacilitatorSvmSigner {
 *     private final Map<String, Keypair> keypairs;
 *     private final SolanaRpcClient rpc;
 *
 *     @Override
 *     public List<String> getAddresses() {
 *         return new ArrayList<>(keypairs.keySet());
 *     }
 *
 *     @Override
 *     public CompletableFuture<String> signTransaction(String txBase64, String feePayer, String network) {
 *         Keypair kp = keypairs.get(feePayer);
 *         return CompletableFuture.completedFuture(sign(txBase64, kp));
 *     }
 *     // ... other methods
 * }
 * }</pre>
 */
public interface FacilitatorSvmSigner {

    /**
     * Gets all available fee payer addresses.
     *
     * @return List of Base58-encoded public keys
     */
    List<String> getAddresses();

    /**
     * Signs a transaction as fee payer.
     *
     * @param txBase64 Base64-encoded transaction (partially signed by client)
     * @param feePayer Fee payer address to use for signing
     * @param network Network identifier (CAIP-2 format)
     * @return CompletableFuture containing Base64-encoded fully signed transaction
     */
    CompletableFuture<String> signTransaction(String txBase64, String feePayer, String network);

    /**
     * Simulates a transaction to verify it will succeed.
     *
     * @param txBase64 Base64-encoded signed transaction
     * @param network Network identifier (CAIP-2 format)
     * @return CompletableFuture containing true if simulation succeeds
     * @throws SvmTransactionException if simulation fails
     */
    CompletableFuture<Boolean> simulateTransaction(String txBase64, String network);

    /**
     * Sends a signed transaction to the network.
     *
     * @param txBase64 Base64-encoded signed transaction
     * @param network Network identifier (CAIP-2 format)
     * @return CompletableFuture containing transaction signature (Base58)
     */
    CompletableFuture<String> sendTransaction(String txBase64, String network);

    /**
     * Waits for transaction confirmation.
     *
     * @param signature Transaction signature (Base58)
     * @param network Network identifier (CAIP-2 format)
     * @return CompletableFuture containing true if confirmed
     */
    CompletableFuture<Boolean> confirmTransaction(String signature, String network);

    /**
     * Signs a transaction synchronously.
     *
     * @param txBase64 Base64-encoded transaction
     * @param feePayer Fee payer address
     * @param network Network identifier
     * @return Base64-encoded signed transaction
     */
    default String signTransactionSync(String txBase64, String feePayer, String network) {
        return signTransaction(txBase64, feePayer, network).join();
    }

    /**
     * Sends and confirms a transaction in one call.
     *
     * @param txBase64 Base64-encoded signed transaction
     * @param network Network identifier
     * @return CompletableFuture containing transaction signature if confirmed
     */
    default CompletableFuture<String> sendAndConfirmTransaction(String txBase64, String network) {
        return sendTransaction(txBase64, network)
            .thenCompose(signature ->
                confirmTransaction(signature, network)
                    .thenApply(confirmed -> {
                        if (!confirmed) {
                            throw new SvmTransactionException("Transaction not confirmed: " + signature);
                        }
                        return signature;
                    })
            );
    }
}
