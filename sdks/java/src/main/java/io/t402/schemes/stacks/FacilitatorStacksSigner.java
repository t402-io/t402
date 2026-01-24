package io.t402.schemes.stacks;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Interface for facilitator-side Stacks operations.
 *
 * <p>Implementations query the Stacks blockchain (via Hiro API) to verify
 * transaction details and status.
 *
 * <h2>Example Implementation</h2>
 * <pre>{@code
 * public class MyStacksQuerier implements FacilitatorStacksSigner {
 *     private final String apiUrl;
 *     private final List<String> addresses;
 *
 *     @Override
 *     public List<String> getAddresses(String network) {
 *         return addresses;
 *     }
 *
 *     @Override
 *     public CompletableFuture<Map<String, Object>> queryTransaction(String txId) {
 *         // GET {apiUrl}/extended/v1/tx/{txId}
 *         return httpClient.getAsync(apiUrl + "/extended/v1/tx/" + txId)
 *             .thenApply(response -> parseResponse(response));
 *     }
 * }
 * }</pre>
 *
 * <p>The returned transaction map should contain:
 * <ul>
 *   <li>{@code tx_id} - The transaction ID (0x-prefixed hex)</li>
 *   <li>{@code tx_status} - Transaction status ("success", "pending", etc.)</li>
 *   <li>{@code tx_type} - Transaction type (e.g., "contract_call")</li>
 *   <li>{@code sender_address} - The sender's principal address</li>
 *   <li>{@code burn_block_time} - Unix timestamp of the burn block</li>
 *   <li>{@code contract_call} - Map with contract call details:
 *       <ul>
 *         <li>{@code contract_id} - The called contract address</li>
 *         <li>{@code function_name} - The function called (e.g., "transfer")</li>
 *         <li>{@code function_args} - List of function arguments</li>
 *       </ul>
 *   </li>
 *   <li>{@code post_conditions} - List of post-conditions (fallback for transfer verification)</li>
 * </ul>
 */
public interface FacilitatorStacksSigner {

    /**
     * Gets the facilitator's Stacks principal addresses for a given network.
     *
     * @param network CAIP-2 network identifier
     * @return List of principal addresses the facilitator controls on this network
     */
    List<String> getAddresses(String network);

    /**
     * Queries a transaction by its ID from the Stacks blockchain.
     *
     * @param txId The 0x-prefixed transaction ID to query
     * @return CompletableFuture containing transaction details map, or null if not found
     */
    CompletableFuture<Map<String, Object>> queryTransaction(String txId);

    /**
     * Queries a transaction synchronously.
     *
     * @param txId The transaction ID to query
     * @return Transaction details map, or null if not found
     */
    default Map<String, Object> queryTransactionSync(String txId) {
        return queryTransaction(txId).join();
    }
}
