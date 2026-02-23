package io.t402.schemes.btc.lightning;

import io.t402.schemes.btc.BtcConstants;
import io.t402.schemes.btc.FacilitatorLightningSigner;
import io.t402.schemes.btc.LightningPayload;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Facilitator scheme for Lightning Network payment verification and settlement.
 *
 * <p>Verifies payments by checking that SHA-256(preimage) === paymentHash.
 * Lightning payments are atomic (settle-on-pay), so settlement is a
 * confirmation-only operation.
 */
public class LightningFacilitatorScheme {

    /** The scheme identifier. */
    public static final String SCHEME = BtcConstants.SCHEME_EXACT;

    /** CAIP family pattern for Lightning networks. */
    public static final String CAIP_FAMILY = BtcConstants.CAIP_FAMILY_LIGHTNING;

    private final FacilitatorLightningSigner signer;
    private final Map<String, Long> usedHashes = Collections.synchronizedMap(new LinkedHashMap<>());

    /**
     * Creates a new LightningFacilitatorScheme.
     *
     * @param signer Facilitator signer for Lightning operations
     */
    public LightningFacilitatorScheme(FacilitatorLightningSigner signer) {
        if (signer == null) {
            throw new IllegalArgumentException("Signer cannot be null");
        }
        this.signer = signer;
    }

    /**
     * Gets all signer addresses (node public keys).
     *
     * @param network Network identifier
     * @return List of node public keys
     */
    public List<String> getSigners(String network) {
        return signer.getAddresses();
    }

    /**
     * Verifies a Lightning payment payload.
     *
     * <p>Core verification: SHA-256(preimage) must equal paymentHash.
     * Optionally verifies with the Lightning node via lookupPayment.
     *
     * @param payload Payment payload map
     * @param requirements Payment requirements map
     * @return CompletableFuture containing verification result
     */
    @SuppressWarnings("unchecked")
    public CompletableFuture<VerificationResult> verify(
            Map<String, Object> payload,
            Map<String, Object> requirements) {

        return CompletableFuture.supplyAsync(() -> {
            // Validate scheme
            String payloadScheme = (String) payload.get("scheme");
            String requiredScheme = (String) requirements.get("scheme");
            if (!SCHEME.equals(payloadScheme) || !SCHEME.equals(requiredScheme)) {
                return VerificationResult.invalid("unsupported_scheme", "");
            }

            // Validate network
            String acceptedNetwork = (String) payload.get("network");
            String requiredNetwork = (String) requirements.get("network");
            if (acceptedNetwork == null || !acceptedNetwork.equals(requiredNetwork)) {
                return VerificationResult.invalid("network_mismatch", "");
            }

            if (!BtcConstants.isSupportedLightningNetwork(requiredNetwork)) {
                return VerificationResult.invalid("unsupported_network", "");
            }

            // Parse payload
            Map<String, Object> payloadData = (Map<String, Object>) payload.get("payload");
            if (payloadData == null) {
                return VerificationResult.invalid("invalid_payload_structure", "");
            }

            LightningPayload lnPayload = LightningPayload.fromMap(payloadData);
            if (lnPayload.getPaymentHash() == null || lnPayload.getPreimage() == null
                    || lnPayload.getBolt11Invoice() == null) {
                return VerificationResult.invalid("invalid_payload_structure", "");
            }

            // Validate preimage format (32 bytes hex)
            if (!BtcConstants.isValidHex(lnPayload.getPreimage(), 32)) {
                return VerificationResult.invalid("invalid_preimage_format", "");
            }

            // Validate payment hash format (32 bytes hex)
            if (!BtcConstants.isValidHex(lnPayload.getPaymentHash(), 32)) {
                return VerificationResult.invalid("invalid_payment_hash_format", "");
            }

            // Check replay
            if (isHashUsed(lnPayload.getPaymentHash())) {
                return VerificationResult.invalid("payment_hash_already_used", "");
            }

            // Core verification: SHA-256(preimage) must equal paymentHash
            byte[] preimageBytes = hexToBytes(lnPayload.getPreimage());
            if (preimageBytes == null) {
                return VerificationResult.invalid("invalid_preimage_encoding", "");
            }

            String computedHash = sha256Hex(preimageBytes);
            if (!computedHash.equals(lnPayload.getPaymentHash())) {
                return VerificationResult.invalid("preimage_hash_mismatch", "");
            }

            // Optionally verify with Lightning node
            try {
                FacilitatorLightningSigner.PaymentLookupResult lookup =
                    signer.lookupPayment(lnPayload.getPaymentHash());

                if (!lookup.isSettled()) {
                    return VerificationResult.invalid("payment_not_settled", "");
                }

                // Verify amount matches if available
                String requiredAmount = (String) requirements.get("amount");
                if (lookup.getAmountSats() != null && requiredAmount != null) {
                    BigInteger paid = new BigInteger(lookup.getAmountSats());
                    BigInteger required = new BigInteger(requiredAmount);
                    if (paid.compareTo(required) < 0) {
                        return VerificationResult.invalid("insufficient_amount", "");
                    }
                }
            } catch (Exception e) {
                // If lookup fails, preimage verification is sufficient
            }

            // Mark as used
            markHashUsed(lnPayload.getPaymentHash());

            return VerificationResult.valid("");
        });
    }

    /**
     * Settles a Lightning payment (confirmation-only since Lightning is atomic).
     *
     * @param payload Payment payload map
     * @param requirements Payment requirements map
     * @return CompletableFuture containing settlement result
     */
    @SuppressWarnings("unchecked")
    public CompletableFuture<SettlementResult> settle(
            Map<String, Object> payload,
            Map<String, Object> requirements) {

        return verify(payload, requirements)
            .thenApply(verifyResult -> {
                String network = (String) payload.get("network");

                if (!verifyResult.isValid) {
                    return SettlementResult.failure(network, "",
                        verifyResult.invalidReason, verifyResult.payer);
                }

                Map<String, Object> payloadData = (Map<String, Object>) payload.get("payload");
                LightningPayload lnPayload = LightningPayload.fromMap(payloadData);

                // Lightning is settle-on-pay: payment hash is the transaction ID
                return SettlementResult.success(network, lnPayload.getPaymentHash(), verifyResult.payer);
            });
    }

    /**
     * Verifies a payment synchronously.
     */
    public VerificationResult verifySync(Map<String, Object> payload, Map<String, Object> requirements) {
        return verify(payload, requirements).join();
    }

    /**
     * Settles a payment synchronously.
     */
    public SettlementResult settleSync(Map<String, Object> payload, Map<String, Object> requirements) {
        return settle(payload, requirements).join();
    }

    private boolean isHashUsed(String hash) {
        cleanupExpiredHashes();
        return usedHashes.containsKey(hash);
    }

    private void markHashUsed(String hash) {
        usedHashes.put(hash, System.currentTimeMillis());
    }

    private void cleanupExpiredHashes() {
        long cutoff = System.currentTimeMillis() - 24 * 60 * 60 * 1000L;
        usedHashes.entrySet().removeIf(entry -> entry.getValue() < cutoff);
    }

    private static String sha256Hex(byte[] input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input);
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    private static byte[] hexToBytes(String hex) {
        if (hex == null || hex.length() % 2 != 0) {
            return null;
        }
        byte[] bytes = new byte[hex.length() / 2];
        for (int i = 0; i < bytes.length; i++) {
            int idx = i * 2;
            bytes[i] = (byte) Integer.parseInt(hex.substring(idx, idx + 2), 16);
        }
        return bytes;
    }

    /**
     * Result of payment verification.
     */
    public static class VerificationResult {
        public final boolean isValid;
        public final String invalidReason;
        public final String payer;

        private VerificationResult(boolean isValid, String invalidReason, String payer) {
            this.isValid = isValid;
            this.invalidReason = invalidReason;
            this.payer = payer;
        }

        public static VerificationResult valid(String payer) {
            return new VerificationResult(true, null, payer);
        }

        public static VerificationResult invalid(String reason, String payer) {
            return new VerificationResult(false, reason, payer);
        }

        public Map<String, Object> toMap() {
            Map<String, Object> map = new HashMap<>();
            map.put("isValid", isValid);
            map.put("invalidReason", invalidReason);
            map.put("payer", payer);
            return map;
        }
    }

    /**
     * Result of payment settlement.
     */
    public static class SettlementResult {
        public final boolean success;
        public final String network;
        public final String transaction;
        public final String errorReason;
        public final String payer;

        private SettlementResult(boolean success, String network, String transaction,
                                 String errorReason, String payer) {
            this.success = success;
            this.network = network;
            this.transaction = transaction;
            this.errorReason = errorReason;
            this.payer = payer;
        }

        public static SettlementResult success(String network, String transaction, String payer) {
            return new SettlementResult(true, network, transaction, null, payer);
        }

        public static SettlementResult failure(String network, String transaction,
                                               String errorReason, String payer) {
            return new SettlementResult(false, network, transaction, errorReason, payer);
        }

        public Map<String, Object> toMap() {
            Map<String, Object> map = new HashMap<>();
            map.put("success", success);
            map.put("network", network);
            map.put("transaction", transaction);
            map.put("errorReason", errorReason);
            map.put("payer", payer);
            return map;
        }
    }
}
