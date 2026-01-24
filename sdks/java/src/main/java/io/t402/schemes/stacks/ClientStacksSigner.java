package io.t402.schemes.stacks;

import java.math.BigInteger;
import java.util.concurrent.CompletableFuture;

/**
 * Interface for client-side Stacks signing operations.
 *
 * <p>Implementations should provide the signer's address and the ability
 * to execute SIP-010 token transfers on the Stacks blockchain.
 *
 * <h2>Example Implementation</h2>
 * <pre>{@code
 * public class MyStacksSigner implements ClientStacksSigner {
 *     private final String address;
 *     private final StacksClient client;
 *
 *     @Override
 *     public String getAddress() {
 *         return address; // e.g., "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K"
 *     }
 *
 *     @Override
 *     public CompletableFuture<String> transferToken(
 *             String contractAddress, String to, BigInteger amount) {
 *         // Build SIP-010 transfer transaction
 *         // Sign with private key
 *         // Broadcast to Stacks network
 *         // Wait for confirmation
 *         return CompletableFuture.completedFuture("0x...");
 *     }
 * }
 * }</pre>
 */
public interface ClientStacksSigner {

    /**
     * Gets the signer's Stacks principal address.
     *
     * @return Stacks principal address (e.g., "SP..." for mainnet, "ST..." for testnet)
     */
    String getAddress();

    /**
     * Executes a SIP-010 token transfer on the Stacks blockchain.
     *
     * <p>This method should:
     * <ol>
     *   <li>Build a contract-call transaction for the SIP-010 transfer function</li>
     *   <li>Sign the transaction with the signer's private key</li>
     *   <li>Broadcast the signed transaction</li>
     *   <li>Wait for on-chain confirmation</li>
     * </ol>
     *
     * @param contractAddress The SIP-010 token contract address (e.g., "SP...token-susdc")
     * @param to The recipient's Stacks principal address
     * @param amount The amount to transfer in atomic units
     * @return CompletableFuture containing the 0x-prefixed transaction ID
     */
    CompletableFuture<String> transferToken(String contractAddress, String to, BigInteger amount);

    /**
     * Executes a SIP-010 token transfer synchronously.
     *
     * @param contractAddress The SIP-010 token contract address
     * @param to The recipient's Stacks principal address
     * @param amount The amount to transfer in atomic units
     * @return The 0x-prefixed transaction ID
     */
    default String transferTokenSync(String contractAddress, String to, BigInteger amount) {
        return transferToken(contractAddress, to, amount).join();
    }
}
