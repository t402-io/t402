package io.t402.bridge;

import io.t402.bridge.BridgeTypes.*;
import java.math.BigInteger;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CompletableFuture;

/**
 * USDT0 Bridge Client for LayerZero OFT transfers.
 *
 * <p>Provides cross-chain USDT0 transfers using LayerZero OFT standard.
 *
 * <p>Example usage:
 * <pre>{@code
 * Usdt0Bridge bridge = new Usdt0Bridge(signer, "arbitrum");
 *
 * // Get quote
 * BridgeQuote quote = bridge.quote(new BridgeQuoteParams(
 *     "arbitrum", "ethereum",
 *     BigInteger.valueOf(100_000000),  // 100 USDT0
 *     recipientAddress
 * ));
 *
 * System.out.println("Fee: " + quote.getNativeFee() + " wei");
 *
 * // Execute bridge
 * BridgeResult result = bridge.send(new BridgeExecuteParams(
 *     "arbitrum", "ethereum",
 *     BigInteger.valueOf(100_000000),
 *     recipientAddress
 * ));
 *
 * System.out.println("TX: " + result.getTxHash());
 * System.out.println("Message GUID: " + result.getMessageGuid());
 * }</pre>
 */
public class Usdt0Bridge {

    private final BridgeSigner signer;
    private final String chain;

    /**
     * Creates a new bridge client.
     *
     * @param signer Wallet signer with read/write capabilities
     * @param chain Source chain name (e.g., "arbitrum", "ethereum")
     * @throws IllegalArgumentException if chain doesn't support bridging
     */
    public Usdt0Bridge(BridgeSigner signer, String chain) {
        if (!BridgeConstants.supportsBridging(chain)) {
            throw new IllegalArgumentException(
                "Chain \"" + chain + "\" does not support USDT0 bridging. " +
                "Supported chains: " + String.join(", ", BridgeConstants.getBridgeableChains())
            );
        }

        this.signer = signer;
        this.chain = chain.toLowerCase();
    }

    /**
     * Get a quote for bridging USDT0.
     *
     * @param params Bridge parameters
     * @return Quote with fee and amount information
     * @throws BridgeException if quote fails
     */
    public BridgeQuote quote(BridgeQuoteParams params) throws BridgeException {
        validateParams(params);

        try {
            SendParam sendParam = buildSendParam(
                params.getToChain(),
                params.getAmount(),
                params.getRecipient(),
                BridgeConstants.DEFAULT_SLIPPAGE
            );

            String oftAddress = BridgeConstants.getUsdt0OftAddress(params.getFromChain());

            // Get quote from contract
            Object result = signer.readContract(
                oftAddress,
                "quoteSend",
                sendParam.toTuple(),
                false
            );

            BigInteger nativeFee = extractNativeFee(result);

            return new BridgeQuote(
                nativeFee,
                params.getAmount(),
                sendParam.getMinAmountLd(),
                BridgeConstants.ESTIMATED_BRIDGE_TIME_SECONDS,
                params.getFromChain(),
                params.getToChain()
            );
        } catch (Exception e) {
            throw new BridgeException("Failed to get bridge quote", e);
        }
    }

    /**
     * Get a quote asynchronously.
     */
    public CompletableFuture<BridgeQuote> quoteAsync(BridgeQuoteParams params) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                return quote(params);
            } catch (BridgeException e) {
                throw new RuntimeException(e);
            }
        });
    }

    /**
     * Execute a bridge transaction.
     *
     * @param params Bridge execution parameters
     * @return Bridge result with transaction hash and message GUID
     * @throws BridgeException if bridge fails
     */
    public BridgeResult send(BridgeExecuteParams params) throws BridgeException {
        validateParams(new BridgeQuoteParams(
            params.getFromChain(),
            params.getToChain(),
            params.getAmount(),
            params.getRecipient()
        ));

        try {
            double slippage = params.getSlippageTolerance() > 0
                ? params.getSlippageTolerance()
                : BridgeConstants.DEFAULT_SLIPPAGE;

            String oftAddress = BridgeConstants.getUsdt0OftAddress(params.getFromChain());
            SendParam sendParam = buildSendParam(
                params.getToChain(),
                params.getAmount(),
                params.getRecipient(),
                slippage
            );

            String refundAddress = params.getRefundAddress() != null
                ? params.getRefundAddress()
                : signer.getAddress();

            // Get fee quote
            Object feeResult = signer.readContract(
                oftAddress,
                "quoteSend",
                sendParam.toTuple(),
                false
            );

            MessagingFee fee = extractMessagingFee(feeResult);

            // Check and approve allowance if needed
            ensureAllowance(oftAddress, params.getAmount());

            // Execute bridge transaction
            String txHash = signer.writeContract(
                oftAddress,
                "send",
                fee.getNativeFee(),
                sendParam.toTuple(),
                new Object[] { fee.getNativeFee(), fee.getLzTokenFee() },
                refundAddress
            );

            // Wait for transaction confirmation
            TransactionReceipt receipt = signer.waitForTransactionReceipt(txHash);

            if (receipt.getStatus() != 1) {
                throw new BridgeException("Bridge transaction failed: " + txHash);
            }

            // Extract message GUID from logs
            String messageGuid = extractMessageGuid(receipt);

            return new BridgeResult(
                txHash,
                messageGuid,
                params.getAmount(),
                sendParam.getMinAmountLd(),
                params.getFromChain(),
                params.getToChain(),
                BridgeConstants.ESTIMATED_BRIDGE_TIME_SECONDS
            );
        } catch (BridgeException e) {
            throw e;
        } catch (Exception e) {
            throw new BridgeException("Failed to execute bridge transaction", e);
        }
    }

    /**
     * Execute a bridge transaction asynchronously.
     */
    public CompletableFuture<BridgeResult> sendAsync(BridgeExecuteParams params) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                return send(params);
            } catch (BridgeException e) {
                throw new RuntimeException(e);
            }
        });
    }

    /**
     * Get all supported destination chains from current chain.
     *
     * @return Set of supported destination chain names
     */
    public Set<String> getSupportedDestinations() {
        Set<String> chains = BridgeConstants.getBridgeableChains();
        chains.remove(chain);
        return chains;
    }

    /**
     * Check if a destination chain is supported.
     *
     * @param toChain Destination chain name
     * @return true if supported
     */
    public boolean supportsDestination(String toChain) {
        return !toChain.equalsIgnoreCase(chain) && BridgeConstants.supportsBridging(toChain);
    }

    /**
     * Get the source chain.
     */
    public String getChain() {
        return chain;
    }

    // Validate bridge parameters
    private void validateParams(BridgeQuoteParams params) {
        if (!params.getFromChain().equalsIgnoreCase(chain)) {
            throw new IllegalArgumentException(
                "Source chain mismatch: bridge initialized for \"" + chain +
                "\" but got \"" + params.getFromChain() + "\""
            );
        }

        if (!BridgeConstants.supportsBridging(params.getFromChain())) {
            throw new IllegalArgumentException(
                "Source chain \"" + params.getFromChain() + "\" does not support USDT0 bridging"
            );
        }

        if (!BridgeConstants.supportsBridging(params.getToChain())) {
            throw new IllegalArgumentException(
                "Destination chain \"" + params.getToChain() + "\" does not support USDT0 bridging"
            );
        }

        if (params.getFromChain().equalsIgnoreCase(params.getToChain())) {
            throw new IllegalArgumentException("Source and destination chains must be different");
        }

        if (params.getAmount().compareTo(BigInteger.ZERO) <= 0) {
            throw new IllegalArgumentException("Amount must be greater than 0");
        }
    }

    // Build LayerZero SendParam
    private SendParam buildSendParam(String toChain, BigInteger amount, String recipient, double slippage) {
        Integer dstEid = BridgeConstants.getEndpointId(toChain);
        if (dstEid == null) {
            throw new IllegalArgumentException("Unknown destination chain: " + toChain);
        }

        byte[] toBytes = BridgeConstants.addressToBytes32(recipient);

        // Calculate minimum amount with slippage
        int slippageBps = (int) (slippage * 100);
        BigInteger minAmount = amount.subtract(
            amount.multiply(BigInteger.valueOf(slippageBps)).divide(BigInteger.valueOf(10000))
        );

        return new SendParam(
            dstEid,
            toBytes,
            amount,
            minAmount,
            BridgeConstants.DEFAULT_EXTRA_OPTIONS,
            new byte[0],
            new byte[0]
        );
    }

    // Extract native fee from contract response
    @SuppressWarnings("unchecked")
    private BigInteger extractNativeFee(Object result) {
        if (result instanceof Object[]) {
            Object[] arr = (Object[]) result;
            return toBigInteger(arr[0]);
        }
        if (result instanceof List) {
            List<Object> list = (List<Object>) result;
            return toBigInteger(list.get(0));
        }
        if (result instanceof java.util.Map) {
            java.util.Map<String, Object> map = (java.util.Map<String, Object>) result;
            return toBigInteger(map.getOrDefault("nativeFee", BigInteger.ZERO));
        }
        return toBigInteger(result);
    }

    // Extract messaging fee from contract response
    @SuppressWarnings("unchecked")
    private MessagingFee extractMessagingFee(Object result) {
        BigInteger nativeFee = BigInteger.ZERO;
        BigInteger lzTokenFee = BigInteger.ZERO;

        if (result instanceof Object[]) {
            Object[] arr = (Object[]) result;
            nativeFee = toBigInteger(arr[0]);
            if (arr.length > 1) {
                lzTokenFee = toBigInteger(arr[1]);
            }
        } else if (result instanceof List) {
            List<Object> list = (List<Object>) result;
            nativeFee = toBigInteger(list.get(0));
            if (list.size() > 1) {
                lzTokenFee = toBigInteger(list.get(1));
            }
        } else if (result instanceof java.util.Map) {
            java.util.Map<String, Object> map = (java.util.Map<String, Object>) result;
            nativeFee = toBigInteger(map.getOrDefault("nativeFee", BigInteger.ZERO));
            lzTokenFee = toBigInteger(map.getOrDefault("lzTokenFee", BigInteger.ZERO));
        }

        return new MessagingFee(nativeFee, lzTokenFee);
    }

    private BigInteger toBigInteger(Object value) {
        if (value == null) {
            return BigInteger.ZERO;
        }
        if (value instanceof BigInteger) {
            return (BigInteger) value;
        }
        if (value instanceof Number) {
            return BigInteger.valueOf(((Number) value).longValue());
        }
        String str = value.toString();
        if (str.startsWith("0x")) {
            return new BigInteger(str.substring(2), 16);
        }
        return new BigInteger(str);
    }

    // Ensure token allowance
    private void ensureAllowance(String oftAddress, BigInteger amount) throws Exception {
        String signerAddress = signer.getAddress();

        // Check current allowance
        Object allowanceResult = signer.readContract(
            oftAddress,
            "allowance",
            signerAddress,
            oftAddress
        );

        BigInteger allowance = toBigInteger(allowanceResult);

        // Approve if needed
        if (allowance.compareTo(amount) < 0) {
            signer.writeContract(
                oftAddress,
                "approve",
                BigInteger.ZERO,
                oftAddress,
                amount
            );
        }
    }

    // Extract message GUID from transaction logs
    private String extractMessageGuid(TransactionReceipt receipt) {
        for (TransactionLog log : receipt.getLogs()) {
            List<String> topics = log.getTopics();
            if (topics != null && topics.size() >= 2) {
                if (topics.get(0).equalsIgnoreCase(BridgeConstants.OFT_SENT_EVENT_TOPIC)) {
                    return topics.get(1);
                }
            }
        }

        throw new IllegalStateException(
            "Failed to extract message GUID from transaction logs. " +
            "The OFTSent event was not found in the transaction receipt."
        );
    }
}
