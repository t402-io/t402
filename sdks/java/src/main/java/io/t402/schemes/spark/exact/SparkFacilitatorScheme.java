package io.t402.schemes.spark.exact;

import io.t402.schemes.spark.SparkConstants;
import io.t402.schemes.spark.SparkPayload;
import io.t402.schemes.spark.SparkSigner;
import io.t402.schemes.spark.TransferInfo;
import io.t402.schemes.spark.TransferStatus;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Facilitator scheme for Spark payment verification and settlement.
 *
 * <p>Handles both direct Spark transfers and Lightning payments routed
 * through Spark with replay protection via ConcurrentHashMap.
 *
 * <h2>Verification</h2>
 * <ul>
 *   <li><b>Spark</b> — Lookup transfer_id via SparkSigner, confirm
 *       amount/recipient/status</li>
 *   <li><b>Lightning</b> — Verify SHA256(preimage) === paymentHash</li>
 * </ul>
 *
 * <h2>Settlement</h2>
 * <p>Spark transfers have instant finality — settle is a confirmation no-op
 * that returns the transfer ID or payment hash as the transaction ID.
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * SparkSigner signer = new MySparkSigner();
 * SparkFacilitatorScheme scheme = new SparkFacilitatorScheme(signer);
 *
 * VerificationResult result = scheme.verifySync(payload, requirements);
 * if (result.isValid) {
 *     SettlementResult settlement = scheme.settleSync(payload, requirements);
 * }
 * }</pre>
 */
public class SparkFacilitatorScheme {

    /** The scheme identifier. */
    public static final String SCHEME = SparkConstants.SCHEME_EXACT;

    /** CAIP family pattern for Spark networks. */
    public static final String CAIP_FAMILY = SparkConstants.CAIP_FAMILY;

    private final SparkSigner signer;

    /** Replay protection: set of verified transfer IDs and payment hashes. */
    private final ConcurrentHashMap<String, Boolean> verified = new ConcurrentHashMap<>();

    /**
     * Creates a new SparkFacilitatorScheme.
     *
     * @param signer Spark signer for transfer lookups
     * @throws IllegalArgumentException if signer is null
     */
    public SparkFacilitatorScheme(SparkSigner signer) {
        if (signer == null) {
            throw new IllegalArgumentException("Signer cannot be null");
        }
        this.signer = signer;
    }

    /**
     * Returns the scheme identifier.
     *
     * @return "exact"
     */
    public String getScheme() {
        return SCHEME;
    }

    /**
     * Returns the CAIP family pattern.
     *
     * @return "spark:*"
     */
    public String getCaipFamily() {
        return CAIP_FAMILY;
    }

    /**
     * Verifies a Spark payment payload synchronously.
     *
     * @param payload Payment payload map
     * @param requirements Payment requirements map
     * @return Verification result
     */
    @SuppressWarnings("unchecked")
    public VerificationResult verifySync(Map<String, Object> payload, Map<String, Object> requirements) {
        // Parse inner payload
        Map<String, Object> payloadData = (Map<String, Object>) payload.get("payload");
        if (payloadData == null) {
            return VerificationResult.invalid("invalid_payload_structure", "");
        }

        SparkPayload sparkPayload = SparkPayload.fromMap(payloadData);
        String network = (String) requirements.get("network");

        String paymentType = sparkPayload.getPaymentType();
        if (paymentType == null) {
            return VerificationResult.invalid("missing_payment_type", "");
        }

        switch (paymentType) {
            case SparkConstants.PAYMENT_TYPE_SPARK:
                return verifySpark(sparkPayload, requirements, network);
            case SparkConstants.PAYMENT_TYPE_LIGHTNING:
                return verifyLightning(sparkPayload, requirements, network);
            default:
                return VerificationResult.invalid("unsupported_payment_type", "");
        }
    }

    /**
     * Settles a Spark payment synchronously.
     *
     * <p>Spark has instant finality, so settlement is a verification
     * followed by returning the transfer ID or payment hash as the
     * transaction identifier.
     *
     * @param payload Payment payload map
     * @param requirements Payment requirements map
     * @return Settlement result
     */
    @SuppressWarnings("unchecked")
    public SettlementResult settleSync(Map<String, Object> payload, Map<String, Object> requirements) {
        String network = (String) requirements.get("network");

        // Verify first
        VerificationResult verifyResult = verifySync(payload, requirements);
        if (!verifyResult.isValid) {
            return SettlementResult.failure(network, "", verifyResult.invalidReason, verifyResult.payer);
        }

        // Determine transaction ID
        Map<String, Object> payloadData = (Map<String, Object>) payload.get("payload");
        SparkPayload sparkPayload = SparkPayload.fromMap(payloadData);
        String txId = sparkPayload.getTransferId();
        if (txId == null || txId.isEmpty()) {
            txId = sparkPayload.getPaymentHash();
        }

        return SettlementResult.success(network, txId, verifyResult.payer);
    }

    private VerificationResult verifySpark(
            SparkPayload payload, Map<String, Object> requirements, String network) {

        String transferId = payload.getTransferId();
        if (transferId == null || transferId.isEmpty()) {
            return VerificationResult.invalid("missing_transfer_id", "");
        }

        // Replay protection
        if (verified.putIfAbsent(transferId, Boolean.TRUE) != null) {
            return VerificationResult.invalid("replay_detected", "");
        }

        // Lookup transfer
        TransferInfo transfer;
        try {
            transfer = signer.getTransfer(transferId);
        } catch (Exception e) {
            return VerificationResult.invalid("transfer_not_found", "");
        }

        // Check status
        if (transfer.getStatus() != TransferStatus.COMPLETED) {
            return VerificationResult.invalid("transfer_not_completed", "");
        }

        // Check amount (requirements amount is in satoshis)
        String amountStr = (String) requirements.get("amount");
        if (amountStr == null) {
            return VerificationResult.invalid("missing_amount", "");
        }
        long requiredAmount;
        try {
            requiredAmount = Long.parseLong(amountStr);
        } catch (NumberFormatException e) {
            return VerificationResult.invalid("invalid_amount", "");
        }
        if (transfer.getAmount() < requiredAmount) {
            return VerificationResult.invalid("insufficient_amount", "");
        }

        // Check recipient
        String serverAddr = signer.getAddress();
        if (!transfer.getReceiver().equalsIgnoreCase(serverAddr)) {
            return VerificationResult.invalid("wrong_recipient", "");
        }

        return VerificationResult.valid(transfer.getSender());
    }

    private VerificationResult verifyLightning(
            SparkPayload payload, Map<String, Object> requirements, String network) {

        String preimage = payload.getPreimage();
        String paymentHash = payload.getPaymentHash();

        if (preimage == null || preimage.isEmpty() || paymentHash == null || paymentHash.isEmpty()) {
            return VerificationResult.invalid("missing_lightning_proof", "");
        }

        // Decode preimage from hex (strip optional 0x prefix)
        String cleanPreimage = preimage.startsWith("0x") ? preimage.substring(2) : preimage;
        byte[] preimageBytes;
        try {
            preimageBytes = hexToBytes(cleanPreimage);
        } catch (Exception e) {
            return VerificationResult.invalid("invalid_preimage", "");
        }

        // Verify: SHA256(preimage) === paymentHash
        byte[] computedHash = sha256(preimageBytes);
        String computedHashHex = bytesToHex(computedHash);
        String expectedHash = paymentHash.startsWith("0x") ? paymentHash.substring(2) : paymentHash;

        if (!computedHashHex.equals(expectedHash)) {
            return VerificationResult.invalid("preimage_mismatch", "");
        }

        // Replay protection for lightning payments
        if (verified.putIfAbsent(paymentHash, Boolean.TRUE) != null) {
            return VerificationResult.invalid("replay_detected", "");
        }

        // Payer identity derived from payment hash prefix
        String payer = "lightning:" + paymentHash.substring(0, Math.min(16, paymentHash.length()));
        return VerificationResult.valid(payer);
    }

    private static byte[] sha256(byte[] input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return digest.digest(input);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    private static byte[] hexToBytes(String hex) {
        if (hex.length() % 2 != 0) {
            throw new IllegalArgumentException("Hex string must have even length");
        }
        byte[] bytes = new byte[hex.length() / 2];
        for (int i = 0; i < bytes.length; i++) {
            int idx = i * 2;
            bytes[i] = (byte) Integer.parseInt(hex.substring(idx, idx + 2), 16);
        }
        return bytes;
    }

    private static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
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
