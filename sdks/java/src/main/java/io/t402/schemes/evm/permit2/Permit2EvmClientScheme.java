package io.t402.schemes.evm.permit2;

import io.t402.schemes.evm.EvmConstants;

import java.math.BigInteger;
import java.security.SecureRandom;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Client scheme for creating Permit2 EVM payment payloads.
 *
 * <p>Handles creation of signed Permit2 PermitTransferFrom messages
 * for the permit2 payment scheme on EVM-compatible chains.</p>
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * Permit2Signer signer = new MyPermit2Signer(privateKey);
 * Permit2EvmClientScheme scheme = new Permit2EvmClientScheme(signer);
 *
 * Map<String, Object> requirements = Map.of(
 *     "network", "eip155:8453",
 *     "payTo", "0xRecipient...",
 *     "maxAmountRequired", "1000000",
 *     "asset", "0xTokenAddress..."
 * );
 *
 * Map<String, Object> payload = scheme.createPaymentPayloadSync(requirements);
 * }</pre>
 */
public class Permit2EvmClientScheme {

    public static final String SCHEME = Permit2Constants.SCHEME_PERMIT2;
    public static final String CAIP_FAMILY = Permit2Constants.CAIP_FAMILY;

    private final Permit2Signer signer;
    private final SecureRandom secureRandom = new SecureRandom();

    /**
     * Creates a new Permit2EvmClientScheme with the given signer.
     *
     * @param signer Permit2 signer for EIP-712 signing
     * @throws IllegalArgumentException if signer is null
     */
    public Permit2EvmClientScheme(Permit2Signer signer) {
        if (signer == null) {
            throw new IllegalArgumentException("Signer cannot be null");
        }
        this.signer = signer;
    }

    /**
     * Gets the signer's Ethereum address.
     *
     * @return 0x-prefixed Ethereum address
     */
    public String getAddress() {
        return signer.getAddress();
    }

    /**
     * Creates a payment payload for the given requirements.
     *
     * @param requirements Payment requirements map containing:
     *   network, payTo, maxAmountRequired, asset, maxTimeoutSeconds
     * @return CompletableFuture containing payment payload map
     */
    public CompletableFuture<Map<String, Object>> createPaymentPayload(Map<String, Object> requirements) {
        String network = (String) requirements.getOrDefault("network", EvmConstants.ETHEREUM_MAINNET);

        if (!EvmConstants.isEvmNetwork(network)) {
            return CompletableFuture.failedFuture(
                new IllegalArgumentException("Not an EVM network: " + network));
        }

        int t402Version = ((Number) requirements.getOrDefault("t402Version", 2)).intValue();
        String payTo = (String) requirements.get("payTo");
        String amount = (String) requirements.get("maxAmountRequired");
        String asset = (String) requirements.get("asset");

        if (payTo == null || payTo.isEmpty()) {
            return CompletableFuture.failedFuture(
                new IllegalArgumentException("payTo address is required"));
        }
        if (amount == null || amount.isEmpty()) {
            return CompletableFuture.failedFuture(
                new IllegalArgumentException("maxAmountRequired is required"));
        }
        if (asset == null || asset.isEmpty()) {
            asset = EvmConstants.getDefaultTokenAddress(network);
        }

        // Generate random nonce
        String nonce = generateNonce();

        // Calculate deadline (1 hour from now)
        long deadline = System.currentTimeMillis() / 1000 + 3600;

        long chainId = EvmConstants.getChainId(network);

        // Build EIP-712 domain
        Map<String, Object> domain = new HashMap<>();
        domain.put("name", Permit2Constants.PERMIT2_DOMAIN_NAME);
        domain.put("chainId", chainId);
        domain.put("verifyingContract", Permit2Constants.PERMIT2_ADDRESS);

        // Build PermitTransferFrom message
        Map<String, Object> permitted = new HashMap<>();
        permitted.put("token", asset);
        permitted.put("amount", new BigInteger(amount));

        Map<String, Object> message = new HashMap<>();
        message.put("permitted", permitted);
        message.put("spender", payTo);
        message.put("nonce", new BigInteger(nonce));
        message.put("deadline", BigInteger.valueOf(deadline));

        final String finalAsset = asset;
        final String finalNonce = nonce;

        return signer.signPermit2TypedData(domain, message, network)
            .thenApply(signature -> {
                Permit2Payload payload = Permit2Payload.builder()
                    .token(finalAsset)
                    .amount(amount)
                    .nonce(finalNonce)
                    .deadline(String.valueOf(deadline))
                    .to(payTo)
                    .requestedAmount(amount)
                    .signature(signature)
                    .owner(signer.getAddress())
                    .build();

                Map<String, Object> result = new HashMap<>();
                result.put("t402Version", t402Version);
                result.put("scheme", SCHEME);
                result.put("network", network);
                result.put("payload", payload.toMap());

                return result;
            });
    }

    /**
     * Creates a payment payload synchronously.
     *
     * @param requirements Payment requirements map
     * @return Payment payload map
     */
    public Map<String, Object> createPaymentPayloadSync(Map<String, Object> requirements) {
        return createPaymentPayload(requirements).join();
    }

    /**
     * Generates a random nonce as a decimal string from 32 random bytes.
     */
    private String generateNonce() {
        byte[] nonceBytes = new byte[32];
        secureRandom.nextBytes(nonceBytes);
        return new BigInteger(1, nonceBytes).toString();
    }
}
