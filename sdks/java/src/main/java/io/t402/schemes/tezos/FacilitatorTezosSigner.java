package io.t402.schemes.tezos;

import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Interface for facilitator-side Tezos operations.
 *
 * <p>Implementations query the Tezos blockchain (via RPC or TzKT indexer)
 * to verify operation status and transfer details.
 *
 * <h2>Example Implementation</h2>
 * <pre>{@code
 * public class MyTezosQuerier implements FacilitatorTezosSigner {
 *     private final String indexerUrl;
 *
 *     @Override
 *     public CompletableFuture<Map<String, Object>> getOperation(
 *             String opHash, String network) {
 *         // Query TzKT indexer for operation details
 *         // GET {indexerUrl}/v1/operations/{opHash}
 *         return httpClient.getAsync(indexerUrl + "/v1/operations/" + opHash)
 *             .thenApply(response -> parseJson(response));
 *     }
 * }
 * }</pre>
 *
 * <p>The returned operation map should contain:
 * <ul>
 *   <li>{@code status} - "applied", "failed", "backtracked", or "skipped"</li>
 *   <li>{@code sender} - Map with "address" key containing the sender's address</li>
 *   <li>{@code target} - Map with "address" key containing the FA2 contract address</li>
 *   <li>{@code entrypoint} - String, should be "transfer" for FA2 operations</li>
 *   <li>{@code parameter} - The FA2 transfer parameters (list of transfer batches)</li>
 * </ul>
 */
public interface FacilitatorTezosSigner {

    /**
     * Queries an operation by its hash.
     *
     * @param opHash The operation hash to query (starts with 'o', 51 characters)
     * @param network CAIP-2 network identifier (e.g., "tezos:NetXdQprcVkpaWU")
     * @return CompletableFuture containing operation details map, or null if not found
     */
    CompletableFuture<Map<String, Object>> getOperation(String opHash, String network);

    /**
     * Queries an operation synchronously.
     *
     * @param opHash The operation hash to query
     * @param network Network identifier
     * @return Operation details map, or null if not found
     */
    default Map<String, Object> getOperationSync(String opHash, String network) {
        return getOperation(opHash, network).join();
    }
}
