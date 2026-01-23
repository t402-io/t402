package io.t402.schemes.aptos;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Interface for facilitator-side Aptos operations.
 *
 * <p>Implementations should provide methods to:
 * <ul>
 *   <li>Get facilitator addresses (may be empty for exact-direct)</li>
 *   <li>Query transactions from the Aptos network</li>
 * </ul>
 *
 * <p>In the exact-direct scheme, the facilitator verifies transactions
 * that the client has already submitted on-chain. The facilitator does not
 * hold funds or execute transfers.
 *
 * <h2>Example Implementation</h2>
 * <pre>{@code
 * public class MyAptosQuerier implements FacilitatorAptosSigner {
 *     private final HttpClient httpClient;
 *     private final String rpcUrl;
 *
 *     @Override
 *     public List<String> getAddresses(String network) {
 *         return List.of(); // No on-chain addresses needed for exact-direct
 *     }
 *
 *     @Override
 *     public CompletableFuture<Map<String, Object>> getTransaction(String txHash, String network) {
 *         return httpClient.getAsync(rpcUrl + "/transactions/by_hash/" + txHash)
 *             .thenApply(response -> parseJson(response));
 *     }
 * }
 * }</pre>
 */
public interface FacilitatorAptosSigner {

    /**
     * Gets the list of facilitator addresses for a network.
     *
     * <p>For exact-direct, the facilitator typically does not hold funds
     * and may return an empty list.
     *
     * @param network Network identifier (CAIP-2 format)
     * @return List of Aptos addresses (may be empty)
     */
    List<String> getAddresses(String network);

    /**
     * Queries a transaction by hash from the Aptos network.
     *
     * <p>The returned map should contain fields from the Aptos REST API:
     * <ul>
     *   <li>{@code hash} - Transaction hash</li>
     *   <li>{@code version} - Ledger version</li>
     *   <li>{@code success} - Whether the transaction succeeded (Boolean)</li>
     *   <li>{@code vm_status} - VM execution status</li>
     *   <li>{@code sender} - Transaction sender address</li>
     *   <li>{@code timestamp} - Block timestamp in microseconds (String)</li>
     *   <li>{@code payload} - Transaction payload map containing:
     *     <ul>
     *       <li>{@code type} - "entry_function_payload"</li>
     *       <li>{@code function} - The Move function called</li>
     *       <li>{@code arguments} - Function arguments list</li>
     *     </ul>
     *   </li>
     * </ul>
     *
     * @param txHash Transaction hash to query (0x-prefixed)
     * @param network Network identifier (CAIP-2 format)
     * @return CompletableFuture containing the transaction result map
     * @throws AptosTransactionException if the transaction is not found or query fails
     */
    CompletableFuture<Map<String, Object>> getTransaction(String txHash, String network);

    /**
     * Queries a transaction synchronously.
     *
     * @param txHash Transaction hash to query
     * @param network Network identifier
     * @return Transaction result map
     */
    default Map<String, Object> getTransactionSync(String txHash, String network) {
        return getTransaction(txHash, network).join();
    }
}
