package io.t402.schemes.evm.permit2proxy;

import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * Interface for facilitator-side Permit2 Proxy operations.
 *
 * <p>Implementations should provide methods to:
 * <ul>
 *   <li>Get facilitator wallet addresses</li>
 *   <li>Call settle() on the proxy contract</li>
 *   <li>Confirm transaction status</li>
 *   <li>Query token balances</li>
 * </ul>
 */
public interface Permit2ProxyFacilitatorSigner {

    /**
     * Gets the list of facilitator wallet addresses.
     *
     * @return List of 0x-prefixed Ethereum addresses
     */
    List<String> getAddresses();

    /**
     * Calls settle() on the exact proxy contract.
     *
     * @param payload The Permit2 Proxy payload
     * @param proxyAddress The proxy contract address
     * @param network Network identifier (CAIP-2 format)
     * @return CompletableFuture containing the transaction hash
     */
    CompletableFuture<String> sendSettle(
            Permit2ProxyPayload payload,
            String proxyAddress,
            String network);

    /**
     * Calls settle() on the upto proxy contract with a specific amount.
     *
     * @param payload The Permit2 Proxy payload
     * @param amount The settlement amount (may differ from permitted amount)
     * @param proxyAddress The proxy contract address
     * @param network Network identifier (CAIP-2 format)
     * @return CompletableFuture containing the transaction hash
     */
    CompletableFuture<String> sendSettleUpto(
            Permit2ProxyPayload payload,
            String amount,
            String proxyAddress,
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

    default String sendSettleSync(Permit2ProxyPayload payload, String proxyAddress, String network) {
        return sendSettle(payload, proxyAddress, network).join();
    }

    default String sendSettleUptoSync(Permit2ProxyPayload payload, String amount, String proxyAddress, String network) {
        return sendSettleUpto(payload, amount, proxyAddress, network).join();
    }

    default boolean confirmTransactionSync(String txHash, String network) {
        return confirmTransaction(txHash, network).join();
    }

    default String getBalanceSync(String address, String token, String network) {
        return getBalance(address, token, network).join();
    }
}
