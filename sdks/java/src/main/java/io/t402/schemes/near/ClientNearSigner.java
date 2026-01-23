package io.t402.schemes.near;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Interface for client-side NEAR signing operations.
 *
 * <p>Implementations should provide methods to:
 * <ul>
 *   <li>Get the signer's NEAR account ID</li>
 *   <li>Sign and send NEP-141 ft_transfer transactions</li>
 * </ul>
 *
 * <p>In the exact-direct scheme, the client executes the transfer
 * directly on-chain and provides the transaction hash as proof.
 *
 * <h2>Example Implementation</h2>
 * <pre>{@code
 * public class MyNearWalletSigner implements ClientNearSigner {
 *     private final NearClient nearClient;
 *     private final String accountId;
 *
 *     @Override
 *     public String getAccountId() {
 *         return accountId;
 *     }
 *
 *     @Override
 *     public CompletableFuture<String> signAndSendTransaction(
 *             String receiverId, List<Map<String, Object>> actions, String network) {
 *         // Build, sign, and broadcast the transaction
 *         return nearClient.sendTransaction(receiverId, actions);
 *     }
 * }
 * }</pre>
 */
public interface ClientNearSigner {

    /**
     * Gets the signer's NEAR account ID.
     *
     * @return NEAR account ID (e.g., "alice.near" or 64-char hex for implicit accounts)
     */
    String getAccountId();

    /**
     * Signs and sends a NEAR transaction.
     *
     * <p>The transaction should contain NEP-141 function call actions
     * (e.g., ft_transfer) directed at the token contract.
     *
     * @param receiverId The contract account receiving the function call
     * @param actions The actions to include in the transaction
     * @param network Network identifier (CAIP-2 format)
     * @return CompletableFuture containing the transaction hash on success
     * @throws NearTransactionException if the transaction fails
     */
    CompletableFuture<String> signAndSendTransaction(
            String receiverId,
            List<Map<String, Object>> actions,
            String network);

    /**
     * Signs and sends a transaction synchronously.
     *
     * @param receiverId The contract account receiving the function call
     * @param actions The actions to include in the transaction
     * @param network Network identifier (CAIP-2 format)
     * @return Transaction hash on success
     * @throws NearTransactionException if the transaction fails
     */
    default String signAndSendTransactionSync(
            String receiverId,
            List<Map<String, Object>> actions,
            String network) {
        return signAndSendTransaction(receiverId, actions, network).join();
    }
}
