package io.t402.schemes.evm;

import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * Interface for facilitator-side EVM operations.
 *
 * <p>Implementations should provide methods to:
 * <ul>
 *   <li>Get facilitator wallet addresses</li>
 *   <li>Recover signer from EIP-712 signature</li>
 *   <li>Execute transferWithAuthorization on-chain</li>
 *   <li>Confirm transaction status</li>
 *   <li>Query token balances</li>
 * </ul>
 *
 * <h2>Example Implementation</h2>
 * <pre>{@code
 * public class MyEvmFacilitator implements FacilitatorEvmSigner {
 *     private final Web3j web3;
 *     private final Credentials credentials;
 *
 *     @Override
 *     public List<String> getAddresses() {
 *         return List.of(credentials.getAddress());
 *     }
 *
 *     @Override
 *     public CompletableFuture<String> recoverSigner(
 *             EvmAuthorization authorization, String signature, String network) {
 *         // Recover address from EIP-712 signature
 *         return CompletableFuture.completedFuture(recoveredAddress);
 *     }
 *
 *     @Override
 *     public CompletableFuture<String> sendTransferWithAuthorization(
 *             EvmAuthorization authorization, String signature, String network) {
 *         // Call transferWithAuthorization on the token contract
 *         return CompletableFuture.completedFuture(txHash);
 *     }
 *
 *     @Override
 *     public CompletableFuture<Boolean> confirmTransaction(String txHash, String network) {
 *         return CompletableFuture.completedFuture(true);
 *     }
 *
 *     @Override
 *     public CompletableFuture<String> getBalance(String address, String token, String network) {
 *         return CompletableFuture.completedFuture("1000000");
 *     }
 * }
 * }</pre>
 */
public interface FacilitatorEvmSigner {

    /**
     * Gets the list of facilitator wallet addresses.
     *
     * @return List of 0x-prefixed Ethereum addresses
     */
    List<String> getAddresses();

    /**
     * Recovers the signer address from an EIP-712 signature.
     *
     * <p>This verifies the signature by recovering the signing address
     * from the EIP-712 typed data hash and the signature.</p>
     *
     * @param authorization Authorization parameters that were signed
     * @param signature 0x-prefixed hex-encoded signature (65 bytes)
     * @param network Network identifier (CAIP-2 format)
     * @return CompletableFuture containing the recovered 0x-prefixed address
     */
    CompletableFuture<String> recoverSigner(
            EvmAuthorization authorization,
            String signature,
            String network);

    /**
     * Executes a transferWithAuthorization transaction on-chain.
     *
     * <p>Calls the EIP-3009 {@code transferWithAuthorization} function on the
     * token contract with the provided authorization and signature.</p>
     *
     * @param authorization Authorization with transfer parameters
     * @param signature Payment signature from the payer
     * @param network Network identifier (CAIP-2 format)
     * @return CompletableFuture containing the transaction hash
     */
    CompletableFuture<String> sendTransferWithAuthorization(
            EvmAuthorization authorization,
            String signature,
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

    /**
     * Recovers signer synchronously.
     *
     * @param authorization Authorization parameters
     * @param signature Signature to verify
     * @param network Network identifier
     * @return Recovered signer address
     */
    default String recoverSignerSync(
            EvmAuthorization authorization,
            String signature,
            String network) {
        return recoverSigner(authorization, signature, network).join();
    }

    /**
     * Sends a transferWithAuthorization transaction synchronously.
     *
     * @param authorization Authorization with transfer parameters
     * @param signature Payment signature
     * @param network Network identifier
     * @return Transaction hash
     */
    default String sendTransferWithAuthorizationSync(
            EvmAuthorization authorization,
            String signature,
            String network) {
        return sendTransferWithAuthorization(authorization, signature, network).join();
    }

    /**
     * Confirms a transaction synchronously.
     *
     * @param txHash Transaction hash
     * @param network Network identifier
     * @return true if confirmed
     */
    default boolean confirmTransactionSync(String txHash, String network) {
        return confirmTransaction(txHash, network).join();
    }

    /**
     * Gets balance synchronously.
     *
     * @param address Address to query
     * @param token Token contract address
     * @param network Network identifier
     * @return Balance in atomic units
     */
    default String getBalanceSync(String address, String token, String network) {
        return getBalance(address, token, network).join();
    }
}
