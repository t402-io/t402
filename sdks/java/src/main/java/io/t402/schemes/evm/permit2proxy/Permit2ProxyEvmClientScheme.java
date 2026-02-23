package io.t402.schemes.evm.permit2proxy;

import io.t402.schemes.evm.EvmConstants;
import io.t402.schemes.evm.permit2.Permit2Constants;

import java.math.BigInteger;
import java.security.SecureRandom;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Client scheme for creating Permit2 Proxy EVM payment payloads.
 *
 * <p>Handles creation of signed Permit2 PermitWitnessTransferFrom messages
 * with T402Witness data for the permit2-proxy payment scheme.</p>
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * Permit2ProxySigner signer = new MyPermit2ProxySigner(privateKey);
 * Permit2ProxyEvmClientScheme scheme = new Permit2ProxyEvmClientScheme(signer);
 *
 * Map<String, Object> requirements = Map.of(
 *     "network", "eip155:8453",
 *     "payTo", "0xRecipient...",
 *     "maxAmountRequired", "1000000",
 *     "asset", "0xTokenAddress...",
 *     "extra", Map.of("facilitator", "0xFacilitator...")
 * );
 *
 * Map<String, Object> payload = scheme.createPaymentPayloadSync(requirements);
 * }</pre>
 */
public class Permit2ProxyEvmClientScheme {

    public static final String SCHEME = Permit2ProxyConstants.SCHEME_PERMIT2_PROXY;
    public static final String CAIP_FAMILY = Permit2ProxyConstants.CAIP_FAMILY;

    private final Permit2ProxySigner signer;
    private final SecureRandom secureRandom = new SecureRandom();

    /**
     * Creates a new Permit2ProxyEvmClientScheme with the given signer.
     *
     * @param signer Permit2 proxy signer for EIP-712 signing
     * @throws IllegalArgumentException if signer is null
     */
    public Permit2ProxyEvmClientScheme(Permit2ProxySigner signer) {
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
     *   network, payTo, maxAmountRequired, asset, extra.facilitator
     * @return CompletableFuture containing payment payload map
     */
    @SuppressWarnings("unchecked")
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

        // Extract facilitator from extra
        String facilitator = "";
        Object extraObj = requirements.get("extra");
        if (extraObj instanceof Map) {
            Map<String, Object> extra = (Map<String, Object>) extraObj;
            Object fObj = extra.get("facilitator");
            if (fObj instanceof String) {
                facilitator = (String) fObj;
            }
        }
        if (facilitator.isEmpty()) {
            return CompletableFuture.failedFuture(
                new IllegalArgumentException("facilitator address required in requirements extra"));
        }

        // Generate random nonce
        String nonce = generateNonce();

        // Calculate deadline (1 hour from now)
        long deadline = System.currentTimeMillis() / 1000 + 3600;

        // Calculate validAfter (30 seconds before now for clock skew)
        long validAfter = System.currentTimeMillis() / 1000 - 30;

        long chainId = EvmConstants.getChainId(network);

        // Build EIP-712 domain
        Map<String, Object> domain = new HashMap<>();
        domain.put("name", Permit2ProxyConstants.PERMIT2_DOMAIN_NAME);
        domain.put("chainId", chainId);
        domain.put("verifyingContract", Permit2Constants.PERMIT2_ADDRESS);

        // Build PermitWitnessTransferFrom message
        Map<String, Object> permitted = new HashMap<>();
        permitted.put("token", asset);
        permitted.put("amount", new BigInteger(amount));

        // Spender is the proxy contract
        Map<String, Object> witness = new HashMap<>();
        witness.put("to", payTo);
        witness.put("facilitator", facilitator);
        witness.put("validAfter", BigInteger.valueOf(validAfter));

        Map<String, Object> message = new HashMap<>();
        message.put("permitted", permitted);
        message.put("spender", Permit2ProxyConstants.EXACT_PROXY_ADDRESS);
        message.put("nonce", new BigInteger(nonce));
        message.put("deadline", BigInteger.valueOf(deadline));
        message.put("witness", witness);

        final String finalAsset = asset;
        final String finalNonce = nonce;
        final String finalFacilitator = facilitator;

        return signer.signPermitWitnessTransferFrom(domain, message, network)
            .thenApply(signature -> {
                Permit2ProxyPayload payload = Permit2ProxyPayload.builder()
                    .token(finalAsset)
                    .amount(amount)
                    .nonce(finalNonce)
                    .deadline(String.valueOf(deadline))
                    .witnessTo(payTo)
                    .witnessFacilitator(finalFacilitator)
                    .witnessValidAfter(String.valueOf(validAfter))
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

    public Map<String, Object> createPaymentPayloadSync(Map<String, Object> requirements) {
        return createPaymentPayload(requirements).join();
    }

    private String generateNonce() {
        byte[] nonceBytes = new byte[32];
        secureRandom.nextBytes(nonceBytes);
        return new BigInteger(1, nonceBytes).toString();
    }
}
