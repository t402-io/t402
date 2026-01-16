package io.t402.bridge;

import java.math.BigInteger;
import java.util.List;

/**
 * Types for USDT0 bridge operations.
 */
public final class BridgeTypes {

    private BridgeTypes() {
        // Utility class
    }

    /**
     * Parameters for getting a bridge quote.
     */
    public static class BridgeQuoteParams {
        private final String fromChain;
        private final String toChain;
        private final BigInteger amount;
        private final String recipient;

        public BridgeQuoteParams(String fromChain, String toChain, BigInteger amount, String recipient) {
            this.fromChain = fromChain;
            this.toChain = toChain;
            this.amount = amount;
            this.recipient = recipient;
        }

        public String getFromChain() {
            return fromChain;
        }

        public String getToChain() {
            return toChain;
        }

        public BigInteger getAmount() {
            return amount;
        }

        public String getRecipient() {
            return recipient;
        }
    }

    /**
     * Quote result from the bridge.
     */
    public static class BridgeQuote {
        private final BigInteger nativeFee;
        private final BigInteger amountToSend;
        private final BigInteger minAmountToReceive;
        private final int estimatedTimeSeconds;
        private final String fromChain;
        private final String toChain;

        public BridgeQuote(
                BigInteger nativeFee,
                BigInteger amountToSend,
                BigInteger minAmountToReceive,
                int estimatedTimeSeconds,
                String fromChain,
                String toChain) {
            this.nativeFee = nativeFee;
            this.amountToSend = amountToSend;
            this.minAmountToReceive = minAmountToReceive;
            this.estimatedTimeSeconds = estimatedTimeSeconds;
            this.fromChain = fromChain;
            this.toChain = toChain;
        }

        public BigInteger getNativeFee() {
            return nativeFee;
        }

        public BigInteger getAmountToSend() {
            return amountToSend;
        }

        public BigInteger getMinAmountToReceive() {
            return minAmountToReceive;
        }

        public int getEstimatedTimeSeconds() {
            return estimatedTimeSeconds;
        }

        public String getFromChain() {
            return fromChain;
        }

        public String getToChain() {
            return toChain;
        }
    }

    /**
     * Parameters for executing a bridge transaction.
     */
    public static class BridgeExecuteParams {
        private final String fromChain;
        private final String toChain;
        private final BigInteger amount;
        private final String recipient;
        private final double slippageTolerance;
        private final String refundAddress;

        public BridgeExecuteParams(
                String fromChain,
                String toChain,
                BigInteger amount,
                String recipient) {
            this(fromChain, toChain, amount, recipient, BridgeConstants.DEFAULT_SLIPPAGE, null);
        }

        public BridgeExecuteParams(
                String fromChain,
                String toChain,
                BigInteger amount,
                String recipient,
                double slippageTolerance,
                String refundAddress) {
            this.fromChain = fromChain;
            this.toChain = toChain;
            this.amount = amount;
            this.recipient = recipient;
            this.slippageTolerance = slippageTolerance;
            this.refundAddress = refundAddress;
        }

        public String getFromChain() {
            return fromChain;
        }

        public String getToChain() {
            return toChain;
        }

        public BigInteger getAmount() {
            return amount;
        }

        public String getRecipient() {
            return recipient;
        }

        public double getSlippageTolerance() {
            return slippageTolerance;
        }

        public String getRefundAddress() {
            return refundAddress;
        }
    }

    /**
     * Result of a bridge transaction.
     */
    public static class BridgeResult {
        private final String txHash;
        private final String messageGuid;
        private final BigInteger amountSent;
        private final BigInteger amountToReceive;
        private final String fromChain;
        private final String toChain;
        private final int estimatedTimeSeconds;

        public BridgeResult(
                String txHash,
                String messageGuid,
                BigInteger amountSent,
                BigInteger amountToReceive,
                String fromChain,
                String toChain,
                int estimatedTimeSeconds) {
            this.txHash = txHash;
            this.messageGuid = messageGuid;
            this.amountSent = amountSent;
            this.amountToReceive = amountToReceive;
            this.fromChain = fromChain;
            this.toChain = toChain;
            this.estimatedTimeSeconds = estimatedTimeSeconds;
        }

        public String getTxHash() {
            return txHash;
        }

        public String getMessageGuid() {
            return messageGuid;
        }

        public BigInteger getAmountSent() {
            return amountSent;
        }

        public BigInteger getAmountToReceive() {
            return amountToReceive;
        }

        public String getFromChain() {
            return fromChain;
        }

        public String getToChain() {
            return toChain;
        }

        public int getEstimatedTimeSeconds() {
            return estimatedTimeSeconds;
        }
    }

    /**
     * LayerZero SendParam structure.
     */
    public static class SendParam {
        private final int dstEid;
        private final byte[] to;
        private final BigInteger amountLd;
        private final BigInteger minAmountLd;
        private final byte[] extraOptions;
        private final byte[] composeMsg;
        private final byte[] oftCmd;

        public SendParam(
                int dstEid,
                byte[] to,
                BigInteger amountLd,
                BigInteger minAmountLd,
                byte[] extraOptions,
                byte[] composeMsg,
                byte[] oftCmd) {
            this.dstEid = dstEid;
            this.to = to;
            this.amountLd = amountLd;
            this.minAmountLd = minAmountLd;
            this.extraOptions = extraOptions;
            this.composeMsg = composeMsg;
            this.oftCmd = oftCmd;
        }

        public int getDstEid() {
            return dstEid;
        }

        public byte[] getTo() {
            return to;
        }

        public BigInteger getAmountLd() {
            return amountLd;
        }

        public BigInteger getMinAmountLd() {
            return minAmountLd;
        }

        public byte[] getExtraOptions() {
            return extraOptions;
        }

        public byte[] getComposeMsg() {
            return composeMsg;
        }

        public byte[] getOftCmd() {
            return oftCmd;
        }

        /**
         * Convert to tuple for contract calls.
         */
        public Object[] toTuple() {
            return new Object[] {
                dstEid,
                to,
                amountLd,
                minAmountLd,
                extraOptions,
                composeMsg,
                oftCmd
            };
        }
    }

    /**
     * LayerZero messaging fee.
     */
    public static class MessagingFee {
        private final BigInteger nativeFee;
        private final BigInteger lzTokenFee;

        public MessagingFee(BigInteger nativeFee, BigInteger lzTokenFee) {
            this.nativeFee = nativeFee;
            this.lzTokenFee = lzTokenFee;
        }

        public BigInteger getNativeFee() {
            return nativeFee;
        }

        public BigInteger getLzTokenFee() {
            return lzTokenFee;
        }
    }

    /**
     * Transaction log from receipt.
     */
    public static class TransactionLog {
        private final String address;
        private final List<String> topics;
        private final String data;

        public TransactionLog(String address, List<String> topics, String data) {
            this.address = address;
            this.topics = topics;
            this.data = data;
        }

        public String getAddress() {
            return address;
        }

        public List<String> getTopics() {
            return topics;
        }

        public String getData() {
            return data;
        }
    }

    /**
     * Transaction receipt from bridge.
     */
    public static class TransactionReceipt {
        private final String transactionHash;
        private final int status;
        private final List<TransactionLog> logs;

        public TransactionReceipt(String transactionHash, int status, List<TransactionLog> logs) {
            this.transactionHash = transactionHash;
            this.status = status;
            this.logs = logs;
        }

        public String getTransactionHash() {
            return transactionHash;
        }

        public int getStatus() {
            return status;
        }

        public List<TransactionLog> getLogs() {
            return logs;
        }
    }

    /**
     * LayerZero message status.
     */
    public enum LayerZeroMessageStatus {
        PENDING,
        INFLIGHT,
        DELIVERED,
        FAILED
    }

    /**
     * LayerZero message information from scan API.
     */
    public static class LayerZeroMessage {
        private final String guid;
        private final String srcTxHash;
        private final String dstTxHash;
        private final LayerZeroMessageStatus status;
        private final int srcChainId;
        private final int dstChainId;

        public LayerZeroMessage(
                String guid,
                String srcTxHash,
                String dstTxHash,
                LayerZeroMessageStatus status,
                int srcChainId,
                int dstChainId) {
            this.guid = guid;
            this.srcTxHash = srcTxHash;
            this.dstTxHash = dstTxHash;
            this.status = status;
            this.srcChainId = srcChainId;
            this.dstChainId = dstChainId;
        }

        public String getGuid() {
            return guid;
        }

        public String getSrcTxHash() {
            return srcTxHash;
        }

        public String getDstTxHash() {
            return dstTxHash;
        }

        public LayerZeroMessageStatus getStatus() {
            return status;
        }

        public int getSrcChainId() {
            return srcChainId;
        }

        public int getDstChainId() {
            return dstChainId;
        }
    }
}
