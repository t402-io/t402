package io.t402.schemes.btc;

/**
 * Interface for client-side Bitcoin on-chain signing operations.
 *
 * <p>Implementations handle PSBT (Partially Signed Bitcoin Transaction) signing
 * for on-chain payments.
 *
 * <h2>Example Implementation</h2>
 * <pre>{@code
 * public class MyBtcWalletSigner implements ClientBtcSigner {
 *     private final BitcoinWallet wallet;
 *
 *     @Override
 *     public String signPsbt(String unsignedPsbt) {
 *         return wallet.signPsbt(Base64.getDecoder().decode(unsignedPsbt));
 *     }
 *
 *     @Override
 *     public String getAddress() { return wallet.getAddress(); }
 *
 *     @Override
 *     public String getPublicKey() { return wallet.getPublicKeyHex(); }
 * }
 * }</pre>
 */
public interface ClientBtcSigner {

    /**
     * Signs a PSBT and returns the base64-encoded signed PSBT.
     *
     * @param unsignedPsbt Base64-encoded unsigned PSBT
     * @return Base64-encoded signed PSBT
     * @throws Exception if signing fails
     */
    String signPsbt(String unsignedPsbt) throws Exception;

    /**
     * Gets the signer's Bitcoin address.
     *
     * @return Bitcoin address
     */
    String getAddress();

    /**
     * Gets the signer's public key as a hex string.
     *
     * @return Hex-encoded public key
     */
    String getPublicKey();
}
