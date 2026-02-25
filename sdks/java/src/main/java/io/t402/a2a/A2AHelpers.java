package io.t402.a2a;

import io.t402.a2a.A2ATypes.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static io.t402.a2a.A2AConstants.*;

/**
 * Helper functions for A2A payment message handling.
 * Supports dual-namespace metadata: canonical t402.payment.* and x402.payment.* compatibility layer.
 */
public final class A2AHelpers {

    private A2AHelpers() {}

    /**
     * Look up a metadata value by t402 key first, falling back to x402 key.
     *
     * @param metadata the metadata map
     * @param t402Key  the canonical t402 key
     * @param x402Key  the x402 compatibility key
     * @return the value, or null if neither key is present
     */
    private static Object getMetaValue(Map<String, Object> metadata, String t402Key, String x402Key) {
        if (metadata == null) return null;
        Object val = metadata.get(t402Key);
        if (val != null) return val;
        return metadata.get(x402Key);
    }

    /**
     * Check if a task is in a payment-required state.
     *
     * @param task the A2A task to check
     * @return true if payment is required
     */
    public static boolean isPaymentRequired(Task task) {
        if (!STATE_INPUT_REQUIRED.equals(task.status.state)) return false;
        if (task.status.message == null || task.status.message.metadata == null) return false;
        Object status = getMetaValue(task.status.message.metadata, META_PAYMENT_STATUS, X402_META_PAYMENT_STATUS);
        return STATUS_PAYMENT_REQUIRED.equals(status);
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
        Object status = getMetaValue(task.status.message.metadata, META_PAYMENT_STATUS, X402_META_PAYMENT_STATUS);
        return STATUS_PAYMENT_COMPLETED.equals(status);
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
        Object status = getMetaValue(task.status.message.metadata, META_PAYMENT_STATUS, X402_META_PAYMENT_STATUS);
        return STATUS_PAYMENT_FAILED.equals(status);
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
        Object req = getMetaValue(task.status.message.metadata, META_PAYMENT_REQUIRED, X402_META_PAYMENT_REQUIRED);
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
        Object receipts = getMetaValue(task.status.message.metadata, META_PAYMENT_RECEIPTS, X402_META_PAYMENT_RECEIPTS);
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
        Object status = getMetaValue(msg.metadata, META_PAYMENT_STATUS, X402_META_PAYMENT_STATUS);
        Object payload = getMetaValue(msg.metadata, META_PAYMENT_PAYLOAD, X402_META_PAYMENT_PAYLOAD);
        return STATUS_PAYMENT_SUBMITTED.equals(status) && payload != null;
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
        Object payload = getMetaValue(msg.metadata, META_PAYMENT_PAYLOAD, X402_META_PAYMENT_PAYLOAD);
        return payload instanceof Map ? (Map<String, Object>) payload : null;
    }

    /**
     * Create an agent message requesting payment.
     * Emits both t402.payment.* and x402.payment.* metadata for dual-namespace compatibility.
     *
     * @param paymentRequired the payment requirements
     * @param text optional message text (defaults to standard text)
     * @return A2A message with payment-required metadata
     */
    @SuppressWarnings("unchecked")
    public static Message createPaymentRequiredMessage(Object paymentRequired, String text) {
        if (text == null || text.isEmpty()) {
            text = "Payment is required to complete this request.";
        }
        Map<String, Object> metadata = new HashMap<>();
        metadata.put(META_PAYMENT_STATUS, STATUS_PAYMENT_REQUIRED);
        metadata.put(META_PAYMENT_REQUIRED, paymentRequired);
        metadata.put(X402_META_PAYMENT_STATUS, STATUS_PAYMENT_REQUIRED);
        Map<String, Object> x402Downgraded = downgradeRequirementsToX402(
                paymentRequired instanceof Map ? (Map<String, Object>) paymentRequired : null);
        if (x402Downgraded != null) {
            metadata.put(X402_META_PAYMENT_REQUIRED, x402Downgraded);
        }
        return new Message("agent", List.of(MessagePart.text(text)), metadata);
    }

    /**
     * Create a user message submitting payment.
     * Emits both t402.payment.* and x402.payment.* metadata for dual-namespace compatibility.
     *
     * @param paymentPayload the payment payload
     * @param text optional message text
     * @return A2A message with payment-submitted metadata
     */
    public static Message createPaymentSubmissionMessage(Object paymentPayload, String text) {
        if (text == null || text.isEmpty()) {
            text = "Here is the payment authorization.";
        }
        Map<String, Object> metadata = new HashMap<>();
        metadata.put(META_PAYMENT_STATUS, STATUS_PAYMENT_SUBMITTED);
        metadata.put(META_PAYMENT_PAYLOAD, paymentPayload);
        metadata.put(X402_META_PAYMENT_STATUS, STATUS_PAYMENT_SUBMITTED);
        metadata.put(X402_META_PAYMENT_PAYLOAD, paymentPayload);
        return new Message("user", List.of(MessagePart.text(text)), metadata);
    }

    /**
     * Create an agent message confirming payment.
     * Emits both t402.payment.* and x402.payment.* metadata for dual-namespace compatibility.
     *
     * @param receipts settlement receipts
     * @param text optional message text
     * @return A2A message with payment-completed metadata
     */
    public static Message createPaymentCompletedMessage(Object receipts, String text) {
        if (text == null || text.isEmpty()) {
            text = "Payment successful.";
        }
        Map<String, Object> metadata = new HashMap<>();
        metadata.put(META_PAYMENT_STATUS, STATUS_PAYMENT_COMPLETED);
        metadata.put(META_PAYMENT_RECEIPTS, receipts);
        metadata.put(X402_META_PAYMENT_STATUS, STATUS_PAYMENT_COMPLETED);
        metadata.put(X402_META_PAYMENT_RECEIPTS, receipts);
        return new Message("agent", List.of(MessagePart.text(text)), metadata);
    }

    /**
     * Create an agent message reporting payment failure.
     * Emits both t402.payment.* and x402.payment.* metadata for dual-namespace compatibility.
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
        Map<String, Object> metadata = new HashMap<>();
        metadata.put(META_PAYMENT_STATUS, STATUS_PAYMENT_FAILED);
        metadata.put(META_PAYMENT_ERROR, errorCode);
        metadata.put(META_PAYMENT_RECEIPTS, receipts);
        metadata.put(X402_META_PAYMENT_STATUS, STATUS_PAYMENT_FAILED);
        metadata.put(X402_META_PAYMENT_ERROR, mapT402ErrorToX402(errorCode));
        metadata.put(X402_META_PAYMENT_RECEIPTS, receipts);
        return new Message("agent", List.of(MessagePart.text(text)), metadata);
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
                "T402 multi-chain payment protocol (12 mechanisms, 44 networks).",
                required
        );
    }

    /**
     * Create an x402 extension declaration for agent cards (compatibility layer).
     *
     * @param required whether the extension is required
     * @return A2A extension declaration for x402
     */
    public static Extension createX402Extension(boolean required) {
        return new Extension(X402_EXTENSION_URI, "x402 compatibility layer for EVM payments.", required);
    }

    /**
     * Map a T402 error code to an x402 v0.2 error code.
     *
     * @param code the T402 error code (e.g. "T402-3001")
     * @return the corresponding x402 error code, or "SETTLEMENT_FAILED" as fallback
     */
    public static String mapT402ErrorToX402(String code) {
        return T402_TO_X402_ERROR_MAP.getOrDefault(code, "SETTLEMENT_FAILED");
    }

    /**
     * Downgrade T402 payment requirements to x402 v0.2 format.
     * Only EVM "exact" scheme entries are included; non-EVM networks are filtered out.
     *
     * @param requirements the T402 payment requirements map
     * @return x402 v1 compatible requirements, or null if no EVM exact entries
     */
    @SuppressWarnings("unchecked")
    public static Map<String, Object> downgradeRequirementsToX402(Map<String, Object> requirements) {
        if (requirements == null) return null;
        Object acceptsObj = requirements.get("accepts");
        if (!(acceptsObj instanceof List)) return null;
        List<Object> accepts = (List<Object>) acceptsObj;
        List<Map<String, Object>> downgraded = new ArrayList<>();
        for (Object item : accepts) {
            if (!(item instanceof Map)) continue;
            Map<String, Object> a = (Map<String, Object>) item;
            String network = String.valueOf(a.getOrDefault("network", ""));
            String scheme = String.valueOf(a.getOrDefault("scheme", ""));
            if (!network.startsWith("eip155:") || !"exact".equals(scheme)) continue;
            Map<String, Object> entry = new HashMap<>(a);
            entry.put("network", CAIP2_TO_FLAT_NAME.getOrDefault(network, network));
            entry.put("maxAmountRequired", a.getOrDefault("amount", ""));
            // Get resource from parent requirements
            Object resource = requirements.get("resource");
            if (resource instanceof Map) {
                entry.put("resource", ((Map<String, Object>) resource).getOrDefault("url", ""));
            } else if (resource != null) {
                entry.put("resource", resource);
            }
            downgraded.add(entry);
        }
        if (downgraded.isEmpty()) return null;
        Map<String, Object> result = new HashMap<>();
        result.put("x402Version", 1);
        result.put("accepts", downgraded);
        return result;
    }

    /**
     * Check if the task uses standalone x402 flow (has x402.payment.required).
     *
     * @param task the A2A task
     * @return true if using x402 standalone flow
     */
    public static boolean isStandaloneFlow(Task task) {
        if (task.status.message == null || task.status.message.metadata == null) return false;
        return STATUS_PAYMENT_REQUIRED.equals(task.status.message.metadata.get(X402_META_PAYMENT_STATUS))
                && task.status.message.metadata.containsKey(X402_META_PAYMENT_REQUIRED);
    }

    /**
     * Check if the task uses embedded x402 flow (x402 status but no x402 requirements).
     *
     * @param task the A2A task
     * @return true if using x402 embedded flow
     */
    public static boolean isEmbeddedFlow(Task task) {
        if (task.status.message == null || task.status.message.metadata == null) return false;
        return STATUS_PAYMENT_REQUIRED.equals(task.status.message.metadata.get(X402_META_PAYMENT_STATUS))
                && !task.status.message.metadata.containsKey(X402_META_PAYMENT_REQUIRED);
    }
}
