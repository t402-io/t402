package io.t402.schemes.btc.exact;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.t402.schemes.btc.BtcConstants;
import io.t402.schemes.btc.ClientBtcSigner;
import io.t402.schemes.btc.PSBTPayload;

import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Client scheme for creating Bitcoin on-chain payment payloads.
 *
 * <p>Builds unsigned PSBTs, signs them via a {@link ClientBtcSigner},
 * and returns the signed PSBT as a payment payload.
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * ClientBtcSigner signer = new MyBtcWalletSigner(wallet);
 * ExactBtcClientScheme scheme = new ExactBtcClientScheme(signer);
 *
 * Map<String, Object> requirements = Map.of(
 *     "network", BtcConstants.BTC_MAINNET,
 *     "payTo", "bc1q...",
 *     "amount", "100000"
 * );
 *
 * Map<String, Object> payload = scheme.createPaymentPayloadSync(requirements);
 * }</pre>
 */
public class ExactBtcClientScheme {

    /** The scheme identifier. */
    public static final String SCHEME = BtcConstants.SCHEME_EXACT;

    /** CAIP family pattern for Bitcoin on-chain networks. */
    public static final String CAIP_FAMILY = BtcConstants.CAIP_FAMILY_BTC;

    private final ClientBtcSigner signer;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Creates a new ExactBtcClientScheme with the given signer.
     *
     * @param signer Client signer for PSBT signing
     */
    public ExactBtcClientScheme(ClientBtcSigner signer) {
        if (signer == null) {
            throw new IllegalArgumentException("Signer cannot be null");
        }
        this.signer = signer;
    }

    /**
     * Gets the signer's Bitcoin address.
     *
     * @return Bitcoin address
     */
    public String getAddress() {
        return signer.getAddress();
    }

    /**
     * Creates a payment payload for the given requirements.
     *
     * @param requirements Payment requirements map
     * @return CompletableFuture containing payment payload map
     */
    public CompletableFuture<Map<String, Object>> createPaymentPayload(Map<String, Object> requirements) {
        return CompletableFuture.supplyAsync(() -> {
            String network = (String) requirements.get("network");
            String payTo = (String) requirements.get("payTo");
            String amount = (String) requirements.get("amount");
            int t402Version = ((Number) requirements.getOrDefault("t402Version", 2)).intValue();

            // Validate network
            if (!BtcConstants.isBtcNetwork(network)) {
                throw new IllegalArgumentException("Not a Bitcoin on-chain network: " + network);
            }

            // Validate address
            if (!BtcConstants.validateBitcoinAddress(payTo)) {
                throw new IllegalArgumentException("Invalid Bitcoin address: " + payTo);
            }

            // Validate amount above dust limit
            long sats;
            try {
                sats = Long.parseLong(amount);
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("Invalid amount format: " + amount);
            }
            if (sats < BtcConstants.DUST_LIMIT) {
                throw new IllegalArgumentException(
                    "Amount " + amount + " satoshis is below dust limit (" + BtcConstants.DUST_LIMIT + ")");
            }

            // Build unsigned PSBT data
            Map<String, Object> psbtData = new HashMap<>();
            psbtData.put("outputs", List.of(Map.of("address", payTo, "value", amount)));
            psbtData.put("network", network);
            psbtData.put("fromAddress", signer.getAddress());
            psbtData.put("fromPubKey", signer.getPublicKey());

            try {
                byte[] psbtJson = objectMapper.writeValueAsBytes(psbtData);
                String unsignedPsbt = Base64.getEncoder().encodeToString(psbtJson);

                // Sign the PSBT
                String signedPsbt = signer.signPsbt(unsignedPsbt);

                PSBTPayload payload = new PSBTPayload(signedPsbt);

                Map<String, Object> result = new HashMap<>();
                result.put("t402Version", t402Version);
                result.put("scheme", SCHEME);
                result.put("network", network);
                result.put("payload", payload.toMap());

                return result;
            } catch (IllegalArgumentException e) {
                throw e;
            } catch (Exception e) {
                throw new RuntimeException("Failed to create payment payload: " + e.getMessage(), e);
            }
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
}
