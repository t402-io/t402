package io.t402.schemes.tron;

import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * Interface for facilitator-side TRON operations.
 *
 * <p>Implementations should provide methods to:
 * <ul>
 *   <li>Get facilitator wallet addresses</li>
 *   <li>Verify payment signatures</li>
 *   <li>Send TRC-20 transfer transactions</li>
 *   <li>Confirm transaction status</li>
 *   <li>Query token balances</li>
 * </ul>
 *
 * <h2>Example Implementation</h2>
 * <pre>{@code
 * public class MyTronFacilitator implements FacilitatorTronSigner {
 *     private final TronSigner signer;
 *     private final TronRpcClient rpcClient;
 *
 *     @Override
 *     public List<String> getAddresses() {
 *         return List.of(signer.getAddress());
 *     }
 *
 *     @Override
 *     public CompletableFuture<Boolean> verifySignature(
 *             TronAuthorization authorization, String signature, String network) {
 *         // Verify TRON message signature
 *         return CompletableFuture.completedFuture(
 *             TronSigner.verifyMessage(authorization.toSigningPayload(), signature)
 *         );
 *     }
 *
 *     @Override
 *     public CompletableFuture<String> sendTransaction(
 *             TronAuthorization authorization, String signature, String network) {
 *         // Build and send TRC-20 transfer
 *         return rpcClient.sendTrc20Transfer(authorization, signature, network);
 *     }
 *
 *     @Override
 *     public CompletableFuture<Boolean> confirmTransaction(String txHash, String network) {
 *         return rpcClient.getTransactionConfirmation(txHash, network);
 *     }
 *
 *     @Override
 *     public CompletableFuture<String> getBalance(String address, String token, String network) {
 *         return rpcClient.getTrc20Balance(address, token, network);
 *     }
 * }
 * }</pre>
 */
public interface FacilitatorTronSigner {

    /**
     * Gets the list of facilitator wallet addresses.
     *
     * @return List of TRON addresses in Base58Check format (starting with 'T')
     */
    List<String> getAddresses();

    /**
     * Verifies a payment authorization signature.
     *
     * @param authorization Authorization parameters that were signed
     * @param signature Hex-encoded signature to verify
     * @param network Network identifier (CAIP-2 format)
     * @return CompletableFuture containing true if signature is valid
     */
    CompletableFuture<Boolean> verifySignature(
            TronAuthorization authorization,
            String signature,
            String network);

    /**
     * Sends a TRC-20 transfer transaction.
     *
     * @param authorization Authorization with transfer parameters
     * @param signature Payment signature from the payer
     * @param network Network identifier (CAIP-2 format)
     * @return CompletableFuture containing the transaction hash
     * @throws TronTransactionException if transaction fails
     */
    CompletableFuture<String> sendTransaction(
            TronAuthorization authorization,
            String signature,
            String network);

    /**
     * Confirms that a transaction has been finalized.
     *
     * @param txHash Transaction hash to confirm
     * @param network Network identifier (CAIP-2 format)
     * @return CompletableFuture containing true if confirmed
     */
    CompletableFuture<Boolean> confirmTransaction(String txHash, String network);

    /**
     * Gets the token balance for an address.
     *
     * @param address TRON address to query
     * @param token TRC-20 token contract address
     * @param network Network identifier (CAIP-2 format)
     * @return CompletableFuture containing balance in atomic units
     */
    CompletableFuture<String> getBalance(String address, String token, String network);

    /**
     * Verifies a signature synchronously.
     *
     * @param authorization Authorization parameters
     * @param signature Signature to verify
     * @param network Network identifier
     * @return true if valid
     */
    default boolean verifySignatureSync(
            TronAuthorization authorization,
            String signature,
            String network) {
        return verifySignature(authorization, signature, network).join();
    }

    /**
     * Sends a transaction synchronously.
     *
     * @param authorization Authorization with transfer parameters
     * @param signature Payment signature
     * @param network Network identifier
     * @return Transaction hash
     */
    default String sendTransactionSync(
            TronAuthorization authorization,
            String signature,
            String network) {
        return sendTransaction(authorization, signature, network).join();
    }

    /**
     * Confirms a transaction synchronously.
     *
     * @param txHash Transaction hash
     * @param network Network identifier
     * @return true if confirmed
     */
    default boolean confirmTransactionSync(String txHash, String network) {
        return confirmTransaction(txHash, network).join();
    }

    /**
     * Gets balance synchronously.
     *
     * @param address Address to query
     * @param token Token contract address
     * @param network Network identifier
     * @return Balance in atomic units
     */
    default String getBalanceSync(String address, String token, String network) {
        return getBalance(address, token, network).join();
    }
}
