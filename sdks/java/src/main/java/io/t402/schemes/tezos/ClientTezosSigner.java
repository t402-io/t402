package io.t402.schemes.tezos;

import java.util.concurrent.CompletableFuture;

/**
 * Interface for client-side Tezos signing operations.
 *
 * <p>Implementations are responsible for managing private keys, constructing
 * FA2 transfer operations, signing, and injecting them into the Tezos network.
 *
 * <h2>Example Implementation</h2>
 * <pre>{@code
 * public class MyTezosSigner implements ClientTezosSigner {
 *     private final String address;
 *     private final TezosClient client;
 *
 *     @Override
 *     public String getAddress() {
 *         return address; // e.g., "tz1..."
 *     }
 *
 *     @Override
 *     public CompletableFuture<String> transferFA2(
 *             String contract, int tokenId, String to, String amount, String network) {
 *         // Build FA2 transfer operation, sign and inject
 *         return CompletableFuture.completedFuture("o...");  // operation hash
 *     }
 * }
 * }</pre>
 */
public interface ClientTezosSigner {

    /**
     * Gets the signer's Tezos address.
     *
     * @return Tezos address (tz1/tz2/tz3 format)
     */
    String getAddress();

    /**
     * Executes an FA2 transfer operation on-chain.
     *
     * <p>Constructs the FA2 transfer call parameter, signs the operation,
     * and injects it into the Tezos network.
     *
     * @param contract The FA2 contract address (KT1...)
     * @param tokenId The token ID within the FA2 contract
     * @param to Recipient Tezos address
     * @param amount Amount in atomic units (as string)
     * @param network CAIP-2 network identifier
     * @return CompletableFuture containing the operation hash (starts with 'o', 51 characters)
     */
    CompletableFuture<String> transferFA2(
        String contract,
        int tokenId,
        String to,
        String amount,
        String network
    );

    /**
     * Executes an FA2 transfer synchronously.
     *
     * @param contract The FA2 contract address
     * @param tokenId The token ID
     * @param to Recipient address
     * @param amount Amount in atomic units
     * @param network Network identifier
     * @return The operation hash
     */
    default String transferFA2Sync(
            String contract, int tokenId, String to, String amount, String network) {
        return transferFA2(contract, tokenId, to, amount, network).join();
    }
}
