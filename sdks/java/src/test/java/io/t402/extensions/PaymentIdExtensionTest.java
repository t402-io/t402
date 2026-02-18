package io.t402.extensions;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class PaymentIdExtensionTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void declareGeneratesUuid() {
        PaymentIdExtension.Extension ext = PaymentIdExtension.declare();
        assertNotNull(ext.info.id);
        assertTrue(ext.info.id.matches(
                "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"));
        assertNotNull(ext.schema);
    }

    @Test
    void declareWithCustomId() {
        PaymentIdExtension.Extension ext = PaymentIdExtension.declare(
                "custom-id", null, null, null);
        assertEquals("custom-id", ext.info.id);
    }

    @Test
    void declareWithAllOptions() {
        Map<String, String> metadata = Map.of("orderId", "order-123");
        PaymentIdExtension.Extension ext = PaymentIdExtension.declare(
                "test-id", "idem-1", "group-1", metadata);

        assertEquals("test-id", ext.info.id);
        assertEquals("idem-1", ext.info.idempotencyKey);
        assertEquals("group-1", ext.info.groupId);
        assertEquals("order-123", ext.info.metadata.get("orderId"));
    }

    @Test
    void declareGeneratesUniqueIds() {
        PaymentIdExtension.Extension ext1 = PaymentIdExtension.declare();
        PaymentIdExtension.Extension ext2 = PaymentIdExtension.declare();
        assertNotEquals(ext1.info.id, ext2.info.id);
    }

    @Test
    void parseValidPayload() {
        Map<String, Object> extensions = new HashMap<>();
        extensions.put(PaymentIdExtension.EXTENSION_KEY,
                Map.of("id", "test-id", "clientId", "client-1"));

        PaymentIdExtension.Payload payload = PaymentIdExtension.parse(extensions);
        assertNotNull(payload);
        assertEquals("test-id", payload.id);
        assertEquals("client-1", payload.clientId);
    }

    @Test
    void parseReturnsNullWhenMissing() {
        assertNull(PaymentIdExtension.parse(Map.of()));
        assertNull(PaymentIdExtension.parse(null));
    }

    @Test
    void parseWithoutClientId() {
        Map<String, Object> extensions = new HashMap<>();
        extensions.put(PaymentIdExtension.EXTENSION_KEY, Map.of("id", "test-id"));

        PaymentIdExtension.Payload payload = PaymentIdExtension.parse(extensions);
        assertNotNull(payload);
        assertEquals("test-id", payload.id);
        assertNull(payload.clientId);
    }

    @Test
    void parseThrowsOnInvalidType() {
        Map<String, Object> extensions = Map.of(
                PaymentIdExtension.EXTENSION_KEY, "not-a-map");
        assertThrows(IllegalArgumentException.class,
                () -> PaymentIdExtension.parse(extensions));
    }

    @Test
    void parseThrowsOnMissingId() {
        Map<String, Object> extensions = new HashMap<>();
        extensions.put(PaymentIdExtension.EXTENSION_KEY,
                Map.of("clientId", "test"));
        assertThrows(IllegalArgumentException.class,
                () -> PaymentIdExtension.parse(extensions));
    }

    @Test
    void validateMatchingIds() {
        PaymentIdExtension.Payload payload = new PaymentIdExtension.Payload("test-id");
        PaymentIdExtension.Info expected = new PaymentIdExtension.Info("test-id");
        assertTrue(PaymentIdExtension.validate(payload, expected));
    }

    @Test
    void validateMismatchedIds() {
        PaymentIdExtension.Payload payload = new PaymentIdExtension.Payload("id-1");
        PaymentIdExtension.Info expected = new PaymentIdExtension.Info("id-2");
        assertFalse(PaymentIdExtension.validate(payload, expected));
    }

    @Test
    void infoJsonSerialization() throws Exception {
        PaymentIdExtension.Info info = new PaymentIdExtension.Info(
                "test-id", "idem-1", "group-1", Map.of("key", "value"));

        String json = mapper.writeValueAsString(info);
        PaymentIdExtension.Info deserialized = mapper.readValue(json, PaymentIdExtension.Info.class);

        assertEquals("test-id", deserialized.id);
        assertEquals("idem-1", deserialized.idempotencyKey);
        assertEquals("group-1", deserialized.groupId);
        assertEquals("value", deserialized.metadata.get("key"));
    }

    @Test
    void infoJsonOmitsNulls() throws Exception {
        PaymentIdExtension.Info info = new PaymentIdExtension.Info("test-id");
        String json = mapper.writeValueAsString(info);

        assertFalse(json.contains("idempotencyKey"));
        assertFalse(json.contains("groupId"));
        assertFalse(json.contains("metadata"));
    }
}
