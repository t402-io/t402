package io.t402.schemes.tron.exact;

import io.t402.schemes.tron.ExactTronPayload;
import io.t402.schemes.tron.FacilitatorTronSigner;
import io.t402.schemes.tron.TronAuthorization;
import io.t402.schemes.tron.TronConstants;

import java.math.BigInteger;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Facilitator scheme for TRON payment verification and settlement.
 * <p>
 * Handles verification of payment signatures and settlement of TRON
 * payments for the exact payment scheme.
 * </p>
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * FacilitatorTronSigner signer = new MyTronFacilitatorSigner(privateKey, rpcClient);
 * ExactTronFacilitatorScheme scheme = new ExactTronFacilitatorScheme(signer);
 *
 * // Verify a payment
 * VerificationResult result = scheme.verifySync(payload, requirements);
 * if (result.valid) {
 *     // Payment is valid, proceed to settle
 *     SettlementResult settlement = scheme.settleSync(payload, requirements);
 *     System.out.println("Transaction hash: " + settlement.transaction);
 * }
 * }</pre>
 */
public class ExactTronFacilitatorScheme {

    /** The scheme identifier. */
    public static final String SCHEME = TronConstants.SCHEME_EXACT;

    /** CAIP family pattern for TRON networks. */
    public static final String CAIP_FAMILY = TronConstants.CAIP_FAMILY;

    private final FacilitatorTronSigner signer;

    /**
     * Creates a new ExactTronFacilitatorScheme with the given signer.
     *
     * @param signer Facilitator signer for verification and settlement
     * @throws IllegalArgumentException if signer is null
     */
    public ExactTronFacilitatorScheme(FacilitatorTronSigner signer) {
        if (signer == null) {
            throw new IllegalArgumentException("Signer cannot be null");
        }
        this.signer = signer;
    }

    /**
     * Gets the facilitator wallet addresses.
     *
     * @return List of TRON addresses
     */
    public List<String> getAddresses() {
        return signer.getAddresses();
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
            // Extract payload data
            Map<String, Object> innerPayload = (Map<String, Object>) payload.get("payload");
            if (innerPayload == null) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("Missing payload")
                );
            }

            String network = (String) payload.get("network");
            if (network == null) {
                network = (String) requirements.get("network");
            }
            network = TronConstants.normalizeNetwork(network);

            // Parse the payload
            ExactTronPayload exactPayload = ExactTronPayload.fromMap(innerPayload);
            TronAuthorization auth = exactPayload.getAuthorization();

            // Validate amount
            String requiredAmount = (String) requirements.get("maxAmountRequired");
            if (requiredAmount == null) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("Missing maxAmountRequired in requirements")
                );
            }

            BigInteger required = new BigInteger(requiredAmount);
            BigInteger provided = new BigInteger(auth.getAmount());
            if (provided.compareTo(required) < 0) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("Amount too low: " + provided + " < " + required)
                );
            }

            // Validate recipient
            String payTo = (String) requirements.get("payTo");
            if (payTo == null || !payTo.equals(auth.getTo())) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("Invalid recipient: expected " + payTo + ", got " + auth.getTo())
                );
            }

            // Validate time window
            long now = System.currentTimeMillis() / 1000;
            if (now < auth.getValidAfter()) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("Payment not yet valid")
                );
            }
            if (now > auth.getValidBefore()) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("Payment has expired")
                );
            }

            // Verify signature
            String signature = exactPayload.getSignature();
            String finalNetwork = network;

            return signer.verifySignature(auth, signature, finalNetwork)
                .thenApply(valid -> {
                    if (!valid) {
                        return VerificationResult.invalid("Invalid signature");
                    }
                    return VerificationResult.valid(exactPayload, finalNetwork);
                })
                .exceptionally(e -> VerificationResult.invalid("Signature verification error: " + e.getMessage()));

        } catch (Exception e) {
            return CompletableFuture.completedFuture(
                VerificationResult.invalid("Verification error: " + e.getMessage())
            );
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
     * Settles a payment by executing the transfer.
     *
     * @param payload Payment payload from the client
     * @param requirements Payment requirements from the server
     * @return CompletableFuture containing settlement result
     */
    @SuppressWarnings("unchecked")
    public CompletableFuture<SettlementResult> settle(
            Map<String, Object> payload,
            Map<String, Object> requirements) {

        return verify(payload, requirements)
            .thenCompose(verificationResult -> {
                if (!verificationResult.valid) {
                    return CompletableFuture.completedFuture(
                        SettlementResult.failed(verificationResult.error)
                    );
                }

                ExactTronPayload exactPayload = verificationResult.payload;
                TronAuthorization auth = exactPayload.getAuthorization();
                String signature = exactPayload.getSignature();
                String network = verificationResult.network;

                return signer.sendTransaction(auth, signature, network)
                    .thenCompose(txHash -> {
                        // Optionally confirm the transaction
                        return signer.confirmTransaction(txHash, network)
                            .thenApply(confirmed -> {
                                if (!confirmed) {
                                    return SettlementResult.pending(txHash);
                                }
                                return SettlementResult.success(txHash);
                            });
                    })
                    .exceptionally(e -> SettlementResult.failed("Transaction failed: " + e.getMessage()));
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
     * Result of payment verification.
     */
    public static class VerificationResult {
        /** Whether the payment is valid. */
        public final boolean valid;

        /** Error message if invalid. */
        public final String error;

        /** The verified payload if valid. */
        public final ExactTronPayload payload;

        /** The network identifier. */
        public final String network;

        private VerificationResult(boolean valid, String error, ExactTronPayload payload, String network) {
            this.valid = valid;
            this.error = error;
            this.payload = payload;
            this.network = network;
        }

        /**
         * Creates a valid verification result.
         *
         * @param payload The verified payload
         * @param network The network identifier
         * @return Valid result
         */
        public static VerificationResult valid(ExactTronPayload payload, String network) {
            return new VerificationResult(true, null, payload, network);
        }

        /**
         * Creates an invalid verification result.
         *
         * @param error Error message
         * @return Invalid result
         */
        public static VerificationResult invalid(String error) {
            return new VerificationResult(false, error, null, null);
        }
    }

    /**
     * Result of payment settlement.
     */
    public static class SettlementResult {
        /** Status of the settlement. */
        public final SettlementStatus status;

        /** Transaction hash if successful or pending. */
        public final String transaction;

        /** Error message if failed. */
        public final String error;

        private SettlementResult(SettlementStatus status, String transaction, String error) {
            this.status = status;
            this.transaction = transaction;
            this.error = error;
        }

        /**
         * Creates a successful settlement result.
         *
         * @param txHash Transaction hash
         * @return Success result
         */
        public static SettlementResult success(String txHash) {
            return new SettlementResult(SettlementStatus.SUCCESS, txHash, null);
        }

        /**
         * Creates a pending settlement result.
         *
         * @param txHash Transaction hash
         * @return Pending result
         */
        public static SettlementResult pending(String txHash) {
            return new SettlementResult(SettlementStatus.PENDING, txHash, null);
        }

        /**
         * Creates a failed settlement result.
         *
         * @param error Error message
         * @return Failed result
         */
        public static SettlementResult failed(String error) {
            return new SettlementResult(SettlementStatus.FAILED, null, error);
        }
    }

    /**
     * Settlement status enum.
     */
    public enum SettlementStatus {
        /** Transaction confirmed successfully. */
        SUCCESS,
        /** Transaction sent but not yet confirmed. */
        PENDING,
        /** Transaction failed. */
        FAILED
    }
}
