package io.t402.a2a;

import io.t402.a2a.A2ATypes.*;
import org.junit.jupiter.api.Test;

import java.util.*;

import static io.t402.a2a.A2AConstants.*;
import static io.t402.a2a.AP2Helpers.*;
import static org.junit.jupiter.api.Assertions.*;

class A2APaymentClientTest {

    // ==================== Helpers ====================

    private Map<String, Object> makeRequirements() {
        Map<String, Object> requirements = new HashMap<>();
        requirements.put("t402Version", 2);
        requirements.put("resource", "https://example.com/api");
        requirements.put("accepts", List.of(
                Map.of("network", "eip155:8453", "scheme", "exact", "amount", "1000000"),
                Map.of("network", "eip155:1", "scheme", "upto", "amount", "2000000"),
                Map.of("network", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", "scheme", "exact", "amount", "500000")
        ));
        return requirements;
    }

    private Task makePaymentRequiredTask() {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put(META_PAYMENT_STATUS, STATUS_PAYMENT_REQUIRED);
        metadata.put(META_PAYMENT_REQUIRED, makeRequirements());
        Message msg = new Message("agent", List.of(MessagePart.text("Pay up")), metadata);
        return new Task("task-1", new TaskStatus(STATE_INPUT_REQUIRED, msg));
    }

    private Task makeNonPaymentTask() {
        Message msg = new Message("agent", List.of(MessagePart.text("Working...")), null);
        return new Task("task-2", new TaskStatus(STATE_WORKING, msg));
    }

    // ==================== requiresPayment ====================

    @Test
    void requiresPayment_true() {
        A2APaymentClient client = new A2APaymentClient();
        assertTrue(client.requiresPayment(makePaymentRequiredTask()));
    }

    @Test
    void requiresPayment_false() {
        A2APaymentClient client = new A2APaymentClient();
        assertFalse(client.requiresPayment(makeNonPaymentTask()));
    }

    @Test
    void requiresPayment_callbackFires() {
        List<Map<String, Object>> captured = new ArrayList<>();
        A2APaymentClient client = new A2APaymentClient(
                captured::add, null, null, null);

        assertTrue(client.requiresPayment(makePaymentRequiredTask()));
        assertEquals(1, captured.size());
        assertEquals(2, captured.get(0).get("t402Version"));
    }

    @Test
    void requiresPayment_callbackNotFiredWhenNotRequired() {
        List<Map<String, Object>> captured = new ArrayList<>();
        A2APaymentClient client = new A2APaymentClient(
                captured::add, null, null, null);

        assertFalse(client.requiresPayment(makeNonPaymentTask()));
        assertTrue(captured.isEmpty());
    }

    // ==================== getRequirements ====================

    @Test
    void getRequirements_returnsRequirements() {
        A2APaymentClient client = new A2APaymentClient();
        Map<String, Object> req = client.getRequirements(makePaymentRequiredTask());
        assertNotNull(req);
        assertEquals(2, req.get("t402Version"));
        assertEquals("https://example.com/api", req.get("resource"));
    }

    @Test
    void getRequirements_returnsNullWhenNotPaymentRequired() {
        A2APaymentClient client = new A2APaymentClient();
        assertNull(client.getRequirements(makeNonPaymentTask()));
    }

    // ==================== selectPaymentOption ====================

    @Test
    void selectPaymentOption_default() {
        A2APaymentClient client = new A2APaymentClient();
        Map<String, Object> option = client.selectPaymentOption(makeRequirements(), null, null);
        assertNotNull(option);
        // Should return first option
        assertEquals("eip155:8453", option.get("network"));
        assertEquals("exact", option.get("scheme"));
    }

    @Test
    void selectPaymentOption_preferredNetwork() {
        A2APaymentClient client = new A2APaymentClient();
        Map<String, Object> option = client.selectPaymentOption(
                makeRequirements(), "eip155:1", null);
        assertNotNull(option);
        assertEquals("eip155:1", option.get("network"));
    }

    @Test
    void selectPaymentOption_preferredScheme() {
        A2APaymentClient client = new A2APaymentClient();
        Map<String, Object> option = client.selectPaymentOption(
                makeRequirements(), null, "upto");
        assertNotNull(option);
        assertEquals("upto", option.get("scheme"));
        assertEquals("eip155:1", option.get("network"));
    }

    @Test
    void selectPaymentOption_preferredBoth() {
        A2APaymentClient client = new A2APaymentClient();
        Map<String, Object> option = client.selectPaymentOption(
                makeRequirements(), "eip155:1", "upto");
        assertNotNull(option);
        assertEquals("eip155:1", option.get("network"));
        assertEquals("upto", option.get("scheme"));
    }

    @Test
    void selectPaymentOption_noMatch_fallsBackToFirst() {
        A2APaymentClient client = new A2APaymentClient();
        Map<String, Object> option = client.selectPaymentOption(
                makeRequirements(), "eip155:999", "permit2");
        assertNotNull(option);
        // Falls back to first
        assertEquals("eip155:8453", option.get("network"));
    }

    @Test
    void selectPaymentOption_emptyAccepts() {
        A2APaymentClient client = new A2APaymentClient();
        Map<String, Object> req = new HashMap<>();
        req.put("accepts", List.of());
        assertNull(client.selectPaymentOption(req, null, null));
    }

    @Test
    void selectPaymentOption_noAcceptsKey() {
        A2APaymentClient client = new A2APaymentClient();
        assertNull(client.selectPaymentOption(Map.of("t402Version", 2), null, null));
    }

    // ==================== createPaymentMessage ====================

    @Test
    void createPaymentMessage_defaultText() {
        A2APaymentClient client = new A2APaymentClient();
        Map<String, Object> payload = Map.of("signature", "0xabc", "network", "eip155:8453");
        Message msg = client.createPaymentMessage(payload, null);

        assertEquals("user", msg.role);
        assertEquals("Here is the payment authorization.", msg.parts.get(0).text);
        assertEquals(STATUS_PAYMENT_SUBMITTED, msg.metadata.get(META_PAYMENT_STATUS));
        assertEquals(STATUS_PAYMENT_SUBMITTED, msg.metadata.get(X402_META_PAYMENT_STATUS));
        assertNotNull(msg.metadata.get(META_PAYMENT_PAYLOAD));
        assertNotNull(msg.metadata.get(X402_META_PAYMENT_PAYLOAD));
    }

    @Test
    void createPaymentMessage_customText() {
        A2APaymentClient client = new A2APaymentClient();
        Map<String, Object> payload = Map.of("signature", "0xdef");
        Message msg = client.createPaymentMessage(payload, "Paying now!");

        assertEquals("Paying now!", msg.parts.get(0).text);
    }

    @Test
    void createPaymentMessage_dualNamespace() {
        A2APaymentClient client = new A2APaymentClient();
        Map<String, Object> payload = Map.of("signature", "0x123");
        Message msg = client.createPaymentMessage(payload, null);

        // Both namespaces should be present
        assertEquals(STATUS_PAYMENT_SUBMITTED, msg.metadata.get(META_PAYMENT_STATUS));
        assertEquals(STATUS_PAYMENT_SUBMITTED, msg.metadata.get(X402_META_PAYMENT_STATUS));
        assertEquals(payload, msg.metadata.get(META_PAYMENT_PAYLOAD));
        assertEquals(payload, msg.metadata.get(X402_META_PAYMENT_PAYLOAD));
    }

    @Test
    void createPaymentMessage_callbackFires() {
        List<Map<String, Object>> captured = new ArrayList<>();
        A2APaymentClient client = new A2APaymentClient(
                null, captured::add, null, null);

        Map<String, Object> payload = Map.of("signature", "0xabc");
        client.createPaymentMessage(payload, null);

        assertEquals(1, captured.size());
        assertEquals("0xabc", captured.get(0).get("signature"));
    }

    // ==================== extractEmbeddedRequirements ====================

    @Test
    void extractEmbeddedRequirements_found() {
        A2APaymentClient client = new A2APaymentClient();

        // Build a task with a CartMandate artifact containing x402 requirements
        Map<String, Object> cartContents = new HashMap<>();
        cartContents.put("id", "cart-1");
        Map<String, Object> paymentRequest = new HashMap<>();
        Map<String, Object> x402Method = new HashMap<>();
        x402Method.put("supported_methods", X402_PAYMENT_METHOD);
        x402Method.put("data", Map.of("requirements", List.of(
                Map.of("network", "eip155:8453", "scheme", "exact", "amount", "500000")
        )));
        paymentRequest.put("method_data", List.of(x402Method));
        cartContents.put("payment_request", paymentRequest);

        Map<String, Object> cartMandate = Map.of("contents", cartContents);
        MessagePart dataPart = createCartMandateDataPart(cartMandate);

        Artifact artifact = new Artifact();
        artifact.parts = List.of(dataPart);

        Task task = new Task("task-emb", new TaskStatus(STATE_INPUT_REQUIRED, null));
        task.artifacts = List.of(artifact);

        List<Map<String, Object>> reqs = client.extractEmbeddedRequirements(task);
        assertNotNull(reqs);
        assertEquals(1, reqs.size());
        assertEquals("eip155:8453", reqs.get(0).get("network"));
    }

    @Test
    void extractEmbeddedRequirements_empty() {
        A2APaymentClient client = new A2APaymentClient();

        // Task with no artifacts
        Task task = new Task("task-no-art", new TaskStatus(STATE_INPUT_REQUIRED, null));
        assertNull(client.extractEmbeddedRequirements(task));
    }

    @Test
    void extractEmbeddedRequirements_noCartMandate() {
        A2APaymentClient client = new A2APaymentClient();

        Artifact artifact = new Artifact();
        artifact.parts = List.of(MessagePart.text("Not a cart"));

        Task task = new Task("task-text", new TaskStatus(STATE_INPUT_REQUIRED, null));
        task.artifacts = List.of(artifact);

        assertNull(client.extractEmbeddedRequirements(task));
    }

    // ==================== createEmbeddedPaymentMessage ====================

    @Test
    void createEmbeddedPaymentMessage_basic() {
        A2APaymentClient client = new A2APaymentClient();

        Map<String, Object> mandateContents = new HashMap<>();
        mandateContents.put("payment_mandate_id", "pm-001");
        mandateContents.put("merchant_agent", "agent-merchant");

        Map<String, Object> payload = Map.of("signature", "0xdeadbeef", "network", "eip155:8453");

        Message msg = client.createEmbeddedPaymentMessage(
                mandateContents, payload, "user-auth-123", null);

        assertEquals("user", msg.role);
        assertEquals("Here is the payment mandate.", msg.parts.get(0).text);

        // Should have dual-namespace payment-submitted status
        assertEquals(STATUS_PAYMENT_SUBMITTED, msg.metadata.get(META_PAYMENT_STATUS));
        assertEquals(STATUS_PAYMENT_SUBMITTED, msg.metadata.get(X402_META_PAYMENT_STATUS));

        // Second part should be a data part with PaymentMandate
        MessagePart dataPart = msg.parts.get(1);
        assertEquals("data", dataPart.kind);
        assertTrue(dataPart.data.containsKey(AP2_DATA_KEY_PAYMENT_MANDATE));
    }

    @Test
    void createEmbeddedPaymentMessage_customText() {
        A2APaymentClient client = new A2APaymentClient();

        Map<String, Object> mandateContents = new HashMap<>();
        mandateContents.put("payment_mandate_id", "pm-002");

        Map<String, Object> payload = Map.of("signature", "0xabc");

        Message msg = client.createEmbeddedPaymentMessage(
                mandateContents, payload, null, "Custom payment text");

        assertEquals("Custom payment text", msg.parts.get(0).text);
    }

    @Test
    @SuppressWarnings("unchecked")
    void createEmbeddedPaymentMessage_containsX402Payload() {
        A2APaymentClient client = new A2APaymentClient();

        Map<String, Object> mandateContents = new HashMap<>();
        mandateContents.put("payment_mandate_id", "pm-003");

        Map<String, Object> payload = Map.of("signature", "0xfeed", "network", "eip155:8453");

        Message msg = client.createEmbeddedPaymentMessage(
                mandateContents, payload, null, null);

        // Extract the PaymentMandate and verify x402 payload is inside
        MessagePart dataPart = msg.parts.get(1);
        Map<String, Object> mandate = (Map<String, Object>) dataPart.data.get(AP2_DATA_KEY_PAYMENT_MANDATE);
        Map<String, Object> contents = (Map<String, Object>) mandate.get("payment_mandate_contents");
        Map<String, Object> response = (Map<String, Object>) contents.get("payment_response");
        assertEquals(X402_PAYMENT_METHOD, response.get("method_name"));
        Map<String, Object> details = (Map<String, Object>) response.get("details");
        assertEquals("0xfeed", details.get("signature"));
    }
}
