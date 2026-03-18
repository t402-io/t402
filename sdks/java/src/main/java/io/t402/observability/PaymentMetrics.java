package io.t402.observability;

import java.math.BigInteger;
import java.util.Map;

/**
 * Aggregated payment metrics computed from collected events.
 */
public record PaymentMetrics(
    int totalAttempted,
    int totalSuccessful,
    int totalFailed,
    double avgVerifyLatencyMs,
    double avgSettleLatencyMs,
    Map<String, BigInteger> amountByNetwork,
    Map<String, Integer> countByNetwork,
    Map<String, Integer> failureReasons
) {}
