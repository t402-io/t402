package io.t402.schemes.evm.erc7710;

import io.t402.schemes.evm.EvmConstants;

import java.math.BigInteger;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Facilitator scheme for ERC-7710 delegation-based EVM payments.
 *
 * <p>Enables payments from smart contract accounts (ERC-4337, ERC-7579) via
 * delegation. The facilitator calls {@code DelegationManager.redeemDelegations()}
 * to execute token transfers on behalf of the delegator.</p>
 *
 * <p>Verification is performed entirely through simulation ({@code eth_call}).
 * The permissionContext is opaque to the facilitator but verifiable by
 * simulating the intended action.</p>
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * ERC7710FacilitatorSigner signer = new MyERC7710Signer(web3j, credentials);
 * ERC7710EvmFacilitatorScheme scheme = new ERC7710EvmFacilitatorScheme(signer);
 *
 * // Verify a delegation payment
 * VerificationResult result = scheme.verifySync(payload, requirements);
 * if (result.isValid) {
 *     SettlementResult settlement = scheme.settleSync(payload, requirements);
 *     System.out.println("Transaction hash: " + settlement.transaction);
 * }
 * }</pre>
 */
public class ERC7710EvmFacilitatorScheme {

    /** The scheme identifier. */
    public static final String SCHEME = EvmConstants.SCHEME_EXACT;

    /** CAIP family pattern for EVM networks. */
    public static final String CAIP_FAMILY = EvmConstants.CAIP_FAMILY;

    /** redeemDelegations ABI for the DelegationManager contract. */
    static final String REDEEM_DELEGATIONS_ABI = "[{\"inputs\":[" +
            "{\"name\":\"_permissionContexts\",\"type\":\"bytes[]\"}," +
            "{\"name\":\"_modes\",\"type\":\"bytes32[]\"}," +
            "{\"name\":\"_executionCallDatas\",\"type\":\"bytes[]\"}" +
            "],\"name\":\"redeemDelegations\",\"outputs\":[]," +
            "\"stateMutability\":\"nonpayable\",\"type\":\"function\"}]";

    private final ERC7710FacilitatorSigner signer;

    /**
     * Creates a new ERC7710EvmFacilitatorScheme with the given signer.
     *
     * @param signer Facilitator signer for simulation and on-chain operations
     * @throws IllegalArgumentException if signer is null
     */
    public ERC7710EvmFacilitatorScheme(ERC7710FacilitatorSigner signer) {
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
     * Verifies an ERC-7710 delegation payment by simulating the redeemDelegations call.
     *
     * <p>Verification steps:
     * <ol>
     *   <li>Scheme and network validation</li>
     *   <li>ERC-7710 payload parsing (delegationManager, permissionContext, delegator)</li>
     *   <li>Transfer method validation (must be erc7710 if specified)</li>
     *   <li>ERC-7579 execution encoding (ERC-20 transfer)</li>
     *   <li>Simulation of redeemDelegations via eth_call</li>
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

            // Parse the ERC-7710 payload
            ERC7710Payload erc7710Payload;
            try {
                erc7710Payload = ERC7710Payload.fromMap(innerPayload);
            } catch (Exception e) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("invalid_erc7710_payload",
                        "Failed to parse ERC-7710 payload: " + e.getMessage()));
            }

            // Verify transfer method is erc7710 if specified
            Map<String, Object> extra = (Map<String, Object>) requirements.get("extra");
            if (extra != null) {
                String transferMethod = (String) extra.get("assetTransferMethod");
                if (transferMethod != null
                        && !EvmConstants.TRANSFER_METHOD_ERC7710.equals(transferMethod)) {
                    return CompletableFuture.completedFuture(
                        VerificationResult.invalid("invalid_transfer_method",
                            "Expected erc7710 transfer method, got: " + transferMethod));
                }
            }

            // Get required fields from requirements
            String asset = (String) requirements.get("asset");
            String payTo = (String) requirements.get("payTo");
            String amountStr = (String) requirements.get("maxAmountRequired");

            if (asset == null || asset.isEmpty()) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("missing_asset",
                        "Missing asset in requirements"));
            }
            if (payTo == null || payTo.isEmpty()) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("missing_pay_to",
                        "Missing payTo in requirements"));
            }
            if (amountStr == null || amountStr.isEmpty()) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("missing_amount",
                        "Missing maxAmountRequired in requirements"));
            }

            BigInteger amount = new BigInteger(amountStr);

            // Encode ERC-20 transfer in ERC-7579 single execution format
            byte[] executionCallData = ERC7579ExecutionEncoder.encodeERC20Transfer(
                    asset, payTo, amount);

            // Decode permission context
            byte[] permissionContextBytes = ERC7579ExecutionEncoder.hexToBytes(
                    erc7710Payload.getPermissionContext());

            // Simulate redeemDelegations via eth_call
            String finalNetwork = network;
            ERC7710Payload finalPayload = erc7710Payload;

            return signer.simulateContract(
                    erc7710Payload.getDelegationManager(),
                    REDEEM_DELEGATIONS_ABI,
                    "redeemDelegations",
                    new byte[][]{permissionContextBytes},          // bytes[] _permissionContexts
                    new byte[][]{ERC7579ExecutionEncoder.SINGLE_CALL_MODE}, // bytes32[] _modes
                    new byte[][]{executionCallData}                // bytes[] _executionCallDatas
                )
                .thenApply(result ->
                    VerificationResult.valid(finalPayload, finalNetwork,
                        finalPayload.getDelegator()))
                .exceptionally(e ->
                    VerificationResult.invalid("delegation_simulation_failed",
                        "redeemDelegations simulation failed: " + e.getMessage()));

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
     * Settles an ERC-7710 delegation payment by calling redeemDelegations on-chain.
     *
     * <p>First verifies the payment via simulation, then if valid, calls
     * {@code DelegationManager.redeemDelegations()} to execute the transfer.</p>
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

                ERC7710Payload erc7710Payload = verificationResult.payload;
                String network = verificationResult.network;

                // Re-encode for settlement
                String asset = (String) requirements.get("asset");
                String payTo = (String) requirements.get("payTo");
                String amountStr = (String) requirements.get("maxAmountRequired");
                BigInteger amount = new BigInteger(amountStr);

                byte[] executionCallData = ERC7579ExecutionEncoder.encodeERC20Transfer(
                        asset, payTo, amount);
                byte[] permissionContextBytes = ERC7579ExecutionEncoder.hexToBytes(
                        erc7710Payload.getPermissionContext());

                // Execute redeemDelegations on-chain
                return signer.writeContract(
                        erc7710Payload.getDelegationManager(),
                        REDEEM_DELEGATIONS_ABI,
                        "redeemDelegations",
                        new byte[][]{permissionContextBytes},
                        new byte[][]{ERC7579ExecutionEncoder.SINGLE_CALL_MODE},
                        new byte[][]{executionCallData}
                    )
                    .thenCompose(txHash ->
                        signer.waitForTransactionReceipt(txHash)
                            .thenApply(receipt -> {
                                if (!receipt.success) {
                                    return SettlementResult.failed("transaction_reverted",
                                        "Transaction reverted: " + txHash);
                                }
                                return SettlementResult.success(txHash,
                                    verificationResult.payer);
                            })
                    )
                    .exceptionally(e -> SettlementResult.failed("delegation_execution_failed",
                        "redeemDelegations call failed: " + e.getMessage()));
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

        /** The verified ERC-7710 payload if valid. */
        public final ERC7710Payload payload;

        /** The network identifier. */
        public final String network;

        /** The recovered payer (delegator) address if valid. */
        public final String payer;

        private VerificationResult(boolean isValid, String invalidReason, String error,
                ERC7710Payload payload, String network, String payer) {
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
         * @param payload The verified ERC-7710 payload
         * @param network The network identifier
         * @param payer The delegator address
         * @return Valid result
         */
        public static VerificationResult valid(ERC7710Payload payload, String network, String payer) {
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

        /** The payer (delegator) address. */
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
         * @param payer Payer (delegator) address
         * @return Success result
         */
        public static SettlementResult success(String txHash, String payer) {
            return new SettlementResult(true, SettlementStatus.SUCCESS, txHash, payer, null, null);
        }

        /**
         * Creates a pending settlement result.
         *
         * @param txHash Transaction hash
         * @param payer Payer (delegator) address
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
