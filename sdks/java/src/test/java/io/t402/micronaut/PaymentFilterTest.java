package io.t402.micronaut;

import io.t402.client.FacilitatorClient;
import io.t402.client.SettlementResponse;
import io.t402.client.VerificationResponse;
import io.t402.model.PaymentPayload;
import io.t402.model.PaymentRequirements;
import io.t402.util.HttpConstants;

import io.micronaut.http.HttpHeaders;
import io.micronaut.http.HttpMethod;
import io.micronaut.http.HttpRequest;
import io.micronaut.http.HttpResponse;
import io.micronaut.http.HttpStatus;
import io.micronaut.http.MutableHttpResponse;
import io.micronaut.http.filter.ServerFilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.reactivestreams.Publisher;
import org.reactivestreams.Subscriber;
import org.reactivestreams.Subscription;

import java.io.IOException;
import java.math.BigInteger;
import java.net.URI;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PaymentFilterTest {

    @Mock FacilitatorClient fac;
    @Mock ServerFilterChain chain;

    private PaymentFilter filter;

    @BeforeEach
    void init() {
        MockitoAnnotations.openMocks(this);

        filter = new PaymentFilter(
                "0xReceiver",
                Map.of("/private", BigInteger.TEN),
                fac
        );
    }

    /* ------------ free endpoint passes straight through --------------- */
    @Test
    void freeEndpoint() throws Exception {
        HttpRequest<?> request = mockRequest("/public", null, null);

        MutableHttpResponse<String> chainResponse = HttpResponse.ok("OK");
        when(chain.proceed(request)).thenReturn(singlePublisher(chainResponse));

        MutableHttpResponse<?> result = awaitResponse(filter.doFilter(request, chain));

        verify(chain).proceed(request);
        assertEquals(HttpStatus.OK, result.getStatus());
    }

    /* ------------ missing header => 402 -------------------------------- */
    @Test
    void missingHeader() throws Exception {
        HttpRequest<?> request = mockRequest("/private", null, null);

        MutableHttpResponse<?> result = awaitResponse(filter.doFilter(request, chain));

        assertEquals(HttpStatus.PAYMENT_REQUIRED, result.getStatus());
        verify(chain, never()).proceed(any());
    }

    /* ------------ v2 valid header => OK -------------------------------- */
    @Test
    void v2ValidHeader() throws Exception {
        PaymentPayload p = PaymentPayload.builder()
                .resource("http://localhost/private", null, "application/json")
                .accepted(new PaymentRequirements("exact", "eip155:84532", "USDC", "10", "0xReceiver", 30))
                .payload(Map.of("signature", "0x1234"))
                .build();
        String header = p.toHeader();

        HttpRequest<?> request = mockRequest("/private", header, null);

        VerificationResponse vr = new VerificationResponse();
        vr.isValid = true;
        when(fac.verify(eq(header), any())).thenReturn(vr);

        SettlementResponse sr = new SettlementResponse();
        sr.success = true;
        sr.transaction = "0xabcdef1234567890";
        sr.network = "eip155:84532";
        when(fac.settle(eq(header), any())).thenReturn(sr);

        MutableHttpResponse<String> chainResponse = HttpResponse.ok("OK");
        when(chain.proceed(request)).thenReturn(singlePublisher(chainResponse));

        MutableHttpResponse<?> result = awaitResponse(filter.doFilter(request, chain));

        verify(chain).proceed(request);
        verify(fac).verify(eq(header), any());
        verify(fac).settle(eq(header), any());
        assertNotEquals(HttpStatus.PAYMENT_REQUIRED, result.getStatus());
    }

    /* ------------ v1 backward compatibility valid header => OK --------- */
    @Test
    void v1ValidHeader() throws Exception {
        PaymentPayload p = new PaymentPayload();
        p.t402Version = 1;
        p.scheme = "exact";
        p.network = "base-sepolia";
        p.payload = Map.of("resource", "/private");
        String header = p.toHeader();

        HttpRequest<?> request = mockRequest("/private", null, header);

        VerificationResponse vr = new VerificationResponse();
        vr.isValid = true;
        when(fac.verify(eq(header), any())).thenReturn(vr);

        SettlementResponse sr = new SettlementResponse();
        sr.success = true;
        sr.transaction = "0xabcdef1234567890";
        sr.network = "base-sepolia";
        when(fac.settle(eq(header), any())).thenReturn(sr);

        MutableHttpResponse<String> chainResponse = HttpResponse.ok("OK");
        when(chain.proceed(request)).thenReturn(singlePublisher(chainResponse));

        MutableHttpResponse<?> result = awaitResponse(filter.doFilter(request, chain));

        verify(chain).proceed(request);
        verify(fac).verify(eq(header), any());
        verify(fac).settle(eq(header), any());
        assertNotEquals(HttpStatus.PAYMENT_REQUIRED, result.getStatus());
    }

    /* ------------ facilitator rejects payment -> 402 ------------------- */
    @Test
    void facilitatorRejection() throws Exception {
        PaymentPayload p = PaymentPayload.builder()
                .resource("http://localhost/private", null, null)
                .accepted(new PaymentRequirements("exact", "eip155:84532", "USDC", "10", "0xReceiver", 30))
                .payload(Map.of())
                .build();
        String header = p.toHeader();

        HttpRequest<?> request = mockRequest("/private", header, null);

        VerificationResponse vr = new VerificationResponse();
        vr.isValid = false;
        vr.invalidReason = "insufficient funds";
        when(fac.verify(eq(header), any())).thenReturn(vr);

        MutableHttpResponse<?> result = awaitResponse(filter.doFilter(request, chain));

        assertEquals(HttpStatus.PAYMENT_REQUIRED, result.getStatus());
        verify(chain, never()).proceed(any());
        verify(fac, never()).settle(any(), any());
    }

    /* ------------ v2 resource mismatch in header -> 402 ----------------- */
    @Test
    void v2ResourceMismatch() throws Exception {
        PaymentPayload p = PaymentPayload.builder()
                .resource("http://localhost/other", null, null)
                .accepted(new PaymentRequirements("exact", "eip155:84532", "USDC", "10", "0xReceiver", 30))
                .payload(Map.of())
                .build();
        String header = p.toHeader();

        HttpRequest<?> request = mockRequest("/private", header, null);

        MutableHttpResponse<?> result = awaitResponse(filter.doFilter(request, chain));

        assertEquals(HttpStatus.PAYMENT_REQUIRED, result.getStatus());
        verify(chain, never()).proceed(any());
        verify(fac, never()).verify(any(), any());
    }

    /* ------------ v1 resource mismatch in header -> 402 ----------------- */
    @Test
    void v1ResourceMismatch() throws Exception {
        PaymentPayload p = new PaymentPayload();
        p.t402Version = 1;
        p.scheme = "exact";
        p.network = "base-sepolia";
        p.payload = Map.of("resource", "/other");
        String header = p.toHeader();

        HttpRequest<?> request = mockRequest("/private", null, header);

        MutableHttpResponse<?> result = awaitResponse(filter.doFilter(request, chain));

        assertEquals(HttpStatus.PAYMENT_REQUIRED, result.getStatus());
        verify(chain, never()).proceed(any());
        verify(fac, never()).verify(any(), any());
    }

    /* ------------ empty header (vs null) -> 402 ------------------------ */
    @Test
    void emptyHeader() throws Exception {
        HttpRequest<?> request = mockRequest("/private", "", "");

        MutableHttpResponse<?> result = awaitResponse(filter.doFilter(request, chain));

        assertEquals(HttpStatus.PAYMENT_REQUIRED, result.getStatus());
        verify(chain, never()).proceed(any());
    }

    /* ------------ malformed header -> 402 ------------------------------ */
    @Test
    void malformedHeader() throws Exception {
        HttpRequest<?> request = mockRequest("/private", "invalid-json-format", null);

        MutableHttpResponse<?> result = awaitResponse(filter.doFilter(request, chain));

        assertEquals(HttpStatus.PAYMENT_REQUIRED, result.getStatus());
        verify(chain, never()).proceed(any());
    }

    /* ------------ verification IOException -> 500 ---------------------- */
    @Test
    void verificationIOException() throws Exception {
        PaymentPayload p = PaymentPayload.builder()
                .resource("http://localhost/private", null, null)
                .accepted(new PaymentRequirements("exact", "eip155:84532", "USDC", "10", "0xReceiver", 30))
                .payload(Map.of())
                .build();
        String header = p.toHeader();

        HttpRequest<?> request = mockRequest("/private", header, null);

        when(fac.verify(any(), any())).thenThrow(new IOException("Network error"));

        MutableHttpResponse<?> result = awaitResponse(filter.doFilter(request, chain));

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, result.getStatus());
        verify(chain, never()).proceed(any());
    }

    /* ------------ unexpected exception during verification -> 500 ------ */
    @Test
    void verificationUnexpectedException() throws Exception {
        PaymentPayload p = PaymentPayload.builder()
                .resource("http://localhost/private", null, null)
                .accepted(new PaymentRequirements("exact", "eip155:84532", "USDC", "10", "0xReceiver", 30))
                .payload(Map.of())
                .build();
        String header = p.toHeader();

        HttpRequest<?> request = mockRequest("/private", header, null);

        when(fac.verify(any(), any())).thenThrow(new RuntimeException("Unexpected error"));

        MutableHttpResponse<?> result = awaitResponse(filter.doFilter(request, chain));

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, result.getStatus());
        verify(chain, never()).proceed(any());
    }

    /* ------------ settlement failure -> 402 ----------------------------- */
    @Test
    void settlementFailure() throws Exception {
        PaymentPayload p = PaymentPayload.builder()
                .resource("http://localhost/private", null, null)
                .accepted(new PaymentRequirements("exact", "eip155:84532", "USDC", "10", "0xReceiver", 30))
                .payload(Map.of())
                .build();
        String header = p.toHeader();

        HttpRequest<?> request = mockRequest("/private", header, null);

        VerificationResponse vr = new VerificationResponse();
        vr.isValid = true;
        when(fac.verify(eq(header), any())).thenReturn(vr);

        SettlementResponse sr = new SettlementResponse();
        sr.success = false;
        sr.errorReason = "insufficient balance";
        when(fac.settle(eq(header), any())).thenReturn(sr);

        MutableHttpResponse<?> result = awaitResponse(filter.doFilter(request, chain));

        assertEquals(HttpStatus.PAYMENT_REQUIRED, result.getStatus());
        verify(fac).verify(eq(header), any());
        verify(fac).settle(eq(header), any());
    }

    /* ------------ settlement exception -> 402 --------------------------- */
    @Test
    void settlementException() throws Exception {
        PaymentPayload p = PaymentPayload.builder()
                .resource("http://localhost/private", null, null)
                .accepted(new PaymentRequirements("exact", "eip155:84532", "USDC", "10", "0xReceiver", 30))
                .payload(Map.of())
                .build();
        String header = p.toHeader();

        HttpRequest<?> request = mockRequest("/private", header, null);

        VerificationResponse vr = new VerificationResponse();
        vr.isValid = true;
        when(fac.verify(eq(header), any())).thenReturn(vr);

        doThrow(new IOException("Network error")).when(fac).settle(any(), any());

        MutableHttpResponse<?> result = awaitResponse(filter.doFilter(request, chain));

        assertEquals(HttpStatus.PAYMENT_REQUIRED, result.getStatus());
        verify(fac).verify(eq(header), any());
        verify(fac).settle(eq(header), any());
    }

    /* ------------ payer extraction from v2 payment payload -------------- */
    @Test
    void payerExtractedFromV2Payload() throws Exception {
        String payerAddress = "0x1234567890abcdef1234567890abcdef12345678";
        PaymentPayload p = PaymentPayload.builder()
                .resource("http://localhost/private", null, "application/json")
                .accepted(new PaymentRequirements("exact", "eip155:84532", "USDC", "1000000", "0xReceiver", 30))
                .payload(Map.of(
                        "signature", "0x1234567890abcdef",
                        "authorization", Map.of(
                                "from", payerAddress,
                                "to", "0xReceiver",
                                "value", "1000000"
                        )
                ))
                .build();
        String header = p.toHeader();

        HttpRequest<?> request = mockRequest("/private", header, null);

        VerificationResponse vr = new VerificationResponse();
        vr.isValid = true;
        when(fac.verify(eq(header), any())).thenReturn(vr);

        SettlementResponse sr = new SettlementResponse();
        sr.success = true;
        sr.transaction = "0xabcdef1234567890";
        sr.network = "eip155:84532";
        when(fac.settle(eq(header), any())).thenReturn(sr);

        MutableHttpResponse<String> chainResponse = HttpResponse.ok("OK");
        when(chain.proceed(request)).thenReturn(singlePublisher(chainResponse));

        MutableHttpResponse<?> result = awaitResponse(filter.doFilter(request, chain));

        // The settlement header should have been added
        String settlementHeader = result.getHeaders().get(HttpConstants.PAYMENT_RESPONSE);
        assertNotNull(settlementHeader, "Settlement response header should be set");

        String jsonString = new String(Base64.getDecoder().decode(settlementHeader));
        assertTrue(jsonString.contains("\"payer\":\"" + payerAddress + "\""),
                "Settlement response should contain payer address: " + jsonString);
        assertTrue(jsonString.contains("\"success\":true"),
                "Settlement response should indicate success: " + jsonString);
    }

    /* ------------ custom network configuration -------------------------- */
    @Test
    void customNetworkConfiguration() throws Exception {
        PaymentFilter customFilter = new PaymentFilter(
                "0xReceiver",
                Map.of("/premium", BigInteger.valueOf(1000000)),
                fac,
                "eip155:8453",
                "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
        );

        HttpRequest<?> request = mockRequest("/premium", null, null);

        MutableHttpResponse<?> result = awaitResponse(customFilter.doFilter(request, chain));

        assertEquals(HttpStatus.PAYMENT_REQUIRED, result.getStatus());
    }

    /* ------------------------------------------------ test helpers ------ */

    /**
     * Creates a mock HttpRequest with the given path and optional payment headers.
     */
    @SuppressWarnings("unchecked")
    private HttpRequest<?> mockRequest(String path, String v2Header, String v1Header) {
        HttpRequest<?> request = mock(HttpRequest.class);
        HttpHeaders headers = mock(HttpHeaders.class);

        when(request.getPath()).thenReturn(path);
        when(request.getUri()).thenReturn(URI.create("http://localhost" + path));
        when(request.getHeaders()).thenReturn(headers);
        when(request.getMethod()).thenReturn(HttpMethod.GET);

        when(headers.get(HttpConstants.PAYMENT_SIGNATURE)).thenReturn(v2Header);
        when(headers.get(HttpConstants.X_PAYMENT)).thenReturn(v1Header);

        return request;
    }

    /**
     * Creates a Publisher that emits a single response.
     */
    private Publisher<MutableHttpResponse<?>> singlePublisher(MutableHttpResponse<?> response) {
        return subscriber -> {
            subscriber.onSubscribe(new Subscription() {
                private boolean completed;

                @Override
                public void request(long n) {
                    if (!completed && n > 0) {
                        completed = true;
                        subscriber.onNext(response);
                        subscriber.onComplete();
                    }
                }

                @Override
                public void cancel() {
                    completed = true;
                }
            });
        };
    }

    /**
     * Awaits the first response from a Publisher.
     */
    private MutableHttpResponse<?> awaitResponse(Publisher<MutableHttpResponse<?>> publisher)
            throws InterruptedException {
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<MutableHttpResponse<?>> ref = new AtomicReference<>();

        publisher.subscribe(new Subscriber<MutableHttpResponse<?>>() {
            @Override
            public void onSubscribe(Subscription s) {
                s.request(1);
            }

            @Override
            public void onNext(MutableHttpResponse<?> response) {
                ref.set(response);
                latch.countDown();
            }

            @Override
            public void onError(Throwable t) {
                latch.countDown();
            }

            @Override
            public void onComplete() {
                latch.countDown();
            }
        });

        assertTrue(latch.await(5, TimeUnit.SECONDS), "Publisher should complete within 5 seconds");
        assertNotNull(ref.get(), "Publisher should emit a response");
        return ref.get();
    }
}
