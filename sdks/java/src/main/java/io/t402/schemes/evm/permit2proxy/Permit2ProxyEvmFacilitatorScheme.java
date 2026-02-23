package io.t402.schemes.evm.permit2proxy;

import io.t402.schemes.evm.EvmConstants;
import io.t402.schemes.evm.permit2.Permit2Constants;

import java.math.BigInteger;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Facilitator scheme for Permit2 Proxy EVM payment verification and settlement.
 *
 * <p>Handles verification of Permit2 Proxy payment payloads and settlement
 * by calling settle() on the T402 Permit2 proxy contracts.</p>
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * Permit2ProxyFacilitatorSigner signer = new MyProxyFacilitatorSigner(web3j, credentials);
 * Permit2ProxyEvmFacilitatorScheme scheme = new Permit2ProxyEvmFacilitatorScheme(signer);
 *
 * VerificationResult result = scheme.verifySync(payload, requirements);
 * if (result.isValid) {
 *     SettlementResult settlement = scheme.settleSync(payload, requirements);
 * }
 * }</pre>
 */
public class Permit2ProxyEvmFacilitatorScheme {

    public static final String SCHEME = Permit2ProxyConstants.SCHEME_PERMIT2_PROXY;
    public static final String CAIP_FAMILY = Permit2ProxyConstants.CAIP_FAMILY;

    private final Permit2ProxyFacilitatorSigner signer;

    /**
     * Creates a new Permit2ProxyEvmFacilitatorScheme with the given signer.
     *
     * @param signer Facilitator signer for on-chain operations
     * @throws IllegalArgumentException if signer is null
     */
    public Permit2ProxyEvmFacilitatorScheme(Permit2ProxyFacilitatorSigner signer) {
        if (signer == null) {
            throw new IllegalArgumentException("Signer cannot be null");
        }
        this.signer = signer;
    }

    public List<String> getAddresses() {
        return signer.getAddresses();
    }

    public List<String> getSigners(String network) {
        return signer.getAddresses();
    }

    /**
     * Gets Permit2 Proxy-specific extra data.
     *
     * @return Map with permit2Address, exactProxyAddress, uptoProxyAddress
     */
    public Map<String, Object> getExtra() {
        Map<String, Object> extra = new HashMap<>();
        extra.put("permit2Address", Permit2Constants.PERMIT2_ADDRESS);
        extra.put("exactProxyAddress", Permit2ProxyConstants.EXACT_PROXY_ADDRESS);
        extra.put("uptoProxyAddress", Permit2ProxyConstants.UPTO_PROXY_ADDRESS);
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

            // Parse the Permit2 Proxy payload
            Permit2ProxyPayload proxyPayload;
            try {
                proxyPayload = Permit2ProxyPayload.fromMap(innerPayload);
            } catch (Exception e) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("invalid_payload_structure",
                        "Failed to parse payload: " + e.getMessage()));
            }

            // Validate required fields
            if (proxyPayload.getOwner() == null || proxyPayload.getOwner().isEmpty()
                    || proxyPayload.getToken() == null || proxyPayload.getToken().isEmpty()) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("invalid_payload_structure",
                        "Missing owner or token in payload"));
            }

            // Validate witness fields
            if (proxyPayload.getWitnessTo() == null || proxyPayload.getWitnessTo().isEmpty()
                    || proxyPayload.getWitnessFacilitator() == null
                    || proxyPayload.getWitnessFacilitator().isEmpty()) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("invalid_witness_structure",
                        "Missing witness to or facilitator in payload"));
            }

            // Verify token matches
            String requiredAsset = (String) requirements.get("asset");
            if (requiredAsset != null && !requiredAsset.equalsIgnoreCase(proxyPayload.getToken())) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("token_mismatch",
                        "Token mismatch: expected " + requiredAsset
                            + ", got " + proxyPayload.getToken()));
            }

            // Verify witness destination matches requirements payTo
            String payTo = (String) requirements.get("payTo");
            if (payTo == null || !payTo.equalsIgnoreCase(proxyPayload.getWitnessTo())) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("recipient_mismatch",
                        "Recipient mismatch: expected " + payTo
                            + ", got " + proxyPayload.getWitnessTo()));
            }

            // Verify the facilitator in the witness is one of our addresses
            boolean facilitatorMatch = false;
            for (String addr : signer.getAddresses()) {
                if (addr.equalsIgnoreCase(proxyPayload.getWitnessFacilitator())) {
                    facilitatorMatch = true;
                    break;
                }
            }
            if (!facilitatorMatch) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("unauthorized_facilitator",
                        "Facilitator " + proxyPayload.getWitnessFacilitator()
                            + " is not one of our addresses"));
            }

            // Verify permitted amount
            String requiredAmount = (String) requirements.get("maxAmountRequired");
            if (requiredAmount == null) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("missing_amount",
                        "Missing maxAmountRequired in requirements"));
            }

            BigInteger required = new BigInteger(requiredAmount);
            BigInteger permittedAmount = new BigInteger(proxyPayload.getAmount());
            if (permittedAmount.compareTo(required) < 0) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("insufficient_permitted_amount",
                        "Permitted amount " + permittedAmount
                            + " < required " + required));
            }

            // Verify validAfter is not in the future
            if (proxyPayload.getWitnessValidAfter() != null
                    && !proxyPayload.getWitnessValidAfter().isEmpty()) {
                BigInteger validAfterVal = new BigInteger(proxyPayload.getWitnessValidAfter());
                BigInteger now = BigInteger.valueOf(System.currentTimeMillis() / 1000);
                if (validAfterVal.compareTo(now) > 0) {
                    return CompletableFuture.completedFuture(
                        VerificationResult.invalid("payment_too_early",
                            "Payment validAfter " + validAfterVal + " is in the future"));
                }
            }

            // Check balance
            final String owner = proxyPayload.getOwner();
            final String token = proxyPayload.getToken();
            final String finalNetwork = network;
            final Permit2ProxyPayload finalPayload = proxyPayload;

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
     * Settles a payment by calling settle() on the proxy contract.
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
                if (!verificationResult.isValid) {
                    return CompletableFuture.completedFuture(
                        SettlementResult.failed(verificationResult.invalidReason,
                            verificationResult.error));
                }

                Permit2ProxyPayload proxyPayload = verificationResult.payload;
                String network = verificationResult.network;

                // Determine proxy address and whether to use upto
                String requiredAmount = (String) requirements.get("maxAmountRequired");
                BigInteger required = new BigInteger(requiredAmount);
                BigInteger permitted = new BigInteger(proxyPayload.getAmount());

                String reqScheme = (String) requirements.get("scheme");
                boolean isUpto = "upto".equals(reqScheme) || permitted.compareTo(required) > 0;

                CompletableFuture<String> txFuture;
                if (isUpto) {
                    String uptoProxy = Permit2ProxyConstants.UPTO_PROXY_ADDRESS;
                    Object extraObj = requirements.get("extra");
                    if (extraObj instanceof Map) {
                        Map<String, Object> extra = (Map<String, Object>) extraObj;
                        Object addr = extra.get("uptoProxyAddress");
                        if (addr instanceof String && !((String) addr).isEmpty()) {
                            uptoProxy = (String) addr;
                        }
                    }
                    txFuture = signer.sendSettleUpto(proxyPayload, requiredAmount, uptoProxy, network);
                } else {
                    String exactProxy = Permit2ProxyConstants.EXACT_PROXY_ADDRESS;
                    Object extraObj = requirements.get("extra");
                    if (extraObj instanceof Map) {
                        Map<String, Object> extra = (Map<String, Object>) extraObj;
                        Object addr = extra.get("exactProxyAddress");
                        if (addr instanceof String && !((String) addr).isEmpty()) {
                            exactProxy = (String) addr;
                        }
                    }
                    txFuture = signer.sendSettle(proxyPayload, exactProxy, network);
                }

                return txFuture
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

    public static class VerificationResult {

        public final boolean isValid;
        public final String invalidReason;
        public final String error;
        public final Permit2ProxyPayload payload;
        public final String network;
        public final String payer;

        private VerificationResult(boolean isValid, String invalidReason, String error,
                Permit2ProxyPayload payload, String network, String payer) {
            this.isValid = isValid;
            this.invalidReason = invalidReason;
            this.error = error;
            this.payload = payload;
            this.network = network;
            this.payer = payer;
        }

        public static VerificationResult valid(Permit2ProxyPayload payload, String network, String payer) {
            return new VerificationResult(true, null, null, payload, network, payer);
        }

        public static VerificationResult invalid(String invalidReason, String error) {
            return new VerificationResult(false, invalidReason, error, null, null, null);
        }
    }

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
