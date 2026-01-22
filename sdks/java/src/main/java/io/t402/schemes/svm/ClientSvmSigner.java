package io.t402.schemes.svm;

import java.util.concurrent.CompletableFuture;

/**
 * Interface for client-side SVM signing operations.
 * <p>
 * Implementations should provide methods to:
 * <ul>
 *   <li>Get the signer's public address</li>
 *   <li>Sign transactions</li>
 *   <li>Optionally get token balances</li>
 * </ul>
 * </p>
 *
 * <h2>Example Implementation</h2>
 * <pre>{@code
 * public class MyWalletSigner implements ClientSvmSigner {
 *     private final Keypair keypair;
 *
 *     @Override
 *     public String getAddress() {
 *         return keypair.getPublicKey().toBase58();
 *     }
 *
 *     @Override
 *     public CompletableFuture<String> signTransaction(String txBase64, String network) {
 *         // Sign the transaction
 *         return CompletableFuture.completedFuture(signedTxBase64);
 *     }
 * }
 * }</pre>
 */
public interface ClientSvmSigner {

    /**
     * Gets the signer's Solana address.
     *
     * @return Base58-encoded public key (Solana address)
     */
    String getAddress();

    /**
     * Signs a transaction.
     *
     * @param txBase64 Base64-encoded unsigned transaction
     * @param network Network identifier (CAIP-2 format)
     * @return CompletableFuture containing Base64-encoded signed transaction
     */
    CompletableFuture<String> signTransaction(String txBase64, String network);

    /**
     * Signs a transaction synchronously.
     * <p>
     * Default implementation calls the async method and blocks.
     *
     * @param txBase64 Base64-encoded unsigned transaction
     * @param network Network identifier (CAIP-2 format)
     * @return Base64-encoded signed transaction
     */
    default String signTransactionSync(String txBase64, String network) {
        return signTransaction(txBase64, network).join();
    }
}
