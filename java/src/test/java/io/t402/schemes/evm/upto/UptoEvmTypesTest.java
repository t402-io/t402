package io.t402.schemes.evm.upto;

import org.junit.jupiter.api.Test;

import java.math.BigInteger;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for Up-To EVM scheme types.
 */
class UptoEvmTypesTest {

    /* ------------ PermitSignature Tests ------------ */

    @Test
    void permitSignatureStructure() {
        PermitSignature sig = new PermitSignature(
            27,
            "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            "0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321"
        );

        assertEquals(27, sig.v);
        assertEquals(66, sig.r.length());  // 0x + 64 hex chars
        assertEquals(66, sig.s.length());
    }

    @Test
    void permitSignatureFactory() {
        PermitSignature sig = PermitSignature.of(28, "0x1234", "0x5678");

        assertEquals(28, sig.v);
        assertEquals("0x1234", sig.r);
        assertEquals("0x5678", sig.s);
    }

    /* ------------ PermitAuthorization Tests ------------ */

    @Test
    void permitAuthorizationStructure() {
        PermitAuthorization auth = new PermitAuthorization(
            "0x1234567890123456789012345678901234567890",
            "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
            "1000000",
            "1740675689",
            5
        );

        assertEquals(42, auth.owner.length());  // 0x + 40 hex chars
        assertEquals(42, auth.spender.length());
        assertEquals("1000000", auth.value);
        assertEquals("1740675689", auth.deadline);
        assertEquals(5, auth.nonce);
    }

    @Test
    void permitAuthorizationBuilder() {
        PermitAuthorization auth = PermitAuthorization.builder()
            .owner("0xowner")
            .spender("0xspender")
            .value("1000000")
            .deadline("1740675689")
            .nonce(5)
            .build();

        assertEquals("0xowner", auth.owner);
        assertEquals("0xspender", auth.spender);
        assertEquals("1000000", auth.value);
        assertEquals(5, auth.nonce);
    }

    /* ------------ UptoEIP2612Payload Tests ------------ */

    @Test
    void eip2612PayloadStructure() {
        UptoEIP2612Payload payload = new UptoEIP2612Payload(
            new PermitSignature(28, "0x1234", "0x5678"),
            new PermitAuthorization("0xowner", "0xspender", "1000000", "1740675689", 0),
            "0xf3746613c2d920b5fdabc0856f2aeb2d4f88ee6037b8cc5d04a71a4462f13480"
        );

        assertEquals(28, payload.signature.v);
        assertEquals("0xowner", payload.authorization.owner);
        assertEquals(66, payload.paymentNonce.length());
    }

    @Test
    void eip2612PayloadBuilder() {
        UptoEIP2612Payload payload = UptoEIP2612Payload.builder()
            .signature(28, "0x1234", "0x5678")
            .authorization(PermitAuthorization.builder()
                .owner("0xowner")
                .spender("0xspender")
                .value("1000000")
                .deadline("1740675689")
                .nonce(5)
                .build())
            .paymentNonce("0xnonce")
            .build();

        assertEquals(28, payload.signature.v);
        assertEquals("0xowner", payload.authorization.owner);
        assertEquals("0xnonce", payload.paymentNonce);
    }

    @Test
    void eip2612PayloadToMap() {
        UptoEIP2612Payload payload = new UptoEIP2612Payload(
            new PermitSignature(28, "0x1234", "0x5678"),
            new PermitAuthorization("0xowner", "0xspender", "1000000", "1740675689", 5),
            "0xnonce"
        );

        Map<String, Object> result = payload.toMap();

        assertEquals("0xnonce", result.get("paymentNonce"));
        @SuppressWarnings("unchecked")
        Map<String, Object> sigMap = (Map<String, Object>) result.get("signature");
        assertEquals(28, sigMap.get("v"));
        @SuppressWarnings("unchecked")
        Map<String, Object> authMap = (Map<String, Object>) result.get("authorization");
        assertEquals("0xowner", authMap.get("owner"));
    }

    @Test
    void eip2612PayloadFromMap() {
        Map<String, Object> data = new HashMap<>();
        data.put("paymentNonce", "0xnonce");
        data.put("signature", Map.of("v", 28, "r", "0x1234", "s", "0x5678"));
        data.put("authorization", Map.of(
            "owner", "0xowner",
            "spender", "0xspender",
            "value", "1000000",
            "deadline", "1740675689",
            "nonce", 5
        ));

        UptoEIP2612Payload payload = UptoEIP2612Payload.fromMap(data);

        assertEquals(28, payload.signature.v);
        assertEquals("0x1234", payload.signature.r);
        assertEquals("0xowner", payload.authorization.owner);
        assertEquals(5, payload.authorization.nonce);
        assertEquals("0xnonce", payload.paymentNonce);
    }

    /* ------------ UptoEvmExtra Tests ------------ */

    @Test
    void evmExtraEIP712Parameters() {
        UptoEvmExtra extra = new UptoEvmExtra("USD Coin", "2");

        assertEquals("USD Coin", extra.name);
        assertEquals("2", extra.version);
    }

    @Test
    void evmExtraWithRouterAddress() {
        UptoEvmExtra extra = new UptoEvmExtra("USD Coin", "2", "0xrouter");

        assertEquals("USD Coin", extra.name);
        assertEquals("2", extra.version);
        assertEquals("0xrouter", extra.routerAddress);
    }

    @Test
    void evmExtraChaining() {
        UptoEvmExtra extra = new UptoEvmExtra("USD Coin", "2")
            .withRouterAddress("0xrouter")
            .withUnit("token")
            .withUnitPrice("100");

        assertEquals("USD Coin", extra.name);
        assertEquals("0xrouter", extra.routerAddress);
        assertEquals("token", extra.unit);
        assertEquals("100", extra.unitPrice);
    }

    /* ------------ UptoEvmTypes Tests ------------ */

    @Test
    void permitTypeFields() {
        assertEquals(5, UptoEvmTypes.PERMIT_TYPE_FIELDS.size());

        var fieldNames = UptoEvmTypes.PERMIT_TYPE_FIELDS.stream()
            .map(f -> f.name)
            .toList();
        assertTrue(fieldNames.contains("owner"));
        assertTrue(fieldNames.contains("spender"));
        assertTrue(fieldNames.contains("value"));
        assertTrue(fieldNames.contains("nonce"));
        assertTrue(fieldNames.contains("deadline"));
    }

    @Test
    void domainTypeFields() {
        assertEquals(4, UptoEvmTypes.DOMAIN_TYPE_FIELDS.size());

        var fieldNames = UptoEvmTypes.DOMAIN_TYPE_FIELDS.stream()
            .map(f -> f.name)
            .toList();
        assertTrue(fieldNames.contains("name"));
        assertTrue(fieldNames.contains("version"));
        assertTrue(fieldNames.contains("chainId"));
        assertTrue(fieldNames.contains("verifyingContract"));
    }

    @Test
    void createPermitDomain() {
        Map<String, Object> domain = UptoEvmTypes.createPermitDomain(
            "USD Coin", "2", 8453L, "0xtoken"
        );

        assertEquals("USD Coin", domain.get("name"));
        assertEquals("2", domain.get("version"));
        assertEquals(8453L, domain.get("chainId"));
        assertEquals("0xtoken", domain.get("verifyingContract"));
    }

    @Test
    void createPermitMessage() {
        PermitAuthorization auth = new PermitAuthorization(
            "0xowner", "0xspender", "1000000", "1740675689", 5
        );

        Map<String, Object> message = UptoEvmTypes.createPermitMessage(auth);

        assertEquals("0xowner", message.get("owner"));
        assertEquals("0xspender", message.get("spender"));
        assertEquals(new BigInteger("1000000"), message.get("value"));
        assertEquals(BigInteger.valueOf(5), message.get("nonce"));
        assertEquals(new BigInteger("1740675689"), message.get("deadline"));
    }

    @Test
    void isEIP2612PayloadValidPayload() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("signature", Map.of("v", 28, "r", "0x123", "s", "0x456"));
        payload.put("authorization", Map.of(
            "owner", "0x123",
            "spender", "0x456",
            "value", "1000",
            "deadline", "123456",
            "nonce", 0
        ));
        payload.put("paymentNonce", "0xabc");

        assertTrue(UptoEvmTypes.isEIP2612Payload(payload));
    }

    @Test
    void isEIP2612PayloadInvalidPayloads() {
        assertFalse(UptoEvmTypes.isEIP2612Payload(null));
        assertFalse(UptoEvmTypes.isEIP2612Payload(new HashMap<>()));

        // String signature instead of object
        Map<String, Object> stringSignature = new HashMap<>();
        stringSignature.put("signature", "0x123");
        stringSignature.put("authorization", Map.of("owner", "0x123"));
        assertFalse(UptoEvmTypes.isEIP2612Payload(stringSignature));

        // Incomplete signature
        Map<String, Object> incompleteSignature = new HashMap<>();
        incompleteSignature.put("signature", Map.of("v", 28));  // missing r, s
        incompleteSignature.put("authorization", Map.of("owner", "0x123"));
        assertFalse(UptoEvmTypes.isEIP2612Payload(incompleteSignature));
    }

    @Test
    void isEIP2612PayloadRejectsExactScheme() {
        // Exact scheme has string signature
        Map<String, Object> exactPayload = new HashMap<>();
        exactPayload.put("signature", "0x123");  // string, not object
        exactPayload.put("authorization", Map.of(
            "from", "0x123",
            "to", "0x456",
            "value", "1000",
            "validAfter", "0",
            "validBefore", "999999",
            "nonce", "0xabc"
        ));

        assertFalse(UptoEvmTypes.isEIP2612Payload(exactPayload));
    }

    /* ------------ Settlement Tests ------------ */

    @Test
    void evmSettlement() {
        UptoEvmSettlement settlement = UptoEvmSettlement.of("150000");

        assertEquals("150000", settlement.settleAmount);
        assertNull(settlement.usageDetails);
    }

    @Test
    void evmSettlementWithUsageDetails() {
        UptoEvmSettlement settlement = UptoEvmSettlement.of("150000")
            .withUsageDetails(UptoEvmUsageDetails.of(1500, "100", "token")
                .withTimeRange(1740672000L, 1740675600L));

        assertEquals("150000", settlement.settleAmount);
        assertNotNull(settlement.usageDetails);
        assertEquals(1500, settlement.usageDetails.unitsConsumed);
        assertEquals(1740672000L, settlement.usageDetails.startTime);
    }

    /* ------------ UsageDetails Tests ------------ */

    @Test
    void evmUsageDetails() {
        UptoEvmUsageDetails usage = new UptoEvmUsageDetails(1500, "100", "token");

        assertEquals(1500, usage.unitsConsumed);
        assertEquals("100", usage.unitPrice);
        assertEquals("token", usage.unitType);
    }

    @Test
    void evmUsageDetailsWithTimeRange() {
        UptoEvmUsageDetails usage = UptoEvmUsageDetails.of(1500, "100", "token")
            .withTimeRange(1740672000L, 1740675600L);

        assertEquals(1740672000L, usage.startTime);
        assertEquals(1740675600L, usage.endTime);
    }
}
