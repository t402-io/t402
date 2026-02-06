package io.t402.a2a;

import io.t402.a2a.A2ATypes.*;

import java.util.List;
import java.util.Map;

import static io.t402.a2a.A2AConstants.*;

/**
 * Helper functions for A2A payment message handling.
 */
public final class A2AHelpers {

    private A2AHelpers() {}

    /**
     * Check if a task is in a payment-required state.
     *
     * @param task the A2A task to check
     * @return true if payment is required
     */
    public static boolean isPaymentRequired(Task task) {
        if (!STATE_INPUT_REQUIRED.equals(task.status.state)) return false;
        if (task.status.message == null || task.status.message.metadata == null) return false;
        return STATUS_PAYMENT_REQUIRED.equals(task.status.message.metadata.get(META_PAYMENT_STATUS));
    }

    /**
     * Check if a task has completed payment.
     *
     * @param task the A2A task to check
     * @return true if payment is completed
     */
    public static boolean isPaymentCompleted(Task task) {
        if (!STATE_COMPLETED.equals(task.status.state)) return false;
        if (task.status.message == null || task.status.message.metadata == null) return false;
        return STATUS_PAYMENT_COMPLETED.equals(task.status.message.metadata.get(META_PAYMENT_STATUS));
    }

    /**
     * Check if a task has failed payment.
     *
     * @param task the A2A task to check
     * @return true if payment failed
     */
    public static boolean isPaymentFailed(Task task) {
        if (!STATE_FAILED.equals(task.status.state)) return false;
        if (task.status.message == null || task.status.message.metadata == null) return false;
        return STATUS_PAYMENT_FAILED.equals(task.status.message.metadata.get(META_PAYMENT_STATUS));
    }

    /**
     * Extract payment requirements from a task.
     *
     * @param task the A2A task
     * @return payment requirements map, or null if not a payment-required task
     */
    @SuppressWarnings("unchecked")
    public static Map<String, Object> getPaymentRequired(Task task) {
        if (!isPaymentRequired(task)) return null;
        Object req = task.status.message.metadata.get(META_PAYMENT_REQUIRED);
        return req instanceof Map ? (Map<String, Object>) req : null;
    }

    /**
     * Extract payment receipts from a task.
     *
     * @param task the A2A task
     * @return list of receipts, or null
     */
    @SuppressWarnings("unchecked")
    public static List<Object> getPaymentReceipts(Task task) {
        if (task.status.message == null || task.status.message.metadata == null) return null;
        Object receipts = task.status.message.metadata.get(META_PAYMENT_RECEIPTS);
        return receipts instanceof List ? (List<Object>) receipts : null;
    }

    /**
     * Check if a message contains a payment submission.
     *
     * @param msg the A2A message
     * @return true if it contains a payment payload
     */
    public static boolean hasPaymentPayload(Message msg) {
        if (msg.metadata == null) return false;
        return STATUS_PAYMENT_SUBMITTED.equals(msg.metadata.get(META_PAYMENT_STATUS))
                && msg.metadata.containsKey(META_PAYMENT_PAYLOAD);
    }

    /**
     * Extract a payment payload from a message.
     *
     * @param msg the A2A message
     * @return payment payload map, or null
     */
    @SuppressWarnings("unchecked")
    public static Map<String, Object> extractPaymentPayload(Message msg) {
        if (msg.metadata == null) return null;
        Object payload = msg.metadata.get(META_PAYMENT_PAYLOAD);
        return payload instanceof Map ? (Map<String, Object>) payload : null;
    }

    /**
     * Create an agent message requesting payment.
     *
     * @param paymentRequired the payment requirements
     * @param text optional message text (defaults to standard text)
     * @return A2A message with payment-required metadata
     */
    public static Message createPaymentRequiredMessage(Object paymentRequired, String text) {
        if (text == null || text.isEmpty()) {
            text = "Payment is required to complete this request.";
        }
        return new Message("agent",
                List.of(MessagePart.text(text)),
                Map.of(
                        META_PAYMENT_STATUS, STATUS_PAYMENT_REQUIRED,
                        META_PAYMENT_REQUIRED, paymentRequired
                ));
    }

    /**
     * Create a user message submitting payment.
     *
     * @param paymentPayload the payment payload
     * @param text optional message text
     * @return A2A message with payment-submitted metadata
     */
    public static Message createPaymentSubmissionMessage(Object paymentPayload, String text) {
        if (text == null || text.isEmpty()) {
            text = "Here is the payment authorization.";
        }
        return new Message("user",
                List.of(MessagePart.text(text)),
                Map.of(
                        META_PAYMENT_STATUS, STATUS_PAYMENT_SUBMITTED,
                        META_PAYMENT_PAYLOAD, paymentPayload
                ));
    }

    /**
     * Create an agent message confirming payment.
     *
     * @param receipts settlement receipts
     * @param text optional message text
     * @return A2A message with payment-completed metadata
     */
    public static Message createPaymentCompletedMessage(Object receipts, String text) {
        if (text == null || text.isEmpty()) {
            text = "Payment successful.";
        }
        return new Message("agent",
                List.of(MessagePart.text(text)),
                Map.of(
                        META_PAYMENT_STATUS, STATUS_PAYMENT_COMPLETED,
                        META_PAYMENT_RECEIPTS, receipts
                ));
    }

    /**
     * Create an agent message reporting payment failure.
     *
     * @param receipts settlement receipts (may be empty)
     * @param errorCode the error code
     * @param text optional message text
     * @return A2A message with payment-failed metadata
     */
    public static Message createPaymentFailedMessage(Object receipts, String errorCode, String text) {
        if (text == null || text.isEmpty()) {
            text = "Payment failed.";
        }
        return new Message("agent",
                List.of(MessagePart.text(text)),
                Map.of(
                        META_PAYMENT_STATUS, STATUS_PAYMENT_FAILED,
                        META_PAYMENT_ERROR, errorCode,
                        META_PAYMENT_RECEIPTS, receipts
                ));
    }

    /**
     * Create a T402 extension declaration for agent cards.
     *
     * @param required whether the extension is required
     * @return A2A extension declaration
     */
    public static Extension createT402Extension(boolean required) {
        return new Extension(
                T402_EXTENSION_URI,
                "Supports payments using the t402 protocol for on-chain settlement.",
                required
        );
    }
}
