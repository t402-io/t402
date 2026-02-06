package io.t402.schemes.cosmos;

import java.util.concurrent.CompletableFuture;

/**
 * Interface for client-side Cosmos signing operations.
 *
 * <p>Implementations should provide methods to:
 * <ul>
 *   <li>Get the signer's Cosmos bech32 address</li>
 *   <li>Send tokens via bank MsgSend transactions</li>
 * </ul>
 *
 * <p>In the exact-direct scheme, the client executes the transfer
 * directly on-chain and provides the transaction hash as proof.
 *
 * <h2>Example Implementation</h2>
 * <pre>{@code
 * public class MyCosmosWalletSigner implements ClientCosmosSigner {
 *     private final CosmosClient cosmosClient;
 *     private final String address;
 *
 *     @Override
 *     public String getAddress() {
 *         return address;
 *     }
 *
 *     @Override
 *     public CompletableFuture<String> sendTokens(
 *             String network, String to, String amount, String denom) {
 *         return cosmosClient.sendBankSend(to, amount, denom);
 *     }
 * }
 * }</pre>
 */
public interface ClientCosmosSigner {

    /**
     * Gets the signer's Cosmos bech32 address.
     *
     * @return Cosmos address (e.g., "noble1abc123...")
     */
    String getAddress();

    /**
     * Sends tokens via a bank MsgSend transaction.
     *
     * <p>Builds, signs, and broadcasts a bank send transaction
     * to transfer the specified amount of tokens to the recipient.
     *
     * @param network Network identifier (CAIP-2 format)
     * @param to Recipient bech32 address
     * @param amount Amount in atomic units (e.g., "1000000" for 1 USDC)
     * @param denom Token denomination (e.g., "uusdc")
     * @return CompletableFuture containing the transaction hash on success
     */
    CompletableFuture<String> sendTokens(String network, String to, String amount, String denom);

    /**
     * Sends tokens synchronously.
     *
     * @param network Network identifier (CAIP-2 format)
     * @param to Recipient bech32 address
     * @param amount Amount in atomic units
     * @param denom Token denomination
     * @return Transaction hash on success
     */
    default String sendTokensSync(String network, String to, String amount, String denom) {
        return sendTokens(network, to, amount, denom).join();
    }
}
