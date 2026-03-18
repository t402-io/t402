package io.t402.policy;

import java.math.BigInteger;

/**
 * Context passed to custom policy rules for evaluation.
 */
public class PolicyContext {
    private final String scheme;
    private final String network;
    private final String asset;
    private final BigInteger amount;
    private final String payTo;
    private final BigInteger totalAmountPaid;
    private final int paymentCount;
    private final int paymentsThisHour;
    private final BigInteger amountPaidToday;

    public PolicyContext(String scheme, String network, String asset, BigInteger amount, String payTo,
                         BigInteger totalAmountPaid, int paymentCount, int paymentsThisHour, BigInteger amountPaidToday) {
        this.scheme = scheme;
        this.network = network;
        this.asset = asset;
        this.amount = amount;
        this.payTo = payTo;
        this.totalAmountPaid = totalAmountPaid;
        this.paymentCount = paymentCount;
        this.paymentsThisHour = paymentsThisHour;
        this.amountPaidToday = amountPaidToday;
    }

    public String getScheme() { return scheme; }
    public String getNetwork() { return network; }
    public String getAsset() { return asset; }
    public BigInteger getAmount() { return amount; }
    public String getPayTo() { return payTo; }
    public BigInteger getTotalAmountPaid() { return totalAmountPaid; }
    public int getPaymentCount() { return paymentCount; }
    public int getPaymentsThisHour() { return paymentsThisHour; }
    public BigInteger getAmountPaidToday() { return amountPaidToday; }
}
