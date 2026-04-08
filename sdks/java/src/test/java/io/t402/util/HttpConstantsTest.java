package io.t402.util;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class HttpConstantsTest {

    @Test
    void v2HeaderConstants() {
        assertEquals("PAYMENT-SIGNATURE", HttpConstants.PAYMENT_SIGNATURE);
        assertEquals("PAYMENT-REQUIRED", HttpConstants.PAYMENT_REQUIRED);
        assertEquals("PAYMENT-RESPONSE", HttpConstants.PAYMENT_RESPONSE);
    }

    @Test
    void v1HeaderConstants() {
        assertEquals("X-PAYMENT", HttpConstants.X_PAYMENT);
        assertEquals("X-PAYMENT-RESPONSE", HttpConstants.X_PAYMENT_RESPONSE);
    }

    @Test
    void getPaymentHeaderNameV2() {
        assertEquals("PAYMENT-SIGNATURE", HttpConstants.getPaymentHeaderName(2));
        assertEquals("PAYMENT-SIGNATURE", HttpConstants.getPaymentHeaderName(3));
    }

    @Test
    void getPaymentHeaderNameV1() {
        assertEquals("X-PAYMENT", HttpConstants.getPaymentHeaderName(1));
        assertEquals("X-PAYMENT", HttpConstants.getPaymentHeaderName(0));
    }

    @Test
    void getResponseHeaderNameV2() {
        assertEquals("PAYMENT-RESPONSE", HttpConstants.getResponseHeaderName(2));
    }

    @Test
    void getResponseHeaderNameV1() {
        assertEquals("X-PAYMENT-RESPONSE", HttpConstants.getResponseHeaderName(1));
    }
}
