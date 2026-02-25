package io.t402.a2a;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;

/**
 * AP2 (Agentic Payment Protocol) types for embedded payment flow.
 */
public final class AP2Types {
    private AP2Types() {}

    /**
     * A currency amount with ISO 4217 code and numeric value.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PaymentCurrencyAmount {
        public String currency;
        public double value;
        public PaymentCurrencyAmount() {}
        public PaymentCurrencyAmount(String currency, double value) {
            this.currency = currency;
            this.value = value;
        }
    }

    /**
     * A line item in a payment request.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PaymentItem {
        public String label;
        public PaymentCurrencyAmount amount;
        public Boolean pending;
        public PaymentItem() {}
        public PaymentItem(String label, PaymentCurrencyAmount amount) {
            this.label = label;
            this.amount = amount;
        }
    }

    /**
     * A payment method with its configuration data.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PaymentMethodData {
        @JsonProperty("supported_methods")
        public String supportedMethods;
        public Map<String, Object> data;
        public PaymentMethodData() {}
        public PaymentMethodData(String supportedMethods, Map<String, Object> data) {
            this.supportedMethods = supportedMethods;
            this.data = data;
        }
    }

    /**
     * Payment details including line items and total.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PaymentDetailsInit {
        public String id;
        @JsonProperty("display_items")
        public List<PaymentItem> displayItems;
        public PaymentItem total;
        public PaymentDetailsInit() {}
    }

    /**
     * A payment request with method data and details.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PaymentRequest {
        @JsonProperty("method_data")
        public List<PaymentMethodData> methodData;
        public PaymentDetailsInit details;
        public PaymentRequest() {}
    }

    /**
     * A payment response containing method name and details.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PaymentResponse {
        @JsonProperty("request_id")
        public String requestId;
        @JsonProperty("method_name")
        public String methodName;
        public Map<String, Object> details;
        public PaymentResponse() {}
    }

    /**
     * An intent mandate describing high-level payment intent.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class IntentMandate {
        @JsonProperty("natural_language_description")
        public String naturalLanguageDescription;
        @JsonProperty("user_cart_confirmation_required")
        public boolean userCartConfirmationRequired;
        public List<String> merchants;
        public List<String> skus;
        @JsonProperty("requires_refundability")
        public Boolean requiresRefundability;
        @JsonProperty("intent_expiry")
        public String intentExpiry;
        public IntentMandate() {}
    }

    /**
     * Cart contents with payment request and metadata.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class CartContents {
        public String id;
        @JsonProperty("user_cart_confirmation_required")
        public boolean userCartConfirmationRequired;
        @JsonProperty("payment_request")
        public PaymentRequest paymentRequest;
        @JsonProperty("cart_expiry")
        public String cartExpiry;
        @JsonProperty("merchant_name")
        public String merchantName;
        public CartContents() {}
    }

    /**
     * A cart mandate with contents and merchant authorization.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class CartMandate {
        public CartContents contents;
        @JsonProperty("merchant_authorization")
        public String merchantAuthorization;
        public CartMandate() {}
    }

    /**
     * Payment mandate contents with response and merchant info.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PaymentMandateContents {
        @JsonProperty("payment_mandate_id")
        public String paymentMandateId;
        @JsonProperty("payment_details_id")
        public String paymentDetailsId;
        @JsonProperty("payment_details_total")
        public PaymentItem paymentDetailsTotal;
        @JsonProperty("payment_response")
        public PaymentResponse paymentResponse;
        @JsonProperty("merchant_agent")
        public String merchantAgent;
        public String timestamp;
        public PaymentMandateContents() {}
    }

    /**
     * A payment mandate with contents and user authorization.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PaymentMandate {
        @JsonProperty("payment_mandate_contents")
        public PaymentMandateContents paymentMandateContents;
        @JsonProperty("user_authorization")
        public String userAuthorization;
        public PaymentMandate() {}
    }

    /**
     * A payment receipt confirming settlement.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PaymentReceipt {
        @JsonProperty("payment_mandate_id")
        public String paymentMandateId;
        public String timestamp;
        @JsonProperty("payment_id")
        public String paymentId;
        public PaymentCurrencyAmount amount;
        @JsonProperty("payment_status")
        public Map<String, Object> paymentStatus;
        public PaymentReceipt() {}
    }
}
