package io.t402.schemes.evm.exact_legacy;

import java.util.concurrent.CompletableFuture;

/**
 * Interface for client-side EVM signing operations for legacy tokens.
 *
 * <p>Implementations should provide methods to:
 * <ul>
 *   <li>Get the signer's Ethereum address</li>
 *   <li>Sign LegacyTransferAuthorization messages using EIP-712</li>
 * </ul>
 *
 * <h2>Example Implementation</h2>
 * <pre>{@code
 * public class MyLegacyEvmWalletSigner implements ClientLegacyEvmSigner {
 *     private final EvmSigner cryptoSigner;
 *
 *     @Override
 *     public String getAddress() {
 *         return cryptoSigner.getAddress();
 *     }
 *
 *     @Override
 *     public CompletableFuture<String> signLegacyPayment(
 *             LegacyEvmAuthorization auth, String network) {
 *         Map<String, Object> payload = auth.toSigningPayload();
 *         return CompletableFuture.completedFuture(cryptoSigner.sign(payload));
 *     }
 * }
 * }</pre>
 */
public interface ClientLegacyEvmSigner {

    /**
     * Gets the signer's Ethereum address.
     *
     * @return 0x-prefixed Ethereum address (checksummed or lowercase)
     */
    String getAddress();

    /**
     * Signs a legacy payment authorization using EIP-712 typed data signing.
     *
     * <p>The implementation should sign a LegacyTransferAuthorization
     * message with the appropriate EIP-712 domain for the given network.</p>
     *
     * @param authorization Legacy authorization parameters to sign (includes spender)
     * @param network Network identifier (CAIP-2 format, e.g., "eip155:1")
     * @return CompletableFuture containing 0x-prefixed hex-encoded signature (65 bytes)
     */
    CompletableFuture<String> signLegacyPayment(LegacyEvmAuthorization authorization, String network);

    /**
     * Signs a legacy payment authorization synchronously.
     *
     * @param authorization Legacy authorization parameters to sign
     * @param network Network identifier (CAIP-2 format)
     * @return 0x-prefixed hex-encoded signature
     */
    default String signLegacyPaymentSync(LegacyEvmAuthorization authorization, String network) {
        return signLegacyPayment(authorization, network).join();
    }
}
