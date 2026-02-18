package io.t402.wdk.bridge;

import java.math.BigInteger;

/**
 * Parameters for a bridge operation.
 */
public class WDKBridgeParams {

    private final String fromNetwork;
    private final String toNetwork;
    private final BigInteger amount;
    private final String recipient;

    public WDKBridgeParams(String fromNetwork, String toNetwork, BigInteger amount, String recipient) {
        this.fromNetwork = fromNetwork;
        this.toNetwork = toNetwork;
        this.amount = amount;
        this.recipient = recipient;
    }

    public String getFromNetwork() {
        return fromNetwork;
    }

    public String getToNetwork() {
        return toNetwork;
    }

    public BigInteger getAmount() {
        return amount;
    }

    public String getRecipient() {
        return recipient;
    }
}
