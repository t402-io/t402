package io.t402.policy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigInteger;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class PaymentPolicyEngineTest {

    PaymentPolicyEngine engine(PaymentPolicy policy) {
        return new PaymentPolicyEngine(policy);
    }

    @Nested @DisplayName("MaxAmountPerPayment")
    class MaxAmountPerPaymentTests {
        @Test void allowBelowLimit() {
            var e = engine(new PaymentPolicy.Builder().maxAmountPerPayment(BigInteger.valueOf(1_000_000)).build());
            assertTrue(e.evaluate("exact", "eip155:8453", "0xUSDC", "500000", "0xR").isAllowed());
        }
        @Test void allowAtLimit() {
            var e = engine(new PaymentPolicy.Builder().maxAmountPerPayment(BigInteger.valueOf(1_000_000)).build());
            assertTrue(e.evaluate("exact", "eip155:8453", "0xUSDC", "1000000", "0xR").isAllowed());
        }
        @Test void denyAboveLimit() {
            var e = engine(new PaymentPolicy.Builder().maxAmountPerPayment(BigInteger.valueOf(1_000_000)).build());
            var d = e.evaluate("exact", "eip155:8453", "0xUSDC", "1000001", "0xR");
            assertFalse(d.isAllowed());
            assertTrue(d.getReason().contains("max per payment"));
        }
    }

    @Nested @DisplayName("MaxAmountPerSession")
    class MaxAmountPerSessionTests {
        @Test void cumulativeTracking() {
            var e = engine(new PaymentPolicy.Builder().maxAmountPerSession(BigInteger.valueOf(2_000_000)).build());
            assertTrue(e.evaluate("exact", "eip155:8453", "0xUSDC", "1000000", "0xR").isAllowed());
            e.recordPayment("1000000");
            assertTrue(e.evaluate("exact", "eip155:8453", "0xUSDC", "1000000", "0xR").isAllowed());
            e.recordPayment("1000000");
            assertFalse(e.evaluate("exact", "eip155:8453", "0xUSDC", "1", "0xR").isAllowed());
        }
    }

    @Nested @DisplayName("MaxAmountPerDay")
    class MaxAmountPerDayTests {
        @Test void denyExceeded() {
            var e = engine(new PaymentPolicy.Builder().maxAmountPerDay(BigInteger.valueOf(5_000_000)).build());
            e.recordPayment("5000000");
            assertFalse(e.evaluate("exact", "eip155:8453", "0xUSDC", "1", "0xR").isAllowed());
        }
    }

    @Nested @DisplayName("MaxPaymentsPerHour")
    class MaxPaymentsPerHourTests {
        @Test void denyTooMany() {
            var e = engine(new PaymentPolicy.Builder().maxPaymentsPerHour(3).build());
            for (int i = 0; i < 3; i++) {
                assertTrue(e.evaluate("exact", "eip155:8453", "0xUSDC", "100", "0xR").isAllowed());
                e.recordPayment("100");
            }
            assertFalse(e.evaluate("exact", "eip155:8453", "0xUSDC", "100", "0xR").isAllowed());
        }
    }

    @Nested @DisplayName("AllowedRecipients")
    class AllowedRecipientsTests {
        @Test void allowListed() {
            var e = engine(new PaymentPolicy.Builder().allowedRecipients(List.of("0xAlice")).build());
            assertTrue(e.evaluate("exact", "eip155:8453", "0xUSDC", "100", "0xAlice").isAllowed());
        }
        @Test void denyUnlisted() {
            var e = engine(new PaymentPolicy.Builder().allowedRecipients(List.of("0xAlice")).build());
            assertFalse(e.evaluate("exact", "eip155:8453", "0xUSDC", "100", "0xEve").isAllowed());
        }
        @Test void caseInsensitive() {
            var e = engine(new PaymentPolicy.Builder().allowedRecipients(List.of("0xAlice")).build());
            assertTrue(e.evaluate("exact", "eip155:8453", "0xUSDC", "100", "0xalice").isAllowed());
        }
    }

    @Nested @DisplayName("BlockedRecipients")
    class BlockedRecipientsTests {
        @Test void denyBlocked() {
            var e = engine(new PaymentPolicy.Builder().blockedRecipients(List.of("0xEvil")).build());
            assertFalse(e.evaluate("exact", "eip155:8453", "0xUSDC", "100", "0xEvil").isAllowed());
        }
        @Test void allowNonBlocked() {
            var e = engine(new PaymentPolicy.Builder().blockedRecipients(List.of("0xEvil")).build());
            assertTrue(e.evaluate("exact", "eip155:8453", "0xUSDC", "100", "0xGood").isAllowed());
        }
    }

    @Nested @DisplayName("AllowedNetworks")
    class AllowedNetworksTests {
        @Test void allowListed() {
            var e = engine(new PaymentPolicy.Builder().allowedNetworks(List.of("eip155:8453")).build());
            assertTrue(e.evaluate("exact", "eip155:8453", "0xUSDC", "100", "0xR").isAllowed());
        }
        @Test void denyUnlisted() {
            var e = engine(new PaymentPolicy.Builder().allowedNetworks(List.of("eip155:8453")).build());
            assertFalse(e.evaluate("exact", "eip155:1", "0xUSDC", "100", "0xR").isAllowed());
        }
    }

    @Nested @DisplayName("AllowedSchemes")
    class AllowedSchemesTests {
        @Test void denyUnlisted() {
            var e = engine(new PaymentPolicy.Builder().allowedSchemes(List.of("exact")).build());
            assertFalse(e.evaluate("upto", "eip155:8453", "0xUSDC", "100", "0xR").isAllowed());
        }
    }

    @Nested @DisplayName("AllowedAssets")
    class AllowedAssetsTests {
        @Test void caseInsensitive() {
            var e = engine(new PaymentPolicy.Builder().allowedAssets(List.of("0xUSDC")).build());
            assertTrue(e.evaluate("exact", "eip155:8453", "0xusdc", "100", "0xR").isAllowed());
        }
        @Test void denyUnlisted() {
            var e = engine(new PaymentPolicy.Builder().allowedAssets(List.of("0xUSDC")).build());
            assertFalse(e.evaluate("exact", "eip155:8453", "0xUSDT", "100", "0xR").isAllowed());
        }
    }

    @Nested @DisplayName("CustomRules")
    class CustomRulesTests {
        @Test void customDeny() {
            var rule = new PolicyRule("no-odd", ctx ->
                ctx.getAmount().testBit(0) ? PolicyDecision.deny("odd amount") : PolicyDecision.allow());
            var e = engine(new PaymentPolicy.Builder().customRules(List.of(rule)).build());
            assertFalse(e.evaluate("exact", "eip155:8453", "0xUSDC", "101", "0xR").isAllowed());
        }
        @Test void customAllow() {
            var rule = new PolicyRule("ok", ctx -> PolicyDecision.allow());
            var e = engine(new PaymentPolicy.Builder().customRules(List.of(rule)).build());
            assertTrue(e.evaluate("exact", "eip155:8453", "0xUSDC", "100", "0xR").isAllowed());
        }
    }

    @Nested @DisplayName("Combined")
    class CombinedTests {
        @Test void multipleRules() {
            var e = engine(new PaymentPolicy.Builder()
                .maxAmountPerPayment(BigInteger.valueOf(1_000_000))
                .allowedNetworks(List.of("eip155:8453"))
                .blockedRecipients(List.of("0xEvil"))
                .build());
            assertTrue(e.evaluate("exact", "eip155:8453", "0xUSDC", "500000", "0xGood").isAllowed());
            assertFalse(e.evaluate("exact", "eip155:1", "0xUSDC", "500000", "0xGood").isAllowed());
            assertFalse(e.evaluate("exact", "eip155:8453", "0xUSDC", "2000000", "0xGood").isAllowed());
            assertFalse(e.evaluate("exact", "eip155:8453", "0xUSDC", "500000", "0xEvil").isAllowed());
        }
    }

    @Nested @DisplayName("SessionStats")
    class SessionStatsTests {
        @Test void tracking() {
            var e = engine(new PaymentPolicy.Builder().build());
            e.recordPayment("1000000");
            e.recordPayment("500000");
            var s = e.getStats();
            assertEquals(BigInteger.valueOf(1_500_000), s.totalAmountPaid());
            assertEquals(2, s.paymentCount());
        }
        @Test void reset() {
            var e = engine(new PaymentPolicy.Builder().build());
            e.recordPayment("1000000");
            e.reset();
            assertEquals(BigInteger.ZERO, e.getStats().totalAmountPaid());
        }
    }

    @Nested @DisplayName("EmptyPolicy")
    class EmptyPolicyTests {
        @Test void allowAll() {
            var e = engine(new PaymentPolicy.Builder().build());
            assertTrue(e.evaluate("exact", "eip155:8453", "0xUSDC", "999999999", "0xAnyone").isAllowed());
        }
        @Test void invalidAmount() {
            var e = engine(new PaymentPolicy.Builder().build());
            assertFalse(e.evaluate("exact", "eip155:8453", "0xUSDC", "not_a_number", "0xR").isAllowed());
        }
    }
}
