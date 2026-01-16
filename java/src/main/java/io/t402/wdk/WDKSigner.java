package io.t402.wdk;

import io.t402.crypto.CryptoSignException;
import io.t402.crypto.CryptoSigner;
import io.t402.crypto.EvmSigner;
import io.t402.wdk.WDKException.WDKErrorCode;
import io.t402.wdk.WDKTypes.*;

import org.web3j.crypto.Bip32ECKeyPair;
import org.web3j.crypto.Credentials;
import org.web3j.crypto.MnemonicUtils;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HashMap;
import java.util.Map;

/**
 * WDK Signer for T402 payments.
 *
 * <p>Provides wallet functionality using BIP-39 seed phrase derivation
 * compatible with Tether WDK.
 *
 * <p>Example usage:
 * <pre>{@code
 * Map<String, String> rpcUrls = Map.of(
 *     "arbitrum", "https://arb1.arbitrum.io/rpc",
 *     "base", "https://mainnet.base.org"
 * );
 *
 * WDKSigner signer = new WDKSigner(seedPhrase, new WDKConfig(rpcUrls));
 *
 * // Get address
 * String address = signer.getAddress();
 *
 * // Get signer for specific chain
 * CryptoSigner chainSigner = signer.getChainSigner("arbitrum", "USDT0");
 *
 * // Sign payment
 * PaymentResult result = signer.signPayment("arbitrum", new PaymentParams(
 *     recipientAddress,
 *     BigInteger.valueOf(1000000), // 1 USDT0
 *     "USDT0",
 *     nonce
 * ));
 * }</pre>
 */
public class WDKSigner {

    /** BIP-44 purpose. */
    private static final int BIP44_PURPOSE = 0x8000002C;

    /** Ethereum coin type. */
    private static final int BIP44_COIN_TYPE = 0x8000003C;

    private final byte[] seed;
    private final WDKConfig config;
    private final Credentials credentials;
    private final Map<String, EvmSigner> chainSigners = new HashMap<>();

    /**
     * Creates a new WDK signer from seed phrase.
     *
     * @param seedPhrase BIP-39 mnemonic seed phrase
     * @param config WDK configuration
     * @throws WDKException if seed phrase is invalid
     */
    public WDKSigner(String seedPhrase, WDKConfig config) throws WDKException {
        if (seedPhrase == null || seedPhrase.trim().isEmpty()) {
            throw new WDKException(WDKErrorCode.INVALID_SEED_PHRASE, "Seed phrase is required");
        }

        if (!validateSeedPhrase(seedPhrase)) {
            throw new WDKException(WDKErrorCode.INVALID_SEED_PHRASE, "Invalid seed phrase");
        }

        this.config = config;
        this.seed = MnemonicUtils.generateSeed(seedPhrase, "");

        // Derive HD wallet key
        Bip32ECKeyPair masterKeypair = Bip32ECKeyPair.generateKeyPair(seed);
        int[] derivationPath = new int[] {
            BIP44_PURPOSE,
            BIP44_COIN_TYPE,
            0x80000000 | config.getAccountIndex(),
            0,
            0
        };

        Bip32ECKeyPair derivedKeyPair = Bip32ECKeyPair.deriveKeyPair(masterKeypair, derivationPath);
        this.credentials = Credentials.create(derivedKeyPair);
    }

    /**
     * Get the wallet address.
     *
     * @return 0x-prefixed Ethereum address
     */
    public String getAddress() {
        return credentials.getAddress();
    }

    /**
     * Get the network identifier for a chain.
     *
     * @param chain Chain name
     * @return CAIP-2 network identifier
     */
    public String getNetwork(String chain) {
        return WDKChains.getNetworkFromChain(chain);
    }

    /**
     * Get a chain-specific signer.
     *
     * @param chain Chain name
     * @param tokenSymbol Token symbol (USDT0, USDC)
     * @return CryptoSigner for the chain
     * @throws WDKException if chain is not configured
     */
    public CryptoSigner getChainSigner(String chain, String tokenSymbol) throws WDKException {
        String cacheKey = chain + ":" + tokenSymbol;

        if (chainSigners.containsKey(cacheKey)) {
            return chainSigners.get(cacheKey);
        }

        Long chainId = WDKChains.getChainId(chain);
        if (chainId == null) {
            throw new WDKException(WDKErrorCode.CHAIN_NOT_CONFIGURED,
                "Unknown chain: " + chain);
        }

        String tokenAddress = WDKChains.getTokenAddress(chain, tokenSymbol);
        if (tokenAddress == null) {
            throw new WDKException(WDKErrorCode.CHAIN_NOT_CONFIGURED,
                "Token " + tokenSymbol + " not supported on " + chain);
        }

        // Get token metadata (use defaults for known tokens)
        String tokenName = getTokenName(tokenSymbol);
        String tokenVersion = "2";

        EvmSigner signer = new EvmSigner(
            credentials,
            chainId,
            tokenName,
            tokenVersion,
            tokenAddress
        );

        chainSigners.put(cacheKey, signer);
        return signer;
    }

    /**
     * Sign a payment.
     *
     * @param chain Chain name
     * @param params Payment parameters
     * @return Payment result with signature
     * @throws WDKException if signing fails
     */
    public PaymentResult signPayment(String chain, PaymentParams params) throws WDKException {
        try {
            CryptoSigner signer = getChainSigner(chain, params.getToken());

            Map<String, Object> payload = new HashMap<>();
            payload.put("from", credentials.getAddress());
            payload.put("to", params.getTo());
            payload.put("value", params.getAmount().toString());
            payload.put("validAfter", params.getValidAfter());
            payload.put("validBefore", params.getValidBefore());
            payload.put("nonce", params.getNonce());

            String signature = signer.sign(payload);

            return new PaymentResult(
                signature,
                credentials.getAddress(),
                params.getTo(),
                params.getAmount(),
                params.getToken()
            );
        } catch (CryptoSignException e) {
            throw new WDKException(WDKErrorCode.SIGNING_FAILED,
                "Failed to sign payment: " + e.getMessage(), e);
        }
    }

    /**
     * Get supported chains.
     *
     * @return Set of chain names
     */
    public java.util.Set<String> getSupportedChains() {
        return WDKChains.getSupportedChains();
    }

    /**
     * Get chains with USDT0 support.
     *
     * @return Set of chain names
     */
    public java.util.Set<String> getUsdt0Chains() {
        return WDKChains.getUsdt0Chains();
    }

    /**
     * Generate a new random seed phrase.
     *
     * @return BIP-39 mnemonic (12 words)
     */
    public static String generateSeedPhrase() {
        byte[] entropy = new byte[16]; // 128 bits = 12 words
        new SecureRandom().nextBytes(entropy);
        return MnemonicUtils.generateMnemonic(entropy);
    }

    /**
     * Generate a seed phrase with specific word count.
     *
     * @param wordCount Number of words (12, 15, 18, 21, or 24)
     * @return BIP-39 mnemonic
     */
    public static String generateSeedPhrase(int wordCount) {
        int entropyBits;
        switch (wordCount) {
            case 12:
                entropyBits = 128;
                break;
            case 15:
                entropyBits = 160;
                break;
            case 18:
                entropyBits = 192;
                break;
            case 21:
                entropyBits = 224;
                break;
            case 24:
                entropyBits = 256;
                break;
            default:
                throw new IllegalArgumentException(
                    "Word count must be 12, 15, 18, 21, or 24");
        }

        byte[] entropy = new byte[entropyBits / 8];
        new SecureRandom().nextBytes(entropy);
        return MnemonicUtils.generateMnemonic(entropy);
    }

    /**
     * Validate a seed phrase.
     *
     * @param seedPhrase Mnemonic to validate
     * @return true if valid
     */
    public static boolean validateSeedPhrase(String seedPhrase) {
        try {
            return MnemonicUtils.validateMnemonic(seedPhrase.trim());
        } catch (Exception e) {
            return false;
        }
    }

    private String getTokenName(String symbol) {
        switch (symbol.toUpperCase()) {
            case "USDT0":
            case "USDT":
                return "Tether USD";
            case "USDC":
                return "USD Coin";
            default:
                return symbol;
        }
    }
}
