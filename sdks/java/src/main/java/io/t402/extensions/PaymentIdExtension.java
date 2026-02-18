package io.t402.extensions;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.Map;
import java.util.UUID;

/**
 * Payment ID Extension for the t402 protocol.
 *
 * <p>Allows servers to attach unique identifiers to payments for
 * correlation, idempotency, and audit trails.</p>
 */
public class PaymentIdExtension {

    /** Extension key for payment ID in requirements/payload extensions. */
    public static final String EXTENSION_KEY = "paymentId";

    /**
     * Server-declared payment identifier information.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Info {
        public String id;
        public String idempotencyKey;
        public String groupId;
        public Map<String, String> metadata;

        public Info() {}

        public Info(String id) {
            this.id = id;
        }

        public Info(String id, String idempotencyKey, String groupId, Map<String, String> metadata) {
            this.id = id;
            this.idempotencyKey = idempotencyKey;
            this.groupId = groupId;
            this.metadata = metadata;
        }
    }

    /**
     * Full payment ID extension structure.
     */
    public static class Extension {
        public Info info;
        public Map<String, Object> schema;

        public Extension() {}

        public Extension(Info info, Map<String, Object> schema) {
            this.info = info;
            this.schema = schema;
        }
    }

    /**
     * Payment ID payload echoed back by the client.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Payload {
        public String id;
        public String clientId;

        public Payload() {}

        public Payload(String id) {
            this.id = id;
        }

        public Payload(String id, String clientId) {
            this.id = id;
            this.clientId = clientId;
        }
    }

    private static final Map<String, Object> SCHEMA = Map.of(
            "type", "object",
            "required", new String[]{"id"},
            "properties", Map.of(
                    "id", Map.of("type", "string", "format", "uuid"),
                    "clientId", Map.of("type", "string")
            )
    );

    /**
     * Declares a payment ID extension with a generated UUID.
     *
     * @return a new Extension with a random UUID
     */
    public static Extension declare() {
        return declare(null, null, null, null);
    }

    /**
     * Declares a payment ID extension with the given options.
     *
     * @param id custom payment ID (null for auto-generated UUID)
     * @param idempotencyKey optional idempotency key
     * @param groupId optional group ID
     * @param metadata optional metadata
     * @return a new Extension
     */
    public static Extension declare(String id, String idempotencyKey, String groupId,
                                     Map<String, String> metadata) {
        String effectiveId = id != null ? id : UUID.randomUUID().toString();
        Info info = new Info(effectiveId, idempotencyKey, groupId, metadata);
        return new Extension(info, SCHEMA);
    }

    /**
     * Parses a payment ID payload from extensions map.
     *
     * @param extensions the extensions map from payment payload
     * @return the parsed Payload, or null if not present
     * @throws IllegalArgumentException if the extension is present but invalid
     */
    @SuppressWarnings("unchecked")
    public static Payload parse(Map<String, Object> extensions) {
        if (extensions == null || !extensions.containsKey(EXTENSION_KEY)) {
            return null;
        }

        Object raw = extensions.get(EXTENSION_KEY);
        if (!(raw instanceof Map)) {
            throw new IllegalArgumentException("Invalid paymentId extension: expected Map");
        }

        Map<String, Object> map = (Map<String, Object>) raw;
        Object idObj = map.get("id");
        if (!(idObj instanceof String) || ((String) idObj).isEmpty()) {
            throw new IllegalArgumentException("Invalid paymentId extension: missing or empty id");
        }

        String id = (String) idObj;
        String clientId = map.get("clientId") instanceof String ? (String) map.get("clientId") : null;

        return new Payload(id, clientId);
    }

    /**
     * Validates that a client's payment ID matches the expected one.
     *
     * @param payload the client's payment ID payload
     * @param expected the expected payment ID info from the server
     * @return true if the IDs match
     */
    public static boolean validate(Payload payload, Info expected) {
        return payload.id != null && payload.id.equals(expected.id);
    }
}
