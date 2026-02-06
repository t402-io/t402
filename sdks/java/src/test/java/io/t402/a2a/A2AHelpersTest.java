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
}
