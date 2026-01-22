package io.t402.model;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class PaymentPayloadTest {

    /* ------------ v2 format tests ------------ */

    @Test
    void v2HeaderRoundTripMaintainsFields() throws Exception {
        // Create v2 PaymentRequirements (accepted)
        PaymentRequirements accepted = new PaymentRequirements();
        accepted.scheme = "exact";
        accepted.network = "eip155:84532";  // CAIP-2 format
        accepted.amount = "10000";
        accepted.asset = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
        accepted.payTo = "0xReceiver";
        accepted.maxTimeoutSeconds = 60;

        // Create v2 ResourceInfo
        ResourceInfo resource = new ResourceInfo(
            "https://api.example.com/weather",
            "Weather data API",
            "application/json"
        );

        // Create v2 PaymentPayload
        PaymentPayload p = new PaymentPayload(resource, accepted, Map.of(
            "signature", "0x1234",
            "authorization", Map.of(
                "from", "0xPayer",
                "to", "0xReceiver",
                "value", "10000"
            )
        ));

        String header = p.toHeader();
        PaymentPayload decoded = PaymentPayload.fromHeader(header);

        assertEquals(2, decoded.t402Version);
        assertNotNull(decoded.resource);
        assertEquals("https://api.example.com/weather", decoded.resource.url);
        assertEquals("Weather data API", decoded.resource.description);
        assertEquals("application/json", decoded.resource.mimeType);
        assertNotNull(decoded.accepted);
        assertEquals("exact", decoded.accepted.scheme);
        assertEquals("eip155:84532", decoded.accepted.network);
        assertEquals("10000", decoded.accepted.amount);
        assertEquals(decoded.payload, p.payload);
    }

    @Test
    void v2BuilderCreatesCorrectPayload() throws Exception {
        PaymentRequirements accepted = new PaymentRequirements(
            "exact", "eip155:8453", "0xUSDC", "1000000", "0xReceiver", 30
        );

        PaymentPayload p = PaymentPayload.builder()
            .resource("https://api.example.com/data", "Premium data", "application/json")
            .accepted(accepted)
            .payload(Map.of("signature", "0xabc"))
            .extensions(Map.of("sessionId", "abc123"))
            .build();

        assertEquals(2, p.t402Version);
        assertEquals("https://api.example.com/data", p.resource.url);
        assertEquals("Premium data", p.resource.description);
        assertEquals("exact", p.accepted.scheme);
        assertEquals("eip155:8453", p.accepted.network);
        assertNotNull(p.extensions);
        assertEquals("abc123", p.extensions.get("sessionId"));
    }

    @Test
    void v2GetEffectiveSchemeAndNetwork() {
        PaymentRequirements accepted = new PaymentRequirements();
        accepted.scheme = "exact";
        accepted.network = "eip155:8453";

        PaymentPayload p = new PaymentPayload();
        p.accepted = accepted;

        assertEquals("exact", p.getEffectiveScheme());
        assertEquals("eip155:8453", p.getEffectiveNetwork());
    }

    /* ------------ v1 backward compatibility tests ------------ */

    @Test
    void v1HeaderRoundTripMaintainsFields() throws Exception {
        // Test backward compatibility with v1 format
        PaymentPayload p = new PaymentPayload();
        p.t402Version = 1;
        p.scheme = "exact";
        p.network = "base-sepolia";
        p.payload = Map.of(
            "amount", "123",
            "resource", "/weather",
            "nonce", "abc"
        );

        String header = p.toHeader();
        PaymentPayload decoded = PaymentPayload.fromHeader(header);

        assertEquals(p.t402Version, decoded.t402Version);
        assertEquals(p.scheme, decoded.scheme);
        assertEquals(p.network, decoded.network);
        assertEquals(p.payload, decoded.payload);
    }

    @Test
    void v1FieldsFallbackInGetters() {
        // When accepted is null, should fall back to v1 fields
        PaymentPayload p = new PaymentPayload();
        p.scheme = "exact";
        p.network = "base-sepolia";
        p.accepted = null;

        assertEquals("exact", p.getEffectiveScheme());
        assertEquals("base-sepolia", p.getEffectiveNetwork());
    }

    /* ------------ edge cases ------------ */

    @Test
    void nullResourceInfo() throws Exception {
        PaymentPayload p = new PaymentPayload();
        p.t402Version = 2;
        p.resource = null;
        p.accepted = new PaymentRequirements("exact", "eip155:8453", "USDC", "1000", "0x123", 30);
        p.payload = Map.of("test", "value");

        String header = p.toHeader();
        PaymentPayload decoded = PaymentPayload.fromHeader(header);

        assertEquals(2, decoded.t402Version);
        assertNull(decoded.resource);
        assertNotNull(decoded.accepted);
    }

    @Test
    void emptyExtensions() throws Exception {
        PaymentPayload p = PaymentPayload.builder()
            .resource(ResourceInfo.of("https://api.example.com"))
            .accepted(new PaymentRequirements("exact", "eip155:8453", "USDC", "1000", "0x123", 30))
            .payload(Map.of())
            .extensions(Map.of())
            .build();

        String header = p.toHeader();
        PaymentPayload decoded = PaymentPayload.fromHeader(header);

        assertNotNull(decoded.extensions);
        assertTrue(decoded.extensions.isEmpty());
    }

    @Test
    void resourceInfoFactoryMethods() {
        ResourceInfo r1 = ResourceInfo.of("https://example.com");
        assertEquals("https://example.com", r1.url);
        assertNull(r1.description);
        assertNull(r1.mimeType);

        ResourceInfo r2 = ResourceInfo.of("https://example.com", "application/json");
        assertEquals("https://example.com", r2.url);
        assertNull(r2.description);
        assertEquals("application/json", r2.mimeType);
    }
}
