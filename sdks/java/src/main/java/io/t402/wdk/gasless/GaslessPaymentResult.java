package io.t402.wdk.gasless;

/**
 * Result of a gasless payment.
 */
public class GaslessPaymentResult {

    private final String userOpHash;
    private final String txHash;
    private final boolean success;
    private final long gasUsed;
    private final long gasCost;
    private final boolean sponsored;

    public GaslessPaymentResult(String userOpHash, String txHash, boolean success,
                                long gasUsed, long gasCost, boolean sponsored) {
        this.userOpHash = userOpHash;
        this.txHash = txHash;
        this.success = success;
        this.gasUsed = gasUsed;
        this.gasCost = gasCost;
        this.sponsored = sponsored;
    }

    public String getUserOpHash() {
        return userOpHash;
    }

    public String getTxHash() {
        return txHash;
    }

    public boolean isSuccess() {
        return success;
    }

    public long getGasUsed() {
        return gasUsed;
    }

    public long getGasCost() {
        return gasCost;
    }

    public boolean isSponsored() {
        return sponsored;
    }
}
