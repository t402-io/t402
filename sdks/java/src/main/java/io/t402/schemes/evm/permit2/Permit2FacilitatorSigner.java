package io.t402.schemes.evm.permit2;

import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * Interface for facilitator-side Permit2 operations.
 *
 * <p>Implementations should provide methods to:
 * <ul>
 *   <li>Get facilitator wallet addresses</li>
 *   <li>Execute permitTransferFrom on-chain</li>
 *   <li>Confirm transaction status</li>
 *   <li>Query token balances</li>
 * </ul>
 */
public interface Permit2FacilitatorSigner {

    /**
     * Gets the list of facilitator wallet addresses.
     *
     * @return List of 0x-prefixed Ethereum addresses
     */
    List<String> getAddresses();

    /**
     * Calls Permit2.permitTransferFrom on-chain.
     *
     * @param payload The Permit2 payload containing permit, transferDetails, owner, and signature
     * @param network Network identifier (CAIP-2 format)
     * @return CompletableFuture containing the transaction hash
     */
    CompletableFuture<String> sendPermitTransferFrom(
            Permit2Payload payload,
            String network);

    /**
     * Confirms that a transaction has been finalized on-chain.
     *
     * @param txHash Transaction hash to confirm
     * @param network Network identifier (CAIP-2 format)
     * @return CompletableFuture containing true if confirmed
     */
    CompletableFuture<Boolean> confirmTransaction(String txHash, String network);

    /**
     * Gets the token balance for an address.
     *
     * @param address Ethereum address to query
     * @param token ERC-20 token contract address
     * @param network Network identifier (CAIP-2 format)
     * @return CompletableFuture containing balance in atomic units
     */
    CompletableFuture<String> getBalance(String address, String token, String network);

    // Default sync methods

    default String sendPermitTransferFromSync(Permit2Payload payload, String network) {
        return sendPermitTransferFrom(payload, network).join();
    }

    default boolean confirmTransactionSync(String txHash, String network) {
        return confirmTransaction(txHash, network).join();
    }

    default String getBalanceSync(String address, String token, String network) {
        return getBalance(address, token, network).join();
    }
}
