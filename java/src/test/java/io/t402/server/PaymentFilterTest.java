package io.t402.server;

import io.t402.client.FacilitatorClient;
import io.t402.client.SettlementResponse;
import io.t402.client.VerificationResponse;
import io.t402.model.Authorization;
import io.t402.model.ExactSchemePayload;
import io.t402.model.PaymentPayload;
import io.t402.model.PaymentRequirements;
import io.t402.model.ResourceInfo;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.PrintWriter;
import java.math.BigInteger;
import java.util.Base64;
import java.util.Map;

import static org.mockito.Mockito.*;

class PaymentFilterTest {

    @Mock HttpServletRequest  req;
    @Mock HttpServletResponse resp;
    @Mock FilterChain         chain;
    @Mock FacilitatorClient   fac;

    private PaymentFilter filter;

    @BeforeEach
    void init() throws Exception {
        MockitoAnnotations.openMocks(this);

        // writer stub
        when(resp.getWriter()).thenReturn(new PrintWriter(new ByteArrayOutputStream(), true));

        // Mock request URL for v2 resource matching
        when(req.getRequestURL()).thenReturn(new StringBuffer("http://localhost/private"));
        when(req.getQueryString()).thenReturn(null);

        filter = new PaymentFilter(
                "0xReceiver",
                Map.of("/private", BigInteger.TEN),
                fac
        );
    }

    /* ------------ free endpoint passes straight through --------------- */
    @Test
    void freeEndpoint() throws Exception {
        when(req.getRequestURI()).thenReturn("/public");

        filter.doFilter(req, resp, chain);

        verify(chain).doFilter(req, resp);
        verify(resp, never()).setStatus(anyInt());
    }

    /* ------------ missing header => 402 -------------------------------- */
    @Test
    void missingHeader() throws Exception {
        when(req.getRequestURI()).thenReturn("/private");
        when(req.getHeader("X-PAYMENT")).thenReturn(null);

        filter.doFilter(req, resp, chain);

        verify(resp).setStatus(HttpServletResponse.SC_PAYMENT_REQUIRED);
        verify(chain, never()).doFilter(any(), any());
    }

    /* ------------ v2 valid header => OK -------------------------------- */
    @Test
    void v2ValidHeader() throws Exception {
        when(req.getRequestURI()).thenReturn("/private");
        when(req.getRequestURL()).thenReturn(new StringBuffer("http://localhost/private"));

        // Build a v2 PaymentPayload with resource.url matching the path
        PaymentPayload p = PaymentPayload.builder()
            .resource("http://localhost/private", null, "application/json")
            .accepted(new PaymentRequirements("exact", "eip155:84532", "USDC", "10", "0xReceiver", 30))
            .payload(Map.of("signature", "0x1234"))
            .build();
        String header = p.toHeader();
        when(req.getHeader("X-PAYMENT")).thenReturn(header);

        // facilitator says it's valid
        VerificationResponse vr = new VerificationResponse();
        vr.isValid = true;
        when(fac.verify(eq(header), any())).thenReturn(vr);

        // settlement succeeds
        SettlementResponse sr = new SettlementResponse();
        sr.success = true;
        sr.txHash = "0xabcdef1234567890";
        sr.networkId = "eip155:84532";
        when(fac.settle(eq(header), any())).thenReturn(sr);

        filter.doFilter(req, resp, chain);

        verify(chain).doFilter(req, resp);
        verify(resp, never()).setStatus(HttpServletResponse.SC_PAYMENT_REQUIRED);
        verify(fac).verify(eq(header), any());
        verify(fac).settle(eq(header), any());
    }

    /* ------------ v1 backward compatibility valid header => OK --------- */
    @Test
    void v1ValidHeader() throws Exception {
        when(req.getRequestURI()).thenReturn("/private");

        // Build a v1 PaymentPayload (using payload.resource)
        PaymentPayload p = new PaymentPayload();
        p.t402Version = 1;
        p.scheme = "exact";
        p.network = "base-sepolia";
        p.payload = Map.of("resource", "/private");
        String header = p.toHeader();
        when(req.getHeader("X-PAYMENT")).thenReturn(header);

        // facilitator says it's valid
        VerificationResponse vr = new VerificationResponse();
        vr.isValid = true;
        when(fac.verify(eq(header), any())).thenReturn(vr);

        // settlement succeeds
        SettlementResponse sr = new SettlementResponse();
        sr.success = true;
        sr.txHash = "0xabcdef1234567890";
        sr.networkId = "base-sepolia";
        when(fac.settle(eq(header), any())).thenReturn(sr);

        filter.doFilter(req, resp, chain);

        verify(chain).doFilter(req, resp);
        verify(resp, never()).setStatus(HttpServletResponse.SC_PAYMENT_REQUIRED);
        verify(fac).verify(eq(header), any());
        verify(fac).settle(eq(header), any());
    }

    /* ------------ facilitator rejects payment → 402 ------------------- */
    @Test
    void facilitatorRejection() throws Exception {
        when(req.getRequestURI()).thenReturn("/private");
        when(req.getRequestURL()).thenReturn(new StringBuffer("http://localhost/private"));

        // well-formed v2 header for /private
        PaymentPayload p = PaymentPayload.builder()
            .resource("http://localhost/private", null, null)
            .accepted(new PaymentRequirements("exact", "eip155:84532", "USDC", "10", "0xReceiver", 30))
            .payload(Map.of())
            .build();
        String header = p.toHeader();
        when(req.getHeader("X-PAYMENT")).thenReturn(header);

        // facilitator response: invalid
        VerificationResponse vr = new VerificationResponse();
        vr.isValid = false;
        vr.invalidReason = "insufficient funds";
        when(fac.verify(eq(header), any())).thenReturn(vr);

        filter.doFilter(req, resp, chain);

        verify(resp).setStatus(HttpServletResponse.SC_PAYMENT_REQUIRED);
        verify(chain, never()).doFilter(any(), any());
        // settle must NOT be called
        verify(fac, never()).settle(any(), any());
    }

    /* ------------ v2 resource mismatch in header → 402 ----------------- */
    @Test
    void v2ResourceMismatch() throws Exception {
        when(req.getRequestURI()).thenReturn("/private");
        when(req.getRequestURL()).thenReturn(new StringBuffer("http://localhost/private"));

        // header says resource is /other (using v2 format)
        PaymentPayload p = PaymentPayload.builder()
            .resource("http://localhost/other", null, null)
            .accepted(new PaymentRequirements("exact", "eip155:84532", "USDC", "10", "0xReceiver", 30))
            .payload(Map.of())
            .build();
        String header = p.toHeader();
        when(req.getHeader("X-PAYMENT")).thenReturn(header);

        filter.doFilter(req, resp, chain);

        verify(resp).setStatus(HttpServletResponse.SC_PAYMENT_REQUIRED);
        verify(chain, never()).doFilter(any(), any());
        // facilitator should NOT have been called
        verify(fac, never()).verify(any(), any());
    }

    /* ------------ v1 resource mismatch in header → 402 ----------------- */
    @Test
    void v1ResourceMismatch() throws Exception {
        when(req.getRequestURI()).thenReturn("/private");

        // header says resource is /other (using v1 format)
        PaymentPayload p = new PaymentPayload();
        p.t402Version = 1;
        p.scheme = "exact";
        p.network = "base-sepolia";
        p.payload = Map.of("resource", "/other");
        String header = p.toHeader();
        when(req.getHeader("X-PAYMENT")).thenReturn(header);

        filter.doFilter(req, resp, chain);

        verify(resp).setStatus(HttpServletResponse.SC_PAYMENT_REQUIRED);
        verify(chain, never()).doFilter(any(), any());
        // facilitator should NOT have been called
        verify(fac, never()).verify(any(), any());
    }

    /* ------------ empty header (vs null) → 402 ------------------------ */
    @Test
    void emptyHeader() throws Exception {
        when(req.getRequestURI()).thenReturn("/private");
        when(req.getHeader("X-PAYMENT")).thenReturn("");  // Empty string

        filter.doFilter(req, resp, chain);

        verify(resp).setStatus(HttpServletResponse.SC_PAYMENT_REQUIRED);
        verify(chain, never()).doFilter(any(), any());
    }

    /* ------------ non-HTTP request passes through without checks ------- */
    @Test
    void nonHttpRequest() throws Exception {
        // Create non-HTTP servlet request and response
        ServletRequest nonHttpReq = mock(ServletRequest.class);
        ServletResponse nonHttpRes = mock(ServletResponse.class);

        filter.doFilter(nonHttpReq, nonHttpRes, chain);

        // Should pass through without any checks
        verify(chain).doFilter(nonHttpReq, nonHttpRes);
        verifyNoInteractions(fac);  // No facilitator interactions
    }

    /* ------------ exception parsing header → 402 ----------------------- */
    @Test
    void malformedHeader() throws Exception {
        when(req.getRequestURI()).thenReturn("/private");
        when(req.getHeader("X-PAYMENT")).thenReturn("invalid-json-format");

        filter.doFilter(req, resp, chain);

        verify(resp).setStatus(HttpServletResponse.SC_PAYMENT_REQUIRED);
        verify(chain, never()).doFilter(any(), any());
    }

    /* ------------ exception during verification → 500 ------------------ */
    @Test
    void verificationException() throws Exception {
        when(req.getRequestURI()).thenReturn("/private");
        when(req.getRequestURL()).thenReturn(new StringBuffer("http://localhost/private"));

        // Create a valid v2 header
        PaymentPayload p = PaymentPayload.builder()
            .resource("http://localhost/private", null, null)
            .accepted(new PaymentRequirements("exact", "eip155:84532", "USDC", "10", "0xReceiver", 30))
            .payload(Map.of())
            .build();
        String header = p.toHeader();
        when(req.getHeader("X-PAYMENT")).thenReturn(header);

        // Make facilitator throw exception during verify
        when(fac.verify(any(), any())).thenThrow(new IOException("Network error"));

        filter.doFilter(req, resp, chain);

        // IOException should return 500 status, not 402
        verify(resp).setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        verify(resp).setContentType("application/json");
        verify(chain, never()).doFilter(any(), any());
    }

    /* ------------ exception during settlement returns 402 --------------- */
    @Test
    void settlementException() throws Exception {
        when(req.getRequestURI()).thenReturn("/private");
        when(req.getRequestURL()).thenReturn(new StringBuffer("http://localhost/private"));

        // Create a valid v2 header
        PaymentPayload p = PaymentPayload.builder()
            .resource("http://localhost/private", null, null)
            .accepted(new PaymentRequirements("exact", "eip155:84532", "USDC", "10", "0xReceiver", 30))
            .payload(Map.of())
            .build();
        String header = p.toHeader();
        when(req.getHeader("X-PAYMENT")).thenReturn(header);

        // Verification succeeds
        VerificationResponse vr = new VerificationResponse();
        vr.isValid = true;
        when(fac.verify(eq(header), any())).thenReturn(vr);

        // But settlement throws exception (should return 402)
        doThrow(new IOException("Network error")).when(fac).settle(any(), any());

        filter.doFilter(req, resp, chain);

        // Request should be processed, but then settlement failure should return 402
        verify(chain).doFilter(req, resp);
        verify(resp).setStatus(HttpServletResponse.SC_PAYMENT_REQUIRED);

        // Verify and settle were both called
        verify(fac).verify(eq(header), any());
        verify(fac).settle(eq(header), any());
    }

    /* ------------ settlement failure returns 402 ------------------------ */
    @Test
    void settlementFailure() throws Exception {
        when(req.getRequestURI()).thenReturn("/private");
        when(req.getRequestURL()).thenReturn(new StringBuffer("http://localhost/private"));

        // Create a valid v2 header
        PaymentPayload p = PaymentPayload.builder()
            .resource("http://localhost/private", null, null)
            .accepted(new PaymentRequirements("exact", "eip155:84532", "USDC", "10", "0xReceiver", 30))
            .payload(Map.of())
            .build();
        String header = p.toHeader();
        when(req.getHeader("X-PAYMENT")).thenReturn(header);

        // Verification succeeds
        VerificationResponse vr = new VerificationResponse();
        vr.isValid = true;
        when(fac.verify(eq(header), any())).thenReturn(vr);

        // Settlement fails (facilitator returns success=false)
        SettlementResponse sr = new SettlementResponse();
        sr.success = false;
        sr.error = "insufficient balance";
        when(fac.settle(eq(header), any())).thenReturn(sr);

        filter.doFilter(req, resp, chain);

        // Request should be processed, but then settlement failure should return 402
        verify(chain).doFilter(req, resp);
        verify(resp).setStatus(HttpServletResponse.SC_PAYMENT_REQUIRED);

        // Verify and settle were both called
        verify(fac).verify(eq(header), any());
        verify(fac).settle(eq(header), any());
    }

    /* ------------ payer extraction from v2 payment payload -------------- */
    @Test
    void payerExtractedFromV2PaymentPayload() throws Exception {
        when(req.getRequestURI()).thenReturn("/private");
        when(req.getRequestURL()).thenReturn(new StringBuffer("http://localhost/private"));

        // Create v2 payment payload with proper authorization structure
        String payerAddress = "0x1234567890abcdef1234567890abcdef12345678";
        PaymentPayload p = PaymentPayload.builder()
            .resource("http://localhost/private", null, "application/json")
            .accepted(new PaymentRequirements("exact", "eip155:84532", "USDC", "1000000", "0xReceiver", 30))
            .payload(Map.of(
                "signature", "0x1234567890abcdef",
                "authorization", Map.of(
                    "from", payerAddress,
                    "to", "0xReceiver",
                    "value", "1000000",
                    "validAfter", "0",
                    "validBefore", "999999999999",
                    "nonce", "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
                )
            ))
            .build();

        String header = p.toHeader();
        when(req.getHeader("X-PAYMENT")).thenReturn(header);

        // Verification succeeds
        VerificationResponse vr = new VerificationResponse();
        vr.isValid = true;
        when(fac.verify(eq(header), any())).thenReturn(vr);

        // Settlement succeeds
        SettlementResponse sr = new SettlementResponse();
        sr.success = true;
        sr.txHash = "0xabcdef1234567890";
        sr.networkId = "eip155:84532";
        when(fac.settle(eq(header), any())).thenReturn(sr);

        filter.doFilter(req, resp, chain);

        // Verify request was processed successfully
        verify(chain).doFilter(req, resp);
        verify(resp, never()).setStatus(HttpServletResponse.SC_PAYMENT_REQUIRED);

        // Verify X-PAYMENT-RESPONSE header was set
        verify(resp).setHeader(eq("X-PAYMENT-RESPONSE"), any());
        verify(resp).setHeader(eq("Access-Control-Expose-Headers"), eq("X-PAYMENT-RESPONSE"));

        // Capture the settlement response header to verify payer was included
        org.mockito.ArgumentCaptor<String> headerCaptor = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(resp).setHeader(eq("X-PAYMENT-RESPONSE"), headerCaptor.capture());

        // Decode and verify the settlement response contains the correct payer
        String base64Header = headerCaptor.getValue();
        String jsonString = new String(Base64.getDecoder().decode(base64Header));

        // Verify the JSON contains the expected payer address
        org.junit.jupiter.api.Assertions.assertTrue(jsonString.contains("\"payer\":\"" + payerAddress + "\""),
            "Settlement response should contain payer address: " + jsonString);
        org.junit.jupiter.api.Assertions.assertTrue(jsonString.contains("\"success\":true"),
            "Settlement response should indicate success: " + jsonString);
    }

    /* ------------ payer extraction with missing authorization ----------- */
    @Test
    void payerExtractionWithMissingAuthorization() throws Exception {
        when(req.getRequestURI()).thenReturn("/private");
        when(req.getRequestURL()).thenReturn(new StringBuffer("http://localhost/private"));

        // Create v2 payment payload without authorization
        PaymentPayload p = PaymentPayload.builder()
            .resource("http://localhost/private", null, null)
            .accepted(new PaymentRequirements("exact", "eip155:84532", "USDC", "10", "0xReceiver", 30))
            .payload(Map.of())
            .build();

        String header = p.toHeader();
        when(req.getHeader("X-PAYMENT")).thenReturn(header);

        // Verification succeeds
        VerificationResponse vr = new VerificationResponse();
        vr.isValid = true;
        when(fac.verify(eq(header), any())).thenReturn(vr);

        // Settlement succeeds
        SettlementResponse sr = new SettlementResponse();
        sr.success = true;
        sr.txHash = "0xabcdef1234567890";
        sr.networkId = "eip155:84532";
        when(fac.settle(eq(header), any())).thenReturn(sr);

        filter.doFilter(req, resp, chain);

        // Verify request was processed successfully
        verify(chain).doFilter(req, resp);
        verify(resp, never()).setStatus(HttpServletResponse.SC_PAYMENT_REQUIRED);

        // Capture the settlement response header
        org.mockito.ArgumentCaptor<String> headerCaptor = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(resp).setHeader(eq("X-PAYMENT-RESPONSE"), headerCaptor.capture());

        // Decode and verify the settlement response has null payer
        String base64Header = headerCaptor.getValue();
        String jsonString = new String(Base64.getDecoder().decode(base64Header));

        // Verify the JSON contains null payer when authorization is missing
        org.junit.jupiter.api.Assertions.assertTrue(jsonString.contains("\"payer\":null"),
            "Settlement response should contain null payer when authorization missing: " + jsonString);
    }

    /* ------------ facilitator IOException returns 500 ------------------- */
    @Test
    void facilitatorIOExceptionReturns500() throws Exception {
        when(req.getRequestURI()).thenReturn("/private");
        when(req.getRequestURL()).thenReturn(new StringBuffer("http://localhost/private"));

        // Create a valid v2 header
        PaymentPayload p = PaymentPayload.builder()
            .resource("http://localhost/private", null, null)
            .accepted(new PaymentRequirements("exact", "eip155:84532", "USDC", "10", "0xReceiver", 30))
            .payload(Map.of())
            .build();
        String header = p.toHeader();
        when(req.getHeader("X-PAYMENT")).thenReturn(header);

        // Make facilitator throw IOException during verify
        when(fac.verify(any(), any())).thenThrow(new IOException("Network timeout"));

        filter.doFilter(req, resp, chain);

        // Should return 500 status for network errors
        verify(resp).setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        verify(resp).setContentType("application/json");
        verify(chain, never()).doFilter(any(), any());

        // Verify error message is written to response
        verify(resp).getWriter();
    }

    /* ------------ facilitator unexpected exception returns 500 ---------- */
    @Test
    void facilitatorUnexpectedExceptionReturns500() throws Exception {
        when(req.getRequestURI()).thenReturn("/private");
        when(req.getRequestURL()).thenReturn(new StringBuffer("http://localhost/private"));

        // Create a valid v2 header
        PaymentPayload p = PaymentPayload.builder()
            .resource("http://localhost/private", null, null)
            .accepted(new PaymentRequirements("exact", "eip155:84532", "USDC", "10", "0xReceiver", 30))
            .payload(Map.of())
            .build();
        String header = p.toHeader();
        when(req.getHeader("X-PAYMENT")).thenReturn(header);

        // Make facilitator throw unexpected exception during verify
        when(fac.verify(any(), any())).thenThrow(new RuntimeException("Unexpected error"));

        filter.doFilter(req, resp, chain);

        // Should return 500 status for unexpected errors
        verify(resp).setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        verify(resp).setContentType("application/json");
        verify(chain, never()).doFilter(any(), any());

        // Verify error message is written to response
        verify(resp).getWriter();
    }

    /* ------------ custom network configuration -------------------------- */
    @Test
    void customNetworkConfiguration() throws Exception {
        // Create filter with custom network configuration
        PaymentFilter customFilter = new PaymentFilter(
            "0xReceiver",
            Map.of("/premium", BigInteger.valueOf(1000000)),
            fac,
            "eip155:8453",  // Base mainnet
            "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"  // USDC on Base
        );

        when(req.getRequestURI()).thenReturn("/premium");
        when(req.getRequestURL()).thenReturn(new StringBuffer("http://localhost/premium"));
        when(req.getHeader("X-PAYMENT")).thenReturn(null);

        customFilter.doFilter(req, resp, chain);

        // Should return 402 with custom network in response
        verify(resp).setStatus(HttpServletResponse.SC_PAYMENT_REQUIRED);
    }
}
