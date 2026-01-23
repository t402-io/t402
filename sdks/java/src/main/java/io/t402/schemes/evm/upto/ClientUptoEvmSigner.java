package io.t402.schemes.evm.upto;

import java.util.concurrent.CompletableFuture;

/**
 * Interface for client-side EVM signing operations for the Up-To (EIP-2612 Permit) scheme.
 *
 * <p>Implementations should provide methods to:
 * <ul>
 *   <li>Get the signer's Ethereum address</li>
 *   <li>Query the current permit nonce from the token contract</li>
 *   <li>Sign EIP-2612 Permit messages using EIP-712 typed data signing</li>
 * </ul>
 *
 * <h2>Example Implementation</h2>
 * <pre>{@code
 * public class MyUptoEvmWalletSigner implements ClientUptoEvmSigner {
 *     private final String address;
 *     private final Web3j web3;
 *
 *     @Override
 *     public String getAddress() {
 *         return address;
 *     }
 *
 *     @Override
 *     public CompletableFuture<Integer> getNonce(String tokenAddress, String network) {
 *         // Query token.nonces(owner) from the contract
 *         return queryTokenNonce(tokenAddress, address);
 *     }
 *
 *     @Override
 *     public CompletableFuture<PermitSignature> signPermit(
 *             PermitAuthorization authorization, String network) {
 *         // Build EIP-712 typed data and sign
 *         Map<String, Object> domain = UptoEvmTypes.createPermitDomain(...);
 *         Map<String, Object> message = UptoEvmTypes.createPermitMessage(authorization);
 *         byte[] sig = signTypedData(domain, message);
 *         return CompletableFuture.completedFuture(splitSignature(sig));
 *     }
 * }
 * }</pre>
 */
public interface ClientUptoEvmSigner {

    /**
     * Gets the signer's Ethereum address.
     *
     * @return 0x-prefixed Ethereum address (checksummed or lowercase)
     */
    String getAddress();

    /**
     * Gets the current permit nonce for the signer from the token contract.
     *
     * <p>The nonce is a monotonically increasing counter maintained by the token
     * contract (EIP-2612). Each successful permit call increments this value.</p>
     *
     * @param tokenAddress ERC-20 token contract address
     * @param network Network identifier (CAIP-2 format, e.g., "eip155:8453")
     * @return CompletableFuture containing the current nonce value
     */
    CompletableFuture<Integer> getNonce(String tokenAddress, String network);

    /**
     * Signs a permit authorization using EIP-712 typed data signing.
     *
     * <p>The implementation should sign an EIP-2612 Permit message with the
     * appropriate EIP-712 domain for the given network and token.</p>
     *
     * @param authorization Permit authorization parameters to sign
     * @param network Network identifier (CAIP-2 format, e.g., "eip155:8453")
     * @return CompletableFuture containing the split signature (v, r, s)
     */
    CompletableFuture<PermitSignature> signPermit(PermitAuthorization authorization, String network);

    /**
     * Gets the current permit nonce synchronously.
     *
     * @param tokenAddress ERC-20 token contract address
     * @param network Network identifier (CAIP-2 format)
     * @return Current nonce value
     */
    default int getNonceSync(String tokenAddress, String network) {
        return getNonce(tokenAddress, network).join();
    }

    /**
     * Signs a permit authorization synchronously.
     *
     * @param authorization Permit authorization parameters to sign
     * @param network Network identifier (CAIP-2 format)
     * @return Split signature (v, r, s)
     */
    default PermitSignature signPermitSync(PermitAuthorization authorization, String network) {
        return signPermit(authorization, network).join();
    }
}
