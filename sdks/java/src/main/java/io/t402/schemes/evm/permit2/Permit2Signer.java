package io.t402.schemes.evm.permit2;

import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Interface for client-side Permit2 EIP-712 signing operations.
 *
 * <p>Implementations should provide methods to:
 * <ul>
 *   <li>Get the signer's Ethereum address</li>
 *   <li>Sign Permit2 PermitTransferFrom messages using EIP-712</li>
 * </ul>
 *
 * <h2>Example Implementation</h2>
 * <pre>{@code
 * public class MyPermit2Signer implements Permit2Signer {
 *     private final String address;
 *     private final ECKeyPair keyPair;
 *
 *     @Override
 *     public String getAddress() { return address; }
 *
 *     @Override
 *     public CompletableFuture<String> signPermit2TypedData(
 *             Map<String, Object> domain,
 *             Map<String, Object> message,
 *             String network) {
 *         // Sign using EIP-712 with PermitTransferFrom primary type
 *         return CompletableFuture.completedFuture(signature);
 *     }
 * }
 * }</pre>
 */
public interface Permit2Signer {

    /**
     * Gets the signer's Ethereum address.
     *
     * @return 0x-prefixed Ethereum address
     */
    String getAddress();

    /**
     * Signs Permit2 EIP-712 typed data.
     *
     * <p>The domain will contain:
     * <ul>
     *   <li>{@code name} - "Permit2"</li>
     *   <li>{@code chainId} - Numeric chain ID</li>
     *   <li>{@code verifyingContract} - Permit2 contract address</li>
     * </ul>
     *
     * <p>The message will contain PermitTransferFrom fields:
     * <ul>
     *   <li>{@code permitted} - Map with token (address) and amount (BigInteger)</li>
     *   <li>{@code spender} - Transfer destination address</li>
     *   <li>{@code nonce} - BigInteger nonce</li>
     *   <li>{@code deadline} - BigInteger deadline timestamp</li>
     * </ul>
     *
     * @param domain EIP-712 domain parameters
     * @param message PermitTransferFrom message to sign
     * @param network Network identifier (CAIP-2 format, e.g., "eip155:8453")
     * @return CompletableFuture containing 0x-prefixed hex-encoded signature (65 bytes)
     */
    CompletableFuture<String> signPermit2TypedData(
            Map<String, Object> domain,
            Map<String, Object> message,
            String network);

    /**
     * Signs Permit2 EIP-712 typed data synchronously.
     *
     * @param domain EIP-712 domain parameters
     * @param message PermitTransferFrom message to sign
     * @param network Network identifier (CAIP-2 format)
     * @return 0x-prefixed hex-encoded signature
     */
    default String signPermit2TypedDataSync(
            Map<String, Object> domain,
            Map<String, Object> message,
            String network) {
        return signPermit2TypedData(domain, message, network).join();
    }
}
