package io.t402.wdk.multisig;

import java.util.Collections;
import java.util.List;

/**
 * Configuration for Safe multi-signature payments.
 */
public class WDKMultisigConfig {

    private final String safeAddress;
    private final int threshold;
    private final List<String> owners;
    private final int chainId;

    public WDKMultisigConfig(String safeAddress, int threshold, List<String> owners) {
        this(safeAddress, threshold, owners, 42161);
    }

    public WDKMultisigConfig(String safeAddress, int threshold, List<String> owners, int chainId) {
        if (safeAddress == null || safeAddress.isEmpty()) {
            throw new IllegalArgumentException("Safe address is required");
        }
        if (threshold < 1) {
            throw new IllegalArgumentException("Threshold must be at least 1");
        }
        if (owners == null || owners.size() < threshold) {
            throw new IllegalArgumentException(
                    "Need at least " + threshold + " owners for threshold");
        }
        // Check for duplicate owners
        long uniqueCount = owners.stream().distinct().count();
        if (uniqueCount != owners.size()) {
            throw new IllegalArgumentException("Owner addresses must be unique");
        }

        this.safeAddress = safeAddress;
        this.threshold = threshold;
        this.owners = Collections.unmodifiableList(owners);
        this.chainId = chainId;
    }

    public String getSafeAddress() {
        return safeAddress;
    }

    public int getThreshold() {
        return threshold;
    }

    public List<String> getOwners() {
        return owners;
    }

    public int getChainId() {
        return chainId;
    }
}
