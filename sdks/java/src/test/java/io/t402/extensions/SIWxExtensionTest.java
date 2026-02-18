package io.t402.extensions;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class SIWxExtensionTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void declareCreatesExtension() {
        SIWxExtension.Extension ext = SIWxExtension.declare(
                "https://api.example.com/premium", "eip155:8453");

        assertEquals("api.example.com", ext.info.domain);
        assertEquals("https://api.example.com/premium", ext.info.uri);
        assertEquals("eip155:8453", ext.info.chainId);
        assertEquals("1", ext.info.version);
        assertNotNull(ext.info.nonce);
        assertEquals(32, ext.info.nonce.length());
        assertNotNull(ext.info.issuedAt);
        assertNotNull(ext.info.expirationTime);
        assertEquals(List.of("https://api.example.com/premium"), ext.info.resources);
        assertNotNull(ext.schema);
    }

    @Test
    void declareWithOptions() {
        String customExpiration = "2030-01-01T00:00:00Z";
        SIWxExtension.Extension ext = SIWxExtension.declare(
                "https://api.example.com/resource", "solana:mainnet",
                "Sign in to access", customExpiration, "siws");

        assertEquals("Sign in to access", ext.info.statement);
        assertEquals(customExpiration, ext.info.expirationTime);
        assertEquals("siws", ext.info.signatureScheme);
    }

    @Test
    void declareGeneratesUniqueNonces() {
        SIWxExtension.Extension ext1 = SIWxExtension.declare(
                "https://example.com", "eip155:1");
        SIWxExtension.Extension ext2 = SIWxExtension.declare(
                "https://example.com", "eip155:1");
        assertNotEquals(ext1.info.nonce, ext2.info.nonce);
    }

    @Test
    void parseValidPayload() {
        Map<String, Object> siwxData = new HashMap<>();
        siwxData.put("domain", "api.example.com");
        siwxData.put("address", "0x1234");
        siwxData.put("uri", "https://api.example.com/resource");
        siwxData.put("version", "1");
        siwxData.put("chainId", "eip155:8453");
        siwxData.put("nonce", "abc123");
        siwxData.put("issuedAt", "2025-01-01T00:00:00Z");
        siwxData.put("signature", "0xsig");

        Map<String, Object> extensions = Map.of(SIWxExtension.EXTENSION_KEY, siwxData);

        SIWxExtension.Payload payload = SIWxExtension.parse(extensions);
        assertNotNull(payload);
        assertEquals("api.example.com", payload.domain);
        assertEquals("0x1234", payload.address);
        assertEquals("0xsig", payload.signature);
    }

    @Test
    void parseReturnsNullWhenMissing() {
        assertNull(SIWxExtension.parse(Map.of()));
        assertNull(SIWxExtension.parse(null));
    }

    @Test
    void parseThrowsOnInvalidType() {
        Map<String, Object> extensions = Map.of(SIWxExtension.EXTENSION_KEY, "invalid");
        assertThrows(IllegalArgumentException.class,
                () -> SIWxExtension.parse(extensions));
    }

    @Test
    void parseThrowsOnMissingField() {
        Map<String, Object> siwxData = Map.of("domain", "example.com");
        Map<String, Object> extensions = Map.of(SIWxExtension.EXTENSION_KEY, siwxData);
        assertThrows(IllegalArgumentException.class,
                () -> SIWxExtension.parse(extensions));
    }

    @Test
    void validateValidMessage() {
        SIWxExtension.Payload payload = new SIWxExtension.Payload();
        payload.domain = "api.example.com";
        payload.uri = "https://api.example.com/resource";
        payload.version = "1";
        payload.issuedAt = Instant.now().toString();

        String result = SIWxExtension.validate(
                payload, "https://api.example.com/resource", 300);
        assertNull(result);
    }

    @Test
    void validateDomainMismatch() {
        SIWxExtension.Payload payload = new SIWxExtension.Payload();
        payload.domain = "other.example.com";
        payload.uri = "https://other.example.com/resource";
        payload.version = "1";
        payload.issuedAt = Instant.now().toString();

        String result = SIWxExtension.validate(
                payload, "https://api.example.com/resource", 300);
        assertNotNull(result);
        assertTrue(result.contains("Domain mismatch"));
    }

    @Test
    void validateExpiredMessage() {
        SIWxExtension.Payload payload = new SIWxExtension.Payload();
        payload.domain = "api.example.com";
        payload.uri = "https://api.example.com/resource";
        payload.version = "1";
        payload.issuedAt = Instant.now().minus(10, ChronoUnit.MINUTES).toString();

        String result = SIWxExtension.validate(
                payload, "https://api.example.com/resource", 300);
        assertNotNull(result);
        assertTrue(result.contains("expired"));
    }

    @Test
    void validateUnsupportedVersion() {
        SIWxExtension.Payload payload = new SIWxExtension.Payload();
        payload.domain = "api.example.com";
        payload.uri = "https://api.example.com/resource";
        payload.version = "99";
        payload.issuedAt = Instant.now().toString();

        String result = SIWxExtension.validate(
                payload, "https://api.example.com/resource", 300);
        assertNotNull(result);
        assertTrue(result.contains("Unsupported version"));
    }

    @Test
    void infoJsonSerialization() throws Exception {
        SIWxExtension.Info info = new SIWxExtension.Info();
        info.domain = "example.com";
        info.uri = "https://example.com/api";
        info.version = "1";
        info.chainId = "eip155:1";
        info.nonce = "test-nonce";

        String json = mapper.writeValueAsString(info);
        SIWxExtension.Info deserialized = mapper.readValue(json, SIWxExtension.Info.class);

        assertEquals("example.com", deserialized.domain);
        assertEquals("eip155:1", deserialized.chainId);
    }

    @Test
    void infoJsonOmitsNulls() throws Exception {
        SIWxExtension.Info info = new SIWxExtension.Info();
        info.domain = "example.com";
        info.version = "1";

        String json = mapper.writeValueAsString(info);
        assertFalse(json.contains("statement"));
        assertFalse(json.contains("notBefore"));
        assertFalse(json.contains("requestId"));
    }
}
