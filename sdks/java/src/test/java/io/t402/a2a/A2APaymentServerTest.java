package io.t402.a2a;

import io.t402.a2a.A2ATypes.*;
import io.t402.a2a.A2APaymentServer.*;
import org.junit.jupiter.api.Test;

import java.util.*;

import static io.t402.a2a.A2AConstants.*;
import static io.t402.a2a.AP2Helpers.*;
import static org.junit.jupiter.api.Assertions.*;

class A2APaymentServerTest {

    // ==================== Mock facilitator ====================

    private static class MockFacilitator implements A2APaymentServer.A2AFacilitator {
        VerifyResult verifyResult;
        SettleResult settleResult;
        Exception verifyError;
        Exception settleError;

        MockFacilitator(VerifyResult vr, SettleResult sr) {
            this.verifyResult = vr;
            this.settleResult = sr;
        }

        @Override
        public VerifyResult verify(Map<String, Object> payload, Map<String, Object> requirements) throws Exception {
            if (verifyError != null) throw verifyError;
            return verifyResult;
        }

        @Override
        public SettleResult settle(Map<String, Object> payload, Map<String, Object> requirements) throws Exception {
            if (settleError != null) throw settleError;
            return settleResult;
        }
    }

    // ==================== Helpers ====================

    private Map<String, Object> makeRequirements() {
        Map<String, Object> req = new HashMap<>();
        req.put("t402Version", 2);
        req.put("resource", "agent://test-agent/skill");
        req.put("accepts", List.of(
                Map.of("network", "eip155:8453", "scheme", "exact", "amount", "1000000")
        ));
        return req;
    }

    private Message makePaymentMessage(Map<String, Object> payload) {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put(META_PAYMENT_STATUS, STATUS_PAYMENT_SUBMITTED);
        metadata.put(META_PAYMENT_PAYLOAD, payload);
        metadata.put(X402_META_PAYMENT_STATUS, STATUS_PAYMENT_SUBMITTED);
        metadata.put(X402_META_PAYMENT_PAYLOAD, payload);
        return new Message("user", List.of(MessagePart.text("Payment")), metadata);
    }

    private Message makeEmptyMessage() {
        return new Message("user", List.of(MessagePart.text("No payment")), null);
    }

    private MockFacilitator makeSuccessFacilitator() {
        return new MockFacilitator(
                new VerifyResult(true, null),
                new SettleResult(true, null, "0xabc123", "eip155:8453")
        );
    }

    // ==================== createRequirements ====================

    @Test
    void createRequirements_mergeWithDefaults() {
        Map<String, Object> defaults = new HashMap<>();
        defaults.put("resource", "agent://default/skill");
        defaults.put("description", "Default desc");

        A2APaymentServer server = new A2APaymentServer(null, defaults, null, null, null, null, null);

        Map<String, Object> req = server.createRequirements(Map.of(
                "accepts", List.of(Map.of("network", "eip155:8453"))
        ));

        assertEquals(2, req.get("t402Version"));
        assertEquals("agent://default/skill", req.get("resource"));
        assertEquals("Default desc", req.get("description"));
        assertNotNull(req.get("accepts"));
    }

    @Test
    void createRequirements_overrideDefaults() {
        Map<String, Object> defaults = new HashMap<>();
        defaults.put("resource", "agent://default/skill");

        A2APaymentServer server = new A2APaymentServer(null, defaults, null, null, null, null, null);

        Map<String, Object> req = server.createRequirements(Map.of(
                "resource", "agent://custom/skill"
        ));

        // Requirements should override defaults
        assertEquals("agent://custom/skill", req.get("resource"));
    }

    @Test
    void createRequirements_noDefaults() {
        A2APaymentServer server = new A2APaymentServer();
        Map<String, Object> req = server.createRequirements(Map.of("accepts", List.of()));
        assertEquals(2, req.get("t402Version"));
        assertNotNull(req.get("accepts"));
    }

    // ==================== createPaymentRequiredTask ====================

    @Test
    void createPaymentRequiredTask_basic() {
        A2APaymentServer server = new A2APaymentServer();
        Map<String, Object> requirements = makeRequirements();

        Task task = server.createPaymentRequiredTask("task-1", requirements, null);

        assertEquals("task-1", task.id);
        assertEquals(STATE_INPUT_REQUIRED, task.status.state);
        assertNotNull(task.status.message);
        assertEquals("agent", task.status.message.role);
        assertEquals(STATUS_PAYMENT_REQUIRED, task.status.message.metadata.get(META_PAYMENT_STATUS));
        assertNotNull(task.status.message.metadata.get(META_PAYMENT_REQUIRED));
        assertNotNull(task.status.timestamp);
    }

    @Test
    void createPaymentRequiredTask_customText() {
        A2APaymentServer server = new A2APaymentServer();
        Task task = server.createPaymentRequiredTask("task-2", makeRequirements(), "Please pay now");

        assertEquals("Please pay now", task.status.message.parts.get(0).text);
    }

    // ==================== extractPaymentPayload ====================

    @Test
    void extractPaymentPayload_t402() {
        A2APaymentServer server = new A2APaymentServer();
        Map<String, Object> payload = Map.of("signature", "0xabc");
        Message msg = makePaymentMessage(payload);

        Map<String, Object> extracted = server.extractPaymentPayload(msg);
        assertNotNull(extracted);
        assertEquals("0xabc", extracted.get("signature"));
    }

    @Test
    void extractPaymentPayload_x402Fallback() {
        A2APaymentServer server = new A2APaymentServer();
        Map<String, Object> payload = Map.of("signature", "0xdef");

        // Only x402 namespace
        Map<String, Object> metadata = new HashMap<>();
        metadata.put(X402_META_PAYMENT_PAYLOAD, payload);
        Message msg = new Message("user", List.of(), metadata);

        Map<String, Object> extracted = server.extractPaymentPayload(msg);
        assertNotNull(extracted);
        assertEquals("0xdef", extracted.get("signature"));
    }

    @Test
    void extractPaymentPayload_null() {
        A2APaymentServer server = new A2APaymentServer();
        assertNull(server.extractPaymentPayload(makeEmptyMessage()));
    }

    // ==================== hasPaymentPayload ====================

    @Test
    void hasPaymentPayload_true() {
        A2APaymentServer server = new A2APaymentServer();
        Map<String, Object> payload = Map.of("signature", "0xabc");
        assertTrue(server.hasPaymentPayload(makePaymentMessage(payload)));
    }

    @Test
    void hasPaymentPayload_false() {
        A2APaymentServer server = new A2APaymentServer();
        assertFalse(server.hasPaymentPayload(makeEmptyMessage()));
    }

    // ==================== processPayment ====================

    @Test
    void processPayment_success() {
        MockFacilitator facilitator = makeSuccessFacilitator();
        A2APaymentServer server = new A2APaymentServer(
                facilitator, null, null, null, null, null, null);

        Map<String, Object> payload = Map.of("signature", "0xabc", "network", "eip155:8453");
        PaymentResult result = server.processPayment(
                makePaymentMessage(payload), makeRequirements());

        assertTrue(result.success);
        assertNull(result.error);
        assertNotNull(result.receipts);
        assertEquals(1, result.receipts.size());
        assertEquals("0xabc123", result.receipts.get(0).txHash);
        assertNotNull(result.message);
        assertEquals(STATUS_PAYMENT_COMPLETED, result.message.metadata.get(META_PAYMENT_STATUS));
    }

    @Test
    void processPayment_verifyFail() {
        MockFacilitator facilitator = new MockFacilitator(
                new VerifyResult(false, "Invalid signature"),
                null
        );
        A2APaymentServer server = new A2APaymentServer(
                facilitator, null, null, null, null, null, null);

        Map<String, Object> payload = Map.of("signature", "0xbad");
        PaymentResult result = server.processPayment(
                makePaymentMessage(payload), makeRequirements());

        assertFalse(result.success);
        assertEquals("Invalid signature", result.error);
        assertEquals(STATUS_PAYMENT_FAILED, result.message.metadata.get(META_PAYMENT_STATUS));
        assertEquals("T402-2001", result.message.metadata.get(META_PAYMENT_ERROR));
    }

    @Test
    void processPayment_verifyFail_defaultReason() {
        MockFacilitator facilitator = new MockFacilitator(
                new VerifyResult(false, null),
                null
        );
        A2APaymentServer server = new A2APaymentServer(
                facilitator, null, null, null, null, null, null);

        Map<String, Object> payload = Map.of("signature", "0xbad");
        PaymentResult result = server.processPayment(
                makePaymentMessage(payload), makeRequirements());

        assertFalse(result.success);
        assertEquals("Payment verification failed", result.error);
    }

    @Test
    void processPayment_settleFail() {
        MockFacilitator facilitator = new MockFacilitator(
                new VerifyResult(true, null),
                new SettleResult(false, "Insufficient gas", null, "eip155:8453")
        );
        A2APaymentServer server = new A2APaymentServer(
                facilitator, null, null, null, null, null, null);

        Map<String, Object> payload = Map.of("signature", "0xabc");
        PaymentResult result = server.processPayment(
                makePaymentMessage(payload), makeRequirements());

        assertFalse(result.success);
        assertEquals("Insufficient gas", result.error);
        assertEquals(1, result.receipts.size());
        assertEquals("T402-3001", result.message.metadata.get(META_PAYMENT_ERROR));
    }

    @Test
    void processPayment_noPayload() {
        A2APaymentServer server = new A2APaymentServer(
                makeSuccessFacilitator(), null, null, null, null, null, null);

        PaymentResult result = server.processPayment(
                makeEmptyMessage(), makeRequirements());

        assertFalse(result.success);
        assertEquals("No payment payload in message", result.error);
        assertEquals("T402-1001", result.message.metadata.get(META_PAYMENT_ERROR));
    }

    @Test
    void processPayment_noFacilitator() {
        A2APaymentServer server = new A2APaymentServer();

        Map<String, Object> payload = Map.of("signature", "0xabc");
        PaymentResult result = server.processPayment(
                makePaymentMessage(payload), makeRequirements());

        assertFalse(result.success);
        assertEquals("No facilitator or payment handler configured", result.error);
        assertEquals("T402-5001", result.message.metadata.get(META_PAYMENT_ERROR));
    }

    @Test
    void processPayment_customHandler() {
        PaymentHandler handler = (p, r) -> {
            Message msg = A2AHelpers.createPaymentCompletedMessage(List.of(), null);
            return PaymentResult.ok(List.of(), msg);
        };

        A2APaymentServer server = new A2APaymentServer(
                null, null, handler, null, null, null, null);

        Map<String, Object> payload = Map.of("signature", "0xcustom");
        PaymentResult result = server.processPayment(
                makePaymentMessage(payload), makeRequirements());

        assertTrue(result.success);
    }

    @Test
    void processPayment_customHandlerException() {
        PaymentHandler handler = (p, r) -> {
            throw new RuntimeException("Handler exploded");
        };

        A2APaymentServer server = new A2APaymentServer(
                null, null, handler, null, null, null, null);

        Map<String, Object> payload = Map.of("signature", "0xfail");
        PaymentResult result = server.processPayment(
                makePaymentMessage(payload), makeRequirements());

        assertFalse(result.success);
        assertEquals("Handler exploded", result.error);
        assertEquals("T402-5002", result.message.metadata.get(META_PAYMENT_ERROR));
    }

    @Test
    void processPayment_facilitatorVerifyException() {
        MockFacilitator facilitator = makeSuccessFacilitator();
        facilitator.verifyError = new RuntimeException("Network timeout");

        A2APaymentServer server = new A2APaymentServer(
                facilitator, null, null, null, null, null, null);

        Map<String, Object> payload = Map.of("signature", "0xabc");
        PaymentResult result = server.processPayment(
                makePaymentMessage(payload), makeRequirements());

        assertFalse(result.success);
        assertEquals("Network timeout", result.error);
        assertEquals("T402-5002", result.message.metadata.get(META_PAYMENT_ERROR));
    }

    @Test
    void processPayment_facilitatorSettleException() {
        MockFacilitator facilitator = makeSuccessFacilitator();
        facilitator.settleError = new RuntimeException("Settlement timeout");

        A2APaymentServer server = new A2APaymentServer(
                facilitator, null, null, null, null, null, null);

        Map<String, Object> payload = Map.of("signature", "0xabc");
        PaymentResult result = server.processPayment(
                makePaymentMessage(payload), makeRequirements());

        assertFalse(result.success);
        assertEquals("Settlement timeout", result.error);
        assertEquals("T402-5002", result.message.metadata.get(META_PAYMENT_ERROR));
    }

    // ==================== handlePayment ====================

    @Test
    void handlePayment_success() {
        A2APaymentServer server = new A2APaymentServer(
                makeSuccessFacilitator(), null, null, null, null, null, null);

        Task task = new Task("task-hp", new TaskStatus(STATE_INPUT_REQUIRED, null));
        Map<String, Object> payload = Map.of("signature", "0xabc");

        Task updated = server.handlePayment(task, makePaymentMessage(payload), makeRequirements());

        assertEquals("task-hp", updated.id);
        assertEquals(STATE_COMPLETED, updated.status.state);
        assertNotNull(updated.history);
        assertEquals(1, updated.history.size());
    }

    @Test
    void handlePayment_failure() {
        A2APaymentServer server = new A2APaymentServer();

        Task task = new Task("task-hf", new TaskStatus(STATE_INPUT_REQUIRED, null));
        Map<String, Object> payload = Map.of("signature", "0xabc");

        Task updated = server.handlePayment(task, makePaymentMessage(payload), makeRequirements());

        assertEquals(STATE_FAILED, updated.status.state);
    }

    // ==================== updateTaskWithPaymentResult ====================

    @Test
    void updateTaskWithPaymentResult_success() {
        A2APaymentServer server = new A2APaymentServer();

        Task task = new Task("task-up", new TaskStatus(STATE_INPUT_REQUIRED, null));
        task.history = new ArrayList<>(List.of(
                new Message("user", List.of(MessagePart.text("Hello")), null)
        ));

        SettleResult sr = new SettleResult(true, null, "0xhash", "eip155:8453");
        Message resultMsg = A2AHelpers.createPaymentCompletedMessage(List.of(sr.toMap()), null);
        PaymentResult result = PaymentResult.ok(List.of(sr), resultMsg);

        Task updated = server.updateTaskWithPaymentResult(task, result);

        assertEquals(STATE_COMPLETED, updated.status.state);
        assertEquals(2, updated.history.size()); // original + result
        assertEquals("task-up", updated.id);
    }

    @Test
    void updateTaskWithPaymentResult_failure() {
        A2APaymentServer server = new A2APaymentServer();

        Task task = new Task("task-uf", new TaskStatus(STATE_INPUT_REQUIRED, null));

        Message resultMsg = A2AHelpers.createPaymentFailedMessage(List.of(), "T402-3001", "Failed");
        PaymentResult result = PaymentResult.fail("Failed", List.of(), resultMsg);

        Task updated = server.updateTaskWithPaymentResult(task, result);

        assertEquals(STATE_FAILED, updated.status.state);
        assertEquals(1, updated.history.size());
    }

    @Test
    void updateTaskWithPaymentResult_preservesFields() {
        A2APaymentServer server = new A2APaymentServer();

        Task task = new Task("task-pf", new TaskStatus(STATE_INPUT_REQUIRED, null));
        task.sessionId = "session-123";
        task.metadata = Map.of("key", "value");

        Artifact artifact = new Artifact();
        artifact.name = "test";
        task.artifacts = List.of(artifact);

        Message resultMsg = A2AHelpers.createPaymentCompletedMessage(List.of(), null);
        PaymentResult result = PaymentResult.ok(List.of(), resultMsg);

        Task updated = server.updateTaskWithPaymentResult(task, result);

        assertEquals("session-123", updated.sessionId);
        assertEquals("value", updated.metadata.get("key"));
        assertEquals(1, updated.artifacts.size());
    }

    // ==================== createPaymentCompletedStatus ====================

    @Test
    void createPaymentCompletedStatus_basic() {
        A2APaymentServer server = new A2APaymentServer();

        SettleResult sr = new SettleResult(true, null, "0xhash", "eip155:8453");
        TaskStatus status = server.createPaymentCompletedStatus(List.of(sr), null);

        assertEquals(STATE_COMPLETED, status.state);
        assertEquals(STATUS_PAYMENT_COMPLETED, status.message.metadata.get(META_PAYMENT_STATUS));
        assertNotNull(status.timestamp);
    }

    @Test
    void createPaymentCompletedStatus_customText() {
        A2APaymentServer server = new A2APaymentServer();

        TaskStatus status = server.createPaymentCompletedStatus(List.of(), "Payment done!");
        assertEquals("Payment done!", status.message.parts.get(0).text);
    }

    // ==================== createPaymentFailedStatus ====================

    @Test
    void createPaymentFailedStatus_basic() {
        A2APaymentServer server = new A2APaymentServer();

        TaskStatus status = server.createPaymentFailedStatus("Bad sig", List.of(), "T402-2001");

        assertEquals(STATE_FAILED, status.state);
        assertEquals(STATUS_PAYMENT_FAILED, status.message.metadata.get(META_PAYMENT_STATUS));
        assertEquals("T402-2001", status.message.metadata.get(META_PAYMENT_ERROR));
        assertNotNull(status.timestamp);
    }

    @Test
    void createPaymentFailedStatus_defaultErrorCode() {
        A2APaymentServer server = new A2APaymentServer();

        TaskStatus status = server.createPaymentFailedStatus("Something failed", List.of(), null);

        assertEquals("T402-5000", status.message.metadata.get(META_PAYMENT_ERROR));
    }

    // ==================== Embedded (AP2) flow ====================

    @Test
    @SuppressWarnings("unchecked")
    void createEmbeddedPaymentRequiredTask_basic() {
        A2APaymentServer server = new A2APaymentServer();

        Map<String, Object> cartContents = new HashMap<>();
        cartContents.put("id", "cart-001");
        cartContents.put("merchant_name", "Test Merchant");
        Map<String, Object> paymentRequest = new HashMap<>();
        paymentRequest.put("method_data", new ArrayList<>());
        cartContents.put("payment_request", paymentRequest);

        List<Map<String, Object>> requirements = List.of(
                Map.of("network", "eip155:8453", "scheme", "exact", "amount", "1000000")
        );

        Task task = server.createEmbeddedPaymentRequiredTask(
                "task-emb-1", cartContents, requirements, "merchant-jwt", null);

        assertEquals("task-emb-1", task.id);
        assertEquals(STATE_INPUT_REQUIRED, task.status.state);
        assertEquals("Payment is required.", task.status.message.parts.get(0).text);
        assertEquals(STATUS_PAYMENT_REQUIRED,
                task.status.message.metadata.get(X402_META_PAYMENT_STATUS));
        // No requirements in metadata (embedded flow signal)
        assertFalse(task.status.message.metadata.containsKey(X402_META_PAYMENT_REQUIRED));

        // Artifact should contain CartMandate
        assertNotNull(task.artifacts);
        assertEquals(1, task.artifacts.size());
        assertEquals("ap2.cart", task.artifacts.get(0).kind);
        assertEquals("Cart Mandate", task.artifacts.get(0).name);

        // Extract requirements from artifact
        Map<String, Object> cartMandate = AP2Helpers.extractCartMandateFromArtifact(task.artifacts.get(0));
        assertNotNull(cartMandate);
        List<Map<String, Object>> extracted = AP2Helpers.extractX402Requirements(cartMandate);
        assertNotNull(extracted);
        assertEquals(1, extracted.size());
        assertEquals("eip155:8453", extracted.get(0).get("network"));
    }

    @Test
    void createEmbeddedPaymentRequiredTask_customText() {
        A2APaymentServer server = new A2APaymentServer();

        Map<String, Object> cartContents = new HashMap<>();
        cartContents.put("id", "cart-002");
        Map<String, Object> paymentRequest = new HashMap<>();
        paymentRequest.put("method_data", new ArrayList<>());
        cartContents.put("payment_request", paymentRequest);

        Task task = server.createEmbeddedPaymentRequiredTask(
                "task-emb-2", cartContents, List.of(), null, "Please complete payment");

        assertEquals("Please complete payment", task.status.message.parts.get(0).text);
    }

    // ==================== extractEmbeddedPayload ====================

    @Test
    void extractEmbeddedPayload_found() {
        A2APaymentServer server = new A2APaymentServer();

        Map<String, Object> mandateContents = new HashMap<>();
        mandateContents.put("payment_mandate_id", "pm-001");
        Map<String, Object> payload = Map.of("signature", "0xpay", "network", "eip155:8453");

        Map<String, Object> mandate = AP2Helpers.createPaymentMandateWithX402(
                mandateContents, payload, null);
        MessagePart dataPart = AP2Helpers.createPaymentMandateDataPart(mandate);

        Message msg = new Message("user", List.of(dataPart), null);

        Map<String, Object> extracted = server.extractEmbeddedPayload(msg);
        assertNotNull(extracted);
        assertEquals("0xpay", extracted.get("signature"));
        assertEquals("eip155:8453", extracted.get("network"));
    }

    @Test
    void extractEmbeddedPayload_notFound() {
        A2APaymentServer server = new A2APaymentServer();
        Message msg = new Message("user", List.of(MessagePart.text("No mandate")), null);
        assertNull(server.extractEmbeddedPayload(msg));
    }

    @Test
    void extractEmbeddedPayload_nullParts() {
        A2APaymentServer server = new A2APaymentServer();
        Message msg = new Message("user", null, null);
        assertNull(server.extractEmbeddedPayload(msg));
    }

    // ==================== Callbacks ====================

    @Test
    void callbacks_fired_onSuccess() {
        List<Map<String, Object>> receivedPayloads = new ArrayList<>();
        List<Map<String, Object>> verifiedPayloads = new ArrayList<>();
        List<List<SettleResult>> settledReceipts = new ArrayList<>();

        A2APaymentServer server = new A2APaymentServer(
                makeSuccessFacilitator(), null, null,
                receivedPayloads::add,
                verifiedPayloads::add,
                settledReceipts::add,
                null
        );

        Map<String, Object> payload = Map.of("signature", "0xabc");
        PaymentResult result = server.processPayment(
                makePaymentMessage(payload), makeRequirements());

        assertTrue(result.success);
        assertEquals(1, receivedPayloads.size());
        assertEquals(1, verifiedPayloads.size());
        assertEquals(1, settledReceipts.size());
    }

    @Test
    void callbacks_fired_onFailure() {
        List<String> failedErrors = new ArrayList<>();
        List<Map<String, Object>> failedPayloads = new ArrayList<>();

        A2APaymentServer server = new A2APaymentServer(
                new MockFacilitator(new VerifyResult(false, "Bad sig"), null),
                null, null,
                null, null, null,
                (error, p) -> {
                    failedErrors.add(error);
                    failedPayloads.add(p);
                }
        );

        Map<String, Object> payload = Map.of("signature", "0xbad");
        PaymentResult result = server.processPayment(
                makePaymentMessage(payload), makeRequirements());

        assertFalse(result.success);
        assertEquals(1, failedErrors.size());
        assertEquals("Bad sig", failedErrors.get(0));
        assertEquals(1, failedPayloads.size());
    }

    @Test
    void callbacks_fired_noPayload() {
        List<String> failedErrors = new ArrayList<>();

        A2APaymentServer server = new A2APaymentServer(
                makeSuccessFacilitator(), null, null,
                null, null, null,
                (error, p) -> failedErrors.add(error)
        );

        server.processPayment(makeEmptyMessage(), makeRequirements());

        assertEquals(1, failedErrors.size());
        assertEquals("No payment payload in message", failedErrors.get(0));
    }

    // ==================== SettleResult.toMap ====================

    @Test
    void settleResult_toMap_success() {
        SettleResult sr = new SettleResult(true, null, "0xhash", "eip155:8453");
        Map<String, Object> map = sr.toMap();

        assertEquals(true, map.get("success"));
        assertEquals("0xhash", map.get("txHash"));
        assertEquals("eip155:8453", map.get("network"));
        assertFalse(map.containsKey("errorReason"));
    }

    @Test
    void settleResult_toMap_failure() {
        SettleResult sr = new SettleResult(false, "Out of gas", null, "eip155:8453");
        Map<String, Object> map = sr.toMap();

        assertEquals(false, map.get("success"));
        assertEquals("Out of gas", map.get("errorReason"));
        assertEquals("eip155:8453", map.get("network"));
        assertFalse(map.containsKey("txHash"));
    }

    // ==================== PaymentResult factory methods ====================

    @Test
    void paymentResult_ok() {
        Message msg = A2AHelpers.createPaymentCompletedMessage(List.of(), null);
        PaymentResult result = PaymentResult.ok(List.of(), msg);

        assertTrue(result.success);
        assertNull(result.error);
        assertNotNull(result.receipts);
        assertNotNull(result.message);
    }

    @Test
    void paymentResult_fail() {
        Message msg = A2AHelpers.createPaymentFailedMessage(List.of(), "T402-3001", "Failed");
        PaymentResult result = PaymentResult.fail("Failed", List.of(), msg);

        assertFalse(result.success);
        assertEquals("Failed", result.error);
        assertNotNull(result.receipts);
        assertNotNull(result.message);
    }
}
