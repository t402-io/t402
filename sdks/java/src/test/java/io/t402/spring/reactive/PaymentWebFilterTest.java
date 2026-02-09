package io.t402.spring.reactive;

import io.t402.client.FacilitatorClient;
import io.t402.client.SettlementResponse;
import io.t402.client.VerificationResponse;
import io.t402.model.PaymentPayload;
import io.t402.model.PaymentRequirements;
import io.t402.spring.RouteConfig;
import io.t402.spring.T402Properties;
import io.t402.util.HttpConstants;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

import java.io.IOException;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PaymentWebFilterTest {

    @Mock
    FacilitatorClient facilitator;

    private T402Properties properties;
    private PaymentWebFilter filter;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);

        properties = new T402Properties();
        properties.setEnabled(true);
        properties.setPayTo("0xReceiver");
        properties.setNetwork("eip155:84532");
        properties.setAsset("0xUSDC");

        RouteConfig route = new RouteConfig();
        route.setPath("/api/premium/**");
        route.setAmount("$1.00");
        properties.setRoutes(List.of(route));

        filter = new PaymentWebFilter(facilitator, properties);
    }

    // ========== Non-protected path tests ==========

    @Test
    void nonProtectedPathPassesThrough() {
        MockServerHttpRequest request = MockServerHttpRequest
                .get("http://localhost/public/data")
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        AtomicBoolean chainCalled = new AtomicBoolean(false);
        WebFilterChain chain = ex -> {
            chainCalled.set(true);
            return Mono.empty();
        };

        filter.filter(exchange, chain).block();

        assertTrue(chainCalled.get(), "Filter chain should be called for non-protected path");
        assertNotEquals(HttpStatus.PAYMENT_REQUIRED, exchange.getResponse().getStatusCode());
    }

    @Test
    void rootPathPassesThrough() {
        MockServerHttpRequest request = MockServerHttpRequest
                .get("http://localhost/")
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        AtomicBoolean chainCalled = new AtomicBoolean(false);
        WebFilterChain chain = ex -> {
            chainCalled.set(true);
            return Mono.empty();
        };

        filter.filter(exchange, chain).block();

        assertTrue(chainCalled.get(), "Filter chain should be called for root path");
    }

    // ========== Missing payment header tests ==========

    @Test
    void protectedPathWithoutPaymentReturns402() {
        MockServerHttpRequest request = MockServerHttpRequest
                .get("http://localhost/api/premium/data")
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        AtomicBoolean chainCalled = new AtomicBoolean(false);
        WebFilterChain chain = ex -> {
            chainCalled.set(true);
            return Mono.empty();
        };

        filter.filter(exchange, chain).block();

        assertFalse(chainCalled.get(), "Filter chain should not be called without payment");
        assertEquals(HttpStatus.PAYMENT_REQUIRED, exchange.getResponse().getStatusCode());
    }

    @Test
    void protectedPathWithEmptyV2HeaderReturns402() {
        MockServerHttpRequest request = MockServerHttpRequest
                .get("http://localhost/api/premium/data")
                .header(HttpConstants.PAYMENT_SIGNATURE, "")
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        AtomicBoolean chainCalled = new AtomicBoolean(false);
        WebFilterChain chain = ex -> {
            chainCalled.set(true);
            return Mono.empty();
        };

        filter.filter(exchange, chain).block();

        assertFalse(chainCalled.get(), "Filter chain should not be called with empty header");
        assertEquals(HttpStatus.PAYMENT_REQUIRED, exchange.getResponse().getStatusCode());
    }

    @Test
    void protectedPathWithEmptyV1HeaderReturns402() {
        MockServerHttpRequest request = MockServerHttpRequest
                .get("http://localhost/api/premium/data")
                .header(HttpConstants.X_PAYMENT, "")
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        AtomicBoolean chainCalled = new AtomicBoolean(false);
        WebFilterChain chain = ex -> {
            chainCalled.set(true);
            return Mono.empty();
        };

        filter.filter(exchange, chain).block();

        assertFalse(chainCalled.get(), "Filter chain should not be called with empty V1 header");
        assertEquals(HttpStatus.PAYMENT_REQUIRED, exchange.getResponse().getStatusCode());
    }

    // ========== Valid V2 payment header tests ==========

    @Test
    void validV2PaymentHeaderPassesThrough() throws Exception {
        PaymentPayload payload = PaymentPayload.builder()
                .resource("http://localhost/api/premium/data", null, null)
                .accepted(new PaymentRequirements("exact", "eip155:84532", "USDC", "1000000", "0xReceiver", 30))
                .payload(Map.of("signature", "0x1234"))
                .build();
        String header = payload.toHeader();

        MockServerHttpRequest request = MockServerHttpRequest
                .get("http://localhost/api/premium/data")
                .header(HttpConstants.PAYMENT_SIGNATURE, header)
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        VerificationResponse vr = new VerificationResponse();
        vr.isValid = true;
        when(facilitator.verify(eq(header), any())).thenReturn(vr);

        AtomicBoolean chainCalled = new AtomicBoolean(false);
        WebFilterChain chain = ex -> {
            chainCalled.set(true);
            return Mono.empty();
        };

        filter.filter(exchange, chain).block();

        assertTrue(chainCalled.get(), "Filter chain should be called with valid payment");
        assertNotEquals(HttpStatus.PAYMENT_REQUIRED, exchange.getResponse().getStatusCode());
        verify(facilitator).verify(eq(header), any());
    }

    // ========== Valid V1 payment header tests ==========

    @Test
    void validV1PaymentHeaderPassesThrough() throws Exception {
        PaymentPayload payload = new PaymentPayload();
        payload.t402Version = 1;
        payload.scheme = "exact";
        payload.network = "base-sepolia";
        payload.payload = Map.of("resource", "/api/premium/data");
        String header = payload.toHeader();

        MockServerHttpRequest request = MockServerHttpRequest
                .get("http://localhost/api/premium/data")
                .header(HttpConstants.X_PAYMENT, header)
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        VerificationResponse vr = new VerificationResponse();
        vr.isValid = true;
        when(facilitator.verify(eq(header), any())).thenReturn(vr);

        AtomicBoolean chainCalled = new AtomicBoolean(false);
        WebFilterChain chain = ex -> {
            chainCalled.set(true);
            return Mono.empty();
        };

        filter.filter(exchange, chain).block();

        assertTrue(chainCalled.get(), "Filter chain should be called with valid V1 payment");
        verify(facilitator).verify(eq(header), any());
    }

    @Test
    void v2HeaderTakesPriorityOverV1() throws Exception {
        PaymentPayload v2Payload = PaymentPayload.builder()
                .resource("http://localhost/api/premium/data", null, null)
                .accepted(new PaymentRequirements("exact", "eip155:84532", "USDC", "1000000", "0xReceiver", 30))
                .payload(Map.of("signature", "0xV2"))
                .build();
        String v2Header = v2Payload.toHeader();

        PaymentPayload v1Payload = new PaymentPayload();
        v1Payload.t402Version = 1;
        v1Payload.scheme = "exact";
        v1Payload.network = "base-sepolia";
        v1Payload.payload = Map.of("resource", "/api/premium/data");
        String v1Header = v1Payload.toHeader();

        MockServerHttpRequest request = MockServerHttpRequest
                .get("http://localhost/api/premium/data")
                .header(HttpConstants.PAYMENT_SIGNATURE, v2Header)
                .header(HttpConstants.X_PAYMENT, v1Header)
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        VerificationResponse vr = new VerificationResponse();
        vr.isValid = true;
        when(facilitator.verify(eq(v2Header), any())).thenReturn(vr);

        AtomicBoolean chainCalled = new AtomicBoolean(false);
        WebFilterChain chain = ex -> {
            chainCalled.set(true);
            return Mono.empty();
        };

        filter.filter(exchange, chain).block();

        assertTrue(chainCalled.get(), "Filter chain should be called");
        verify(facilitator).verify(eq(v2Header), any());
        verify(facilitator, never()).verify(eq(v1Header), any());
    }

    // ========== Invalid payment tests ==========

    @Test
    void invalidPaymentReturns402() throws Exception {
        PaymentPayload payload = PaymentPayload.builder()
                .resource("http://localhost/api/premium/data", null, null)
                .accepted(new PaymentRequirements("exact", "eip155:84532", "USDC", "1000000", "0xReceiver", 30))
                .payload(Map.of())
                .build();
        String header = payload.toHeader();

        MockServerHttpRequest request = MockServerHttpRequest
                .get("http://localhost/api/premium/data")
                .header(HttpConstants.PAYMENT_SIGNATURE, header)
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        VerificationResponse vr = new VerificationResponse();
        vr.isValid = false;
        vr.invalidReason = "insufficient funds";
        when(facilitator.verify(eq(header), any())).thenReturn(vr);

        AtomicBoolean chainCalled = new AtomicBoolean(false);
        WebFilterChain chain = ex -> {
            chainCalled.set(true);
            return Mono.empty();
        };

        filter.filter(exchange, chain).block();

        assertFalse(chainCalled.get(), "Filter chain should not be called for invalid payment");
        assertEquals(HttpStatus.PAYMENT_REQUIRED, exchange.getResponse().getStatusCode());
    }

    @Test
    void malformedPaymentHeaderReturns402() {
        MockServerHttpRequest request = MockServerHttpRequest
                .get("http://localhost/api/premium/data")
                .header(HttpConstants.PAYMENT_SIGNATURE, "not-valid-base64!!!")
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        AtomicBoolean chainCalled = new AtomicBoolean(false);
        WebFilterChain chain = ex -> {
            chainCalled.set(true);
            return Mono.empty();
        };

        filter.filter(exchange, chain).block();

        assertFalse(chainCalled.get(), "Filter chain should not be called for malformed header");
        assertEquals(HttpStatus.PAYMENT_REQUIRED, exchange.getResponse().getStatusCode());
    }

    // ========== Resource mismatch tests ==========

    @Test
    void resourceMismatchReturns402() throws Exception {
        PaymentPayload payload = PaymentPayload.builder()
                .resource("http://localhost/other/resource", null, null)
                .accepted(new PaymentRequirements("exact", "eip155:84532", "USDC", "1000000", "0xReceiver", 30))
                .payload(Map.of("signature", "0x1234"))
                .build();
        String header = payload.toHeader();

        MockServerHttpRequest request = MockServerHttpRequest
                .get("http://localhost/api/premium/data")
                .header(HttpConstants.PAYMENT_SIGNATURE, header)
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        AtomicBoolean chainCalled = new AtomicBoolean(false);
        WebFilterChain chain = ex -> {
            chainCalled.set(true);
            return Mono.empty();
        };

        filter.filter(exchange, chain).block();

        assertFalse(chainCalled.get(), "Filter chain should not be called for resource mismatch");
        assertEquals(HttpStatus.PAYMENT_REQUIRED, exchange.getResponse().getStatusCode());
        verify(facilitator, never()).verify(any(), any());
    }

    @Test
    void resourceMatchByFullUrlPasses() throws Exception {
        String fullUrl = "http://localhost/api/premium/data";
        PaymentPayload payload = PaymentPayload.builder()
                .resource(fullUrl, null, null)
                .accepted(new PaymentRequirements("exact", "eip155:84532", "USDC", "1000000", "0xReceiver", 30))
                .payload(Map.of("signature", "0x1234"))
                .build();
        String header = payload.toHeader();

        MockServerHttpRequest request = MockServerHttpRequest
                .get(fullUrl)
                .header(HttpConstants.PAYMENT_SIGNATURE, header)
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        VerificationResponse vr = new VerificationResponse();
        vr.isValid = true;
        when(facilitator.verify(eq(header), any())).thenReturn(vr);

        AtomicBoolean chainCalled = new AtomicBoolean(false);
        WebFilterChain chain = ex -> {
            chainCalled.set(true);
            return Mono.empty();
        };

        filter.filter(exchange, chain).block();

        assertTrue(chainCalled.get(), "Filter chain should be called when resource URL matches full URL");
        verify(facilitator).verify(eq(header), any());
    }

    @Test
    void resourceMatchByPathPasses() throws Exception {
        PaymentPayload payload = PaymentPayload.builder()
                .resource("/api/premium/data", null, null)
                .accepted(new PaymentRequirements("exact", "eip155:84532", "USDC", "1000000", "0xReceiver", 30))
                .payload(Map.of("signature", "0x1234"))
                .build();
        String header = payload.toHeader();

        MockServerHttpRequest request = MockServerHttpRequest
                .get("http://localhost/api/premium/data")
                .header(HttpConstants.PAYMENT_SIGNATURE, header)
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        VerificationResponse vr = new VerificationResponse();
        vr.isValid = true;
        when(facilitator.verify(eq(header), any())).thenReturn(vr);

        AtomicBoolean chainCalled = new AtomicBoolean(false);
        WebFilterChain chain = ex -> {
            chainCalled.set(true);
            return Mono.empty();
        };

        filter.filter(exchange, chain).block();

        assertTrue(chainCalled.get(), "Filter chain should be called when resource matches path");
        verify(facilitator).verify(eq(header), any());
    }

    @Test
    void nullResourceInPayloadSkipsResourceCheck() throws Exception {
        PaymentPayload payload = PaymentPayload.builder()
                .accepted(new PaymentRequirements("exact", "eip155:84532", "USDC", "1000000", "0xReceiver", 30))
                .payload(Map.of("signature", "0x1234"))
                .build();
        String header = payload.toHeader();

        MockServerHttpRequest request = MockServerHttpRequest
                .get("http://localhost/api/premium/data")
                .header(HttpConstants.PAYMENT_SIGNATURE, header)
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        VerificationResponse vr = new VerificationResponse();
        vr.isValid = true;
        when(facilitator.verify(eq(header), any())).thenReturn(vr);

        AtomicBoolean chainCalled = new AtomicBoolean(false);
        WebFilterChain chain = ex -> {
            chainCalled.set(true);
            return Mono.empty();
        };

        filter.filter(exchange, chain).block();

        assertTrue(chainCalled.get(), "Filter chain should be called when no resource in payload");
        verify(facilitator).verify(eq(header), any());
    }

    // ========== Verification error tests ==========

    @Test
    void verificationExceptionReturns402() throws Exception {
        PaymentPayload payload = PaymentPayload.builder()
                .resource("http://localhost/api/premium/data", null, null)
                .accepted(new PaymentRequirements("exact", "eip155:84532", "USDC", "1000000", "0xReceiver", 30))
                .payload(Map.of("signature", "0x1234"))
                .build();
        String header = payload.toHeader();

        MockServerHttpRequest request = MockServerHttpRequest
                .get("http://localhost/api/premium/data")
                .header(HttpConstants.PAYMENT_SIGNATURE, header)
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        when(facilitator.verify(any(), any())).thenThrow(new IOException("Network error"));

        AtomicBoolean chainCalled = new AtomicBoolean(false);
        WebFilterChain chain = ex -> {
            chainCalled.set(true);
            return Mono.empty();
        };

        filter.filter(exchange, chain).block();

        assertFalse(chainCalled.get(), "Filter chain should not be called on verification error");
        assertEquals(HttpStatus.PAYMENT_REQUIRED, exchange.getResponse().getStatusCode());
    }

    // ========== Settlement tests ==========

    @Test
    void settlementCalledAfterSuccessfulVerification() throws Exception {
        PaymentPayload payload = PaymentPayload.builder()
                .resource("http://localhost/api/premium/data", null, null)
                .accepted(new PaymentRequirements("exact", "eip155:84532", "USDC", "1000000", "0xReceiver", 30))
                .payload(Map.of("signature", "0x1234"))
                .build();
        String header = payload.toHeader();

        MockServerHttpRequest request = MockServerHttpRequest
                .get("http://localhost/api/premium/data")
                .header(HttpConstants.PAYMENT_SIGNATURE, header)
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        VerificationResponse vr = new VerificationResponse();
        vr.isValid = true;
        when(facilitator.verify(eq(header), any())).thenReturn(vr);

        SettlementResponse sr = new SettlementResponse();
        sr.success = true;
        sr.transaction = "0xabc123";
        when(facilitator.settle(eq(header), any())).thenReturn(sr);

        AtomicBoolean chainCalled = new AtomicBoolean(false);
        WebFilterChain chain = ex -> {
            chainCalled.set(true);
            return Mono.empty();
        };

        filter.filter(exchange, chain).block();

        assertTrue(chainCalled.get(), "Filter chain should be called");
        verify(facilitator).verify(eq(header), any());
        verify(facilitator).settle(eq(header), any());
    }

    @Test
    void settlementExceptionDoesNotFailRequest() throws Exception {
        PaymentPayload payload = PaymentPayload.builder()
                .resource("http://localhost/api/premium/data", null, null)
                .accepted(new PaymentRequirements("exact", "eip155:84532", "USDC", "1000000", "0xReceiver", 30))
                .payload(Map.of("signature", "0x1234"))
                .build();
        String header = payload.toHeader();

        MockServerHttpRequest request = MockServerHttpRequest
                .get("http://localhost/api/premium/data")
                .header(HttpConstants.PAYMENT_SIGNATURE, header)
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        VerificationResponse vr = new VerificationResponse();
        vr.isValid = true;
        when(facilitator.verify(eq(header), any())).thenReturn(vr);

        when(facilitator.settle(any(), any())).thenThrow(new IOException("Settlement network error"));

        AtomicBoolean chainCalled = new AtomicBoolean(false);
        WebFilterChain chain = ex -> {
            chainCalled.set(true);
            return Mono.empty();
        };

        // Should not throw even if settlement fails
        assertDoesNotThrow(() -> filter.filter(exchange, chain).block());
        assertTrue(chainCalled.get(), "Filter chain should be called even if settlement fails");
    }

    // ========== Exchange attributes tests ==========

    @Test
    void paymentHeaderStoredInExchangeAttributes() throws Exception {
        PaymentPayload payload = PaymentPayload.builder()
                .resource("http://localhost/api/premium/data", null, null)
                .accepted(new PaymentRequirements("exact", "eip155:84532", "USDC", "1000000", "0xReceiver", 30))
                .payload(Map.of("signature", "0x1234"))
                .build();
        String header = payload.toHeader();

        MockServerHttpRequest request = MockServerHttpRequest
                .get("http://localhost/api/premium/data")
                .header(HttpConstants.PAYMENT_SIGNATURE, header)
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        VerificationResponse vr = new VerificationResponse();
        vr.isValid = true;
        when(facilitator.verify(eq(header), any())).thenReturn(vr);

        WebFilterChain chain = ex -> {
            // Verify attributes are set when the chain is invoked
            assertEquals(header, ex.getAttribute("t402.paymentHeader"));
            assertNotNull(ex.getAttribute("t402.paymentRequirements"));
            return Mono.empty();
        };

        filter.filter(exchange, chain).block();
    }

    // ========== Multiple routes tests ==========

    @Test
    void multipleProtectedRoutes() throws Exception {
        RouteConfig route1 = new RouteConfig();
        route1.setPath("/api/premium/**");
        route1.setAmount("$1.00");

        RouteConfig route2 = new RouteConfig();
        route2.setPath("/api/basic/*");
        route2.setAmount("$0.10");

        properties.setRoutes(List.of(route1, route2));
        filter = new PaymentWebFilter(facilitator, properties);

        // Test first route blocks
        MockServerHttpRequest request1 = MockServerHttpRequest
                .get("http://localhost/api/premium/data")
                .build();
        MockServerWebExchange exchange1 = MockServerWebExchange.from(request1);

        AtomicBoolean chain1Called = new AtomicBoolean(false);
        filter.filter(exchange1, ex -> {
            chain1Called.set(true);
            return Mono.empty();
        }).block();

        assertFalse(chain1Called.get());
        assertEquals(HttpStatus.PAYMENT_REQUIRED, exchange1.getResponse().getStatusCode());

        // Test second route blocks
        MockServerHttpRequest request2 = MockServerHttpRequest
                .get("http://localhost/api/basic/info")
                .build();
        MockServerWebExchange exchange2 = MockServerWebExchange.from(request2);

        AtomicBoolean chain2Called = new AtomicBoolean(false);
        filter.filter(exchange2, ex -> {
            chain2Called.set(true);
            return Mono.empty();
        }).block();

        assertFalse(chain2Called.get());
        assertEquals(HttpStatus.PAYMENT_REQUIRED, exchange2.getResponse().getStatusCode());

        // Test non-matching path passes
        MockServerHttpRequest request3 = MockServerHttpRequest
                .get("http://localhost/public/data")
                .build();
        MockServerWebExchange exchange3 = MockServerWebExchange.from(request3);

        AtomicBoolean chain3Called = new AtomicBoolean(false);
        filter.filter(exchange3, ex -> {
            chain3Called.set(true);
            return Mono.empty();
        }).block();

        assertTrue(chain3Called.get(), "Non-matching path should pass through");
    }

    @Test
    void disabledRouteDoesNotBlock() {
        RouteConfig enabledRoute = new RouteConfig();
        enabledRoute.setPath("/api/premium/**");
        enabledRoute.setAmount("$1.00");

        RouteConfig disabledRoute = new RouteConfig();
        disabledRoute.setPath("/api/disabled/**");
        disabledRoute.setAmount("$2.00");
        disabledRoute.setEnabled(false);

        properties.setRoutes(List.of(enabledRoute, disabledRoute));
        filter = new PaymentWebFilter(facilitator, properties);

        // Disabled route should pass through
        MockServerHttpRequest request = MockServerHttpRequest
                .get("http://localhost/api/disabled/data")
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        AtomicBoolean chainCalled = new AtomicBoolean(false);
        filter.filter(exchange, ex -> {
            chainCalled.set(true);
            return Mono.empty();
        }).block();

        assertTrue(chainCalled.get(), "Disabled route should pass through");
    }

    // ========== Route configuration tests ==========

    @Test
    void routeUsesGlobalDefaultsWhenNotOverridden() throws Exception {
        RouteConfig route = new RouteConfig();
        route.setPath("/api/premium/**");
        route.setAmount("$1.00");
        // Do NOT set scheme, network, asset on route -- should use global defaults

        properties.setRoutes(List.of(route));
        filter = new PaymentWebFilter(facilitator, properties);

        PaymentPayload payload = PaymentPayload.builder()
                .resource("http://localhost/api/premium/data", null, null)
                .accepted(new PaymentRequirements("exact", "eip155:84532", "0xUSDC", "1000000", "0xReceiver", 30))
                .payload(Map.of("signature", "0x1234"))
                .build();
        String header = payload.toHeader();

        MockServerHttpRequest request = MockServerHttpRequest
                .get("http://localhost/api/premium/data")
                .header(HttpConstants.PAYMENT_SIGNATURE, header)
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        VerificationResponse vr = new VerificationResponse();
        vr.isValid = true;
        when(facilitator.verify(eq(header), any())).thenReturn(vr);

        filter.filter(exchange, ex -> Mono.empty()).block();

        // Verify the requirements passed to facilitator use global defaults
        verify(facilitator).verify(eq(header), argThat(req ->
                "exact".equals(req.scheme)
                        && "eip155:84532".equals(req.network)
                        && "0xUSDC".equals(req.asset)
                        && "0xReceiver".equals(req.payTo)
        ));
    }

    @Test
    void routeOverridesGlobalDefaults() throws Exception {
        RouteConfig route = new RouteConfig();
        route.setPath("/api/premium/**");
        route.setAmount("$2.00");
        route.setScheme("upto");
        route.setNetwork("eip155:8453");
        route.setAsset("0xCustomAsset");

        properties.setRoutes(List.of(route));
        filter = new PaymentWebFilter(facilitator, properties);

        PaymentPayload payload = PaymentPayload.builder()
                .resource("http://localhost/api/premium/data", null, null)
                .accepted(new PaymentRequirements("upto", "eip155:8453", "0xCustomAsset", "2000000", "0xReceiver", 30))
                .payload(Map.of("signature", "0x1234"))
                .build();
        String header = payload.toHeader();

        MockServerHttpRequest request = MockServerHttpRequest
                .get("http://localhost/api/premium/data")
                .header(HttpConstants.PAYMENT_SIGNATURE, header)
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        VerificationResponse vr = new VerificationResponse();
        vr.isValid = true;
        when(facilitator.verify(eq(header), any())).thenReturn(vr);

        filter.filter(exchange, ex -> Mono.empty()).block();

        verify(facilitator).verify(eq(header), argThat(req ->
                "upto".equals(req.scheme)
                        && "eip155:8453".equals(req.network)
                        && "0xCustomAsset".equals(req.asset)
                        && "2000000".equals(req.amount)
        ));
    }

    // ========== Configuration via T402WebFluxConfiguration ==========

    @Test
    void configurationCreatesBeans() {
        T402WebFluxConfiguration config = new T402WebFluxConfiguration();

        FacilitatorClient client = config.facilitatorClient(properties);
        assertNotNull(client, "FacilitatorClient bean should be created");

        PaymentWebFilter webFilter = config.paymentWebFilter(client, properties);
        assertNotNull(webFilter, "PaymentWebFilter bean should be created");
    }

    // ========== Ant-style path matching tests ==========

    @Test
    void antStyleWildcardMatchesNestedPaths() {
        // Route pattern: /api/premium/**
        MockServerHttpRequest request = MockServerHttpRequest
                .get("http://localhost/api/premium/deep/nested/path")
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        AtomicBoolean chainCalled = new AtomicBoolean(false);
        filter.filter(exchange, ex -> {
            chainCalled.set(true);
            return Mono.empty();
        }).block();

        assertFalse(chainCalled.get(), "Nested path should match ** wildcard");
        assertEquals(HttpStatus.PAYMENT_REQUIRED, exchange.getResponse().getStatusCode());
    }

    @Test
    void singleWildcardMatchesOnlyOneLevel() {
        RouteConfig route = new RouteConfig();
        route.setPath("/api/basic/*");
        route.setAmount("$0.10");
        properties.setRoutes(List.of(route));
        filter = new PaymentWebFilter(facilitator, properties);

        // Single level should match
        MockServerHttpRequest matchRequest = MockServerHttpRequest
                .get("http://localhost/api/basic/info")
                .build();
        MockServerWebExchange matchExchange = MockServerWebExchange.from(matchRequest);

        AtomicBoolean matchChainCalled = new AtomicBoolean(false);
        filter.filter(matchExchange, ex -> {
            matchChainCalled.set(true);
            return Mono.empty();
        }).block();

        assertFalse(matchChainCalled.get(), "Single level path should match * wildcard");

        // Nested level should NOT match
        MockServerHttpRequest noMatchRequest = MockServerHttpRequest
                .get("http://localhost/api/basic/deep/nested")
                .build();
        MockServerWebExchange noMatchExchange = MockServerWebExchange.from(noMatchRequest);

        AtomicBoolean noMatchChainCalled = new AtomicBoolean(false);
        filter.filter(noMatchExchange, ex -> {
            noMatchChainCalled.set(true);
            return Mono.empty();
        }).block();

        assertTrue(noMatchChainCalled.get(), "Nested path should not match * wildcard");
    }

    // ========== 402 response body tests ==========

    @Test
    void response402ContainsJsonBody() {
        MockServerHttpRequest request = MockServerHttpRequest
                .get("http://localhost/api/premium/data")
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        filter.filter(exchange, ex -> Mono.empty()).block();

        assertEquals(HttpStatus.PAYMENT_REQUIRED, exchange.getResponse().getStatusCode());
        assertEquals("application/json",
                exchange.getResponse().getHeaders().getContentType().toString());
    }

    // ========== Null routes configuration ==========

    @Test
    void nullRoutesDoesNotThrow() {
        properties.setRoutes(null);
        assertDoesNotThrow(() -> new PaymentWebFilter(facilitator, properties));

        PaymentWebFilter nullFilter = new PaymentWebFilter(facilitator, properties);
        MockServerHttpRequest request = MockServerHttpRequest
                .get("http://localhost/api/premium/data")
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        AtomicBoolean chainCalled = new AtomicBoolean(false);
        nullFilter.filter(exchange, ex -> {
            chainCalled.set(true);
            return Mono.empty();
        }).block();

        assertTrue(chainCalled.get(), "All paths should pass through with null routes");
    }

    @Test
    void emptyRoutesPassesEverythingThrough() {
        properties.setRoutes(List.of());
        filter = new PaymentWebFilter(facilitator, properties);

        MockServerHttpRequest request = MockServerHttpRequest
                .get("http://localhost/api/premium/data")
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        AtomicBoolean chainCalled = new AtomicBoolean(false);
        filter.filter(exchange, ex -> {
            chainCalled.set(true);
            return Mono.empty();
        }).block();

        assertTrue(chainCalled.get(), "All paths should pass through with empty routes");
    }
}
