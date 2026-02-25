package io.t402.a2a;

import static io.t402.a2a.A2AHelpers.createT402Extension;
import static io.t402.a2a.A2AHelpers.createX402Extension;
import static io.t402.a2a.A2AConstants.EXTENSIONS_HEADER;
import static io.t402.a2a.A2AConstants.X402_EXTENSION_URI;

import java.util.*;

/**
 * Helper functions for AP2 (Agentic Payment Protocol) embedded payment flow.
 * Bridges between AP2 mandates and x402/t402 payment requirements/payloads.
 */
public final class AP2Helpers {
    private AP2Helpers() {}

    /** AP2 extension URI. */
    public static final String AP2_EXTENSION_URI = "https://github.com/google-agentic-commerce/ap2/tree/v0.1";

    /** x402 payment method identifier for AP2 payment requests. */
    public static final String X402_PAYMENT_METHOD = "https://www.x402.org/";

    /** AP2 data key for intent mandate. */
    public static final String AP2_DATA_KEY_INTENT_MANDATE = "ap2.mandates.IntentMandate";

    /** AP2 data key for cart mandate. */
    public static final String AP2_DATA_KEY_CART_MANDATE = "ap2.mandates.CartMandate";

    /** AP2 data key for payment mandate. */
    public static final String AP2_DATA_KEY_PAYMENT_MANDATE = "ap2.mandates.PaymentMandate";

    /** AP2 data key for payment receipt. */
    public static final String AP2_DATA_KEY_PAYMENT_RECEIPT = "ap2.PaymentReceipt";

    /**
     * Create a cart mandate with x402 payment method injected.
     * Adds (or replaces) an x402 payment method entry in the cart's payment request method_data.
     *
     * @param cartContents          the cart contents map
     * @param requirements          list of x402 payment requirements
     * @param merchantAuthorization optional merchant authorization string
     * @return a cart mandate map with x402 method data
     */
    @SuppressWarnings("unchecked")
    public static Map<String, Object> createCartMandateWithX402(
            Map<String, Object> cartContents,
            List<Map<String, Object>> requirements,
            String merchantAuthorization) {
        // Get existing payment_request
        Map<String, Object> paymentRequest = (Map<String, Object>) cartContents.get("payment_request");
        List<Map<String, Object>> methodData = paymentRequest != null
                ? new ArrayList<>((List<Map<String, Object>>) paymentRequest.getOrDefault("method_data", Collections.emptyList()))
                : new ArrayList<>();

        // Filter out existing x402 methods
        methodData.removeIf(m -> X402_PAYMENT_METHOD.equals(m.get("supported_methods")));

        // Add x402 method
        Map<String, Object> x402Method = new HashMap<>();
        x402Method.put("supported_methods", X402_PAYMENT_METHOD);
        x402Method.put("data", Map.of("requirements", requirements));
        methodData.add(x402Method);

        // Build updated cart contents
        Map<String, Object> updatedRequest = new HashMap<>(paymentRequest != null ? paymentRequest : Map.of());
        updatedRequest.put("method_data", methodData);

        Map<String, Object> updatedContents = new HashMap<>(cartContents);
        updatedContents.put("payment_request", updatedRequest);

        Map<String, Object> mandate = new HashMap<>();
        mandate.put("contents", updatedContents);
        if (merchantAuthorization != null && !merchantAuthorization.isEmpty()) {
            mandate.put("merchant_authorization", merchantAuthorization);
        }
        return mandate;
    }

    /**
     * Extract x402 payment requirements from a cart mandate.
     *
     * @param cartMandate the cart mandate map
     * @return list of x402 requirements, or null if not found
     */
    @SuppressWarnings("unchecked")
    public static List<Map<String, Object>> extractX402Requirements(Map<String, Object> cartMandate) {
        Map<String, Object> contents = (Map<String, Object>) cartMandate.get("contents");
        if (contents == null) return null;
        Map<String, Object> paymentRequest = (Map<String, Object>) contents.get("payment_request");
        if (paymentRequest == null) return null;
        List<Map<String, Object>> methodData = (List<Map<String, Object>>) paymentRequest.get("method_data");
        if (methodData == null) return null;
        for (Map<String, Object> m : methodData) {
            if (X402_PAYMENT_METHOD.equals(m.get("supported_methods"))) {
                Map<String, Object> data = (Map<String, Object>) m.get("data");
                if (data != null && data.get("requirements") instanceof List) {
                    return (List<Map<String, Object>>) data.get("requirements");
                }
            }
        }
        return null;
    }

    /**
     * Create a payment mandate with x402 payment payload.
     * Sets the payment_response method_name to x402 and injects the payload as details.
     *
     * @param mandateContents   the payment mandate contents map
     * @param payload           the x402 payment payload
     * @param userAuthorization optional user authorization string
     * @return a payment mandate map with x402 payload
     */
    @SuppressWarnings("unchecked")
    public static Map<String, Object> createPaymentMandateWithX402(
            Map<String, Object> mandateContents,
            Map<String, Object> payload,
            String userAuthorization) {
        Map<String, Object> updatedContents = new HashMap<>(mandateContents);
        Map<String, Object> response = new HashMap<>();
        Map<String, Object> existingResponse = (Map<String, Object>) mandateContents.get("payment_response");
        if (existingResponse != null) {
            response.putAll(existingResponse);
        }
        response.put("method_name", X402_PAYMENT_METHOD);
        response.put("details", payload);
        updatedContents.put("payment_response", response);

        Map<String, Object> mandate = new HashMap<>();
        mandate.put("payment_mandate_contents", updatedContents);
        if (userAuthorization != null && !userAuthorization.isEmpty()) {
            mandate.put("user_authorization", userAuthorization);
        }
        return mandate;
    }

    /**
     * Extract x402 payment payload from a payment mandate.
     *
     * @param paymentMandate the payment mandate map
     * @return the x402 payload map, or null if not found or not x402
     */
    @SuppressWarnings("unchecked")
    public static Map<String, Object> extractX402Payload(Map<String, Object> paymentMandate) {
        Map<String, Object> contents = (Map<String, Object>) paymentMandate.get("payment_mandate_contents");
        if (contents == null) return null;
        Map<String, Object> response = (Map<String, Object>) contents.get("payment_response");
        if (response == null) return null;
        if (!X402_PAYMENT_METHOD.equals(response.get("method_name"))) return null;
        Object details = response.get("details");
        return details instanceof Map ? (Map<String, Object>) details : null;
    }

    /**
     * Create an AP2 extension declaration for agent cards.
     *
     * @param roles    list of AP2 roles (defaults to ["merchant"] if null/empty)
     * @param required whether the extension is required
     * @return A2A extension declaration for AP2
     */
    public static A2ATypes.Extension createAP2Extension(List<String> roles, boolean required) {
        if (roles == null || roles.isEmpty()) roles = List.of("merchant");
        String desc = "AP2 payment agent (roles: " + String.join(", ", roles) + ").";
        return new A2ATypes.Extension(AP2_EXTENSION_URI, desc, required);
    }

    /**
     * Create a data part containing a cart mandate.
     *
     * @param cartMandate the cart mandate map
     * @return a MessagePart with kind "data" containing the cart mandate
     */
    public static A2ATypes.MessagePart createCartMandateDataPart(Map<String, Object> cartMandate) {
        A2ATypes.MessagePart part = new A2ATypes.MessagePart();
        part.kind = "data";
        part.data = Map.of(AP2_DATA_KEY_CART_MANDATE, cartMandate);
        return part;
    }

    /**
     * Create a data part containing a payment mandate.
     *
     * @param paymentMandate the payment mandate map
     * @return a MessagePart with kind "data" containing the payment mandate
     */
    public static A2ATypes.MessagePart createPaymentMandateDataPart(Map<String, Object> paymentMandate) {
        A2ATypes.MessagePart part = new A2ATypes.MessagePart();
        part.kind = "data";
        part.data = Map.of(AP2_DATA_KEY_PAYMENT_MANDATE, paymentMandate);
        return part;
    }

    /**
     * Extract a cart mandate from an artifact's parts.
     *
     * @param artifact the A2A artifact
     * @return the cart mandate map, or null if not found
     */
    @SuppressWarnings("unchecked")
    public static Map<String, Object> extractCartMandateFromArtifact(A2ATypes.Artifact artifact) {
        if (artifact.parts == null) return null;
        for (A2ATypes.MessagePart part : artifact.parts) {
            if ("data".equals(part.kind) && part.data != null
                    && part.data.containsKey(AP2_DATA_KEY_CART_MANDATE)) {
                Object cm = part.data.get(AP2_DATA_KEY_CART_MANDATE);
                return cm instanceof Map ? (Map<String, Object>) cm : null;
            }
        }
        return null;
    }

    /**
     * Extract a payment mandate from a message's parts.
     *
     * @param message the A2A message
     * @return the payment mandate map, or null if not found
     */
    @SuppressWarnings("unchecked")
    public static Map<String, Object> extractPaymentMandateFromMessage(A2ATypes.Message message) {
        if (message.parts == null) return null;
        for (A2ATypes.MessagePart part : message.parts) {
            if ("data".equals(part.kind) && part.data != null
                    && part.data.containsKey(AP2_DATA_KEY_PAYMENT_MANDATE)) {
                Object pm = part.data.get(AP2_DATA_KEY_PAYMENT_MANDATE);
                return pm instanceof Map ? (Map<String, Object>) pm : null;
            }
        }
        return null;
    }

    // ==================== AgentCard extension composition ====================

    /**
     * Options for createPaymentExtensions.
     */
    public static class PaymentExtensionOptions {
        public List<String> ap2Roles;
        public boolean t402Required;
        public boolean x402Required;
        public boolean ap2Required;

        public PaymentExtensionOptions() {}
    }

    /**
     * Create a complete payment extensions list for an AgentCard.
     * Returns [t402, x402, ap2?] extensions.
     *
     * @param options configuration for extension required flags and AP2 roles
     * @return list of A2A extensions
     */
    public static List<A2ATypes.Extension> createPaymentExtensions(PaymentExtensionOptions options) {
        List<A2ATypes.Extension> extensions = new ArrayList<>();
        extensions.add(createT402Extension(options.t402Required));
        extensions.add(createX402Extension(options.x402Required));
        if (options.ap2Roles != null && !options.ap2Roles.isEmpty()) {
            extensions.add(createAP2Extension(options.ap2Roles, options.ap2Required));
        }
        return extensions;
    }

    /**
     * Create a complete payment extensions list for an AgentCard with default options.
     * Returns [t402, x402] extensions with required=false.
     *
     * @return list of A2A extensions
     */
    public static List<A2ATypes.Extension> createPaymentExtensions() {
        return createPaymentExtensions(new PaymentExtensionOptions());
    }

    // ==================== Header helpers ====================

    /**
     * Get HTTP headers for A2A payment extension activation.
     *
     * @param includeAP2 whether to include the AP2 extension URI
     * @return map of HTTP headers
     */
    public static Map<String, String> getPaymentExtensionHeaders(boolean includeAP2) {
        StringBuilder uris = new StringBuilder(X402_EXTENSION_URI);
        if (includeAP2) {
            uris.append(", ").append(AP2_EXTENSION_URI);
        }
        Map<String, String> headers = new HashMap<>();
        headers.put(EXTENSIONS_HEADER, uris.toString());
        return headers;
    }

    /**
     * Get HTTP headers for A2A payment extension activation (x402 only).
     *
     * @return map of HTTP headers with x402 extension URI
     */
    public static Map<String, String> getPaymentExtensionHeaders() {
        return getPaymentExtensionHeaders(false);
    }
}
