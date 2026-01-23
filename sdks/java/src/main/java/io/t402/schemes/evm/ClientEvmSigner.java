package io.t402.schemes.evm;

import java.util.concurrent.CompletableFuture;

/**
 * Interface for client-side EVM signing operations.
 *
 * <p>Implementations should provide methods to:
 * <ul>
 *   <li>Get the signer's Ethereum address</li>
 *   <li>Sign EIP-3009 TransferWithAuthorization messages using EIP-712</li>
 * </ul>
 *
 * <h2>Example Implementation</h2>
 * <pre>{@code
 * public class MyEvmWalletSigner implements ClientEvmSigner {
 *     private final EvmSigner cryptoSigner;
 *
 *     public MyEvmWalletSigner(String privateKey, long chainId, String tokenAddress) {
 *         this.cryptoSigner = EvmSigner.fromPrivateKey(
 *             privateKey, chainId, "TetherToken", "1", tokenAddress
 *         );
 *     }
 *
 *     @Override
 *     public String getAddress() {
 *         return cryptoSigner.getAddress();
 *     }
 *
 *     @Override
 *     public CompletableFuture<String> signPayment(EvmAuthorization auth, String network) {
 *         Map<String, Object> payload = auth.toSigningPayload();
 *         return CompletableFuture.completedFuture(cryptoSigner.sign(payload));
 *     }
 * }
 * }</pre>
 */
public interface ClientEvmSigner {

    /**
     * Gets the signer's Ethereum address.
     *
     * @return 0x-prefixed Ethereum address (checksummed or lowercase)
     */
    String getAddress();

    /**
     * Signs a payment authorization using EIP-712 typed data signing.
     *
     * <p>The implementation should sign an EIP-3009 TransferWithAuthorization
     * message with the appropriate EIP-712 domain for the given network.</p>
     *
     * @param authorization Authorization parameters to sign
     * @param network Network identifier (CAIP-2 format, e.g., "eip155:8453")
     * @return CompletableFuture containing 0x-prefixed hex-encoded signature (65 bytes)
     */
    CompletableFuture<String> signPayment(EvmAuthorization authorization, String network);

    /**
     * Signs a payment authorization synchronously.
     *
     * @param authorization Authorization parameters to sign
     * @param network Network identifier (CAIP-2 format)
     * @return 0x-prefixed hex-encoded signature
     */
    default String signPaymentSync(EvmAuthorization authorization, String network) {
        return signPayment(authorization, network).join();
    }
}
