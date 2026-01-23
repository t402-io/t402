package io.t402.schemes.polkadot;

import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Interface for facilitator-side Polkadot operations.
 *
 * <p>Implementations query the Polkadot blockchain (via Subscan indexer or RPC)
 * to verify extrinsic details and status.
 *
 * <h2>Example Implementation</h2>
 * <pre>{@code
 * public class MyPolkadotQuerier implements FacilitatorPolkadotSigner {
 *     private final String indexerUrl;
 *
 *     @Override
 *     public CompletableFuture<Map<String, Object>> getExtrinsic(
 *             String extrinsicHash, String network) {
 *         // Query Subscan API for extrinsic details
 *         // POST {indexerUrl}/api/scan/extrinsic
 *         // Body: {"hash": extrinsicHash}
 *         return httpClient.postAsync(...)
 *             .thenApply(response -> parseResponse(response));
 *     }
 * }
 * }</pre>
 *
 * <p>The returned extrinsic map should contain:
 * <ul>
 *   <li>{@code extrinsic_hash} or {@code extrinsicHash} - The extrinsic hash</li>
 *   <li>{@code block_hash} or {@code blockHash} - The block hash</li>
 *   <li>{@code block_num} or {@code blockNumber} - The block number</li>
 *   <li>{@code extrinsic_index} or {@code extrinsicIndex} - Index within block</li>
 *   <li>{@code success} - Boolean, whether the extrinsic succeeded</li>
 *   <li>{@code account_id} or {@code signer} - The signer's SS58 address</li>
 *   <li>{@code call_module} or {@code module} - The pallet name (e.g., "Assets")</li>
 *   <li>{@code call_module_function} or {@code call} - The function name (e.g., "transfer_keep_alive")</li>
 *   <li>{@code params} - List of parameter maps</li>
 * </ul>
 */
public interface FacilitatorPolkadotSigner {

    /**
     * Queries an extrinsic by its hash.
     *
     * @param extrinsicHash The 0x-prefixed hex hash of the extrinsic
     * @param network CAIP-2 network identifier
     * @return CompletableFuture containing extrinsic details map, or null if not found
     */
    CompletableFuture<Map<String, Object>> getExtrinsic(String extrinsicHash, String network);

    /**
     * Queries an extrinsic synchronously.
     *
     * @param extrinsicHash The extrinsic hash to query
     * @param network Network identifier
     * @return Extrinsic details map, or null if not found
     */
    default Map<String, Object> getExtrinsicSync(String extrinsicHash, String network) {
        return getExtrinsic(extrinsicHash, network).join();
    }
}
