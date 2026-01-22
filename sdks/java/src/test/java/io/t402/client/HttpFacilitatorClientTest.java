package io.t402.client;

import io.t402.model.PaymentPayload;
import io.t402.model.PaymentRequirements;
import io.t402.model.ResourceInfo;
import com.github.tomakehurst.wiremock.WireMockServer;
import org.junit.jupiter.api.*;
import static com.github.tomakehurst.wiremock.client.WireMock.*;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class HttpFacilitatorClientTest {

    static WireMockServer wm;
    HttpFacilitatorClient client;

    @BeforeAll
    static void startServer() {
        wm = new WireMockServer(0);   // random port
        wm.start();
    }

    @AfterAll
    static void stopServer() { wm.stop(); }

    @BeforeEach
    void setUp() {
        wm.resetAll();
        client = new HttpFacilitatorClient("http://localhost:" + wm.port());
    }

    /**
     * Helper to create a valid v2 payment header for testing.
     */
    private String createV2PaymentHeader() {
        PaymentPayload payload = PaymentPayload.builder()
            .resource("https://api.example.com/data", "Test resource", "application/json")
            .accepted(new PaymentRequirements("exact", "eip155:84532", "USDC", "10000", "0xReceiver", 30))
            .payload(Map.of(
                "signature", "0x1234",
                "authorization", Map.of(
                    "from", "0xPayer",
                    "to", "0xReceiver",
                    "value", "10000"
                )
            ))
            .build();
        return payload.toHeader();
    }

    @Test
    void constructorHandlesTrailingSlash() {
        // Create client with trailing slash
        HttpFacilitatorClient clientWithTrailingSlash =
            new HttpFacilitatorClient("http://localhost:" + wm.port() + "/");

        // Stub a simple request to verify the URL is formatted correctly
        wm.stubFor(get(urlEqualTo("/supported"))
            .willReturn(aResponse()
                .withHeader("Content-Type","application/json")
                .withBody("{\"kinds\":[]}")));

        // This would fail with a 404 if the URL was not correctly handled
        assertDoesNotThrow(() -> clientWithTrailingSlash.supported());
    }

    @Test
    void verifyAndSettleHappyPath() throws Exception {
        // stub /verify
        wm.stubFor(post(urlEqualTo("/verify"))
            .willReturn(aResponse()
                .withHeader("Content-Type","application/json")
                .withBody("{\"isValid\":true}")));

        // stub /settle
        wm.stubFor(post(urlEqualTo("/settle"))
            .willReturn(aResponse()
                .withHeader("Content-Type","application/json")
                .withBody("{\"success\":true,\"txHash\":\"0xabc\",\"networkId\":\"eip155:84532\"}")));

        String header = createV2PaymentHeader();
        PaymentRequirements req = new PaymentRequirements("exact", "eip155:84532", "USDC", "10000", "0xReceiver", 30);

        VerificationResponse vr = client.verify(header, req);
        assertTrue(vr.isValid);

        SettlementResponse sr = client.settle(header, req);
        assertTrue(sr.success);
        assertEquals("0xabc", sr.txHash);
    }

    @Test
    void verifyRequestBodyContainsPaymentPayload() throws Exception {
        // Stub /verify to capture the request body
        wm.stubFor(post(urlEqualTo("/verify"))
            .willReturn(aResponse()
                .withHeader("Content-Type","application/json")
                .withBody("{\"isValid\":true}")));

        String header = createV2PaymentHeader();
        PaymentRequirements req = new PaymentRequirements("exact", "eip155:84532", "USDC", "10000", "0xReceiver", 30);

        client.verify(header, req);

        // Verify the request body contains paymentPayload and paymentRequirements
        wm.verify(postRequestedFor(urlEqualTo("/verify"))
            .withRequestBody(containing("\"paymentPayload\""))
            .withRequestBody(containing("\"paymentRequirements\""))
            .withRequestBody(containing("\"t402Version\":2")));
    }

    @Test
    void supportedEndpoint() throws Exception {
        wm.stubFor(get(urlEqualTo("/supported"))
            .willReturn(aResponse()
                .withHeader("Content-Type","application/json")
                .withBody("{\"kinds\":[{\"t402Version\":2,\"scheme\":\"exact\",\"network\":\"eip155:84532\"}]}")));

        Set<Kind> kinds = client.supported();
        assertEquals(1, kinds.size());
        Kind k = kinds.iterator().next();
        assertEquals("exact", k.scheme);
        assertEquals("eip155:84532", k.network);
        assertEquals(2, k.t402Version);
    }

    @Test
    void supportedFullEndpoint() throws Exception {
        wm.stubFor(get(urlEqualTo("/supported"))
            .willReturn(aResponse()
                .withHeader("Content-Type","application/json")
                .withBody("{\"kinds\":[{\"t402Version\":2,\"scheme\":\"exact\",\"network\":\"eip155:8453\"}]," +
                    "\"extensions\":[\"session\"]," +
                    "\"signers\":{\"eip155:*\":[\"0x1234\"]}}")));

        SupportedResponse resp = client.supportedFull();
        assertNotNull(resp.kinds);
        assertEquals(1, resp.kinds.size());
        assertNotNull(resp.extensions);
        assertEquals(1, resp.extensions.size());
        assertEquals("session", resp.extensions.get(0));
        assertNotNull(resp.signers);
        assertTrue(resp.signers.containsKey("eip155:*"));
    }

    @Test
    void supportedResponseSupportsCheck() throws Exception {
        wm.stubFor(get(urlEqualTo("/supported"))
            .willReturn(aResponse()
                .withHeader("Content-Type","application/json")
                .withBody("{\"kinds\":[" +
                    "{\"t402Version\":2,\"scheme\":\"exact\",\"network\":\"eip155:8453\"}," +
                    "{\"t402Version\":2,\"scheme\":\"exact\",\"network\":\"eip155:84532\"}" +
                    "]}")));

        SupportedResponse resp = client.supportedFull();
        assertTrue(resp.supports("exact", "eip155:8453"));
        assertTrue(resp.supports("exact", "eip155:84532"));
        assertFalse(resp.supports("exact", "eip155:1"));
        assertFalse(resp.supports("deferred", "eip155:8453"));
    }

    @Test
    void supportedResponseSignersLookup() {
        SupportedResponse resp = new SupportedResponse();
        resp.signers = Map.of(
            "eip155:*", List.of("0x1234", "0x5678"),
            "solana:*", List.of("ABC123")
        );

        // Wildcard match
        assertEquals(List.of("0x1234", "0x5678"), resp.getSignersForNetwork("eip155:8453"));
        assertEquals(List.of("0x1234", "0x5678"), resp.getSignersForNetwork("eip155:84532"));
        assertEquals(List.of("ABC123"), resp.getSignersForNetwork("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"));

        // No match
        assertNull(resp.getSignersForNetwork("tron:mainnet"));
    }

    @Test
    void supportedEndpointWithEmptyKinds() throws Exception {
        // Test when the 'kinds' list is empty
        wm.stubFor(get(urlEqualTo("/supported"))
            .willReturn(aResponse()
                .withHeader("Content-Type","application/json")
                .withBody("{\"kinds\":[]}")));

        Set<Kind> kinds = client.supported();
        assertTrue(kinds.isEmpty());
    }

    @Test
    void supportedEndpointWithMissingKinds() throws Exception {
        // Test when the 'kinds' field is missing entirely
        wm.stubFor(get(urlEqualTo("/supported"))
            .willReturn(aResponse()
                .withHeader("Content-Type","application/json")
                .withBody("{\"otherField\":123}")));

        Set<Kind> kinds = client.supported();
        assertTrue(kinds.isEmpty());
    }

    @Test
    void verifyWithInvalidResponse() throws Exception {
        // Test handling of invalid JSON in the verify response
        wm.stubFor(post(urlEqualTo("/verify"))
            .willReturn(aResponse()
                .withHeader("Content-Type","application/json")
                .withBody("{\"isValid\":false,\"invalidReason\":\"insufficient balance\"}")));

        String header = createV2PaymentHeader();
        PaymentRequirements req = new PaymentRequirements();
        VerificationResponse response = client.verify(header, req);

        assertFalse(response.isValid);
        assertEquals("insufficient balance", response.invalidReason);
    }

    @Test
    void settleWithPartialResponse() throws Exception {
        // Test when settlement response only has some fields
        wm.stubFor(post(urlEqualTo("/settle"))
            .willReturn(aResponse()
                .withHeader("Content-Type","application/json")
                .withBody("{\"success\":true}")));  // Missing txHash and networkId

        String header = createV2PaymentHeader();
        PaymentRequirements req = new PaymentRequirements();
        SettlementResponse response = client.settle(header, req);

        assertTrue(response.success);
        assertNull(response.txHash);  // Should be null since it wasn't in the response
        assertNull(response.networkId);
    }

    @Test
    void settleWithError() throws Exception {
        // Test settlement with error response
        wm.stubFor(post(urlEqualTo("/settle"))
            .willReturn(aResponse()
                .withHeader("Content-Type","application/json")
                .withBody("{\"success\":false,\"error\":\"payment timed out\"}")));

        String header = createV2PaymentHeader();
        PaymentRequirements req = new PaymentRequirements();
        SettlementResponse response = client.settle(header, req);

        assertFalse(response.success);
        assertEquals("payment timed out", response.error);
    }

    @Test
    void testNetworkTimeout() {
        // Test with a non-existent server to simulate network issues
        HttpFacilitatorClient badClient = new HttpFacilitatorClient("http://localhost:1");  // Port 1 should not be listening

        String header = createV2PaymentHeader();
        PaymentRequirements req = new PaymentRequirements();

        // Both methods should throw an exception
        assertThrows(Exception.class, () -> badClient.verify(header, req));
        assertThrows(Exception.class, () -> badClient.settle(header, req));
        assertThrows(Exception.class, () -> badClient.supported());
    }

    @Test
    void verifyRejectsNon200Status() {
        String header = createV2PaymentHeader();
        PaymentRequirements req = new PaymentRequirements();

        // Test HTTP 201 - should be rejected even though it's successful
        wm.stubFor(post(urlEqualTo("/verify"))
            .willReturn(aResponse()
                .withStatus(201)
                .withHeader("Content-Type", "application/json")
                .withBody("{\"isValid\":true}")));

        Exception ex = assertThrows(Exception.class, () -> client.verify(header, req));
        assertTrue(ex.getMessage().contains("HTTP 201"));
    }

    @Test
    void settleRejectsNon200Status() {
        String header = createV2PaymentHeader();
        PaymentRequirements req = new PaymentRequirements();

        // Test HTTP 404
        wm.stubFor(post(urlEqualTo("/settle"))
            .willReturn(aResponse()
                .withStatus(404)
                .withHeader("Content-Type", "application/json")
                .withBody("{\"error\":\"not found\"}")));

        Exception ex = assertThrows(Exception.class, () -> client.settle(header, req));
        assertTrue(ex.getMessage().contains("HTTP 404"));
        assertTrue(ex.getMessage().contains("not found"));
    }

    @Test
    void supportedRejectsNon200Status() {
        // Test HTTP 500
        wm.stubFor(get(urlEqualTo("/supported"))
            .willReturn(aResponse()
                .withStatus(500)
                .withHeader("Content-Type", "application/json")
                .withBody("{\"error\":\"internal server error\"}")));

        Exception ex = assertThrows(Exception.class, () -> client.supported());
        assertTrue(ex.getMessage().contains("HTTP 500"));
        assertTrue(ex.getMessage().contains("internal server error"));
    }

    @Test
    void verifyHandles400BadRequest() {
        String header = createV2PaymentHeader();
        PaymentRequirements req = new PaymentRequirements();

        wm.stubFor(post(urlEqualTo("/verify"))
            .willReturn(aResponse()
                .withStatus(400)
                .withHeader("Content-Type", "application/json")
                .withBody("{\"error\":\"invalid payment header\"}")));

        Exception ex = assertThrows(Exception.class, () -> client.verify(header, req));
        assertTrue(ex.getMessage().contains("HTTP 400"));
        assertTrue(ex.getMessage().contains("invalid payment header"));
    }
}
