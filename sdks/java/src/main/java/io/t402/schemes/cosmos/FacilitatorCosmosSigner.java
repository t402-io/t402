package io.t402.schemes.cosmos;

import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * Interface for facilitator-side Cosmos operations.
 *
 * <p>Implementations should provide methods to:
 * <ul>
 *   <li>Get facilitator addresses for a network</li>
 *   <li>Query transactions from the Cosmos REST API</li>
 *   <li>Query token balances</li>
 * </ul>
 *
 * <p>For the exact-direct scheme, the facilitator verifies on-chain
 * transactions rather than executing them, since the client already
 * performed the transfer.
 *
 * <h2>Example Implementation</h2>
 * <pre>{@code
 * public class MyCosmosRpcFacilitator implements FacilitatorCosmosSigner {
 *     private final CosmosRestClient restClient;
 *
 *     @Override
 *     public List<String> getAddresses(String network) {
 *         return List.of("noble1facilitator...");
 *     }
 *
 *     @Override
 *     public CompletableFuture<CosmosTransactionResult> queryTransaction(
 *             String network, String txHash) {
 *         return restClient.getTx(network, txHash);
 *     }
 *
 *     @Override
 *     public CompletableFuture<String> getBalance(
 *             String network, String address, String denom) {
 *         return restClient.getBalance(network, address, denom);
 *     }
 * }
 * }</pre>
 */
public interface FacilitatorCosmosSigner {

    /**
     * Gets the list of facilitator addresses for a network.
     *
     * @param network Network identifier (CAIP-2 format)
     * @return List of bech32 addresses
     */
    List<String> getAddresses(String network);

    /**
     * Queries a transaction by hash from the Cosmos REST API.
     *
     * @param network Network identifier (CAIP-2 format)
     * @param txHash The transaction hash to query
     * @return CompletableFuture containing the transaction result
     */
    CompletableFuture<CosmosTransactionResult> queryTransaction(String network, String txHash);

    /**
     * Queries a transaction synchronously.
     *
     * @param network Network identifier (CAIP-2 format)
     * @param txHash The transaction hash to query
     * @return Transaction result
     */
    default CosmosTransactionResult queryTransactionSync(String network, String txHash) {
        return queryTransaction(network, txHash).join();
    }

    /**
     * Gets the token balance for an account.
     *
     * @param network Network identifier (CAIP-2 format)
     * @param address Bech32 address to query
     * @param denom Token denomination (e.g., "uusdc")
     * @return CompletableFuture containing the balance string in atomic units
     */
    CompletableFuture<String> getBalance(String network, String address, String denom);

    /**
     * Gets the token balance synchronously.
     *
     * @param network Network identifier (CAIP-2 format)
     * @param address Bech32 address to query
     * @param denom Token denomination
     * @return Balance string in atomic units
     */
    default String getBalanceSync(String network, String address, String denom) {
        return getBalance(network, address, denom).join();
    }
}
