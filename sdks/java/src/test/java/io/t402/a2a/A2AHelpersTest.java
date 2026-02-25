package io.t402.a2a;

import io.t402.a2a.A2ATypes.*;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static io.t402.a2a.A2AConstants.*;
import static io.t402.a2a.A2AHelpers.*;
import static org.junit.jupiter.api.Assertions.*;

class A2AHelpersTest {

    private Task makePaymentRequiredTask() {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put(META_PAYMENT_STATUS, STATUS_PAYMENT_REQUIRED);
        metadata.put(META_PAYMENT_REQUIRED, Map.of(
                "t402Version", 2,
                "resource", "https://example.com/api"
        ));
        Message msg = new Message("agent",
                List.of(MessagePart.text("Pay up")), metadata);
        return new Task("task-1", new TaskStatus(STATE_INPUT_REQUIRED, msg));
    }

    private Task makePaymentCompletedTask() {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put(META_PAYMENT_STATUS, STATUS_PAYMENT_COMPLETED);
        metadata.put(META_PAYMENT_RECEIPTS, List.of(Map.of("txHash", "0xabc")));
        Message msg = new Message("agent",
                List.of(MessagePart.text("Done")), metadata);
        return new Task("task-1", new TaskStatus(STATE_COMPLETED, msg));
    }

    private Task makePaymentFailedTask() {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put(META_PAYMENT_STATUS, STATUS_PAYMENT_FAILED);
        metadata.put(META_PAYMENT_ERROR, "T402-3001");
        Message msg = new Message("agent",
                List.of(MessagePart.text("Failed")), metadata);
        return new Task("task-1", new TaskStatus(STATE_FAILED, msg));
    }

    @Test
    void testIsPaymentRequired() {
        assertTrue(isPaymentRequired(makePaymentRequiredTask()));
    }

    @Test
    void testIsPaymentRequiredFalseWrongState() {
        Task task = makePaymentRequiredTask();
        task.status.state = STATE_WORKING;
        assertFalse(isPaymentRequired(task));
    }

    @Test
    void testIsPaymentRequiredFalseNoMessage() {
        Task task = new Task("task-1", new TaskStatus(STATE_INPUT_REQUIRED, null));
        assertFalse(isPaymentRequired(task));
    }

    @Test
    void testIsPaymentCompleted() {
        assertTrue(isPaymentCompleted(makePaymentCompletedTask()));
    }

    @Test
    void testIsPaymentCompletedFalse() {
        Task task = makePaymentCompletedTask();
        task.status.state = STATE_WORKING;
        assertFalse(isPaymentCompleted(task));
    }

    @Test
    void testIsPaymentFailed() {
        assertTrue(isPaymentFailed(makePaymentFailedTask()));
    }

    @Test
    void testIsPaymentFailedFalse() {
        Task task = makePaymentFailedTask();
        task.status.state = STATE_COMPLETED;
        assertFalse(isPaymentFailed(task));
    }

    @Test
    void testGetPaymentRequired() {
        Map<String, Object> req = getPaymentRequired(makePaymentRequiredTask());
        assertNotNull(req);
        assertEquals("https://example.com/api", req.get("resource"));
    }

    @Test
    void testGetPaymentRequiredNull() {
        Task task = new Task("task-1", new TaskStatus(STATE_WORKING, null));
        assertNull(getPaymentRequired(task));
    }

    @Test
    void testGetPaymentReceipts() {
        List<Object> receipts = getPaymentReceipts(makePaymentCompletedTask());
        assertNotNull(receipts);
        assertEquals(1, receipts.size());
    }

    @Test
    void testGetPaymentReceiptsNull() {
        Task task = new Task("task-1", new TaskStatus(STATE_WORKING, null));
        assertNull(getPaymentReceipts(task));
    }

    @Test
    void testHasPaymentPayload() {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put(META_PAYMENT_STATUS, STATUS_PAYMENT_SUBMITTED);
        metadata.put(META_PAYMENT_PAYLOAD, Map.of("signature", "0xabc"));
        Message msg = new Message("user", List.of(), metadata);
        assertTrue(hasPaymentPayload(msg));
    }

    @Test
    void testHasPaymentPayloadFalse() {
        Message msg = new Message("user", List.of(), null);
        assertFalse(hasPaymentPayload(msg));
    }

    @Test
    void testExtractPaymentPayload() {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put(META_PAYMENT_PAYLOAD, Map.of("signature", "0xabc"));
        Message msg = new Message("user", List.of(), metadata);
        Map<String, Object> payload = extractPaymentPayload(msg);
        assertNotNull(payload);
        assertEquals("0xabc", payload.get("signature"));
    }

    @Test
    void testExtractPaymentPayloadNull() {
        Message msg = new Message("user", List.of(), null);
        assertNull(extractPaymentPayload(msg));
    }

    @Test
    void testCreatePaymentRequiredMessage() {
        Message msg = createPaymentRequiredMessage(Map.of("t402Version", 2), null);
        assertEquals("agent", msg.role);
        assertEquals("Payment is required to complete this request.", msg.parts.get(0).text);
        assertEquals(STATUS_PAYMENT_REQUIRED, msg.metadata.get(META_PAYMENT_STATUS));
    }

    @Test
    void testCreatePaymentRequiredMessageCustomText() {
        Message msg = createPaymentRequiredMessage(Map.of("t402Version", 2), "Pay now");
        assertEquals("Pay now", msg.parts.get(0).text);
    }

    @Test
    void testCreatePaymentSubmissionMessage() {
        Message msg = createPaymentSubmissionMessage(Map.of("sig", "0x"), null);
        assertEquals("user", msg.role);
        assertEquals(STATUS_PAYMENT_SUBMITTED, msg.metadata.get(META_PAYMENT_STATUS));
    }

    @Test
    void testCreatePaymentCompletedMessage() {
        Message msg = createPaymentCompletedMessage(List.of("receipt-1"), null);
        assertEquals("agent", msg.role);
        assertEquals(STATUS_PAYMENT_COMPLETED, msg.metadata.get(META_PAYMENT_STATUS));
    }

    @Test
    void testCreatePaymentFailedMessage() {
        Message msg = createPaymentFailedMessage(List.of(), "T402-3001", "Verification failed");
        assertEquals("agent", msg.role);
        assertEquals(STATUS_PAYMENT_FAILED, msg.metadata.get(META_PAYMENT_STATUS));
        assertEquals("T402-3001", msg.metadata.get(META_PAYMENT_ERROR));
        assertEquals("Verification failed", msg.parts.get(0).text);
    }

    @Test
    void testCreateT402Extension() {
        Extension ext = createT402Extension(true);
        assertEquals(T402_EXTENSION_URI, ext.uri);
        assertTrue(ext.required);
    }

    @Test
    void testCreateT402ExtensionOptional() {
        Extension ext = createT402Extension(false);
        assertFalse(ext.required);
    }

    @Test
    void testConstants() {
        assertEquals("https://github.com/google-a2a/a2a-t402/v0.1", T402_EXTENSION_URI);
        assertEquals("X-A2A-Extensions", EXTENSIONS_HEADER);
    }

    // ==================== Dual-namespace (x402) tests ====================

    @Test
    void testIsPaymentRequiredX402Only() {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put(X402_META_PAYMENT_STATUS, STATUS_PAYMENT_REQUIRED);
        Message msg = new Message("agent", List.of(MessagePart.text("Pay")), metadata);
        Task task = new Task("task-x", new TaskStatus(STATE_INPUT_REQUIRED, msg));
        assertTrue(isPaymentRequired(task));
    }

    @Test
    void testIsPaymentRequiredDualNamespace() {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put(META_PAYMENT_STATUS, STATUS_PAYMENT_REQUIRED);
        metadata.put(X402_META_PAYMENT_STATUS, STATUS_PAYMENT_REQUIRED);
        Message msg = new Message("agent", List.of(MessagePart.text("Pay")), metadata);
        Task task = new Task("task-dual", new TaskStatus(STATE_INPUT_REQUIRED, msg));
        assertTrue(isPaymentRequired(task));
    }

    @Test
    void testCreatePaymentRequiredMessageDualNamespace() {
        Map<String, Object> requirements = new HashMap<>();
        requirements.put("t402Version", 2);
        requirements.put("accepts", List.of(Map.of(
                "network", "eip155:8453",
                "scheme", "exact",
                "amount", "1000000",
                "asset", "USDT"
        )));
        requirements.put("resource", Map.of("url", "https://example.com/api"));
        Message msg = createPaymentRequiredMessage(requirements, null);
        // t402 namespace
        assertEquals(STATUS_PAYMENT_REQUIRED, msg.metadata.get(META_PAYMENT_STATUS));
        assertNotNull(msg.metadata.get(META_PAYMENT_REQUIRED));
        // x402 namespace
        assertEquals(STATUS_PAYMENT_REQUIRED, msg.metadata.get(X402_META_PAYMENT_STATUS));
        assertNotNull(msg.metadata.get(X402_META_PAYMENT_REQUIRED));
        // Check downgraded x402 requirements
        @SuppressWarnings("unchecked")
        Map<String, Object> x402Req = (Map<String, Object>) msg.metadata.get(X402_META_PAYMENT_REQUIRED);
        assertEquals(1, x402Req.get("x402Version"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> x402Accepts = (List<Map<String, Object>>) x402Req.get("accepts");
        assertEquals(1, x402Accepts.size());
        assertEquals("base", x402Accepts.get(0).get("network"));
        assertEquals("1000000", x402Accepts.get(0).get("maxAmountRequired"));
        assertEquals("https://example.com/api", x402Accepts.get(0).get("resource"));
    }

    @Test
    void testCreatePaymentSubmissionMessageDualNamespace() {
        Message msg = createPaymentSubmissionMessage(Map.of("sig", "0xabc"), null);
        // t402 namespace
        assertEquals(STATUS_PAYMENT_SUBMITTED, msg.metadata.get(META_PAYMENT_STATUS));
        assertNotNull(msg.metadata.get(META_PAYMENT_PAYLOAD));
        // x402 namespace
        assertEquals(STATUS_PAYMENT_SUBMITTED, msg.metadata.get(X402_META_PAYMENT_STATUS));
        assertNotNull(msg.metadata.get(X402_META_PAYMENT_PAYLOAD));
    }

    @Test
    void testCreatePaymentCompletedMessageDualNamespace() {
        Message msg = createPaymentCompletedMessage(List.of("receipt-1"), null);
        // t402 namespace
        assertEquals(STATUS_PAYMENT_COMPLETED, msg.metadata.get(META_PAYMENT_STATUS));
        assertNotNull(msg.metadata.get(META_PAYMENT_RECEIPTS));
        // x402 namespace
        assertEquals(STATUS_PAYMENT_COMPLETED, msg.metadata.get(X402_META_PAYMENT_STATUS));
        assertNotNull(msg.metadata.get(X402_META_PAYMENT_RECEIPTS));
    }

    @Test
    void testCreatePaymentFailedMessageDualNamespaceErrorMapping() {
        Message msg = createPaymentFailedMessage(List.of(), "T402-3001", null);
        // t402 namespace
        assertEquals(STATUS_PAYMENT_FAILED, msg.metadata.get(META_PAYMENT_STATUS));
        assertEquals("T402-3001", msg.metadata.get(META_PAYMENT_ERROR));
        // x402 namespace
        assertEquals(STATUS_PAYMENT_FAILED, msg.metadata.get(X402_META_PAYMENT_STATUS));
        assertEquals("SETTLEMENT_FAILED", msg.metadata.get(X402_META_PAYMENT_ERROR));
    }

    @Test
    void testHasPaymentPayloadX402Only() {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put(X402_META_PAYMENT_STATUS, STATUS_PAYMENT_SUBMITTED);
        metadata.put(X402_META_PAYMENT_PAYLOAD, Map.of("signature", "0xdef"));
        Message msg = new Message("user", List.of(), metadata);
        assertTrue(hasPaymentPayload(msg));
    }

    @Test
    void testMapT402ErrorToX402() {
        assertEquals("INVALID_AMOUNT", mapT402ErrorToX402("T402-1001"));
        assertEquals("INVALID_SIGNATURE", mapT402ErrorToX402("T402-2001"));
        assertEquals("SETTLEMENT_FAILED", mapT402ErrorToX402("T402-3001"));
        assertEquals("SETTLEMENT_FAILED", mapT402ErrorToX402("T402-5001"));
        assertEquals("SETTLEMENT_FAILED", mapT402ErrorToX402("T402-5002"));
    }

    @Test
    void testMapT402ErrorToX402Unknown() {
        assertEquals("SETTLEMENT_FAILED", mapT402ErrorToX402("T402-9999"));
        assertEquals("SETTLEMENT_FAILED", mapT402ErrorToX402("UNKNOWN"));
    }

    @Test
    void testDowngradeRequirementsToX402() {
        Map<String, Object> requirements = new HashMap<>();
        requirements.put("accepts", List.of(
                Map.of("network", "eip155:8453", "scheme", "exact", "amount", "500000"),
                Map.of("network", "eip155:1", "scheme", "exact", "amount", "1000000")
        ));
        requirements.put("resource", Map.of("url", "https://example.com/resource"));
        @SuppressWarnings("unchecked")
        Map<String, Object> result = downgradeRequirementsToX402(requirements);
        assertNotNull(result);
        assertEquals(1, result.get("x402Version"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> accepts = (List<Map<String, Object>>) result.get("accepts");
        assertEquals(2, accepts.size());
        assertEquals("base", accepts.get(0).get("network"));
        assertEquals("500000", accepts.get(0).get("maxAmountRequired"));
        assertEquals("https://example.com/resource", accepts.get(0).get("resource"));
        assertEquals("ethereum", accepts.get(1).get("network"));
    }

    @Test
    void testDowngradeRequirementsNonEvmReturnsNull() {
        Map<String, Object> requirements = new HashMap<>();
        requirements.put("accepts", List.of(
                Map.of("network", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", "scheme", "exact", "amount", "1000000")
        ));
        assertNull(downgradeRequirementsToX402(requirements));
    }

    @Test
    void testIsStandaloneFlow() {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put(X402_META_PAYMENT_STATUS, STATUS_PAYMENT_REQUIRED);
        metadata.put(X402_META_PAYMENT_REQUIRED, Map.of("x402Version", 1));
        Message msg = new Message("agent", List.of(MessagePart.text("Pay")), metadata);
        Task task = new Task("task-sa", new TaskStatus(STATE_INPUT_REQUIRED, msg));
        assertTrue(isStandaloneFlow(task));
        assertFalse(isEmbeddedFlow(task));
    }

    @Test
    void testIsEmbeddedFlow() {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put(X402_META_PAYMENT_STATUS, STATUS_PAYMENT_REQUIRED);
        // No X402_META_PAYMENT_REQUIRED key
        Message msg = new Message("agent", List.of(MessagePart.text("Pay")), metadata);
        Task task = new Task("task-em", new TaskStatus(STATE_INPUT_REQUIRED, msg));
        assertTrue(isEmbeddedFlow(task));
        assertFalse(isStandaloneFlow(task));
    }

    @Test
    void testCreateX402Extension() {
        Extension ext = createX402Extension(true);
        assertEquals(X402_EXTENSION_URI, ext.uri);
        assertEquals("x402 compatibility layer for EVM payments.", ext.description);
        assertTrue(ext.required);
    }

    @Test
    void testX402Constants() {
        assertEquals("https://github.com/google-agentic-commerce/a2a-x402/blob/main/spec/v0.2", X402_EXTENSION_URI);
        assertEquals("x402.payment.status", X402_META_PAYMENT_STATUS);
        assertEquals("x402.payment.required", X402_META_PAYMENT_REQUIRED);
        assertEquals("x402.payment.payload", X402_META_PAYMENT_PAYLOAD);
        assertEquals("x402.payment.receipts", X402_META_PAYMENT_RECEIPTS);
        assertEquals("x402.payment.error", X402_META_PAYMENT_ERROR);
        // Verify CAIP2 mapping has entries
        assertEquals("base", CAIP2_TO_FLAT_NAME.get("eip155:8453"));
        assertEquals("ethereum", CAIP2_TO_FLAT_NAME.get("eip155:1"));
        assertEquals(27, CAIP2_TO_FLAT_NAME.size());
    }
}
