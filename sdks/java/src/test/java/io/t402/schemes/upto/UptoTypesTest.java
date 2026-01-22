package io.t402.schemes.upto;

import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for Up-To scheme core types.
 */
class UptoTypesTest {

    /* ------------ Constants Tests ------------ */

    @Test
    void schemeConstant() {
        assertEquals("upto", UptoConstants.SCHEME);
    }

    @Test
    void defaultValues() {
        assertEquals("1000", UptoConstants.DEFAULT_MIN_AMOUNT);
        assertEquals(300, UptoConstants.DEFAULT_MAX_TIMEOUT_SECONDS);
    }

    @Test
    void supportedUnits() {
        assertEquals(7, UptoConstants.SUPPORTED_UNITS.size());
        assertTrue(UptoConstants.SUPPORTED_UNITS.contains("token"));
        assertTrue(UptoConstants.SUPPORTED_UNITS.contains("request"));
        assertTrue(UptoConstants.SUPPORTED_UNITS.contains("second"));
        assertTrue(UptoConstants.SUPPORTED_UNITS.contains("byte"));
    }

    @Test
    void isValidUnit() {
        assertTrue(UptoConstants.isValidUnit("token"));
        assertTrue(UptoConstants.isValidUnit("request"));
        assertTrue(UptoConstants.isValidUnit("byte"));
        assertFalse(UptoConstants.isValidUnit("invalid"));
        assertFalse(UptoConstants.isValidUnit(""));
    }

    /* ------------ PaymentRequirements Tests ------------ */

    @Test
    void paymentRequirementsHasUptoScheme() {
        UptoPaymentRequirements req = new UptoPaymentRequirements(
            "eip155:8453", "1000000", "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            "0x1234567890123456789012345678901234567890", 300
        );

        assertEquals("upto", req.scheme);
        assertEquals("1000000", req.maxAmount);
        assertEquals("1000", req.minAmount);  // default
    }

    @Test
    void paymentRequirementsBuilder() {
        UptoPaymentRequirements req = UptoPaymentRequirements.builder()
            .network("eip155:8453")
            .maxAmount("1000000")
            .minAmount("10000")
            .asset("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")
            .payTo("0x1234567890123456789012345678901234567890")
            .maxTimeoutSeconds(600)
            .extra(new UptoExtra("token", "100"))
            .build();

        assertEquals("upto", req.scheme);
        assertEquals("eip155:8453", req.network);
        assertEquals("1000000", req.maxAmount);
        assertEquals("10000", req.minAmount);
        assertEquals(600, req.maxTimeoutSeconds);
        assertNotNull(req.extra);
        assertEquals("token", req.extra.unit);
    }

    @Test
    void paymentRequirementsWithExtra() {
        UptoPaymentRequirements req = new UptoPaymentRequirements(
            "eip155:8453", "1000000", "0x123", "0x456", 300
        ).withExtra(new UptoExtra("token", "100"));

        assertNotNull(req.extra);
        assertEquals("token", req.extra.unit);
        assertEquals("100", req.extra.unitPrice);
    }

    /* ------------ Extra Tests ------------ */

    @Test
    void extraBillingConfiguration() {
        UptoExtra extra = new UptoExtra("token", "100");

        assertEquals("token", extra.unit);
        assertEquals("100", extra.unitPrice);
    }

    @Test
    void extraEIP712Parameters() {
        UptoExtra extra = new UptoExtra("USD Coin", "2", "0xrouter");

        assertEquals("USD Coin", extra.name);
        assertEquals("2", extra.version);
        assertEquals("0xrouter", extra.routerAddress);
    }

    @Test
    void extraChaining() {
        UptoExtra extra = new UptoExtra("token", "100")
            .withName("USD Coin")
            .withVersion("2")
            .withRouterAddress("0xrouter");

        assertEquals("token", extra.unit);
        assertEquals("USD Coin", extra.name);
        assertEquals("2", extra.version);
        assertEquals("0xrouter", extra.routerAddress);
    }

    /* ------------ Settlement Tests ------------ */

    @Test
    void settlementContainsAmount() {
        UptoSettlement settlement = new UptoSettlement("150000");

        assertEquals("150000", settlement.settleAmount);
        assertNull(settlement.usageDetails);
    }

    @Test
    void settlementWithUsageDetails() {
        UptoSettlement settlement = UptoSettlement.of("150000")
            .withUsageDetails(new UptoUsageDetails(1500, "100", "token"));

        assertEquals("150000", settlement.settleAmount);
        assertNotNull(settlement.usageDetails);
        assertEquals(1500, settlement.usageDetails.unitsConsumed);
    }

    /* ------------ UsageDetails Tests ------------ */

    @Test
    void usageDetailsTracksMetrics() {
        UptoUsageDetails usage = new UptoUsageDetails(1500, "100", "token")
            .withTimeRange(1740672000L, 1740675600L);

        assertEquals(1500, usage.unitsConsumed);
        assertEquals("100", usage.unitPrice);
        assertEquals("token", usage.unitType);
        assertEquals(1740672000L, usage.startTime);
        assertEquals(1740675600L, usage.endTime);
    }

    @Test
    void usageDetailsWithMetadata() {
        UptoUsageDetails usage = UptoUsageDetails.of(1500, "100", "token")
            .withMetadata(Map.of("model", "gpt-4", "promptTokens", 100));

        assertEquals(1500, usage.unitsConsumed);
        assertNotNull(usage.metadata);
        assertEquals("gpt-4", usage.metadata.get("model"));
    }

    /* ------------ SettlementResponse Tests ------------ */

    @Test
    void settlementResponseSuccess() {
        UptoSettlementResponse response = UptoSettlementResponse.success("150000", "1000000", "0xabc123");

        assertTrue(response.success);
        assertEquals("150000", response.settledAmount);
        assertEquals("1000000", response.maxAmount);
        assertEquals("0xabc123", response.transactionHash);
    }

    @Test
    void settlementResponseFailure() {
        UptoSettlementResponse response = UptoSettlementResponse.failure("1000000", "Insufficient balance");

        assertFalse(response.success);
        assertEquals("0", response.settledAmount);
        assertEquals("1000000", response.maxAmount);
        assertEquals("Insufficient balance", response.error);
    }

    @Test
    void settlementResponseWithBlockDetails() {
        UptoSettlementResponse response = UptoSettlementResponse.success("150000", "1000000")
            .withBlockNumber(12345678L)
            .withGasUsed("85000");

        assertEquals(12345678L, response.blockNumber);
        assertEquals("85000", response.gasUsed);
    }

    /* ------------ ValidationResult Tests ------------ */

    @Test
    void validationResultValid() {
        UptoValidationResult result = UptoValidationResult.valid(
            "1000000", "0x1234567890123456789012345678901234567890", 1740675600L
        );

        assertTrue(result.isValid);
        assertEquals("1000000", result.validatedMaxAmount);
        assertEquals("0x1234567890123456789012345678901234567890", result.payer);
        assertEquals(1740675600L, result.expiresAt);
    }

    @Test
    void validationResultInvalid() {
        UptoValidationResult result = UptoValidationResult.invalid("Permit signature is invalid");

        assertFalse(result.isValid);
        assertEquals("Permit signature is invalid", result.invalidReason);
    }

    /* ------------ Utils Tests ------------ */

    @Test
    void isUptoPaymentRequirementsTrue() {
        Map<String, Object> data = new HashMap<>();
        data.put("scheme", "upto");
        data.put("network", "eip155:8453");
        data.put("maxAmount", "1000000");
        data.put("asset", "0x123");
        data.put("payTo", "0x456");

        assertTrue(UptoUtils.isUptoPaymentRequirements(data));
    }

    @Test
    void isUptoPaymentRequirementsFalseForExact() {
        Map<String, Object> data = new HashMap<>();
        data.put("scheme", "exact");
        data.put("amount", "1000000");

        assertFalse(UptoUtils.isUptoPaymentRequirements(data));
    }

    @Test
    void isUptoPaymentRequirementsFalseMissingMaxAmount() {
        Map<String, Object> data = new HashMap<>();
        data.put("scheme", "upto");
        data.put("amount", "1000000");  // wrong field

        assertFalse(UptoUtils.isUptoPaymentRequirements(data));
    }

    @Test
    void isUptoPaymentRequirementsFalseForNull() {
        assertFalse(UptoUtils.isUptoPaymentRequirements(null));
    }

    @Test
    void createPaymentRequirements() {
        UptoPaymentRequirements req = UptoUtils.createPaymentRequirements(
            "eip155:8453", "1000000", "0x123", "0x456"
        );

        assertEquals("upto", req.scheme);
        assertEquals("eip155:8453", req.network);
        assertEquals("1000000", req.maxAmount);
        assertEquals(UptoConstants.DEFAULT_MIN_AMOUNT, req.minAmount);
        assertEquals(UptoConstants.DEFAULT_MAX_TIMEOUT_SECONDS, req.maxTimeoutSeconds);
    }

    @Test
    void createSettlement() {
        UptoSettlement settlement = UptoUtils.createSettlement("150000");

        assertEquals("150000", settlement.settleAmount);
        assertNull(settlement.usageDetails);
    }

    @Test
    void createSettlementWithUsageDetails() {
        UptoSettlement settlement = UptoUtils.createSettlement("150000", 1500, "100", "token");

        assertEquals("150000", settlement.settleAmount);
        assertNotNull(settlement.usageDetails);
        assertEquals(1500, settlement.usageDetails.unitsConsumed);
        assertEquals("100", settlement.usageDetails.unitPrice);
        assertEquals("token", settlement.usageDetails.unitType);
    }
}
