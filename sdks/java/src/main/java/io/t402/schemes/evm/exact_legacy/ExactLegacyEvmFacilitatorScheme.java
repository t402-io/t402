package io.t402.schemes.evm.exact_legacy;

import io.t402.schemes.evm.EvmConstants;

import java.math.BigInteger;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Facilitator scheme for EVM payment verification and settlement
 * using the approve + transferFrom pattern for legacy tokens.
 *
 * <p>Verifies EIP-712 signatures of LegacyTransferAuthorization messages and
 * settles payments by calling transferFrom on the token contract.</p>
 *
 * <h2>Configuration</h2>
 * <p>Supports a configurable {@code minAllowanceRatio} (default 1.0) to specify
 * the minimum fraction of payment amount that must be approved as allowance.</p>
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * FacilitatorLegacyEvmSigner signer = new MyLegacyFacilitator(web3j, credentials);
 * ExactLegacyEvmFacilitatorScheme scheme = new ExactLegacyEvmFacilitatorScheme(signer);
 *
 * // Verify a payment
 * VerificationResult result = scheme.verifySync(payload, requirements);
 * if (result.isValid) {
 *     // Payment is valid, proceed to settle
 *     SettlementResult settlement = scheme.settleSync(payload, requirements);
 *     System.out.println("Transaction hash: " + settlement.transaction);
 * }
 * }</pre>
 */
public class ExactLegacyEvmFacilitatorScheme {

    /** The scheme identifier. */
    public static final String SCHEME = "exact-legacy";

    /** CAIP family pattern for EVM networks. */
    public static final String CAIP_FAMILY = EvmConstants.CAIP_FAMILY;

    /** Default minimum allowance ratio (1.0 = full amount required). */
    public static final double DEFAULT_MIN_ALLOWANCE_RATIO = 1.0;

    private final FacilitatorLegacyEvmSigner signer;
    private final double minAllowanceRatio;

    /**
     * Creates a new ExactLegacyEvmFacilitatorScheme with the given signer and default config.
     *
     * @param signer Facilitator signer for verification and settlement
     * @throws IllegalArgumentException if signer is null
     */
    public ExactLegacyEvmFacilitatorScheme(FacilitatorLegacyEvmSigner signer) {
        this(signer, DEFAULT_MIN_ALLOWANCE_RATIO);
    }

    /**
     * Creates a new ExactLegacyEvmFacilitatorScheme with the given signer and config.
     *
     * @param signer Facilitator signer for verification and settlement
     * @param minAllowanceRatio Minimum allowance ratio (0.0 to 1.0)
     * @throws IllegalArgumentException if signer is null or ratio is invalid
     */
    public ExactLegacyEvmFacilitatorScheme(FacilitatorLegacyEvmSigner signer, double minAllowanceRatio) {
        if (signer == null) {
            throw new IllegalArgumentException("Signer cannot be null");
        }
        if (minAllowanceRatio < 0.0 || minAllowanceRatio > 1.0) {
            throw new IllegalArgumentException("minAllowanceRatio must be between 0.0 and 1.0");
        }
        this.signer = signer;
        this.minAllowanceRatio = minAllowanceRatio;
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
     * Gets the configured minimum allowance ratio.
     *
     * @return Minimum allowance ratio (0.0 to 1.0)
     */
    public double getMinAllowanceRatio() {
        return minAllowanceRatio;
    }

    /**
     * Verifies a payment payload against requirements.
     *
     * <p>Verification includes:
     * <ol>
     *   <li>Scheme and network validation</li>
     *   <li>Payload structure validation</li>
     *   <li>Spender is a facilitator address</li>
     *   <li>Amount sufficiency check</li>
     *   <li>Recipient address match</li>
     *   <li>Time window validation (validAfter/validBefore)</li>
     *   <li>EIP-712 signature recovery and validation</li>
     *   <li>Balance and allowance checks</li>
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

            // Parse the legacy payload
            ExactLegacyEvmPayload legacyPayload;
            try {
                legacyPayload = ExactLegacyEvmPayload.fromMap(innerPayload);
            } catch (Exception e) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("invalid_payload_structure",
                        "Failed to parse legacy payload: " + e.getMessage()));
            }

            LegacyEvmAuthorization auth = legacyPayload.getAuthorization();

            // Verify the spender is one of our addresses
            String authSpender = auth.getSpender();
            List<String> facilitatorAddresses = signer.getAddresses();
            boolean isValidSpender = false;
            for (String addr : facilitatorAddresses) {
                if (addr.equalsIgnoreCase(authSpender)) {
                    isValidSpender = true;
                    break;
                }
            }
            if (!isValidSpender) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("invalid_spender",
                        "Spender " + authSpender + " is not a facilitator address"));
            }

            // Validate amount
            String requiredAmount = (String) requirements.get("maxAmountRequired");
            if (requiredAmount == null) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("missing_amount",
                        "Missing maxAmountRequired in requirements"));
            }

            BigInteger required = new BigInteger(requiredAmount);
            BigInteger provided = new BigInteger(auth.getValue());
            if (provided.compareTo(required) < 0) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("amount_insufficient",
                        "Amount insufficient: provided " + provided + " < required " + required));
            }

            // Validate recipient
            String payTo = (String) requirements.get("payTo");
            if (payTo == null || !payTo.equalsIgnoreCase(auth.getTo())) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("recipient_mismatch",
                        "Recipient mismatch: expected " + payTo + ", got " + auth.getTo()));
            }

            // Validate time window
            long now = System.currentTimeMillis() / 1000;
            if (auth.getValidAfter() > now) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("not_yet_valid",
                        "Payment not yet valid (validAfter: " + auth.getValidAfter() + ")"));
            }
            if (auth.getValidBefore() < now) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("expired",
                        "Payment has expired (validBefore: " + auth.getValidBefore() + ")"));
            }

            // Recover signer and validate signature
            String signature = legacyPayload.getSignature();
            String finalNetwork = network;

            return signer.recoverLegacySigner(auth, signature, finalNetwork)
                .thenCompose(recoveredAddress -> {
                    if (recoveredAddress == null || recoveredAddress.isEmpty()) {
                        return CompletableFuture.completedFuture(
                            VerificationResult.invalid("invalid_signature",
                                "Could not recover signer from signature"));
                    }

                    // Verify that recovered address matches the "from" in authorization
                    if (!recoveredAddress.equalsIgnoreCase(auth.getFrom())) {
                        return CompletableFuture.completedFuture(
                            VerificationResult.invalid("signer_mismatch",
                                "Recovered signer " + recoveredAddress
                                    + " does not match authorization from " + auth.getFrom()));
                    }

                    // Check balance
                    String asset = (String) requirements.get("asset");
                    if (asset == null || asset.isEmpty()) {
                        asset = EvmConstants.getDefaultTokenAddress(finalNetwork);
                    }

                    String tokenAddress = asset;
                    return signer.getBalance(auth.getFrom(), tokenAddress, finalNetwork)
                        .thenCompose(balanceStr -> {
                            BigInteger balance = new BigInteger(balanceStr);
                            if (balance.compareTo(required) < 0) {
                                return CompletableFuture.completedFuture(
                                    VerificationResult.invalid("insufficient_balance",
                                        "Insufficient balance: " + balance + " < " + required));
                            }

                            // Check allowance
                            return signer.getAllowance(auth.getFrom(), authSpender, tokenAddress, finalNetwork)
                                .thenApply(allowanceStr -> {
                                    BigInteger allowance = new BigInteger(allowanceStr);
                                    BigInteger requiredAllowance = BigInteger.valueOf(
                                        (long) (required.longValue() * minAllowanceRatio));
                                    if (allowance.compareTo(requiredAllowance) < 0) {
                                        return VerificationResult.invalid("insufficient_allowance",
                                            "Insufficient allowance: " + allowance
                                                + " < required " + requiredAllowance);
                                    }

                                    return VerificationResult.valid(legacyPayload, finalNetwork, recoveredAddress);
                                });
                        });
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
     * Settles a payment by executing transferFrom on-chain.
     *
     * <p>First verifies the payment, then if valid, calls the token contract's
     * transferFrom function.</p>
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

                ExactLegacyEvmPayload legacyPayload = verificationResult.payload;
                LegacyEvmAuthorization auth = legacyPayload.getAuthorization();
                String network = verificationResult.network;

                return signer.sendTransferFrom(auth, network)
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
        public final ExactLegacyEvmPayload payload;

        /** The network identifier. */
        public final String network;

        /** The recovered payer address if valid. */
        public final String payer;

        private VerificationResult(boolean isValid, String invalidReason, String error,
                ExactLegacyEvmPayload payload, String network, String payer) {
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
         * @param payer The recovered payer address
         * @return Valid result
         */
        public static VerificationResult valid(ExactLegacyEvmPayload payload, String network, String payer) {
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

        /** The payer address. */
        public final String payer;

        /** Machine-readable error reason if failed. */
        public final String errorReason;

        /** Human-readable error message if failed. */
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

        /**
         * Creates a successful settlement result.
         *
         * @param txHash Transaction hash
         * @param payer Payer address
         * @return Success result
         */
        public static SettlementResult success(String txHash, String payer) {
            return new SettlementResult(true, SettlementStatus.SUCCESS, txHash, payer, null, null);
        }

        /**
         * Creates a pending settlement result.
         *
         * @param txHash Transaction hash
         * @param payer Payer address
         * @return Pending result
         */
        public static SettlementResult pending(String txHash, String payer) {
            return new SettlementResult(false, SettlementStatus.PENDING, txHash, payer, null, null);
        }

        /**
         * Creates a failed settlement result.
         *
         * @param errorReason Machine-readable error reason
         * @param error Human-readable error message
         * @return Failed result
         */
        public static SettlementResult failed(String errorReason, String error) {
            return new SettlementResult(false, SettlementStatus.FAILED, null, null, errorReason, error);
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
