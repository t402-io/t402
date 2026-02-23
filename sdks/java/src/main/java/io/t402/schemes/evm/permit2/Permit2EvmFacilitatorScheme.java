package io.t402.schemes.evm.permit2;

import io.t402.schemes.evm.EvmConstants;

import java.math.BigInteger;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Facilitator scheme for Permit2 EVM payment verification and settlement.
 *
 * <p>Handles verification of Permit2 payment payloads and settlement
 * by calling permitTransferFrom on the Permit2 contract.</p>
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * Permit2FacilitatorSigner signer = new MyPermit2FacilitatorSigner(web3j, credentials);
 * Permit2EvmFacilitatorScheme scheme = new Permit2EvmFacilitatorScheme(signer);
 *
 * VerificationResult result = scheme.verifySync(payload, requirements);
 * if (result.isValid) {
 *     SettlementResult settlement = scheme.settleSync(payload, requirements);
 * }
 * }</pre>
 */
public class Permit2EvmFacilitatorScheme {

    public static final String SCHEME = Permit2Constants.SCHEME_PERMIT2;
    public static final String CAIP_FAMILY = Permit2Constants.CAIP_FAMILY;

    private final Permit2FacilitatorSigner signer;

    /**
     * Creates a new Permit2EvmFacilitatorScheme with the given signer.
     *
     * @param signer Facilitator signer for on-chain operations
     * @throws IllegalArgumentException if signer is null
     */
    public Permit2EvmFacilitatorScheme(Permit2FacilitatorSigner signer) {
        if (signer == null) {
            throw new IllegalArgumentException("Signer cannot be null");
        }
        this.signer = signer;
    }

    /**
     * Gets the facilitator wallet addresses.
     *
     * @return List of 0x-prefixed Ethereum addresses
     */
    public List<String> getAddresses() {
        return signer.getAddresses();
    }

    /**
     * Gets the facilitator signer addresses for a specific network.
     *
     * @param network Network identifier (CAIP-2 format)
     * @return List of signer addresses
     */
    public List<String> getSigners(String network) {
        return signer.getAddresses();
    }

    /**
     * Gets Permit2-specific extra data.
     *
     * @return Map with permit2Address
     */
    public Map<String, Object> getExtra() {
        Map<String, Object> extra = new HashMap<>();
        extra.put("permit2Address", Permit2Constants.PERMIT2_ADDRESS);
        return extra;
    }

    /**
     * Verifies a payment payload against requirements.
     *
     * @param payload Payment payload from the client
     * @param requirements Payment requirements from the server
     * @return CompletableFuture containing verification result
     */
    @SuppressWarnings("unchecked")
    public CompletableFuture<VerificationResult> verify(
            Map<String, Object> payload,
            Map<String, Object> requirements) {

        try {
            // Validate scheme
            String scheme = (String) payload.get("scheme");
            if (!SCHEME.equals(scheme)) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("invalid_scheme",
                        "Unsupported scheme: " + scheme + ", expected: " + SCHEME));
            }

            // Validate network
            String payloadNetwork = (String) payload.get("network");
            String requirementsNetwork = (String) requirements.get("network");
            if (payloadNetwork != null && requirementsNetwork != null
                    && !payloadNetwork.equals(requirementsNetwork)) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("network_mismatch",
                        "Network mismatch: payload=" + payloadNetwork
                            + ", requirements=" + requirementsNetwork));
            }

            String network = payloadNetwork != null ? payloadNetwork : requirementsNetwork;
            if (network == null || !EvmConstants.isEvmNetwork(network)) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("invalid_network",
                        "Invalid or missing EVM network: " + network));
            }

            // Extract inner payload
            Map<String, Object> innerPayload = (Map<String, Object>) payload.get("payload");
            if (innerPayload == null) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("invalid_payload_structure",
                        "Missing payload data"));
            }

            // Parse the Permit2 payload
            Permit2Payload p2Payload;
            try {
                p2Payload = Permit2Payload.fromMap(innerPayload);
            } catch (Exception e) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("invalid_payload_structure",
                        "Failed to parse payload: " + e.getMessage()));
            }

            // Validate required fields
            if (p2Payload.getOwner() == null || p2Payload.getOwner().isEmpty()
                    || p2Payload.getToken() == null || p2Payload.getToken().isEmpty()) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("invalid_payload_structure",
                        "Missing owner or token in payload"));
            }

            // Verify token matches
            String requiredAsset = (String) requirements.get("asset");
            if (requiredAsset != null && !requiredAsset.equalsIgnoreCase(p2Payload.getToken())) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("token_mismatch",
                        "Token mismatch: expected " + requiredAsset
                            + ", got " + p2Payload.getToken()));
            }

            // Verify recipient matches
            String payTo = (String) requirements.get("payTo");
            if (payTo == null || !payTo.equalsIgnoreCase(p2Payload.getTo())) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("recipient_mismatch",
                        "Recipient mismatch: expected " + payTo
                            + ", got " + p2Payload.getTo()));
            }

            // Verify permitted amount
            String requiredAmount = (String) requirements.get("maxAmountRequired");
            if (requiredAmount == null) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("missing_amount",
                        "Missing maxAmountRequired in requirements"));
            }

            BigInteger required = new BigInteger(requiredAmount);
            BigInteger permittedAmount = new BigInteger(p2Payload.getAmount());
            if (permittedAmount.compareTo(required) < 0) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("insufficient_permitted_amount",
                        "Permitted amount " + permittedAmount
                            + " < required " + required));
            }

            // Verify requested amount
            BigInteger requestedAmount = new BigInteger(p2Payload.getRequestedAmount());
            if (requestedAmount.compareTo(required) < 0) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("insufficient_requested_amount",
                        "Requested amount " + requestedAmount
                            + " < required " + required));
            }

            // Check balance
            final String owner = p2Payload.getOwner();
            final String token = p2Payload.getToken();
            final String finalNetwork = network;
            final Permit2Payload finalPayload = p2Payload;

            return signer.getBalance(owner, token, finalNetwork)
                .thenApply(balanceStr -> {
                    BigInteger balance = new BigInteger(balanceStr);
                    if (balance.compareTo(required) < 0) {
                        return VerificationResult.invalid("insufficient_balance",
                            "Balance " + balance + " < required " + required);
                    }
                    return VerificationResult.valid(finalPayload, finalNetwork, owner);
                })
                .exceptionally(e -> VerificationResult.invalid("balance_check_failed",
                    "Failed to check balance: " + e.getMessage()));

        } catch (Exception e) {
            return CompletableFuture.completedFuture(
                VerificationResult.invalid("verification_error",
                    "Verification error: " + e.getMessage()));
        }
    }

    public VerificationResult verifySync(
            Map<String, Object> payload,
            Map<String, Object> requirements) {
        return verify(payload, requirements).join();
    }

    /**
     * Settles a payment by executing permitTransferFrom on-chain.
     *
     * @param payload Payment payload from the client
     * @param requirements Payment requirements from the server
     * @return CompletableFuture containing settlement result
     */
    public CompletableFuture<SettlementResult> settle(
            Map<String, Object> payload,
            Map<String, Object> requirements) {

        return verify(payload, requirements)
            .thenCompose(verificationResult -> {
                if (!verificationResult.isValid) {
                    return CompletableFuture.completedFuture(
                        SettlementResult.failed(verificationResult.invalidReason,
                            verificationResult.error));
                }

                Permit2Payload p2Payload = verificationResult.payload;
                String network = verificationResult.network;

                return signer.sendPermitTransferFrom(p2Payload, network)
                    .thenCompose(txHash ->
                        signer.confirmTransaction(txHash, network)
                            .thenApply(confirmed -> {
                                if (!confirmed) {
                                    return SettlementResult.pending(txHash,
                                        verificationResult.payer);
                                }
                                return SettlementResult.success(txHash,
                                    verificationResult.payer);
                            })
                    )
                    .exceptionally(e -> SettlementResult.failed("transaction_failed",
                        "Transaction failed: " + e.getMessage()));
            });
    }

    public SettlementResult settleSync(
            Map<String, Object> payload,
            Map<String, Object> requirements) {
        return settle(payload, requirements).join();
    }

    // ============================================================
    // Result Types
    // ============================================================

    /**
     * Result of payment verification.
     */
    public static class VerificationResult {

        public final boolean isValid;
        public final String invalidReason;
        public final String error;
        public final Permit2Payload payload;
        public final String network;
        public final String payer;

        private VerificationResult(boolean isValid, String invalidReason, String error,
                Permit2Payload payload, String network, String payer) {
            this.isValid = isValid;
            this.invalidReason = invalidReason;
            this.error = error;
            this.payload = payload;
            this.network = network;
            this.payer = payer;
        }

        public static VerificationResult valid(Permit2Payload payload, String network, String payer) {
            return new VerificationResult(true, null, null, payload, network, payer);
        }

        public static VerificationResult invalid(String invalidReason, String error) {
            return new VerificationResult(false, invalidReason, error, null, null, null);
        }
    }

    /**
     * Result of payment settlement.
     */
    public static class SettlementResult {

        public final boolean success;
        public final SettlementStatus status;
        public final String transaction;
        public final String payer;
        public final String errorReason;
        public final String error;

        private SettlementResult(boolean success, SettlementStatus status,
                String transaction, String payer, String errorReason, String error) {
            this.success = success;
            this.status = status;
            this.transaction = transaction;
            this.payer = payer;
            this.errorReason = errorReason;
            this.error = error;
        }

        public static SettlementResult success(String txHash, String payer) {
            return new SettlementResult(true, SettlementStatus.SUCCESS, txHash, payer, null, null);
        }

        public static SettlementResult pending(String txHash, String payer) {
            return new SettlementResult(false, SettlementStatus.PENDING, txHash, payer, null, null);
        }

        public static SettlementResult failed(String errorReason, String error) {
            return new SettlementResult(false, SettlementStatus.FAILED, null, null, errorReason, error);
        }
    }

    public enum SettlementStatus {
        SUCCESS,
        PENDING,
        FAILED
    }
}
