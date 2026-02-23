package io.t402.schemes.btc.exact;

import io.t402.schemes.btc.BtcConstants;
import io.t402.schemes.btc.FacilitatorBtcSigner;
import io.t402.schemes.btc.PSBTPayload;

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
 * Facilitator scheme for Bitcoin on-chain payment verification and settlement.
 *
 * <p>Handles PSBT verification and broadcasting for exact BTC payments
 * with replay protection via PSBT hash caching.
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * FacilitatorBtcSigner signer = new MyBtcFacilitatorSigner(rpcClient);
 * ExactBtcFacilitatorScheme scheme = new ExactBtcFacilitatorScheme(signer);
 *
 * VerificationResult result = scheme.verifySync(payload, requirements);
 * if (result.isValid) {
 *     SettlementResult settlement = scheme.settleSync(payload, requirements);
 * }
 * }</pre>
 */
public class ExactBtcFacilitatorScheme {

    /** The scheme identifier. */
    public static final String SCHEME = BtcConstants.SCHEME_EXACT;

    /** CAIP family pattern for Bitcoin on-chain networks. */
    public static final String CAIP_FAMILY = BtcConstants.CAIP_FAMILY_BTC;

    private final FacilitatorBtcSigner signer;
    private final long usedTxCacheDurationMs;
    private final Map<String, Long> usedTxs = Collections.synchronizedMap(new LinkedHashMap<>());

    /**
     * Creates a new ExactBtcFacilitatorScheme with default cache duration (24 hours).
     *
     * @param signer Facilitator signer for BTC operations
     */
    public ExactBtcFacilitatorScheme(FacilitatorBtcSigner signer) {
        this(signer, 24 * 60 * 60 * 1000L);
    }

    /**
     * Creates a new ExactBtcFacilitatorScheme with specified cache duration.
     *
     * @param signer Facilitator signer for BTC operations
     * @param usedTxCacheDurationMs Cache duration for replay protection in milliseconds
     */
    public ExactBtcFacilitatorScheme(FacilitatorBtcSigner signer, long usedTxCacheDurationMs) {
        if (signer == null) {
            throw new IllegalArgumentException("Signer cannot be null");
        }
        this.signer = signer;
        this.usedTxCacheDurationMs = usedTxCacheDurationMs > 0 ? usedTxCacheDurationMs : 24 * 60 * 60 * 1000L;
    }

    /**
     * Gets all signer addresses.
     *
     * @param network Network identifier
     * @return List of facilitator Bitcoin addresses
     */
    public List<String> getSigners(String network) {
        return signer.getAddresses();
    }

    /**
     * Verifies a Bitcoin on-chain payment payload.
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

            // Validate network matches
            String acceptedNetwork = (String) payload.get("network");
            String requiredNetwork = (String) requirements.get("network");
            if (acceptedNetwork == null || !acceptedNetwork.equals(requiredNetwork)) {
                return VerificationResult.invalid("network_mismatch", "");
            }

            // Validate network is supported
            if (!BtcConstants.isSupportedBtcNetwork(requiredNetwork)) {
                return VerificationResult.invalid("unsupported_network", "");
            }

            // Parse payload
            Map<String, Object> payloadData = (Map<String, Object>) payload.get("payload");
            if (payloadData == null) {
                return VerificationResult.invalid("invalid_payload_structure", "");
            }

            PSBTPayload psbtPayload = PSBTPayload.fromMap(payloadData);
            if (psbtPayload.getSignedPsbt() == null || psbtPayload.getSignedPsbt().isEmpty()) {
                return VerificationResult.invalid("invalid_payload_missing_psbt", "");
            }

            // Validate payTo address
            String payTo = (String) requirements.get("payTo");
            if (payTo == null || !BtcConstants.validateBitcoinAddress(payTo)) {
                return VerificationResult.invalid("invalid_pay_to_address", "");
            }

            // Validate amount above dust limit
            String amountStr = (String) requirements.get("amount");
            if (amountStr == null) {
                return VerificationResult.invalid("missing_amount", "");
            }
            try {
                long amount = Long.parseLong(amountStr);
                if (amount < BtcConstants.DUST_LIMIT) {
                    return VerificationResult.invalid("amount_below_dust_limit", "");
                }
            } catch (NumberFormatException e) {
                return VerificationResult.invalid("invalid_amount_format", "");
            }

            // Check replay protection
            String psbtHash = hashPsbt(psbtPayload.getSignedPsbt());
            if (isTxUsed(psbtHash)) {
                return VerificationResult.invalid("psbt_already_used", "");
            }

            // Verify via signer
            try {
                FacilitatorBtcSigner.VerifyResult verifyResult =
                    signer.verifyPsbt(psbtPayload.getSignedPsbt(), payTo, amountStr);

                if (!verifyResult.isValid()) {
                    String reason = verifyResult.getReason() != null
                        ? verifyResult.getReason() : "psbt_verification_failed";
                    return VerificationResult.invalid(reason, verifyResult.getPayer());
                }

                // Mark as used
                markTxUsed(psbtHash);

                return VerificationResult.valid(verifyResult.getPayer());
            } catch (Exception e) {
                return VerificationResult.invalid(
                    "psbt_verification_error: " + e.getMessage(), "");
            }
        });
    }

    /**
     * Settles a Bitcoin on-chain payment by broadcasting the PSBT.
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
            .thenCompose(verifyResult -> {
                String network = (String) payload.get("network");

                if (!verifyResult.isValid) {
                    return CompletableFuture.completedFuture(
                        SettlementResult.failure(network, "", verifyResult.invalidReason, verifyResult.payer));
                }

                Map<String, Object> payloadData = (Map<String, Object>) payload.get("payload");
                PSBTPayload psbtPayload = PSBTPayload.fromMap(payloadData);

                return CompletableFuture.supplyAsync(() -> {
                    try {
                        String txId = signer.broadcastPsbt(psbtPayload.getSignedPsbt());

                        FacilitatorBtcSigner.ConfirmationResult confirmation =
                            signer.waitForConfirmation(txId, 1);

                        if (!confirmation.isConfirmed()) {
                            return SettlementResult.failure(network, txId,
                                "transaction_not_confirmed", verifyResult.payer);
                        }

                        return SettlementResult.success(network, txId, verifyResult.payer);
                    } catch (Exception e) {
                        return SettlementResult.failure(network, "",
                            "broadcast_failed: " + e.getMessage(), verifyResult.payer);
                    }
                });
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

    private String hashPsbt(String signedPsbt) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(signedPsbt.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    private boolean isTxUsed(String hash) {
        cleanupExpiredTxs();
        return usedTxs.containsKey(hash);
    }

    private void markTxUsed(String hash) {
        usedTxs.put(hash, System.currentTimeMillis());
    }

    private void cleanupExpiredTxs() {
        long cutoff = System.currentTimeMillis() - usedTxCacheDurationMs;
        usedTxs.entrySet().removeIf(entry -> entry.getValue() < cutoff);
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
