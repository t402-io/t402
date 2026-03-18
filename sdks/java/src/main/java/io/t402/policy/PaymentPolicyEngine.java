package io.t402.policy;

import java.math.BigInteger;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Evaluates payment requests against a {@link PaymentPolicy}.
 *
 * <p>Thread-safe. Tracks cumulative session statistics for budget enforcement.</p>
 *
 * <pre>{@code
 * PaymentPolicy policy = new PaymentPolicy.Builder()
 *     .maxAmountPerPayment(new BigInteger("1000000"))
 *     .allowedNetworks(List.of("eip155:8453"))
 *     .build();
 *
 * PaymentPolicyEngine engine = new PaymentPolicyEngine(policy);
 * PolicyDecision decision = engine.evaluate("exact", "eip155:8453", "0xUSDC", "500000", "0xRecipient");
 * if (decision.isAllowed()) {
 *     engine.recordPayment("500000");
 * }
 * }</pre>
 */
public class PaymentPolicyEngine {

    private final PaymentPolicy policy;
    private BigInteger totalAmountPaid = BigInteger.ZERO;
    private int paymentCount = 0;
    private BigInteger amountPaidToday = BigInteger.ZERO;
    private final List<Long> hourlyTimestamps = new ArrayList<>();
    private long dayStart;

    public PaymentPolicyEngine(PaymentPolicy policy) {
        this.policy = policy;
        this.dayStart = startOfDay();
    }

    /**
     * Evaluate whether a payment is allowed by the policy.
     */
    public synchronized PolicyDecision evaluate(String scheme, String network, String asset, String amount, String payTo) {
        pruneHourly();
        checkDayRollover();

        BigInteger amountBig;
        try {
            amountBig = new BigInteger(amount);
        } catch (NumberFormatException e) {
            return PolicyDecision.deny("invalid amount");
        }

        // Max per payment
        if (policy.getMaxAmountPerPayment() != null && amountBig.compareTo(policy.getMaxAmountPerPayment()) > 0) {
            return PolicyDecision.deny("amount " + amountBig + " exceeds max per payment " + policy.getMaxAmountPerPayment());
        }

        // Max per session
        if (policy.getMaxAmountPerSession() != null) {
            BigInteger projected = totalAmountPaid.add(amountBig);
            if (projected.compareTo(policy.getMaxAmountPerSession()) > 0) {
                return PolicyDecision.deny("cumulative " + projected + " exceeds session limit " + policy.getMaxAmountPerSession());
            }
        }

        // Max per day
        if (policy.getMaxAmountPerDay() != null) {
            BigInteger projected = amountPaidToday.add(amountBig);
            if (projected.compareTo(policy.getMaxAmountPerDay()) > 0) {
                return PolicyDecision.deny("daily spending " + projected + " exceeds limit " + policy.getMaxAmountPerDay());
            }
        }

        // Max payments per hour
        if (policy.getMaxPaymentsPerHour() != null && hourlyTimestamps.size() >= policy.getMaxPaymentsPerHour()) {
            return PolicyDecision.deny("hourly payment count " + hourlyTimestamps.size() + " exceeds limit " + policy.getMaxPaymentsPerHour());
        }

        // Allowed recipients
        if (policy.getAllowedRecipients() != null) {
            boolean found = policy.getAllowedRecipients().stream().anyMatch(r -> r.equalsIgnoreCase(payTo));
            if (!found) return PolicyDecision.deny("recipient " + payTo + " not in allowed list");
        }

        // Blocked recipients
        if (policy.getBlockedRecipients() != null) {
            boolean blocked = policy.getBlockedRecipients().stream().anyMatch(r -> r.equalsIgnoreCase(payTo));
            if (blocked) return PolicyDecision.deny("recipient " + payTo + " is blocked");
        }

        // Allowed networks
        if (policy.getAllowedNetworks() != null && !policy.getAllowedNetworks().contains(network)) {
            return PolicyDecision.deny("network " + network + " not allowed");
        }

        // Allowed schemes
        if (policy.getAllowedSchemes() != null && !policy.getAllowedSchemes().contains(scheme)) {
            return PolicyDecision.deny("scheme " + scheme + " not allowed");
        }

        // Allowed assets
        if (policy.getAllowedAssets() != null) {
            boolean found = policy.getAllowedAssets().stream().anyMatch(a -> a.equalsIgnoreCase(asset));
            if (!found) return PolicyDecision.deny("asset " + asset + " not allowed");
        }

        // Custom rules
        if (policy.getCustomRules() != null) {
            PolicyContext ctx = new PolicyContext(scheme, network, asset, amountBig, payTo,
                totalAmountPaid, paymentCount, hourlyTimestamps.size(), amountPaidToday);
            for (PolicyRule rule : policy.getCustomRules()) {
                PolicyDecision d = rule.evaluate(ctx);
                if (!d.isAllowed()) {
                    return PolicyDecision.deny("rule '" + rule.getName() + "': " + d.getReason());
                }
            }
        }

        return PolicyDecision.allow();
    }

    /**
     * Record a successful payment to update session stats.
     */
    public synchronized void recordPayment(String amount) {
        BigInteger amountBig = new BigInteger(amount);
        totalAmountPaid = totalAmountPaid.add(amountBig);
        paymentCount++;
        amountPaidToday = amountPaidToday.add(amountBig);
        hourlyTimestamps.add(Instant.now().getEpochSecond());
    }

    /**
     * Reset all session statistics.
     */
    public synchronized void reset() {
        totalAmountPaid = BigInteger.ZERO;
        paymentCount = 0;
        amountPaidToday = BigInteger.ZERO;
        hourlyTimestamps.clear();
        dayStart = startOfDay();
    }

    /**
     * Get current session statistics.
     */
    public synchronized SessionStats getStats() {
        pruneHourly();
        return new SessionStats(totalAmountPaid, paymentCount, hourlyTimestamps.size(), amountPaidToday);
    }

    private void pruneHourly() {
        long cutoff = Instant.now().getEpochSecond() - 3600;
        hourlyTimestamps.removeIf(t -> t < cutoff);
    }

    private void checkDayRollover() {
        long currentDayStart = startOfDay();
        if (currentDayStart > dayStart) {
            amountPaidToday = BigInteger.ZERO;
            dayStart = currentDayStart;
        }
    }

    private static long startOfDay() {
        long now = Instant.now().getEpochSecond();
        return now - (now % 86400);
    }

    /**
     * Session statistics snapshot.
     */
    public record SessionStats(BigInteger totalAmountPaid, int paymentCount, int paymentsThisHour, BigInteger amountPaidToday) {}
}
