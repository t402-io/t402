package io.t402.schemes.evm.exact_legacy;

import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * Interface for facilitator-side EVM operations for legacy tokens.
 *
 * <p>Implementations should provide methods to:
 * <ul>
 *   <li>Get facilitator wallet addresses (spender addresses)</li>
 *   <li>Recover signer from EIP-712 LegacyTransferAuthorization signature</li>
 *   <li>Execute transferFrom on-chain</li>
 *   <li>Confirm transaction status</li>
 *   <li>Query token balances and allowances</li>
 * </ul>
 *
 * <h2>Example Implementation</h2>
 * <pre>{@code
 * public class MyLegacyFacilitator implements FacilitatorLegacyEvmSigner {
 *     @Override
 *     public List<String> getAddresses() {
 *         return List.of(credentials.getAddress());
 *     }
 *
 *     @Override
 *     public CompletableFuture<String> recoverLegacySigner(
 *             LegacyEvmAuthorization auth, String signature, String network) {
 *         // Recover address from EIP-712 signature of LegacyTransferAuthorization
 *         return CompletableFuture.completedFuture(recoveredAddress);
 *     }
 *
 *     @Override
 *     public CompletableFuture<String> sendTransferFrom(
 *             LegacyEvmAuthorization auth, String network) {
 *         // Call transferFrom on the token contract
 *         return CompletableFuture.completedFuture(txHash);
 *     }
 * }
 * }</pre>
 */
public interface FacilitatorLegacyEvmSigner {

    /**
     * Gets the list of facilitator wallet addresses (spender addresses).
     *
     * @return List of 0x-prefixed Ethereum addresses
     */
    List<String> getAddresses();

    /**
     * Recovers the signer address from an EIP-712 LegacyTransferAuthorization signature.
     *
     * @param authorization Legacy authorization parameters that were signed
     * @param signature 0x-prefixed hex-encoded signature (65 bytes)
     * @param network Network identifier (CAIP-2 format)
     * @return CompletableFuture containing the recovered 0x-prefixed address
     */
    CompletableFuture<String> recoverLegacySigner(
            LegacyEvmAuthorization authorization,
            String signature,
            String network);

    /**
     * Executes a transferFrom transaction on-chain.
     *
     * <p>Calls the ERC-20 {@code transferFrom} function on the token contract
     * to transfer tokens from the payer to the recipient.</p>
     *
     * @param authorization Legacy authorization with transfer parameters
     * @param network Network identifier (CAIP-2 format)
     * @return CompletableFuture containing the transaction hash
     */
    CompletableFuture<String> sendTransferFrom(
            LegacyEvmAuthorization authorization,
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
     * @return CompletableFuture containing balance in atomic units as string
     */
    CompletableFuture<String> getBalance(String address, String token, String network);

    /**
     * Gets the token allowance for spender on owner's tokens.
     *
     * @param owner Token owner address
     * @param spender Approved spender address
     * @param token ERC-20 token contract address
     * @param network Network identifier (CAIP-2 format)
     * @return CompletableFuture containing allowance in atomic units as string
     */
    CompletableFuture<String> getAllowance(String owner, String spender, String token, String network);
}
