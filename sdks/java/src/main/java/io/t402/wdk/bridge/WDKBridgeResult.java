package io.t402.wdk.bridge;

import java.math.BigInteger;

/**
 * Result of a bridge operation.
 */
public class WDKBridgeResult {

    private final String txHash;
    private final String messageGuid;
    private final int estimatedTime;
    private final String fromNetwork;
    private final String toNetwork;
    private final BigInteger amountSent;

    public WDKBridgeResult(String txHash, String messageGuid, int estimatedTime,
                           String fromNetwork, String toNetwork, BigInteger amountSent) {
        this.txHash = txHash;
        this.messageGuid = messageGuid;
        this.estimatedTime = estimatedTime;
        this.fromNetwork = fromNetwork;
        this.toNetwork = toNetwork;
        this.amountSent = amountSent;
    }

    public String getTxHash() {
        return txHash;
    }

    public String getMessageGuid() {
        return messageGuid;
    }

    public int getEstimatedTime() {
        return estimatedTime;
    }

    public String getFromNetwork() {
        return fromNetwork;
    }

    public String getToNetwork() {
        return toNetwork;
    }

    public BigInteger getAmountSent() {
        return amountSent;
    }
}
