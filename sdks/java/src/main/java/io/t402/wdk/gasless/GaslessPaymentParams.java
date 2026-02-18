package io.t402.wdk.gasless;

import java.math.BigInteger;

/**
 * Parameters for a gasless payment.
 */
public class GaslessPaymentParams {

    private final String to;
    private final BigInteger amount;
    private final String token;
    private final String network;

    public GaslessPaymentParams(String to, BigInteger amount, String token, String network) {
        this.to = to;
        this.amount = amount;
        this.token = token;
        this.network = network;
    }

    public String getTo() {
        return to;
    }

    public BigInteger getAmount() {
        return amount;
    }

    public String getToken() {
        return token;
    }

    public String getNetwork() {
        return network;
    }
}
