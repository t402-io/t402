package io.t402.extensions;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.net.URI;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

/**
 * Sign-In-With-X (SIWx) Extension for the t402 protocol.
 *
 * <p>Provides CAIP-122 compliant wallet-based identity assertions,
 * allowing clients to prove control of a wallet address.</p>
 */
public class SIWxExtension {

    /** Extension key for SIWx in requirements/payload extensions. */
    public static final String EXTENSION_KEY = "siwx";

    /** HTTP header name for SIWx payload. */
    public static final String HEADER_NAME = "X-T402-SIWx";

    /**
     * Server-side SIWx declaration.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Info {
        public String domain;
        public String uri;
        public String statement;
        public String version;
        public String chainId;
        public String nonce;
        public String issuedAt;
        public String expirationTime;
        public String notBefore;
        public String requestId;
        public List<String> resources;
        public String signatureScheme;

        public Info() {}
    }

    /**
     * Client-side SIWx response.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Payload {
        public String domain;
        public String address;
        public String statement;
        public String uri;
        public String version;
        public String chainId;
        public String nonce;
        public String issuedAt;
        public String expirationTime;
        public String notBefore;
        public String requestId;
        public List<String> resources;
        public String signature;

        public Payload() {}
    }

    /**
     * Full SIWx extension structure.
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

    private static final Map<String, Object> SIWX_SCHEMA = Map.ofEntries(
            Map.entry("type", "object"),
            Map.entry("required", List.of("domain", "address", "uri", "version", "chainId", "nonce", "issuedAt", "signature")),
            Map.entry("properties", Map.ofEntries(
                    Map.entry("domain", Map.of("type", "string")),
                    Map.entry("address", Map.of("type", "string")),
                    Map.entry("statement", Map.of("type", "string")),
                    Map.entry("uri", Map.of("type", "string")),
                    Map.entry("version", Map.of("type", "string")),
                    Map.entry("chainId", Map.of("type", "string")),
                    Map.entry("nonce", Map.of("type", "string")),
                    Map.entry("issuedAt", Map.of("type", "string")),
                    Map.entry("signature", Map.of("type", "string"))
            ))
    );

    private static final SecureRandom RANDOM = new SecureRandom();

    /**
     * Declares a SIWx extension for server responses.
     *
     * @param resourceUri full URI of the resource
     * @param network network in CAIP-2 format (e.g., "eip155:8453")
     * @return a new Extension
     */
    public static Extension declare(String resourceUri, String network) {
        return declare(resourceUri, network, null, null, null);
    }

    /**
     * Declares a SIWx extension for server responses with options.
     *
     * @param resourceUri full URI of the resource
     * @param network network in CAIP-2 format
     * @param statement optional statement
     * @param expirationTime optional custom expiration time (ISO 8601)
     * @param signatureScheme optional preferred signature scheme
     * @return a new Extension
     */
    public static Extension declare(String resourceUri, String network,
                                     String statement, String expirationTime,
                                     String signatureScheme) {
        URI parsed = URI.create(resourceUri);
        String domain = parsed.getHost();
        if (parsed.getPort() > 0) {
            domain += ":" + parsed.getPort();
        }

        Instant now = Instant.now();
        String effectiveExpiration = expirationTime != null ? expirationTime
                : now.plus(5, ChronoUnit.MINUTES).toString();

        Info info = new Info();
        info.domain = domain;
        info.uri = resourceUri;
        info.statement = statement;
        info.version = "1";
        info.chainId = network;
        info.nonce = generateNonce();
        info.issuedAt = now.toString();
        info.expirationTime = effectiveExpiration;
        info.resources = List.of(resourceUri);
        info.signatureScheme = signatureScheme;

        return new Extension(info, SIWX_SCHEMA);
    }

    /**
     * Parses a SIWx payload from extensions map.
     *
     * @param extensions the extensions map
     * @return the parsed Payload, or null if not present
     * @throws IllegalArgumentException if present but invalid
     */
    @SuppressWarnings("unchecked")
    public static Payload parse(Map<String, Object> extensions) {
        if (extensions == null || !extensions.containsKey(EXTENSION_KEY)) {
            return null;
        }

        Object raw = extensions.get(EXTENSION_KEY);
        if (!(raw instanceof Map)) {
            throw new IllegalArgumentException("Invalid siwx extension: expected Map");
        }

        Map<String, Object> map = (Map<String, Object>) raw;

        List<String> required = List.of("domain", "address", "uri", "version", "chainId", "nonce", "issuedAt", "signature");
        for (String field : required) {
            if (!map.containsKey(field)) {
                throw new IllegalArgumentException("Invalid siwx extension: missing " + field);
            }
        }

        Payload payload = new Payload();
        payload.domain = (String) map.get("domain");
        payload.address = (String) map.get("address");
        payload.statement = (String) map.get("statement");
        payload.uri = (String) map.get("uri");
        payload.version = (String) map.get("version");
        payload.chainId = (String) map.get("chainId");
        payload.nonce = (String) map.get("nonce");
        payload.issuedAt = (String) map.get("issuedAt");
        payload.expirationTime = (String) map.get("expirationTime");
        payload.notBefore = (String) map.get("notBefore");
        payload.requestId = (String) map.get("requestId");
        payload.signature = (String) map.get("signature");

        if (map.get("resources") instanceof List) {
            payload.resources = (List<String>) map.get("resources");
        }

        return payload;
    }

    /**
     * Validates a SIWx message against expected values.
     *
     * @param payload the SIWx payload to validate
     * @param expectedResourceUri the expected resource URI
     * @param maxAgeSeconds maximum age of issuedAt in seconds
     * @return null if valid, error message if invalid
     */
    public static String validate(Payload payload, String expectedResourceUri, long maxAgeSeconds) {
        URI parsed = URI.create(expectedResourceUri);
        String expectedDomain = parsed.getHost();
        if (parsed.getPort() > 0) {
            expectedDomain += ":" + parsed.getPort();
        }

        if (!expectedDomain.equals(payload.domain)) {
            return "Domain mismatch: expected " + expectedDomain + ", got " + payload.domain;
        }

        if (!expectedResourceUri.equals(payload.uri)) {
            return "URI mismatch: expected " + expectedResourceUri + ", got " + payload.uri;
        }

        if (!"1".equals(payload.version)) {
            return "Unsupported version: " + payload.version;
        }

        Instant issuedAt = Instant.parse(payload.issuedAt);
        long ageSeconds = Instant.now().getEpochSecond() - issuedAt.getEpochSecond();
        if (ageSeconds > maxAgeSeconds) {
            return "Message has expired (issuedAt too old)";
        }

        if (payload.expirationTime != null) {
            Instant expiration = Instant.parse(payload.expirationTime);
            if (Instant.now().isAfter(expiration)) {
                return "Message has expired";
            }
        }

        if (payload.notBefore != null) {
            Instant notBefore = Instant.parse(payload.notBefore);
            if (Instant.now().isBefore(notBefore)) {
                return "Message not yet valid (notBefore in future)";
            }
        }

        return null;
    }

    private static String generateNonce() {
        byte[] bytes = new byte[16];
        RANDOM.nextBytes(bytes);
        StringBuilder sb = new StringBuilder(32);
        for (byte b : bytes) {
            sb.append(String.format("%02x", b & 0xff));
        }
        return sb.toString();
    }
}
