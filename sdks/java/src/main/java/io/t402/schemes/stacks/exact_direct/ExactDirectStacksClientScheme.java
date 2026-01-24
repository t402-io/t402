package io.t402.schemes.stacks.exact_direct;

import io.t402.schemes.stacks.ClientStacksSigner;
import io.t402.schemes.stacks.ExactDirectPayload;
import io.t402.schemes.stacks.StacksConstants;

import java.math.BigInteger;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Client scheme for Stacks exact-direct payments using SIP-010 token transfers.
 *
 * <p>In the exact-direct scheme, the client directly executes the SIP-010 token
 * transfer on the Stacks blockchain and provides the transaction ID as proof
 * of payment.
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * ClientStacksSigner signer = new MyStacksSigner(privateKey);
 * ExactDirectStacksClientScheme scheme = new ExactDirectStacksClientScheme(signer);
 *
 * Map<String, Object> requirements = Map.of(
 *     "scheme", "exact-direct",
 *     "network", "stacks:1",
 *     "payTo", "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
 *     "maxAmountRequired", "1000000"
 * );
 *
 * Map<String, Object> payload = scheme.createPaymentPayloadSync(requirements);
 * }</pre>
 */
public class ExactDirectStacksClientScheme {

    /** The scheme identifier. */
    public static final String SCHEME = StacksConstants.SCHEME_EXACT_DIRECT;

    /** CAIP family pattern for Stacks networks. */
    public static final String CAIP_FAMILY = StacksConstants.CAIP_FAMILY;

    private final ClientStacksSigner signer;

    /**
     * Creates a new ExactDirectStacksClientScheme with the given signer.
     *
     * @param signer Client signer for token transfers
     * @throws IllegalArgumentException if signer is null
     */
    public ExactDirectStacksClientScheme(ClientStacksSigner signer) {
        if (signer == null) {
            throw new IllegalArgumentException("Signer cannot be null");
        }
        this.signer = signer;
    }

    /**
     * Gets the signer's Stacks principal address.
     *
     * @return Principal address
     */
    public String getAddress() {
        return signer.getAddress();
    }

    /**
     * Creates a payment payload by executing a SIP-010 token transfer on-chain.
     *
     * <p>This method:
     * <ol>
     *   <li>Validates the payment requirements</li>
     *   <li>Resolves the contract address from requirements</li>
     *   <li>Executes the SIP-010 transfer via the signer</li>
     *   <li>Returns a payload containing the transaction ID as proof</li>
     * </ol>
     *
     * @param requirements Payment requirements map
     * @return CompletableFuture containing payment payload map
     * @throws IllegalArgumentException if requirements are invalid
     */
    @SuppressWarnings("unchecked")
    public CompletableFuture<Map<String, Object>> createPaymentPayload(Map<String, Object> requirements) {
        // Extract fields
        String network = (String) requirements.getOrDefault("network", StacksConstants.MAINNET_CAIP2);
        int t402Version = ((Number) requirements.getOrDefault("t402Version", 2)).intValue();
        String payTo = (String) requirements.get("payTo");
        String amount = (String) requirements.get("maxAmountRequired");
        if (amount == null) {
            amount = (String) requirements.get("amount");
        }

        // Validate network
        if (!StacksConstants.isStacksNetwork(network)) {
            throw new IllegalArgumentException("Invalid Stacks network: " + network);
        }

        // Validate payTo
        if (payTo == null || payTo.isEmpty()) {
            throw new IllegalArgumentException("PayTo address is required");
        }
        if (!StacksConstants.isValidPrincipal(payTo)) {
            throw new IllegalArgumentException("Invalid payTo principal address: " + payTo);
        }

        // Validate amount
        if (amount == null || amount.isEmpty()) {
            throw new IllegalArgumentException("Amount is required");
        }
        BigInteger amountBigInt;
        try {
            amountBigInt = new BigInteger(amount);
            if (amountBigInt.compareTo(BigInteger.ZERO) <= 0) {
                throw new IllegalArgumentException("Amount must be positive: " + amount);
            }
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Invalid amount format: " + amount);
        }

        // Resolve contract address
        String contractAddress = resolveContractAddress(requirements, network);

        // Get sender address
        String fromAddress = signer.getAddress();
        if (fromAddress == null || fromAddress.isEmpty()) {
            throw new IllegalArgumentException("Signer address is empty");
        }

        String finalNetwork = network;
        String finalAmount = amount;
        String finalContractAddress = contractAddress;

        // Execute the SIP-010 transfer
        return signer.transferToken(contractAddress, payTo, amountBigInt)
            .thenApply(txId -> {
                // Build the payload
                ExactDirectPayload payload = ExactDirectPayload.builder()
                    .txId(txId)
                    .from(fromAddress)
                    .to(payTo)
                    .amount(finalAmount)
                    .contractAddress(finalContractAddress)
                    .build();

                // Build result map
                Map<String, Object> payloadResult = new HashMap<>();
                payloadResult.put("t402Version", t402Version);
                payloadResult.put("scheme", SCHEME);
                payloadResult.put("network", finalNetwork);
                payloadResult.put("payload", payload.toMap());

                return payloadResult;
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

    /**
     * Resolves the contract address from requirements.
     *
     * <p>Tries to determine the contract address from:
     * <ol>
     *   <li>The extra.contractAddress field</li>
     *   <li>The default sUSDC contract for the network</li>
     * </ol>
     */
    @SuppressWarnings("unchecked")
    private String resolveContractAddress(Map<String, Object> requirements, String network) {
        // Try extra.contractAddress first
        Object extraObj = requirements.get("extra");
        if (extraObj instanceof Map) {
            Map<String, Object> extra = (Map<String, Object>) extraObj;
            Object contractVal = extra.get("contractAddress");
            if (contractVal instanceof String && !((String) contractVal).isEmpty()) {
                return (String) contractVal;
            }
        }

        // Fall back to default for the network
        if (StacksConstants.isSupportedNetwork(network)) {
            return StacksConstants.getDefaultContract(network);
        }

        throw new IllegalArgumentException(
            "No contract address specified and network is not supported: " + network);
    }
}
