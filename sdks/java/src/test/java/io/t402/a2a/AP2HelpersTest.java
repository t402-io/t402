package io.t402.a2a;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static io.t402.a2a.AP2Helpers.*;
import static io.t402.a2a.A2AConstants.*;

import java.util.*;

class AP2HelpersTest {

    // ==================== Constants ====================

    @Test
    void testAP2ExtensionURI() {
        assertEquals("https://github.com/google-agentic-commerce/ap2/tree/v0.1", AP2_EXTENSION_URI);
    }

    @Test
    void testX402PaymentMethod() {
        assertEquals("https://www.x402.org/", X402_PAYMENT_METHOD);
    }

    @Test
    void testDataKeys() {
        assertEquals("ap2.mandates.IntentMandate", AP2_DATA_KEY_INTENT_MANDATE);
        assertEquals("ap2.mandates.CartMandate", AP2_DATA_KEY_CART_MANDATE);
        assertEquals("ap2.mandates.PaymentMandate", AP2_DATA_KEY_PAYMENT_MANDATE);
        assertEquals("ap2.PaymentReceipt", AP2_DATA_KEY_PAYMENT_RECEIPT);
    }

    // ==================== CartMandate bridge ====================

    private Map<String, Object> makeCartContents() {
        Map<String, Object> cartContents = new HashMap<>();
        cartContents.put("id", "cart-123");
        cartContents.put("merchant_name", "Test Merchant");

        Map<String, Object> paymentRequest = new HashMap<>();
        Map<String, Object> existingMethod = new HashMap<>();
        existingMethod.put("supported_methods", "https://example.com/pay");
        existingMethod.put("data", Map.of("token", "abc"));
        paymentRequest.put("method_data", List.of(existingMethod));
        cartContents.put("payment_request", paymentRequest);

        return cartContents;
    }

    private List<Map<String, Object>> makeRequirements() {
        Map<String, Object> req = new HashMap<>();
        req.put("network", "eip155:8453");
        req.put("scheme", "exact");
        req.put("amount", "1000000");
        req.put("asset", "USDT");
        return List.of(req);
    }

    @Test
    void testCreateCartMandateWithX402() {
        Map<String, Object> cartContents = makeCartContents();
        List<Map<String, Object>> requirements = makeRequirements();

        Map<String, Object> mandate = createCartMandateWithX402(cartContents, requirements, "auth-token-123");

        assertNotNull(mandate.get("contents"));
        assertEquals("auth-token-123", mandate.get("merchant_authorization"));
    }

    @Test
    void testCreateCartMandateWithX402NoAuth() {
        Map<String, Object> cartContents = makeCartContents();
        List<Map<String, Object>> requirements = makeRequirements();

        Map<String, Object> mandate = createCartMandateWithX402(cartContents, requirements, null);

        assertNotNull(mandate.get("contents"));
        assertFalse(mandate.containsKey("merchant_authorization"));
    }

    @Test
    void testCreateCartMandateWithX402EmptyAuth() {
        Map<String, Object> cartContents = makeCartContents();
        List<Map<String, Object>> requirements = makeRequirements();

        Map<String, Object> mandate = createCartMandateWithX402(cartContents, requirements, "");

        assertFalse(mandate.containsKey("merchant_authorization"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void testCreateCartMandatePreservesExistingMethods() {
        Map<String, Object> cartContents = makeCartContents();
        List<Map<String, Object>> requirements = makeRequirements();

        Map<String, Object> mandate = createCartMandateWithX402(cartContents, requirements, null);
        Map<String, Object> contents = (Map<String, Object>) mandate.get("contents");
        Map<String, Object> paymentRequest = (Map<String, Object>) contents.get("payment_request");
        List<Map<String, Object>> methodData = (List<Map<String, Object>>) paymentRequest.get("method_data");

        // Should have original method + x402 method
        assertEquals(2, methodData.size());
        assertEquals("https://example.com/pay", methodData.get(0).get("supported_methods"));
        assertEquals(X402_PAYMENT_METHOD, methodData.get(1).get("supported_methods"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void testCreateCartMandateReplacesExistingX402() {
        // Cart already has an x402 method - should replace it
        Map<String, Object> cartContents = new HashMap<>();
        cartContents.put("id", "cart-456");
        Map<String, Object> paymentRequest = new HashMap<>();
        Map<String, Object> oldX402 = new HashMap<>();
        oldX402.put("supported_methods", X402_PAYMENT_METHOD);
        oldX402.put("data", Map.of("requirements", List.of()));
        paymentRequest.put("method_data", new ArrayList<>(List.of(oldX402)));
        cartContents.put("payment_request", paymentRequest);

        List<Map<String, Object>> requirements = makeRequirements();
        Map<String, Object> mandate = createCartMandateWithX402(cartContents, requirements, null);

        Map<String, Object> contents = (Map<String, Object>) mandate.get("contents");
        Map<String, Object> pr = (Map<String, Object>) contents.get("payment_request");
        List<Map<String, Object>> methodData = (List<Map<String, Object>>) pr.get("method_data");

        assertEquals(1, methodData.size());
        assertEquals(X402_PAYMENT_METHOD, methodData.get(0).get("supported_methods"));
        Map<String, Object> data = (Map<String, Object>) methodData.get(0).get("data");
        List<Map<String, Object>> reqs = (List<Map<String, Object>>) data.get("requirements");
        assertEquals(1, reqs.size());
        assertEquals("eip155:8453", reqs.get(0).get("network"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void testCreateCartMandateWithNullPaymentRequest() {
        Map<String, Object> cartContents = new HashMap<>();
        cartContents.put("id", "cart-789");
        // No payment_request key

        List<Map<String, Object>> requirements = makeRequirements();
        Map<String, Object> mandate = createCartMandateWithX402(cartContents, requirements, null);

        Map<String, Object> contents = (Map<String, Object>) mandate.get("contents");
        Map<String, Object> pr = (Map<String, Object>) contents.get("payment_request");
        List<Map<String, Object>> methodData = (List<Map<String, Object>>) pr.get("method_data");

        assertEquals(1, methodData.size());
        assertEquals(X402_PAYMENT_METHOD, methodData.get(0).get("supported_methods"));
    }

    // ==================== Extract x402 requirements ====================

    @Test
    void testExtractX402RequirementsRoundTrip() {
        Map<String, Object> cartContents = makeCartContents();
        List<Map<String, Object>> requirements = makeRequirements();

        Map<String, Object> mandate = createCartMandateWithX402(cartContents, requirements, "auth");
        List<Map<String, Object>> extracted = extractX402Requirements(mandate);

        assertNotNull(extracted);
        assertEquals(1, extracted.size());
        assertEquals("eip155:8453", extracted.get(0).get("network"));
        assertEquals("exact", extracted.get(0).get("scheme"));
        assertEquals("1000000", extracted.get(0).get("amount"));
    }

    @Test
    void testExtractX402RequirementsNullContents() {
        Map<String, Object> mandate = new HashMap<>();
        assertNull(extractX402Requirements(mandate));
    }

    @Test
    void testExtractX402RequirementsNullPaymentRequest() {
        Map<String, Object> mandate = Map.of("contents", Map.of("id", "cart-1"));
        assertNull(extractX402Requirements(mandate));
    }

    @Test
    void testExtractX402RequirementsNullMethodData() {
        Map<String, Object> mandate = Map.of("contents",
                Map.of("payment_request", Map.of("details", Map.of())));
        assertNull(extractX402Requirements(mandate));
    }

    @Test
    void testExtractX402RequirementsNonX402Method() {
        Map<String, Object> contents = new HashMap<>();
        Map<String, Object> pr = new HashMap<>();
        pr.put("method_data", List.of(Map.of(
                "supported_methods", "https://other.pay/",
                "data", Map.of("key", "val")
        )));
        contents.put("payment_request", pr);

        Map<String, Object> mandate = Map.of("contents", contents);
        assertNull(extractX402Requirements(mandate));
    }

    // ==================== PaymentMandate bridge ====================

    private Map<String, Object> makeMandateContents() {
        Map<String, Object> contents = new HashMap<>();
        contents.put("payment_mandate_id", "pm-001");
        contents.put("payment_details_id", "pd-001");
        contents.put("merchant_agent", "agent-merchant");
        return contents;
    }

    private Map<String, Object> makePayload() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("signature", "0xdeadbeef");
        payload.put("network", "eip155:8453");
        return payload;
    }

    @Test
    void testCreatePaymentMandateWithX402() {
        Map<String, Object> mandateContents = makeMandateContents();
        Map<String, Object> payload = makePayload();

        Map<String, Object> mandate = createPaymentMandateWithX402(mandateContents, payload, "user-auth-123");

        assertNotNull(mandate.get("payment_mandate_contents"));
        assertEquals("user-auth-123", mandate.get("user_authorization"));
    }

    @Test
    void testCreatePaymentMandateWithX402NoAuth() {
        Map<String, Object> mandateContents = makeMandateContents();
        Map<String, Object> payload = makePayload();

        Map<String, Object> mandate = createPaymentMandateWithX402(mandateContents, payload, null);

        assertNotNull(mandate.get("payment_mandate_contents"));
        assertFalse(mandate.containsKey("user_authorization"));
    }

    @Test
    void testCreatePaymentMandateWithX402EmptyAuth() {
        Map<String, Object> mandateContents = makeMandateContents();
        Map<String, Object> payload = makePayload();

        Map<String, Object> mandate = createPaymentMandateWithX402(mandateContents, payload, "");

        assertFalse(mandate.containsKey("user_authorization"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void testCreatePaymentMandatePreservesExistingResponse() {
        Map<String, Object> mandateContents = makeMandateContents();
        mandateContents.put("payment_response", Map.of("request_id", "req-1"));
        Map<String, Object> payload = makePayload();

        Map<String, Object> mandate = createPaymentMandateWithX402(mandateContents, payload, null);
        Map<String, Object> contents = (Map<String, Object>) mandate.get("payment_mandate_contents");
        Map<String, Object> response = (Map<String, Object>) contents.get("payment_response");

        assertEquals("req-1", response.get("request_id"));
        assertEquals(X402_PAYMENT_METHOD, response.get("method_name"));
        assertEquals(payload, response.get("details"));
    }

    // ==================== Extract x402 payload ====================

    @Test
    void testExtractX402PayloadRoundTrip() {
        Map<String, Object> mandateContents = makeMandateContents();
        Map<String, Object> payload = makePayload();

        Map<String, Object> mandate = createPaymentMandateWithX402(mandateContents, payload, "auth");
        Map<String, Object> extracted = extractX402Payload(mandate);

        assertNotNull(extracted);
        assertEquals("0xdeadbeef", extracted.get("signature"));
        assertEquals("eip155:8453", extracted.get("network"));
    }

    @Test
    void testExtractX402PayloadNullContents() {
        Map<String, Object> mandate = new HashMap<>();
        assertNull(extractX402Payload(mandate));
    }

    @Test
    void testExtractX402PayloadNullResponse() {
        Map<String, Object> mandate = Map.of("payment_mandate_contents",
                Map.of("payment_mandate_id", "pm-1"));
        assertNull(extractX402Payload(mandate));
    }

    @Test
    void testExtractX402PayloadWrongMethod() {
        Map<String, Object> contents = new HashMap<>();
        contents.put("payment_response", Map.of(
                "method_name", "https://other.pay/",
                "details", Map.of("key", "val")
        ));
        Map<String, Object> mandate = Map.of("payment_mandate_contents", contents);
        assertNull(extractX402Payload(mandate));
    }

    // ==================== createAP2Extension ====================

    @Test
    void testCreateAP2ExtensionDefaultRoles() {
        A2ATypes.Extension ext = createAP2Extension(null, true);
        assertEquals(AP2_EXTENSION_URI, ext.uri);
        assertEquals("AP2 payment agent (roles: merchant).", ext.description);
        assertTrue(ext.required);
    }

    @Test
    void testCreateAP2ExtensionEmptyRoles() {
        A2ATypes.Extension ext = createAP2Extension(List.of(), false);
        assertEquals("AP2 payment agent (roles: merchant).", ext.description);
        assertFalse(ext.required);
    }

    @Test
    void testCreateAP2ExtensionCustomRoles() {
        A2ATypes.Extension ext = createAP2Extension(List.of("merchant", "buyer"), true);
        assertEquals("AP2 payment agent (roles: merchant, buyer).", ext.description);
    }

    // ==================== DataPart helpers ====================

    @Test
    void testCreateCartMandateDataPart() {
        Map<String, Object> cartMandate = Map.of("contents", Map.of("id", "cart-1"));
        A2ATypes.MessagePart part = createCartMandateDataPart(cartMandate);

        assertEquals("data", part.kind);
        assertNotNull(part.data);
        assertTrue(part.data.containsKey(AP2_DATA_KEY_CART_MANDATE));
        assertEquals(cartMandate, part.data.get(AP2_DATA_KEY_CART_MANDATE));
    }

    @Test
    void testCreatePaymentMandateDataPart() {
        Map<String, Object> paymentMandate = Map.of("payment_mandate_contents", Map.of("id", "pm-1"));
        A2ATypes.MessagePart part = createPaymentMandateDataPart(paymentMandate);

        assertEquals("data", part.kind);
        assertNotNull(part.data);
        assertTrue(part.data.containsKey(AP2_DATA_KEY_PAYMENT_MANDATE));
        assertEquals(paymentMandate, part.data.get(AP2_DATA_KEY_PAYMENT_MANDATE));
    }

    // ==================== Extract from Artifact/Message ====================

    @Test
    void testExtractCartMandateFromArtifact() {
        Map<String, Object> cartMandate = Map.of("contents", Map.of("id", "cart-1"));
        A2ATypes.MessagePart dataPart = createCartMandateDataPart(cartMandate);

        A2ATypes.Artifact artifact = new A2ATypes.Artifact();
        artifact.parts = List.of(dataPart);

        Map<String, Object> extracted = extractCartMandateFromArtifact(artifact);
        assertNotNull(extracted);
        @SuppressWarnings("unchecked")
        Map<String, Object> contents = (Map<String, Object>) extracted.get("contents");
        assertEquals("cart-1", contents.get("id"));
    }

    @Test
    void testExtractCartMandateFromArtifactNullParts() {
        A2ATypes.Artifact artifact = new A2ATypes.Artifact();
        artifact.parts = null;
        assertNull(extractCartMandateFromArtifact(artifact));
    }

    @Test
    void testExtractCartMandateFromArtifactNoMatchingPart() {
        A2ATypes.MessagePart textPart = A2ATypes.MessagePart.text("Hello");
        A2ATypes.Artifact artifact = new A2ATypes.Artifact();
        artifact.parts = List.of(textPart);
        assertNull(extractCartMandateFromArtifact(artifact));
    }

    @Test
    void testExtractPaymentMandateFromMessage() {
        Map<String, Object> paymentMandate = Map.of("payment_mandate_contents",
                Map.of("payment_mandate_id", "pm-1"));
        A2ATypes.MessagePart dataPart = createPaymentMandateDataPart(paymentMandate);

        A2ATypes.Message message = new A2ATypes.Message("user", List.of(dataPart), null);

        Map<String, Object> extracted = extractPaymentMandateFromMessage(message);
        assertNotNull(extracted);
        @SuppressWarnings("unchecked")
        Map<String, Object> contents = (Map<String, Object>) extracted.get("payment_mandate_contents");
        assertEquals("pm-1", contents.get("payment_mandate_id"));
    }

    @Test
    void testExtractPaymentMandateFromMessageNullParts() {
        A2ATypes.Message message = new A2ATypes.Message("user", null, null);
        assertNull(extractPaymentMandateFromMessage(message));
    }

    @Test
    void testExtractPaymentMandateFromMessageNoMatchingPart() {
        A2ATypes.MessagePart textPart = A2ATypes.MessagePart.text("No mandate here");
        A2ATypes.Message message = new A2ATypes.Message("user", List.of(textPart), null);
        assertNull(extractPaymentMandateFromMessage(message));
    }

    // ==================== createPaymentExtensions ====================

    @Test
    void createPaymentExtensions_defaultReturnsT402X402() {
        List<A2ATypes.Extension> exts = AP2Helpers.createPaymentExtensions();
        assertEquals(2, exts.size());
        assertEquals(T402_EXTENSION_URI, exts.get(0).uri);
        assertEquals(X402_EXTENSION_URI, exts.get(1).uri);
        assertFalse(exts.get(0).required);
        assertFalse(exts.get(1).required);
    }

    @Test
    void createPaymentExtensions_includesAP2WhenRolesSpecified() {
        AP2Helpers.PaymentExtensionOptions opts = new AP2Helpers.PaymentExtensionOptions();
        opts.ap2Roles = List.of("merchant");
        List<A2ATypes.Extension> exts = AP2Helpers.createPaymentExtensions(opts);
        assertEquals(3, exts.size());
        assertEquals(AP2Helpers.AP2_EXTENSION_URI, exts.get(2).uri);
        assertTrue(exts.get(2).description.contains("merchant"));
    }

    @Test
    void createPaymentExtensions_respectsRequiredFlags() {
        AP2Helpers.PaymentExtensionOptions opts = new AP2Helpers.PaymentExtensionOptions();
        opts.t402Required = true;
        opts.x402Required = true;
        opts.ap2Roles = List.of("shopper");
        opts.ap2Required = true;
        List<A2ATypes.Extension> exts = AP2Helpers.createPaymentExtensions(opts);
        assertTrue(exts.get(0).required);
        assertTrue(exts.get(1).required);
        assertTrue(exts.get(2).required);
    }

    // ==================== getPaymentExtensionHeaders ====================

    @Test
    void getPaymentExtensionHeaders_returnsX402ByDefault() {
        Map<String, String> headers = AP2Helpers.getPaymentExtensionHeaders();
        assertEquals(X402_EXTENSION_URI, headers.get(EXTENSIONS_HEADER));
    }

    @Test
    void getPaymentExtensionHeaders_includesAP2WhenRequested() {
        Map<String, String> headers = AP2Helpers.getPaymentExtensionHeaders(true);
        String expected = X402_EXTENSION_URI + ", " + AP2Helpers.AP2_EXTENSION_URI;
        assertEquals(expected, headers.get(EXTENSIONS_HEADER));
    }
}
