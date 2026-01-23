package io.t402.schemes.evm.upto;

import io.t402.schemes.evm.EvmConstants;

import java.math.BigInteger;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Facilitator scheme for EVM payment verification and settlement
 * using EIP-2612 Permit (Up-To scheme).
 *
 * <p>Handles verification of EIP-712 Permit signatures and settlement
 * of EVM payments by calling permit() followed by transferFrom() on the
 * token contract. The Up-To scheme allows partial settlement where the
 * actual transfer amount can be less than the permitted amount.</p>
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * FacilitatorUptoEvmSigner signer = new MyUptoEvmFacilitatorSigner(web3j, credentials);
 * UptoEvmFacilitatorScheme scheme = new UptoEvmFacilitatorScheme(signer);
 *
 * // Verify a payment
 * VerificationResult result = scheme.verifySync(payload, requirements);
 * if (result.isValid) {
 *     // Settle with partial amount (up-to feature)
 *     UptoEvmSettlement settlement = UptoEvmSettlement.of("500000"); // Only charge 0.50 USDT
 *     SettlementResult settlementResult = scheme.settleSync(payload, requirements, settlement);
 *     System.out.println("Transaction hash: " + settlementResult.transaction);
 * }
 * }</pre>
 *
 * <h2>Key Differences from Exact Scheme</h2>
 * <ul>
 *   <li>Verifies permit signature (v, r, s) instead of a single hex signature</li>
 *   <li>Spender must match a facilitator address (not the recipient)</li>
 *   <li>Settlement is two steps: permit() + transferFrom()</li>
 *   <li>Supports partial settlement (settleAmount &lt;= permitted value)</li>
 *   <li>Uses deadline instead of validAfter/validBefore window</li>
 * </ul>
 */
public class UptoEvmFacilitatorScheme {

    /** The scheme identifier. */
    public static final String SCHEME = EvmConstants.SCHEME_UPTO;

    /** CAIP family pattern for EVM networks. */
    public static final String CAIP_FAMILY = EvmConstants.CAIP_FAMILY;

    private final FacilitatorUptoEvmSigner signer;

    /**
     * Creates a new UptoEvmFacilitatorScheme with the given signer.
     *
     * @param signer Facilitator signer for permit verification and settlement
     * @throws IllegalArgumentException if signer is null
     */
    public UptoEvmFacilitatorScheme(FacilitatorUptoEvmSigner signer) {
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
     * Verifies a payment payload against requirements.
     *
     * <p>Verification includes:
     * <ol>
     *   <li>Scheme and network validation</li>
     *   <li>Payload structure validation (EIP-2612 format)</li>
     *   <li>Amount sufficiency check (value &gt;= maxAmountRequired)</li>
     *   <li>Spender address validation (must be a facilitator address)</li>
     *   <li>Deadline validation (must be in the future)</li>
     *   <li>EIP-712 Permit signature recovery and owner validation</li>
     * </ol>
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
                    VerificationResult.invalid("unsupported_scheme",
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

            // Validate signature is present and is an object (not a string like EIP-3009)
            Object sigObj = innerPayload.get("signature");
            if (sigObj == null || !(sigObj instanceof Map)) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("invalid_payload_structure",
                        "Payload is not a valid EIP-2612 Permit structure: missing or invalid signature"));
            }

            // Validate authorization is present
            Object authObj = innerPayload.get("authorization");
            if (authObj == null || !(authObj instanceof Map)) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("invalid_payload_structure",
                        "Payload is not a valid EIP-2612 Permit structure: missing authorization"));
            }

            // Parse the payload
            UptoEIP2612Payload uptoPayload;
            try {
                uptoPayload = UptoEIP2612Payload.fromMap(innerPayload);
            } catch (Exception e) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("invalid_payload_structure",
                        "Failed to parse payload: " + e.getMessage()));
            }

            PermitAuthorization auth = uptoPayload.authorization;
            PermitSignature sig = uptoPayload.signature;

            // Validate signature components
            if (sig == null || sig.r == null || sig.s == null) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("invalid_payload_structure",
                        "Incomplete permit signature (missing v, r, or s)"));
            }

            // Validate authorization fields are present
            if (auth == null) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("invalid_payload_structure",
                        "Missing permit authorization"));
            }
            if (auth.owner == null || auth.owner.isEmpty()) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("missing_owner",
                        "Missing owner in permit authorization"));
            }
            if (auth.spender == null || auth.spender.isEmpty()) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("missing_spender",
                        "Missing spender in permit authorization"));
            }
            if (auth.value == null || auth.value.isEmpty()) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("missing_value",
                        "Missing value in permit authorization"));
            }
            if (auth.deadline == null || auth.deadline.isEmpty()) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("missing_deadline",
                        "Missing deadline in permit authorization"));
            }

            // Validate amount
            String requiredAmount = (String) requirements.get("maxAmountRequired");
            if (requiredAmount == null) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("missing_amount",
                        "Missing maxAmountRequired in requirements"));
            }

            BigInteger required = new BigInteger(requiredAmount);
            BigInteger provided = new BigInteger(auth.value);
            if (provided.compareTo(required) < 0) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("amount_insufficient",
                        "Amount insufficient: provided " + provided + " < required " + required));
            }

            // Validate spender is a facilitator address
            List<String> facilitatorAddresses = signer.getAddresses();
            boolean spenderValid = facilitatorAddresses.stream()
                .anyMatch(addr -> addr.equalsIgnoreCase(auth.spender));
            if (!spenderValid) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("spender_mismatch",
                        "Spender " + auth.spender + " is not a recognized facilitator address"));
            }

            // Validate deadline is in the future
            long now = System.currentTimeMillis() / 1000;
            long deadline;
            try {
                deadline = Long.parseLong(auth.deadline);
            } catch (NumberFormatException e) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("invalid_deadline",
                        "Invalid deadline format: " + auth.deadline));
            }
            if (now > deadline) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("expired",
                        "Permit has expired (deadline: " + deadline + ")"));
            }

            // Recover signer and validate
            String finalNetwork = network;

            return signer.recoverPermitSigner(auth, sig, finalNetwork)
                .thenApply(recoveredAddress -> {
                    if (recoveredAddress == null || recoveredAddress.isEmpty()) {
                        return VerificationResult.invalid("invalid_signature",
                            "Could not recover signer from permit signature");
                    }

                    // Verify that recovered address matches the "owner" in authorization
                    if (!recoveredAddress.equalsIgnoreCase(auth.owner)) {
                        return VerificationResult.invalid("signer_mismatch",
                            "Recovered signer " + recoveredAddress
                                + " does not match permit owner " + auth.owner);
                    }

                    return VerificationResult.valid(uptoPayload, finalNetwork, recoveredAddress);
                })
                .exceptionally(e -> VerificationResult.invalid("signature_verification_error",
                    "Signature verification failed: " + e.getMessage()));

        } catch (Exception e) {
            return CompletableFuture.completedFuture(
                VerificationResult.invalid("verification_error",
                    "Verification error: " + e.getMessage()));
        }
    }

    /**
     * Verifies a payment synchronously.
     *
     * @param payload Payment payload
     * @param requirements Payment requirements
     * @return Verification result
     */
    public VerificationResult verifySync(
            Map<String, Object> payload,
            Map<String, Object> requirements) {
        return verify(payload, requirements).join();
    }

    /**
     * Settles a payment by executing permit() + transferFrom() on-chain.
     *
     * <p>First verifies the payment, then if valid, executes the two-step
     * settlement process. The settle amount defaults to the full maxAmountRequired
     * from the requirements.</p>
     *
     * @param payload Payment payload from the client
     * @param requirements Payment requirements from the server
     * @return CompletableFuture containing settlement result
     */
    public CompletableFuture<SettlementResult> settle(
            Map<String, Object> payload,
            Map<String, Object> requirements) {

        String settleAmount = (String) requirements.get("maxAmountRequired");
        return settle(payload, requirements, UptoEvmSettlement.of(settleAmount));
    }

    /**
     * Settles a payment with a specified settlement amount (partial settlement).
     *
     * <p>First verifies the payment, then if valid, calls permit() followed by
     * transferFrom() with the specified settle amount. The settle amount must be
     * less than or equal to the permitted value.</p>
     *
     * @param payload Payment payload from the client
     * @param requirements Payment requirements from the server
     * @param settlement Settlement parameters including the amount to transfer
     * @return CompletableFuture containing settlement result
     */
    public CompletableFuture<SettlementResult> settle(
            Map<String, Object> payload,
            Map<String, Object> requirements,
            UptoEvmSettlement settlement) {

        return verify(payload, requirements)
            .thenCompose(verificationResult -> {
                if (!verificationResult.isValid) {
                    return CompletableFuture.completedFuture(
                        SettlementResult.failed(verificationResult.invalidReason,
                            verificationResult.error));
                }

                UptoEIP2612Payload uptoPayload = verificationResult.payload;
                PermitAuthorization auth = uptoPayload.authorization;
                PermitSignature sig = uptoPayload.signature;
                String network = verificationResult.network;

                // Determine the settle amount
                final String finalSettleAmount;
                if (settlement.settleAmount == null || settlement.settleAmount.isEmpty()) {
                    finalSettleAmount = auth.value; // Default to full permitted amount
                } else {
                    finalSettleAmount = settlement.settleAmount;
                }

                // Validate settle amount <= permitted value
                BigInteger settleAmt = new BigInteger(finalSettleAmount);
                BigInteger permitted = new BigInteger(auth.value);
                if (settleAmt.compareTo(permitted) > 0) {
                    return CompletableFuture.completedFuture(
                        SettlementResult.failed("settle_amount_exceeds_permit",
                            "Settle amount " + settleAmt + " exceeds permitted value " + permitted));
                }

                // Validate settle amount > 0
                if (settleAmt.compareTo(BigInteger.ZERO) <= 0) {
                    return CompletableFuture.completedFuture(
                        SettlementResult.failed("invalid_settle_amount",
                            "Settle amount must be greater than zero"));
                }

                // Get payTo from requirements
                String payTo = (String) requirements.get("payTo");
                if (payTo == null || payTo.isEmpty()) {
                    return CompletableFuture.completedFuture(
                        SettlementResult.failed("missing_pay_to",
                            "Missing payTo in requirements"));
                }

                return signer.sendPermitAndTransferFrom(auth, sig, payTo, finalSettleAmount, network)
                    .thenCompose(txHash ->
                        signer.confirmTransaction(txHash, network)
                            .thenApply(confirmed -> {
                                if (!confirmed) {
                                    return SettlementResult.pending(txHash,
                                        verificationResult.payer, finalSettleAmount);
                                }
                                return SettlementResult.success(txHash,
                                    verificationResult.payer, finalSettleAmount);
                            })
                    )
                    .exceptionally(e -> SettlementResult.failed("transaction_failed",
                        "Transaction failed: " + e.getMessage()));
            });
    }

    /**
     * Settles a payment synchronously.
     *
     * @param payload Payment payload
     * @param requirements Payment requirements
     * @return Settlement result
     */
    public SettlementResult settleSync(
            Map<String, Object> payload,
            Map<String, Object> requirements) {
        return settle(payload, requirements).join();
    }

    /**
     * Settles a payment synchronously with specified settlement parameters.
     *
     * @param payload Payment payload
     * @param requirements Payment requirements
     * @param settlement Settlement parameters
     * @return Settlement result
     */
    public SettlementResult settleSync(
            Map<String, Object> payload,
            Map<String, Object> requirements,
            UptoEvmSettlement settlement) {
        return settle(payload, requirements, settlement).join();
    }

    // ============================================================
    // Result Types
    // ============================================================

    /**
     * Result of payment verification.
     */
    public static class VerificationResult {

        /** Whether the payment is valid. */
        public final boolean isValid;

        /** Machine-readable reason code if invalid. */
        public final String invalidReason;

        /** Human-readable error message if invalid. */
        public final String error;

        /** The verified payload if valid. */
        public final UptoEIP2612Payload payload;

        /** The network identifier. */
        public final String network;

        /** The recovered payer (owner) address if valid. */
        public final String payer;

        private VerificationResult(boolean isValid, String invalidReason, String error,
                UptoEIP2612Payload payload, String network, String payer) {
            this.isValid = isValid;
            this.invalidReason = invalidReason;
            this.error = error;
            this.payload = payload;
            this.network = network;
            this.payer = payer;
        }

        /**
         * Creates a valid verification result.
         *
         * @param payload The verified payload
         * @param network The network identifier
         * @param payer The recovered payer (owner) address
         * @return Valid result
         */
        public static VerificationResult valid(UptoEIP2612Payload payload, String network, String payer) {
            return new VerificationResult(true, null, null, payload, network, payer);
        }

        /**
         * Creates an invalid verification result.
         *
         * @param invalidReason Machine-readable reason code
         * @param error Human-readable error message
         * @return Invalid result
         */
        public static VerificationResult invalid(String invalidReason, String error) {
            return new VerificationResult(false, invalidReason, error, null, null, null);
        }
    }

    /**
     * Result of payment settlement.
     */
    public static class SettlementResult {

        /** Whether the settlement was successful. */
        public final boolean success;

        /** Settlement status. */
        public final SettlementStatus status;

        /** Transaction hash if submitted. */
        public final String transaction;

        /** The payer (owner) address. */
        public final String payer;

        /** The actual amount settled. */
        public final String settledAmount;

        /** Machine-readable error reason if failed. */
        public final String errorReason;

        /** Human-readable error message if failed. */
        public final String error;

        private SettlementResult(boolean success, SettlementStatus status,
                String transaction, String payer, String settledAmount,
                String errorReason, String error) {
            this.success = success;
            this.status = status;
            this.transaction = transaction;
            this.payer = payer;
            this.settledAmount = settledAmount;
            this.errorReason = errorReason;
            this.error = error;
        }

        /**
         * Creates a successful settlement result.
         *
         * @param txHash Transaction hash
         * @param payer Payer address
         * @param settledAmount Amount that was settled
         * @return Success result
         */
        public static SettlementResult success(String txHash, String payer, String settledAmount) {
            return new SettlementResult(true, SettlementStatus.SUCCESS,
                txHash, payer, settledAmount, null, null);
        }

        /**
         * Creates a pending settlement result.
         *
         * @param txHash Transaction hash
         * @param payer Payer address
         * @param settledAmount Amount being settled
         * @return Pending result
         */
        public static SettlementResult pending(String txHash, String payer, String settledAmount) {
            return new SettlementResult(false, SettlementStatus.PENDING,
                txHash, payer, settledAmount, null, null);
        }

        /**
         * Creates a failed settlement result.
         *
         * @param errorReason Machine-readable error reason
         * @param error Human-readable error message
         * @return Failed result
         */
        public static SettlementResult failed(String errorReason, String error) {
            return new SettlementResult(false, SettlementStatus.FAILED,
                null, null, null, errorReason, error);
        }
    }

    /**
     * Settlement status enum.
     */
    public enum SettlementStatus {
        /** Transaction confirmed successfully on-chain. */
        SUCCESS,
        /** Transaction sent but not yet confirmed. */
        PENDING,
        /** Transaction or verification failed. */
        FAILED
    }
}
