package io.t402.spring;

import io.t402.client.FacilitatorClient;
import io.t402.client.SettlementResponse;
import io.t402.client.VerificationResponse;
import io.t402.model.PaymentPayload;
import io.t402.model.PaymentRequirements;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.web.method.HandlerMethod;

import java.io.ByteArrayOutputStream;
import java.io.PrintWriter;
import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PaymentInterceptorTest {

    @Mock HttpServletRequest request;
    @Mock HttpServletResponse response;
    @Mock FacilitatorClient facilitator;

    private T402Properties properties;
    private PaymentInterceptor interceptor;

    @BeforeEach
    void setUp() throws Exception {
        MockitoAnnotations.openMocks(this);

        properties = new T402Properties();
        properties.setEnabled(true);
        properties.setPayTo("0xReceiver");
        properties.setNetwork("eip155:84532");
        properties.setAsset("0xUSDC");

        // Add a route configuration
        RouteConfig route = new RouteConfig();
        route.setPath("/api/premium/**");
        route.setAmount("$1.00");
        properties.setRoutes(List.of(route));

        interceptor = new PaymentInterceptor(facilitator, properties);

        // Mock response writer
        when(response.getWriter()).thenReturn(new PrintWriter(new ByteArrayOutputStream(), true));
    }

    @Test
    void nonHandlerMethodPassesThrough() throws Exception {
        // Non-HandlerMethod should pass through
        assertTrue(interceptor.preHandle(request, response, new Object()));
        verify(response, never()).setStatus(anyInt());
    }

    @Test
    void noAnnotationNoRoutePassesThrough() throws Exception {
        // Request to path not covered by route or annotation
        when(request.getRequestURI()).thenReturn("/public/data");

        HandlerMethod handler = createHandlerMethod(TestController.class, "freeEndpoint");
        assertTrue(interceptor.preHandle(request, response, handler));
        verify(response, never()).setStatus(anyInt());
    }

    @Test
    void routeMatchWithoutPaymentReturns402() throws Exception {
        // Request matches route pattern
        when(request.getRequestURI()).thenReturn("/api/premium/data");
        when(request.getHeader("X-PAYMENT")).thenReturn(null);
        when(request.getRequestURL()).thenReturn(new StringBuffer("http://localhost/api/premium/data"));
        when(request.getQueryString()).thenReturn(null);

        HandlerMethod handler = createHandlerMethod(TestController.class, "freeEndpoint");
        assertFalse(interceptor.preHandle(request, response, handler));
        verify(response).setStatus(HttpServletResponse.SC_PAYMENT_REQUIRED);
    }

    @Test
    void routeMatchWithValidPaymentPasses() throws Exception {
        when(request.getRequestURI()).thenReturn("/api/premium/data");
        when(request.getRequestURL()).thenReturn(new StringBuffer("http://localhost/api/premium/data"));
        when(request.getQueryString()).thenReturn(null);

        // Create valid v2 payment header
        PaymentPayload payload = PaymentPayload.builder()
            .resource("http://localhost/api/premium/data", null, null)
            .accepted(new PaymentRequirements("exact", "eip155:84532", "USDC", "1000000", "0xReceiver", 30))
            .payload(Map.of("signature", "0x1234"))
            .build();
        String header = payload.toHeader();
        when(request.getHeader("X-PAYMENT")).thenReturn(header);

        // Mock verification success
        VerificationResponse vr = new VerificationResponse();
        vr.isValid = true;
        when(facilitator.verify(eq(header), any())).thenReturn(vr);

        HandlerMethod handler = createHandlerMethod(TestController.class, "freeEndpoint");
        assertTrue(interceptor.preHandle(request, response, handler));
        verify(response, never()).setStatus(HttpServletResponse.SC_PAYMENT_REQUIRED);
    }

    @Test
    void annotatedMethodWithoutPaymentReturns402() throws Exception {
        when(request.getRequestURI()).thenReturn("/some/path");
        when(request.getHeader("X-PAYMENT")).thenReturn(null);
        when(request.getRequestURL()).thenReturn(new StringBuffer("http://localhost/some/path"));
        when(request.getQueryString()).thenReturn(null);

        // Method with @RequirePayment annotation
        HandlerMethod handler = createHandlerMethod(TestController.class, "premiumEndpoint");
        assertFalse(interceptor.preHandle(request, response, handler));
        verify(response).setStatus(HttpServletResponse.SC_PAYMENT_REQUIRED);
    }

    @Test
    void classAnnotationAppliedToMethod() throws Exception {
        when(request.getRequestURI()).thenReturn("/premium/data");
        when(request.getHeader("X-PAYMENT")).thenReturn(null);
        when(request.getRequestURL()).thenReturn(new StringBuffer("http://localhost/premium/data"));
        when(request.getQueryString()).thenReturn(null);

        // Method on class with @RequirePayment annotation
        HandlerMethod handler = createHandlerMethod(PremiumController.class, "getData");
        assertFalse(interceptor.preHandle(request, response, handler));
        verify(response).setStatus(HttpServletResponse.SC_PAYMENT_REQUIRED);
    }

    @Test
    void methodAnnotationOverridesClassAnnotation() throws Exception {
        when(request.getRequestURI()).thenReturn("/premium/expensive");
        when(request.getRequestURL()).thenReturn(new StringBuffer("http://localhost/premium/expensive"));
        when(request.getQueryString()).thenReturn(null);

        // Create payment for $1.00 (class-level amount)
        PaymentPayload payload = PaymentPayload.builder()
            .resource("http://localhost/premium/expensive", null, null)
            .accepted(new PaymentRequirements("exact", "eip155:84532", "USDC", "1000000", "0xReceiver", 30))
            .payload(Map.of())
            .build();
        String header = payload.toHeader();
        when(request.getHeader("X-PAYMENT")).thenReturn(header);

        VerificationResponse vr = new VerificationResponse();
        vr.isValid = true;
        when(facilitator.verify(eq(header), any())).thenReturn(vr);

        // Method with @RequirePayment($5.00) should use method-level amount
        HandlerMethod handler = createHandlerMethod(PremiumController.class, "expensiveEndpoint");
        assertTrue(interceptor.preHandle(request, response, handler));

        // Verify the amount used was from method annotation ($5.00 = 5000000)
        verify(facilitator).verify(eq(header), argThat(req ->
            req.amount.equals("5000000")
        ));
    }

    @Test
    void malformedPaymentHeaderReturns402() throws Exception {
        when(request.getRequestURI()).thenReturn("/api/premium/data");
        when(request.getHeader("X-PAYMENT")).thenReturn("invalid-header");
        when(request.getRequestURL()).thenReturn(new StringBuffer("http://localhost/api/premium/data"));
        when(request.getQueryString()).thenReturn(null);

        HandlerMethod handler = createHandlerMethod(TestController.class, "freeEndpoint");
        assertFalse(interceptor.preHandle(request, response, handler));
        verify(response).setStatus(HttpServletResponse.SC_PAYMENT_REQUIRED);
    }

    @Test
    void verificationFailureReturns402() throws Exception {
        when(request.getRequestURI()).thenReturn("/api/premium/data");
        when(request.getRequestURL()).thenReturn(new StringBuffer("http://localhost/api/premium/data"));
        when(request.getQueryString()).thenReturn(null);

        PaymentPayload payload = PaymentPayload.builder()
            .resource("http://localhost/api/premium/data", null, null)
            .accepted(new PaymentRequirements("exact", "eip155:84532", "USDC", "1000000", "0xReceiver", 30))
            .payload(Map.of())
            .build();
        String header = payload.toHeader();
        when(request.getHeader("X-PAYMENT")).thenReturn(header);

        // Mock verification failure
        VerificationResponse vr = new VerificationResponse();
        vr.isValid = false;
        vr.invalidReason = "insufficient funds";
        when(facilitator.verify(eq(header), any())).thenReturn(vr);

        HandlerMethod handler = createHandlerMethod(TestController.class, "freeEndpoint");
        assertFalse(interceptor.preHandle(request, response, handler));
        verify(response).setStatus(HttpServletResponse.SC_PAYMENT_REQUIRED);
    }

    @Test
    void afterCompletionSettlesPayment() throws Exception {
        // Simulate successful pre-handle
        String header = createValidPaymentHeader();
        PaymentRequirements requirements = new PaymentRequirements("exact", "eip155:84532", "USDC", "1000000", "0xReceiver", 30);

        when(request.getAttribute("t402.paymentHeader")).thenReturn(header);
        when(request.getAttribute("t402.paymentRequirements")).thenReturn(requirements);
        when(response.getStatus()).thenReturn(200);

        SettlementResponse sr = new SettlementResponse();
        sr.success = true;
        sr.txHash = "0xabc123";
        when(facilitator.settle(eq(header), any())).thenReturn(sr);

        interceptor.afterCompletion(request, response, null, null);

        verify(facilitator).settle(eq(header), any());
    }

    @Test
    void afterCompletionDoesNotSettleOnError() throws Exception {
        // Simulate response with error status
        String header = createValidPaymentHeader();
        PaymentRequirements requirements = new PaymentRequirements();

        when(request.getAttribute("t402.paymentHeader")).thenReturn(header);
        when(request.getAttribute("t402.paymentRequirements")).thenReturn(requirements);
        when(response.getStatus()).thenReturn(500);

        interceptor.afterCompletion(request, response, null, null);

        verify(facilitator, never()).settle(any(), any());
    }

    // ========== Helper methods ==========

    private String createValidPaymentHeader() {
        PaymentPayload payload = PaymentPayload.builder()
            .resource("http://localhost/api/premium/data", null, null)
            .accepted(new PaymentRequirements("exact", "eip155:84532", "USDC", "1000000", "0xReceiver", 30))
            .payload(Map.of("signature", "0x1234"))
            .build();
        return payload.toHeader();
    }

    private HandlerMethod createHandlerMethod(Class<?> clazz, String methodName) throws Exception {
        Method method = null;
        for (Method m : clazz.getDeclaredMethods()) {
            if (m.getName().equals(methodName)) {
                method = m;
                break;
            }
        }
        if (method == null) {
            throw new NoSuchMethodException(methodName);
        }
        Object bean = clazz.getDeclaredConstructor().newInstance();
        return new HandlerMethod(bean, method);
    }

    // ========== Test controllers ==========

    static class TestController {
        public String freeEndpoint() {
            return "free";
        }

        @RequirePayment(amount = "$0.50")
        public String premiumEndpoint() {
            return "premium";
        }
    }

    @RequirePayment(amount = "$1.00")
    static class PremiumController {
        public String getData() {
            return "data";
        }

        @RequirePayment(amount = "$5.00")
        public String expensiveEndpoint() {
            return "expensive";
        }
    }
}
