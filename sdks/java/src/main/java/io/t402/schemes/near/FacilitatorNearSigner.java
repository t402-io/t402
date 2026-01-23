package io.t402.schemes.near;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Interface for facilitator-side NEAR operations.
 *
 * <p>Implementations should provide methods to:
 * <ul>
 *   <li>Get facilitator account IDs for a network</li>
 *   <li>Query transactions from the NEAR RPC</li>
 * </ul>
 *
 * <p>For the exact-direct scheme, the facilitator verifies on-chain
 * transactions rather than executing them, since the client already
 * performed the transfer.
 *
 * <h2>Example Implementation</h2>
 * <pre>{@code
 * public class MyNearFacilitator implements FacilitatorNearSigner {
 *     private final NearRpcClient rpcClient;
 *
 *     @Override
 *     public List<String> getAddresses(String network) {
 *         return List.of("facilitator.near");
 *     }
 *
 *     @Override
 *     public CompletableFuture<Map<String, Object>> queryTransaction(
 *             String txHash, String senderId, String network) {
 *         return rpcClient.tx(txHash, senderId);
 *     }
 * }
 * }</pre>
 */
public interface FacilitatorNearSigner {

    /**
     * Gets the list of facilitator account IDs for a network.
     *
     * @param network Network identifier (CAIP-2 format)
     * @return List of NEAR account IDs
     */
    List<String> getAddresses(String network);

    /**
     * Queries a transaction by hash from the NEAR RPC.
     *
     * <p>The returned map should match the NEAR RPC transaction result format:
     * <pre>{@code
     * {
     *     "status": {"SuccessValue": "...", ...},
     *     "transaction": {
     *         "hash": "...",
     *         "signer_id": "...",
     *         "receiver_id": "...",
     *         "actions": [
     *             {"FunctionCall": {"method_name": "ft_transfer", "args": "...", ...}}
     *         ]
     *     }
     * }
     * }</pre>
     *
     * @param txHash The transaction hash to query
     * @param senderId The sender's account ID (needed for RPC query)
     * @param network Network identifier (CAIP-2 format)
     * @return CompletableFuture containing the transaction result map
     * @throws NearTransactionException if the transaction is not found or query fails
     */
    CompletableFuture<Map<String, Object>> queryTransaction(
            String txHash,
            String senderId,
            String network);

    /**
     * Queries a transaction synchronously.
     *
     * @param txHash The transaction hash to query
     * @param senderId The sender's account ID
     * @param network Network identifier (CAIP-2 format)
     * @return Transaction result map from the NEAR RPC
     * @throws NearTransactionException if the transaction is not found
     */
    default Map<String, Object> queryTransactionSync(
            String txHash,
            String senderId,
            String network) {
        return queryTransaction(txHash, senderId, network).join();
    }
}
