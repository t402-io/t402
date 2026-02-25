package io.t402.a2a;

import io.t402.a2a.A2ATypes.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static io.t402.a2a.A2AConstants.*;
import static io.t402.a2a.A2AHelpers.*;
import static io.t402.a2a.AP2Helpers.*;

/**
 * A2A Payment Server.
 *
 * <p>Handles server-side payment processing for A2A agent endpoints,
 * including generating payment requirements and processing payment submissions.
 *
 * <p>Usage example:
 * <pre>{@code
 * A2APaymentServer server = new A2APaymentServer(
 *     facilitator,
 *     Map.of("t402Version", 2, "resource", "agent://my-agent/skill"),
 *     null, null, null, null, null
 * );
 *
 * // Create payment-required response
 * Map<String, Object> requirements = server.createRequirements(
 *     Map.of("accepts", List.of(Map.of("scheme", "exact", "network", "eip155:8453", "amount", "1000000")))
 * );
 * Task task = server.createPaymentRequiredTask("task-1", requirements, null);
 *
 * // Process payment submission
 * PaymentResult result = server.processPayment(message, requirements);
 * if (result.success) {
 *     // Continue with task execution
 * }
 * }</pre>
 */
public class A2APaymentServer {

    // ==================== Facilitator interface ====================

    /**
     * Simplified facilitator interface for A2A payment verification and settlement.
     * Avoids coupling to the full io.t402.client package.
     */
    public interface A2AFacilitator {
        /**
         * Verify a payment payload against requirements.
         *
         * @param payload      the payment payload
         * @param requirements the payment requirements
         * @return verification result
         * @throws Exception on communication or processing errors
         */
        VerifyResult verify(Map<String, Object> payload, Map<String, Object> requirements) throws Exception;

        /**
         * Settle a verified payment.
         *
         * @param payload      the payment payload
         * @param requirements the payment requirements
         * @return settlement result
         * @throws Exception on communication or processing errors
         */
        SettleResult settle(Map<String, Object> payload, Map<String, Object> requirements) throws Exception;
    }

    // ==================== Result types ====================

    /** Result of a payment verification call. */
    public static class VerifyResult {
        public final boolean isValid;
        public final String invalidReason;

        public VerifyResult(boolean isValid, String invalidReason) {
            this.isValid = isValid;
            this.invalidReason = invalidReason;
        }
    }

    /** Result of a payment settlement call. */
    public static class SettleResult {
        public final boolean success;
        public final String errorReason;
        public final String txHash;
        public final String network;

        public SettleResult(boolean success, String errorReason, String txHash, String network) {
            this.success = success;
            this.errorReason = errorReason;
            this.txHash = txHash;
            this.network = network;
        }

        /** Convert to a map for embedding in A2A metadata. */
        public Map<String, Object> toMap() {
            Map<String, Object> map = new HashMap<>();
            map.put("success", success);
            if (txHash != null) map.put("txHash", txHash);
            if (network != null) map.put("network", network);
            if (errorReason != null) map.put("errorReason", errorReason);
            return map;
        }
    }

    /** Result of payment processing (verify + settle). */
    public static class PaymentResult {
        public final boolean success;
        public final List<SettleResult> receipts;
        public final String error;
        public final Message message;

        public PaymentResult(boolean success, List<SettleResult> receipts, String error, Message message) {
            this.success = success;
            this.receipts = receipts;
            this.error = error;
            this.message = message;
        }

        /** Create a successful result. */
        public static PaymentResult ok(List<SettleResult> receipts, Message message) {
            return new PaymentResult(true, receipts, null, message);
        }

        /** Create a failed result. */
        public static PaymentResult fail(String error, List<SettleResult> receipts, Message message) {
            return new PaymentResult(false, receipts, error, message);
        }
    }

    // ==================== Custom handler interface ====================

    /** Custom payment handler as an alternative to the facilitator. */
    @FunctionalInterface
    public interface PaymentHandler {
        PaymentResult handle(Map<String, Object> payload, Map<String, Object> requirements) throws Exception;
    }

    // ==================== Callback interfaces ====================

    /** Callback fired when a payment payload is received. */
    @FunctionalInterface
    public interface PaymentReceivedCallback {
        void onPaymentReceived(Map<String, Object> payload);
    }

    /** Callback fired when a payment is verified. */
    @FunctionalInterface
    public interface PaymentVerifiedCallback {
        void onPaymentVerified(Map<String, Object> payload);
    }

    /** Callback fired when a payment is settled. */
    @FunctionalInterface
    public interface PaymentSettledCallback {
        void onPaymentSettled(List<SettleResult> receipts);
    }

    /** Callback fired when a payment fails. */
    @FunctionalInterface
    public interface PaymentFailedCallback {
        void onPaymentFailed(String error, Map<String, Object> payload);
    }

    // ==================== Fields ====================

    private final A2AFacilitator facilitator;
    private final Map<String, Object> defaultRequirements;
    private final PaymentHandler paymentHandler;
    private final PaymentReceivedCallback onPaymentReceived;
    private final PaymentVerifiedCallback onPaymentVerified;
    private final PaymentSettledCallback onPaymentSettled;
    private final PaymentFailedCallback onPaymentFailed;

    // ==================== Constructors ====================

    /** Create a server with no facilitator, defaults, or callbacks. */
    public A2APaymentServer() {
        this(null, null, null, null, null, null, null);
    }

    /**
     * Create a server with all optional parameters.
     *
     * @param facilitator         facilitator for verify + settle (may be null)
     * @param defaultRequirements default requirements merged into every createRequirements call (may be null)
     * @param paymentHandler      custom handler as alternative to facilitator (may be null)
     * @param onPaymentReceived   fired when payload is extracted (may be null)
     * @param onPaymentVerified   fired after successful verification (may be null)
     * @param onPaymentSettled    fired after successful settlement (may be null)
     * @param onPaymentFailed     fired on any failure (may be null)
     */
    public A2APaymentServer(
            A2AFacilitator facilitator,
            Map<String, Object> defaultRequirements,
            PaymentHandler paymentHandler,
            PaymentReceivedCallback onPaymentReceived,
            PaymentVerifiedCallback onPaymentVerified,
            PaymentSettledCallback onPaymentSettled,
            PaymentFailedCallback onPaymentFailed) {
        this.facilitator = facilitator;
        this.defaultRequirements = defaultRequirements;
        this.paymentHandler = paymentHandler;
        this.onPaymentReceived = onPaymentReceived;
        this.onPaymentVerified = onPaymentVerified;
        this.onPaymentSettled = onPaymentSettled;
        this.onPaymentFailed = onPaymentFailed;
    }

    // ==================== Requirements ====================

    /**
     * Create payment requirements, merging with defaults.
     * The {@code requirements} parameter overrides matching keys from defaults.
     *
     * @param requirements partial requirements to merge
     * @return merged requirements with {@code t402Version} defaulting to 2
     */
    public Map<String, Object> createRequirements(Map<String, Object> requirements) {
        Map<String, Object> merged = new HashMap<>();
        merged.put("t402Version", 2);
        if (defaultRequirements != null) {
            merged.putAll(defaultRequirements);
        }
        if (requirements != null) {
            merged.putAll(requirements);
        }
        return merged;
    }

    // ==================== Task status helpers ====================

    /**
     * Create a payment-required task status.
     *
     * @param requirements payment requirements
     * @param text         optional text message (null uses default)
     * @return task status in "input-required" state
     */
    public TaskStatus createPaymentRequiredStatus(Map<String, Object> requirements, String text) {
        TaskStatus status = new TaskStatus(STATE_INPUT_REQUIRED,
                createPaymentRequiredMessage(requirements, text));
        status.timestamp = now();
        return status;
    }

    /**
     * Create a payment-required task.
     *
     * @param taskId       task identifier
     * @param requirements payment requirements
     * @param text         optional text message (null uses default)
     * @return task in "input-required" state with payment metadata
     */
    public Task createPaymentRequiredTask(String taskId, Map<String, Object> requirements, String text) {
        return new Task(taskId, createPaymentRequiredStatus(requirements, text));
    }

    /**
     * Create a completed task status with payment receipts.
     *
     * @param receipts settlement receipts
     * @param text     optional text message (null uses default)
     * @return task status in "completed" state
     */
    public TaskStatus createPaymentCompletedStatus(List<SettleResult> receipts, String text) {
        TaskStatus status = new TaskStatus(STATE_COMPLETED,
                createPaymentCompletedMessage(toReceiptList(receipts), text));
        status.timestamp = now();
        return status;
    }

    /**
     * Create a failed task status with payment error.
     *
     * @param error     error message
     * @param receipts  settlement receipts (may be empty)
     * @param errorCode error code (e.g. "T402-5000")
     * @return task status in "failed" state
     */
    public TaskStatus createPaymentFailedStatus(String error, List<SettleResult> receipts, String errorCode) {
        if (errorCode == null || errorCode.isEmpty()) {
            errorCode = "T402-5000";
        }
        TaskStatus status = new TaskStatus(STATE_FAILED,
                createPaymentFailedMessage(toReceiptList(receipts), errorCode, error));
        status.timestamp = now();
        return status;
    }

    // ==================== Payload extraction ====================

    /**
     * Extract payment payload from an A2A message.
     * Supports dual-namespace: tries t402.payment.payload first, then x402.payment.payload.
     *
     * @param message A2A message that may contain payment metadata
     * @return payment payload map, or null
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> extractPaymentPayload(Message message) {
        return A2AHelpers.extractPaymentPayload(message);
    }

    /**
     * Check if a message contains a payment submission.
     * Checks both t402 and x402 namespace metadata.
     *
     * @param message A2A message to check
     * @return true if the message has payment-submitted status and a payload
     */
    public boolean hasPaymentPayload(Message message) {
        return A2AHelpers.hasPaymentPayload(message);
    }

    // ==================== Payment processing ====================

    /**
     * Process a payment submission: extract, verify, and settle.
     *
     * <p>Processing flow:
     * <ol>
     *   <li>Extract payload from message (error T402-1001 if missing)</li>
     *   <li>Fire {@code onPaymentReceived}</li>
     *   <li>If custom handler is set, delegate to it</li>
     *   <li>If facilitator is set: verify (T402-2001 on fail) then settle (T402-3001 on fail)</li>
     *   <li>If neither handler nor facilitator: error T402-5001</li>
     *   <li>Catch exceptions: error T402-5002</li>
     * </ol>
     *
     * @param message      A2A message containing payment payload
     * @param requirements original payment requirements
     * @return payment processing result
     */
    public PaymentResult processPayment(Message message, Map<String, Object> requirements) {
        Map<String, Object> payload = extractPaymentPayload(message);

        if (payload == null) {
            String error = "No payment payload in message";
            if (onPaymentFailed != null) onPaymentFailed.onPaymentFailed(error, null);
            return PaymentResult.fail(error, List.of(),
                    createPaymentFailedMessage(List.of(), "T402-1001", error));
        }

        if (onPaymentReceived != null) onPaymentReceived.onPaymentReceived(payload);

        // Custom handler takes priority
        if (paymentHandler != null) {
            try {
                return paymentHandler.handle(payload, requirements);
            } catch (Exception e) {
                String error = e.getMessage() != null ? e.getMessage() : "Payment processing error";
                if (onPaymentFailed != null) onPaymentFailed.onPaymentFailed(error, payload);
                return PaymentResult.fail(error, List.of(),
                        createPaymentFailedMessage(List.of(), "T402-5002", error));
            }
        }

        // Facilitator flow
        if (facilitator == null) {
            String error = "No facilitator or payment handler configured";
            if (onPaymentFailed != null) onPaymentFailed.onPaymentFailed(error, payload);
            return PaymentResult.fail(error, List.of(),
                    createPaymentFailedMessage(List.of(), "T402-5001", error));
        }

        try {
            // Verify
            VerifyResult verifyResult = facilitator.verify(payload, requirements);
            if (!verifyResult.isValid) {
                String error = verifyResult.invalidReason != null
                        ? verifyResult.invalidReason : "Payment verification failed";
                if (onPaymentFailed != null) onPaymentFailed.onPaymentFailed(error, payload);
                return PaymentResult.fail(error, List.of(),
                        createPaymentFailedMessage(List.of(), "T402-2001", error));
            }

            if (onPaymentVerified != null) onPaymentVerified.onPaymentVerified(payload);

            // Settle
            SettleResult settleResult = facilitator.settle(payload, requirements);
            List<SettleResult> receipts = List.of(settleResult);

            if (!settleResult.success) {
                String error = settleResult.errorReason != null
                        ? settleResult.errorReason : "Payment settlement failed";
                if (onPaymentFailed != null) onPaymentFailed.onPaymentFailed(error, payload);
                return PaymentResult.fail(error, receipts,
                        createPaymentFailedMessage(toReceiptList(receipts), "T402-3001", error));
            }

            if (onPaymentSettled != null) onPaymentSettled.onPaymentSettled(receipts);

            return PaymentResult.ok(receipts,
                    createPaymentCompletedMessage(toReceiptList(receipts), null));

        } catch (Exception e) {
            String error = e.getMessage() != null ? e.getMessage() : "Payment processing error";
            if (onPaymentFailed != null) onPaymentFailed.onPaymentFailed(error, payload);
            return PaymentResult.fail(error, List.of(),
                    createPaymentFailedMessage(List.of(), "T402-5002", error));
        }
    }

    /**
     * Handle a complete payment flow for a task.
     * Processes the payment submission and returns an updated task.
     *
     * @param task         the current A2A task
     * @param message      the message containing payment payload
     * @param requirements payment requirements
     * @return updated task with payment result
     */
    public Task handlePayment(Task task, Message message, Map<String, Object> requirements) {
        PaymentResult result = processPayment(message, requirements);
        return updateTaskWithPaymentResult(task, result);
    }

    /**
     * Update a task with a payment result.
     *
     * @param task   the original task
     * @param result the payment result
     * @return a new task with updated status and history
     */
    public Task updateTaskWithPaymentResult(Task task, PaymentResult result) {
        Task updated = new Task();
        updated.kind = task.kind;
        updated.id = task.id;
        updated.sessionId = task.sessionId;
        updated.artifacts = task.artifacts;
        updated.metadata = task.metadata;

        // Append the result message to history
        List<Message> history = new ArrayList<>();
        if (task.history != null) {
            history.addAll(task.history);
        }
        history.add(result.message);
        updated.history = history;

        if (result.success) {
            updated.status = createPaymentCompletedStatus(
                    result.receipts != null ? result.receipts : List.of(), null);
        } else {
            updated.status = createPaymentFailedStatus(
                    result.error != null ? result.error : "Payment failed",
                    result.receipts != null ? result.receipts : List.of(),
                    null);
        }

        return updated;
    }

    // ==================== Embedded (AP2) flow ====================

    /**
     * Create a payment-required task using the AP2 embedded flow.
     * Returns a CartMandate as artifact instead of metadata.
     *
     * @param taskId                task identifier
     * @param cartContents          cart contents (payment_request will be augmented with x402)
     * @param requirements          list of x402 payment requirements to embed
     * @param merchantAuthorization optional merchant JWT
     * @param text                  optional text message (null uses default)
     * @return A2A task with CartMandate artifact and embedded flow metadata
     */
    public Task createEmbeddedPaymentRequiredTask(
            String taskId,
            Map<String, Object> cartContents,
            List<Map<String, Object>> requirements,
            String merchantAuthorization,
            String text) {
        if (text == null || text.isEmpty()) {
            text = "Payment is required.";
        }

        Map<String, Object> cartMandate = createCartMandateWithX402(
                cartContents, requirements, merchantAuthorization);

        // Status message: embedded flow has status but no requirements in metadata
        Map<String, Object> metadata = new HashMap<>();
        metadata.put(X402_META_PAYMENT_STATUS, STATUS_PAYMENT_REQUIRED);

        Message statusMsg = new Message("agent", List.of(MessagePart.text(text)), metadata);
        TaskStatus status = new TaskStatus(STATE_INPUT_REQUIRED, statusMsg);
        status.timestamp = now();

        Task task = new Task(taskId, status);

        // Artifact with CartMandate
        Artifact artifact = new Artifact();
        artifact.kind = "ap2.cart";
        artifact.name = "Cart Mandate";
        artifact.parts = List.of(createCartMandateDataPart(cartMandate));

        task.artifacts = List.of(artifact);
        return task;
    }

    /**
     * Extract x402 PaymentPayload from an embedded-flow message.
     * Scans message parts for PaymentMandate DataPart.
     *
     * @param message A2A message with PaymentMandate DataPart
     * @return x402 PaymentPayload map, or null if not found
     */
    public Map<String, Object> extractEmbeddedPayload(Message message) {
        Map<String, Object> mandate = extractPaymentMandateFromMessage(message);
        if (mandate == null) return null;
        return extractX402Payload(mandate);
    }

    // ==================== Private helpers ====================

    /** Convert a list of SettleResult to a list of maps for embedding in metadata. */
    private static List<Map<String, Object>> toReceiptList(List<SettleResult> receipts) {
        if (receipts == null || receipts.isEmpty()) return List.of();
        List<Map<String, Object>> list = new ArrayList<>();
        for (SettleResult r : receipts) {
            list.add(r.toMap());
        }
        return list;
    }

    /** Get the current timestamp in ISO-8601 format. */
    private static String now() {
        return java.time.Instant.now().toString();
    }
}
