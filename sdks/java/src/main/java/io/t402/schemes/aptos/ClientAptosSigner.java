package io.t402.schemes.aptos;

import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Interface for client-side Aptos signing and transaction submission.
 *
 * <p>Implementations should provide methods to:
 * <ul>
 *   <li>Get the signer's Aptos address</li>
 *   <li>Sign and submit Fungible Asset transfer transactions</li>
 * </ul>
 *
 * <p>In the exact-direct scheme, the client executes the transfer on-chain
 * and provides the transaction hash as proof of payment.
 *
 * <h2>Example Implementation</h2>
 * <pre>{@code
 * public class MyAptosSigner implements ClientAptosSigner {
 *     private final AptosAccount account;
 *     private final AptosClient client;
 *
 *     @Override
 *     public String getAddress() {
 *         return account.getAddress();
 *     }
 *
 *     @Override
 *     public CompletableFuture<String> signAndSubmit(Map<String, Object> txPayload, String network) {
 *         // Build, sign, and submit the transaction
 *         Transaction tx = client.buildTransaction(account, txPayload);
 *         String hash = client.submitTransaction(account.sign(tx));
 *         return CompletableFuture.completedFuture(hash);
 *     }
 * }
 * }</pre>
 */
public interface ClientAptosSigner {

    /**
     * Gets the signer's Aptos address.
     *
     * @return Aptos address (0x-prefixed hex, up to 64 hex chars)
     */
    String getAddress();

    /**
     * Signs and submits a transaction to the Aptos network.
     *
     * <p>The transaction payload contains the entry function call parameters
     * for a Fungible Asset transfer via {@code 0x1::primary_fungible_store::transfer}.
     *
     * <p>The payload map contains:
     * <ul>
     *   <li>{@code type} - "entry_function_payload"</li>
     *   <li>{@code function} - "0x1::primary_fungible_store::transfer"</li>
     *   <li>{@code type_arguments} - empty list</li>
     *   <li>{@code arguments} - [metadataAddress, recipientAddress, amount]</li>
     * </ul>
     *
     * @param txPayload Transaction payload map with function and arguments
     * @param network Network identifier (CAIP-2 format, e.g., "aptos:1")
     * @return CompletableFuture containing the transaction hash (0x-prefixed, 64 hex chars)
     */
    CompletableFuture<String> signAndSubmit(Map<String, Object> txPayload, String network);

    /**
     * Signs and submits a transaction synchronously.
     *
     * @param txPayload Transaction payload map
     * @param network Network identifier (CAIP-2 format)
     * @return Transaction hash
     */
    default String signAndSubmitSync(Map<String, Object> txPayload, String network) {
        return signAndSubmit(txPayload, network).join();
    }
}
