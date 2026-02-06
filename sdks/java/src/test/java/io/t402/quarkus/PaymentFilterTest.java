package io.t402.quarkus;

import io.t402.client.FacilitatorClient;
import io.t402.client.SettlementResponse;
import io.t402.client.VerificationResponse;
import io.t402.model.PaymentPayload;
import io.t402.model.PaymentRequirements;
import io.t402.util.HttpConstants;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerResponseContext;
import jakarta.ws.rs.core.MultivaluedHashMap;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.io.IOException;
import java.math.BigInteger;
import java.net.URI;
import java.util.Base64;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PaymentFilterTest {

    @Mock FacilitatorClient fac;
    @Mock ContainerRequestContext reqCtx;
    @Mock ContainerResponseContext respCtx;
    @Mock UriInfo uriInfo;

    private PaymentFilter filter;

    @BeforeEach
    void init() {
        MockitoAnnotations.openMocks(this);

        when(reqCtx.getUriInfo()).thenReturn(uriInfo);
        when(uriInfo.getRequestUri()).thenReturn(URI.create("http://localhost/private"));

        filter = new PaymentFilter(
                "0xReceiver",
                Map.of("/private", BigInteger.TEN),
                fac
        );
    }

    /* ------------ free endpoint passes straight through --------------- */
    @Test
    void freeEndpoint() throws Exception {
        when(uriInfo.getPath()).thenReturn("public");

        filter.filter(reqCtx);

        verify(reqCtx, never()).abortWith(any());
    }

    /* ------------ missing header => 402 -------------------------------- */
    @Test
    void missingHeader() throws Exception {
        when(uriInfo.getPath()).thenReturn("private");
        when(reqCtx.getHeaderString(HttpConstants.PAYMENT_SIGNATURE)).thenReturn(null);
        when(reqCtx.getHeaderString(HttpConstants.X_PAYMENT)).thenReturn(null);

        filter.filter(reqCtx);

        ArgumentCaptor<Response> captor = ArgumentCaptor.forClass(Response.class);
        verify(reqCtx).abortWith(captor.capture());
        assertEquals(402, captor.getValue().getStatus());
    }

    /* ------------ v2 valid header => OK -------------------------------- */
    @Test
    void v2ValidHeader() throws Exception {
        when(uriInfo.getPath()).thenReturn("private");

        PaymentPayload p = PaymentPayload.builder()
                .resource("http://localhost/private", null, "application/json")
                .accepted(new PaymentRequirements("exact", "eip155:84532", "USDC", "10", "0xReceiver", 30))
                .payload(Map.of("signature", "0x1234"))
                .build();
        String header = p.toHeader();

        when(reqCtx.getHeaderString(HttpConstants.PAYMENT_SIGNATURE)).thenReturn(header);

        VerificationResponse vr = new VerificationResponse();
        vr.isValid = true;
        when(fac.verify(eq(header), any())).thenReturn(vr);

        filter.filter(reqCtx);

        // Should NOT abort - payment is valid
        verify(reqCtx, never()).abortWith(any());

        // Should store payment info in properties
        verify(reqCtx).setProperty(eq(PaymentFilter.PROP_PAYMENT_HEADER), eq(header));
        verify(reqCtx).setProperty(eq(PaymentFilter.PROP_PAYMENT_REQUIREMENTS), any(PaymentRequirements.class));
        verify(reqCtx).setProperty(eq(PaymentFilter.PROP_PAYMENT_PAYLOAD), any(PaymentPayload.class));
    }

    /* ------------ v1 backward compatibility valid header => OK --------- */
    @Test
    void v1ValidHeader() throws Exception {
        when(uriInfo.getPath()).thenReturn("private");

        PaymentPayload p = new PaymentPayload();
        p.t402Version = 1;
        p.scheme = "exact";
        p.network = "base-sepolia";
        p.payload = Map.of("resource", "/private");
        String header = p.toHeader();

        when(reqCtx.getHeaderString(HttpConstants.PAYMENT_SIGNATURE)).thenReturn(null);
        when(reqCtx.getHeaderString(HttpConstants.X_PAYMENT)).thenReturn(header);

        VerificationResponse vr = new VerificationResponse();
        vr.isValid = true;
        when(fac.verify(eq(header), any())).thenReturn(vr);

        filter.filter(reqCtx);

        verify(reqCtx, never()).abortWith(any());
        verify(reqCtx).setProperty(eq(PaymentFilter.PROP_PAYMENT_HEADER), eq(header));
    }

    /* ------------ facilitator rejects payment -> 402 ------------------- */
    @Test
    void facilitatorRejection() throws Exception {
        when(uriInfo.getPath()).thenReturn("private");

        PaymentPayload p = PaymentPayload.builder()
                .resource("http://localhost/private", null, null)
                .accepted(new PaymentRequirements("exact", "eip155:84532", "USDC", "10", "0xReceiver", 30))
                .payload(Map.of())
                .build();
        String header = p.toHeader();

        when(reqCtx.getHeaderString(HttpConstants.PAYMENT_SIGNATURE)).thenReturn(header);

        VerificationResponse vr = new VerificationResponse();
        vr.isValid = false;
        vr.invalidReason = "insufficient funds";
        when(fac.verify(eq(header), any())).thenReturn(vr);

        filter.filter(reqCtx);

        ArgumentCaptor<Response> captor = ArgumentCaptor.forClass(Response.class);
        verify(reqCtx).abortWith(captor.capture());
        assertEquals(402, captor.getValue().getStatus());
        verify(fac, never()).settle(any(), any());
    }

    /* ------------ v2 resource mismatch in header -> 402 ----------------- */
    @Test
    void v2ResourceMismatch() throws Exception {
        when(uriInfo.getPath()).thenReturn("private");

        PaymentPayload p = PaymentPayload.builder()
                .resource("http://localhost/other", null, null)
                .accepted(new PaymentRequirements("exact", "eip155:84532", "USDC", "10", "0xReceiver", 30))
                .payload(Map.of())
                .build();
        String header = p.toHeader();

        when(reqCtx.getHeaderString(HttpConstants.PAYMENT_SIGNATURE)).thenReturn(header);

        filter.filter(reqCtx);

        ArgumentCaptor<Response> captor = ArgumentCaptor.forClass(Response.class);
        verify(reqCtx).abortWith(captor.capture());
        assertEquals(402, captor.getValue().getStatus());
        verify(fac, never()).verify(any(), any());
    }

    /* ------------ v1 resource mismatch in header -> 402 ----------------- */
    @Test
    void v1ResourceMismatch() throws Exception {
        when(uriInfo.getPath()).thenReturn("private");

        PaymentPayload p = new PaymentPayload();
        p.t402Version = 1;
        p.scheme = "exact";
        p.network = "base-sepolia";
        p.payload = Map.of("resource", "/other");
        String header = p.toHeader();

        when(reqCtx.getHeaderString(HttpConstants.PAYMENT_SIGNATURE)).thenReturn(null);
        when(reqCtx.getHeaderString(HttpConstants.X_PAYMENT)).thenReturn(header);

        filter.filter(reqCtx);

        ArgumentCaptor<Response> captor = ArgumentCaptor.forClass(Response.class);
        verify(reqCtx).abortWith(captor.capture());
        assertEquals(402, captor.getValue().getStatus());
        verify(fac, never()).verify(any(), any());
    }

    /* ------------ empty header (vs null) -> 402 ------------------------ */
    @Test
    void emptyHeader() throws Exception {
        when(uriInfo.getPath()).thenReturn("private");
        when(reqCtx.getHeaderString(HttpConstants.PAYMENT_SIGNATURE)).thenReturn("");
        when(reqCtx.getHeaderString(HttpConstants.X_PAYMENT)).thenReturn("");

        filter.filter(reqCtx);

        ArgumentCaptor<Response> captor = ArgumentCaptor.forClass(Response.class);
        verify(reqCtx).abortWith(captor.capture());
        assertEquals(402, captor.getValue().getStatus());
    }

    /* ------------ malformed header -> 402 ------------------------------ */
    @Test
    void malformedHeader() throws Exception {
        when(uriInfo.getPath()).thenReturn("private");
        when(reqCtx.getHeaderString(HttpConstants.PAYMENT_SIGNATURE)).thenReturn("invalid-json-format");

        filter.filter(reqCtx);

        ArgumentCaptor<Response> captor = ArgumentCaptor.forClass(Response.class);
        verify(reqCtx).abortWith(captor.capture());
        assertEquals(402, captor.getValue().getStatus());
    }

    /* ------------ verification IOException -> 500 ---------------------- */
    @Test
    void verificationIOException() throws Exception {
        when(uriInfo.getPath()).thenReturn("private");

        PaymentPayload p = PaymentPayload.builder()
                .resource("http://localhost/private", null, null)
                .accepted(new PaymentRequirements("exact", "eip155:84532", "USDC", "10", "0xReceiver", 30))
                .payload(Map.of())
                .build();
        String header = p.toHeader();

        when(reqCtx.getHeaderString(HttpConstants.PAYMENT_SIGNATURE)).thenReturn(header);
        when(fac.verify(any(), any())).thenThrow(new IOException("Network error"));

        filter.filter(reqCtx);

        ArgumentCaptor<Response> captor = ArgumentCaptor.forClass(Response.class);
        verify(reqCtx).abortWith(captor.capture());
        assertEquals(500, captor.getValue().getStatus());
    }

    /* ------------ unexpected exception during verification -> 500 ------ */
    @Test
    void verificationUnexpectedException() throws Exception {
        when(uriInfo.getPath()).thenReturn("private");

        PaymentPayload p = PaymentPayload.builder()
                .resource("http://localhost/private", null, null)
                .accepted(new PaymentRequirements("exact", "eip155:84532", "USDC", "10", "0xReceiver", 30))
                .payload(Map.of())
                .build();
        String header = p.toHeader();

        when(reqCtx.getHeaderString(HttpConstants.PAYMENT_SIGNATURE)).thenReturn(header);
        when(fac.verify(any(), any())).thenThrow(new RuntimeException("Unexpected error"));

        filter.filter(reqCtx);

        ArgumentCaptor<Response> captor = ArgumentCaptor.forClass(Response.class);
        verify(reqCtx).abortWith(captor.capture());
        assertEquals(500, captor.getValue().getStatus());
    }

    /* ------------ response filter settles payment ---------------------- */
    @Test
    void responseFilterSettlesPayment() throws Exception {
        String paymentHeader = "someHeader";
        PaymentRequirements requirements = new PaymentRequirements(
                "exact", "eip155:84532", "USDC", "10", "0xReceiver", 30);

        PaymentPayload payload = PaymentPayload.builder()
                .resource("http://localhost/private", null, null)
                .accepted(requirements)
                .payload(Map.of("authorization", Map.of("from", "0xPayer")))
                .build();

        when(reqCtx.getProperty(PaymentFilter.PROP_PAYMENT_HEADER)).thenReturn(paymentHeader);
        when(reqCtx.getProperty(PaymentFilter.PROP_PAYMENT_REQUIREMENTS)).thenReturn(requirements);
        when(reqCtx.getProperty(PaymentFilter.PROP_PAYMENT_PAYLOAD)).thenReturn(payload);
        when(respCtx.getStatus()).thenReturn(200);

        MultivaluedMap<String, Object> responseHeaders = new MultivaluedHashMap<>();
        when(respCtx.getHeaders()).thenReturn(responseHeaders);

        SettlementResponse sr = new SettlementResponse();
        sr.success = true;
        sr.transaction = "0xabcdef1234567890";
        sr.network = "eip155:84532";
        when(fac.settle(eq(paymentHeader), any())).thenReturn(sr);

        filter.filter(reqCtx, respCtx);

        verify(fac).settle(eq(paymentHeader), any());

        // Verify settlement header was added
        Object headerValue = responseHeaders.getFirst(HttpConstants.PAYMENT_RESPONSE);
        assertNotNull(headerValue, "Settlement response header should be set");

        String jsonString = new String(Base64.getDecoder().decode((String) headerValue));
        assertTrue(jsonString.contains("\"payer\":\"0xPayer\""),
                "Settlement response should contain payer address: " + jsonString);
        assertTrue(jsonString.contains("\"success\":true"),
                "Settlement response should indicate success: " + jsonString);
    }

    /* ------------ response filter skips on error status ---------------- */
    @Test
    void responseFilterSkipsOnErrorStatus() throws Exception {
        when(reqCtx.getProperty(PaymentFilter.PROP_PAYMENT_HEADER)).thenReturn("someHeader");
        when(reqCtx.getProperty(PaymentFilter.PROP_PAYMENT_REQUIREMENTS))
                .thenReturn(new PaymentRequirements());
        when(respCtx.getStatus()).thenReturn(500);

        filter.filter(reqCtx, respCtx);

        verify(fac, never()).settle(any(), any());
    }

    /* ------------ response filter skips when no payment info ----------- */
    @Test
    void responseFilterSkipsWhenNoPaymentInfo() throws Exception {
        when(reqCtx.getProperty(PaymentFilter.PROP_PAYMENT_HEADER)).thenReturn(null);

        filter.filter(reqCtx, respCtx);

        verify(fac, never()).settle(any(), any());
    }

    /* ------------ response filter handles settlement exception --------- */
    @Test
    void responseFilterHandlesSettlementException() throws Exception {
        String paymentHeader = "someHeader";
        PaymentRequirements requirements = new PaymentRequirements(
                "exact", "eip155:84532", "USDC", "10", "0xReceiver", 30);

        when(reqCtx.getProperty(PaymentFilter.PROP_PAYMENT_HEADER)).thenReturn(paymentHeader);
        when(reqCtx.getProperty(PaymentFilter.PROP_PAYMENT_REQUIREMENTS)).thenReturn(requirements);
        when(respCtx.getStatus()).thenReturn(200);

        doThrow(new IOException("Network error")).when(fac).settle(any(), any());

        // Should not throw
        assertDoesNotThrow(() -> filter.filter(reqCtx, respCtx));
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

        when(uriInfo.getPath()).thenReturn("premium");
        when(uriInfo.getRequestUri()).thenReturn(URI.create("http://localhost/premium"));
        when(reqCtx.getHeaderString(HttpConstants.PAYMENT_SIGNATURE)).thenReturn(null);
        when(reqCtx.getHeaderString(HttpConstants.X_PAYMENT)).thenReturn(null);

        customFilter.filter(reqCtx);

        ArgumentCaptor<Response> captor = ArgumentCaptor.forClass(Response.class);
        verify(reqCtx).abortWith(captor.capture());
        assertEquals(402, captor.getValue().getStatus());
    }
}
