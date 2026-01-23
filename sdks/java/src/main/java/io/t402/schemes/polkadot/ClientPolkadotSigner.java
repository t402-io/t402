package io.t402.schemes.polkadot;

import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Interface for client-side Polkadot signing operations.
 *
 * <p>Implementations should provide the signer's address and the ability
 * to build, sign, and submit asset transfer extrinsics to Polkadot Asset Hub.
 *
 * <h2>Example Implementation</h2>
 * <pre>{@code
 * public class MyPolkadotSigner implements ClientPolkadotSigner {
 *     private final String address;
 *     private final SubstrateClient client;
 *
 *     @Override
 *     public String getAddress() {
 *         return address; // SS58 encoded, e.g., "5GrwvaEF..."
 *     }
 *
 *     @Override
 *     public CompletableFuture<Map<String, Object>> signAndSubmit(
 *             Map<String, Object> call, String network) {
 *         // Build assets.transfer_keep_alive extrinsic
 *         // Sign with keypair
 *         // Submit to chain and wait for inclusion
 *         return CompletableFuture.completedFuture(Map.of(
 *             "extrinsicHash", "0x...",
 *             "blockHash", "0x...",
 *             "extrinsicIndex", 2
 *         ));
 *     }
 * }
 * }</pre>
 */
public interface ClientPolkadotSigner {

    /**
     * Gets the signer's SS58-encoded Polkadot address.
     *
     * @return SS58-encoded address string
     */
    String getAddress();

    /**
     * Signs and submits an asset transfer extrinsic.
     *
     * <p>The call map contains:
     * <ul>
     *   <li>{@code assetId} - int: The on-chain asset ID (e.g., 1984 for USDT)</li>
     *   <li>{@code target} - String: The SS58-encoded recipient address</li>
     *   <li>{@code amount} - String: The atomic amount to transfer</li>
     * </ul>
     *
     * @param call Map describing the assets.transfer_keep_alive call
     * @param network CAIP-2 network identifier
     * @return CompletableFuture containing result map with:
     *         <ul>
     *           <li>{@code extrinsicHash} - 0x-prefixed hash of the extrinsic</li>
     *           <li>{@code blockHash} - 0x-prefixed hash of the block</li>
     *           <li>{@code extrinsicIndex} - Index within the block</li>
     *         </ul>
     */
    CompletableFuture<Map<String, Object>> signAndSubmit(Map<String, Object> call, String network);

    /**
     * Signs and submits an asset transfer synchronously.
     *
     * @param call Map describing the transfer call
     * @param network Network identifier
     * @return Result map with extrinsicHash, blockHash, extrinsicIndex
     */
    default Map<String, Object> signAndSubmitSync(Map<String, Object> call, String network) {
        return signAndSubmit(call, network).join();
    }
}
