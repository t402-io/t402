package io.t402.schemes.evm.upto;

import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * Interface for facilitator-side EVM operations for the Up-To (EIP-2612 Permit) scheme.
 *
 * <p>Implementations should provide methods to:
 * <ul>
 *   <li>Get facilitator wallet addresses</li>
 *   <li>Recover signer from EIP-712 Permit signature</li>
 *   <li>Execute permit() + transferFrom() on-chain for settlement</li>
 *   <li>Confirm transaction status</li>
 *   <li>Query token balances and allowances</li>
 * </ul>
 *
 * <h2>Example Implementation</h2>
 * <pre>{@code
 * public class MyUptoEvmFacilitator implements FacilitatorUptoEvmSigner {
 *     private final Web3j web3;
 *     private final Credentials credentials;
 *
 *     @Override
 *     public List<String> getAddresses() {
 *         return List.of(credentials.getAddress());
 *     }
 *
 *     @Override
 *     public CompletableFuture<String> recoverPermitSigner(
 *             PermitAuthorization authorization, PermitSignature signature, String network) {
 *         // Recover address from EIP-712 Permit signature
 *         return CompletableFuture.completedFuture(recoveredAddress);
 *     }
 *
 *     @Override
 *     public CompletableFuture<String> sendPermitAndTransferFrom(
 *             PermitAuthorization authorization, PermitSignature signature,
 *             String payTo, String settleAmount, String network) {
 *         // 1. Call token.permit(owner, spender, value, deadline, v, r, s)
 *         // 2. Call token.transferFrom(owner, payTo, settleAmount)
 *         return CompletableFuture.completedFuture(txHash);
 *     }
 *
 *     @Override
 *     public CompletableFuture<Boolean> confirmTransaction(String txHash, String network) {
 *         return CompletableFuture.completedFuture(true);
 *     }
 * }
 * }</pre>
 */
public interface FacilitatorUptoEvmSigner {

    /**
     * Gets the list of facilitator wallet addresses.
     *
     * <p>These addresses are used as the "spender" in permit authorizations.</p>
     *
     * @return List of 0x-prefixed Ethereum addresses
     */
    List<String> getAddresses();

    /**
     * Recovers the signer address from an EIP-712 Permit signature.
     *
     * <p>This verifies the permit signature by recovering the signing address
     * from the EIP-712 typed data hash and the split signature components.</p>
     *
     * @param authorization Permit authorization parameters that were signed
     * @param signature Split signature components (v, r, s)
     * @param network Network identifier (CAIP-2 format)
     * @return CompletableFuture containing the recovered 0x-prefixed address
     */
    CompletableFuture<String> recoverPermitSigner(
            PermitAuthorization authorization,
            PermitSignature signature,
            String network);

    /**
     * Executes permit() followed by transferFrom() on-chain.
     *
     * <p>This is the two-step settlement process for the Up-To scheme:
     * <ol>
     *   <li>Calls {@code token.permit(owner, spender, value, deadline, v, r, s)}
     *       to approve the facilitator to spend tokens</li>
     *   <li>Calls {@code token.transferFrom(owner, payTo, settleAmount)}
     *       to transfer the actual settlement amount (which may be less than
     *       the permitted value)</li>
     * </ol>
     *
     * @param authorization Permit authorization parameters
     * @param signature Permit signature (v, r, s)
     * @param payTo Recipient address for the transfer
     * @param settleAmount Amount to actually transfer (must be &lt;= authorization.value)
     * @param network Network identifier (CAIP-2 format)
     * @return CompletableFuture containing the transaction hash
     */
    CompletableFuture<String> sendPermitAndTransferFrom(
            PermitAuthorization authorization,
            PermitSignature signature,
            String payTo,
            String settleAmount,
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
     * Gets the current token allowance for the facilitator (spender) from a given owner.
     *
     * @param owner Token owner address
     * @param token ERC-20 token contract address
     * @param network Network identifier (CAIP-2 format)
     * @return CompletableFuture containing current allowance in atomic units
     */
    CompletableFuture<String> getAllowance(String owner, String token, String network);

    /**
     * Recovers permit signer synchronously.
     *
     * @param authorization Permit authorization parameters
     * @param signature Permit signature to verify
     * @param network Network identifier
     * @return Recovered signer address
     */
    default String recoverPermitSignerSync(
            PermitAuthorization authorization,
            PermitSignature signature,
            String network) {
        return recoverPermitSigner(authorization, signature, network).join();
    }

    /**
     * Sends permit and transferFrom synchronously.
     *
     * @param authorization Permit authorization parameters
     * @param signature Permit signature
     * @param payTo Recipient address
     * @param settleAmount Amount to transfer
     * @param network Network identifier
     * @return Transaction hash
     */
    default String sendPermitAndTransferFromSync(
            PermitAuthorization authorization,
            PermitSignature signature,
            String payTo,
            String settleAmount,
            String network) {
        return sendPermitAndTransferFrom(authorization, signature, payTo, settleAmount, network).join();
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

    /**
     * Gets allowance synchronously.
     *
     * @param owner Token owner address
     * @param token Token contract address
     * @param network Network identifier
     * @return Current allowance in atomic units
     */
    default String getAllowanceSync(String owner, String token, String network) {
        return getAllowance(owner, token, network).join();
    }
}
