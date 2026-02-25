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
 * A2A Payment Client.
 *
 * <p>Handles payment flows for A2A client agents, including detecting
 * payment-required states and submitting payment payloads.
 *
 * <p>Usage example:
 * <pre>{@code
 * A2APaymentClient client = new A2APaymentClient(
 *     req -> System.out.println("Payment required: " + req),
 *     null, null, null
 * );
 *
 * if (client.requiresPayment(task)) {
 *     Map<String, Object> requirements = client.getRequirements(task);
 *     Map<String, Object> option = client.selectPaymentOption(requirements, "eip155:8453", "exact");
 *     // ... sign with mechanism ...
 *     Message message = client.createPaymentMessage(payload, null);
 * }
 * }</pre>
 */
public class A2APaymentClient {

    // ==================== Callback interfaces ====================

    /** Callback fired when a task is detected as payment-required. */
    @FunctionalInterface
    public interface PaymentRequiredCallback {
        void onPaymentRequired(Map<String, Object> requirements);
    }

    /** Callback fired when a payment message is created. */
    @FunctionalInterface
    public interface PaymentSubmittedCallback {
        void onPaymentSubmitted(Map<String, Object> payload);
    }

    /** Callback fired when a task transitions to payment-completed. */
    @FunctionalInterface
    public interface PaymentCompletedCallback {
        void onPaymentCompleted(Task task);
    }

    /** Callback fired when payment fails. */
    @FunctionalInterface
    public interface PaymentFailedCallback {
        void onPaymentFailed(String error, Task task);
    }

    // ==================== Fields ====================

    private final PaymentRequiredCallback onPaymentRequired;
    private final PaymentSubmittedCallback onPaymentSubmitted;
    private final PaymentCompletedCallback onPaymentCompleted;
    private final PaymentFailedCallback onPaymentFailed;

    // ==================== Constructors ====================

    /** Create a client with no callbacks. */
    public A2APaymentClient() {
        this(null, null, null, null);
    }

    /**
     * Create a client with optional callbacks.
     *
     * @param onPaymentRequired  fired when payment is required (may be null)
     * @param onPaymentSubmitted fired when a payment message is created (may be null)
     * @param onPaymentCompleted fired on payment completion (may be null)
     * @param onPaymentFailed    fired on payment failure (may be null)
     */
    public A2APaymentClient(
            PaymentRequiredCallback onPaymentRequired,
            PaymentSubmittedCallback onPaymentSubmitted,
            PaymentCompletedCallback onPaymentCompleted,
            PaymentFailedCallback onPaymentFailed) {
        this.onPaymentRequired = onPaymentRequired;
        this.onPaymentSubmitted = onPaymentSubmitted;
        this.onPaymentCompleted = onPaymentCompleted;
        this.onPaymentFailed = onPaymentFailed;
    }

    // ==================== Methods ====================

    /**
     * Check if a task requires payment.
     * Fires {@code onPaymentRequired} callback if payment is required.
     *
     * @param task the A2A task to check
     * @return true if the task is in a payment-required state
     */
    public boolean requiresPayment(Task task) {
        boolean requires = isPaymentRequired(task);
        if (requires) {
            Map<String, Object> requirements = getPaymentRequired(task);
            if (requirements != null && onPaymentRequired != null) {
                onPaymentRequired.onPaymentRequired(requirements);
            }
        }
        return requires;
    }

    /**
     * Get payment requirements from a task.
     *
     * @param task the A2A task
     * @return payment requirements map, or null if not a payment-required task
     */
    public Map<String, Object> getRequirements(Task task) {
        return getPaymentRequired(task);
    }

    /**
     * Select the best payment option from requirements.
     *
     * <p>Searches the {@code accepts} list in order of preference:
     * <ol>
     *   <li>Exact match for both network and scheme</li>
     *   <li>Match for network only</li>
     *   <li>Match for scheme only</li>
     *   <li>First option</li>
     * </ol>
     *
     * @param requirements     payment requirements with an {@code accepts} list
     * @param preferredNetwork preferred CAIP-2 network (may be null)
     * @param preferredScheme  preferred scheme e.g. "exact", "upto" (may be null)
     * @return the best matching option, or null if accepts is empty/missing
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> selectPaymentOption(
            Map<String, Object> requirements,
            String preferredNetwork,
            String preferredScheme) {
        Object acceptsObj = requirements.get("accepts");
        if (!(acceptsObj instanceof List)) return null;
        List<Map<String, Object>> accepts = (List<Map<String, Object>>) acceptsObj;
        if (accepts.isEmpty()) return null;

        // Try exact match for both network and scheme
        if (preferredNetwork != null && preferredScheme != null) {
            for (Map<String, Object> a : accepts) {
                if (preferredNetwork.equals(a.get("network"))
                        && preferredScheme.equals(a.get("scheme"))) {
                    return a;
                }
            }
        }

        // Try match for network only
        if (preferredNetwork != null) {
            for (Map<String, Object> a : accepts) {
                if (preferredNetwork.equals(a.get("network"))) {
                    return a;
                }
            }
        }

        // Try match for scheme only
        if (preferredScheme != null) {
            for (Map<String, Object> a : accepts) {
                if (preferredScheme.equals(a.get("scheme"))) {
                    return a;
                }
            }
        }

        // Return first option
        return accepts.get(0);
    }

    /**
     * Create a payment submission message.
     * Delegates to {@link A2AHelpers#createPaymentSubmissionMessage(Object, String)}.
     *
     * @param payload the payment payload map
     * @param text    optional text message (null uses default)
     * @return A2A message with payment-submitted metadata (dual-namespace)
     */
    public Message createPaymentMessage(Map<String, Object> payload, String text) {
        if (onPaymentSubmitted != null) {
            onPaymentSubmitted.onPaymentSubmitted(payload);
        }
        return createPaymentSubmissionMessage(payload, text);
    }

    /**
     * Extract payment requirements from an embedded-flow task.
     * Scans task artifacts for CartMandate DataPart with x402 method data.
     *
     * @param task the A2A task with CartMandate artifacts
     * @return list of x402 payment requirements, or null if not found
     */
    public List<Map<String, Object>> extractEmbeddedRequirements(Task task) {
        if (task.artifacts == null) return null;
        for (Artifact artifact : task.artifacts) {
            Map<String, Object> cartMandate = extractCartMandateFromArtifact(artifact);
            if (cartMandate != null) {
                return extractX402Requirements(cartMandate);
            }
        }
        return null;
    }

    /**
     * Create a payment message for the AP2 embedded flow.
     * Wraps the PaymentPayload inside a PaymentMandate DataPart.
     *
     * @param mandateContents   payment mandate contents (without payment_response)
     * @param payload           the x402 payment payload
     * @param userAuthorization optional user authorization (Verifiable Presentation)
     * @param text              optional text message (null uses default)
     * @return A2A message with PaymentMandate DataPart and dual-namespace metadata
     */
    public Message createEmbeddedPaymentMessage(
            Map<String, Object> mandateContents,
            Map<String, Object> payload,
            String userAuthorization,
            String text) {
        if (text == null || text.isEmpty()) {
            text = "Here is the payment mandate.";
        }
        Map<String, Object> mandate = createPaymentMandateWithX402(
                mandateContents, payload, userAuthorization);

        Map<String, Object> metadata = new HashMap<>();
        metadata.put(META_PAYMENT_STATUS, STATUS_PAYMENT_SUBMITTED);
        metadata.put(X402_META_PAYMENT_STATUS, STATUS_PAYMENT_SUBMITTED);

        List<MessagePart> parts = new ArrayList<>();
        parts.add(MessagePart.text(text));
        parts.add(createPaymentMandateDataPart(mandate));

        Message msg = new Message("user", parts, metadata);
        return msg;
    }
}
