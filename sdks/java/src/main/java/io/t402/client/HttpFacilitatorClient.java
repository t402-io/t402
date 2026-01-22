package io.t402.client;

import io.t402.model.PaymentPayload;
import io.t402.model.PaymentRequirements;
import io.t402.util.Json;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Synchronous facilitator client using Java 17 HttpClient.
 * <p>
 * This client implements the t402 v2 facilitator API for verifying and settling payments.
 * The facilitator handles blockchain operations on behalf of the resource server.
 * </p>
 *
 * <h3>Usage</h3>
 * <pre>{@code
 * HttpFacilitatorClient client = new HttpFacilitatorClient("https://facilitator.t402.io");
 *
 * // Verify a payment
 * VerificationResponse vr = client.verify(paymentHeader, requirements);
 * if (vr.isValid) {
 *     // Settle the payment
 *     SettlementResponse sr = client.settle(paymentHeader, requirements);
 * }
 *
 * // Get supported networks
 * Set<Kind> supported = client.supported();
 * }</pre>
 *
 * @see FacilitatorClient
 */
public class HttpFacilitatorClient implements FacilitatorClient {

    private final HttpClient http =
            HttpClient.newBuilder()
                      .connectTimeout(Duration.ofSeconds(5))
                      .build();

    private final String baseUrl;   // without trailing "/"

    /**
     * Creates a new HTTP facilitator client.
     *
     * @param baseUrl the base URL of the facilitator service (trailing slash will be removed)
     */
    public HttpFacilitatorClient(String baseUrl) {
        this.baseUrl = baseUrl.endsWith("/")
                ? baseUrl.substring(0, baseUrl.length() - 1)
                : baseUrl;
    }

    /* ------------------------------------------------ verify ------------- */

    /**
     * Verifies a payment authorization without executing the transaction.
     * <p>
     * This method sends the payment header and requirements to the facilitator
     * which validates the signature, checks balances, and simulates the transaction.
     * </p>
     *
     * @param paymentHeader base64-encoded payment payload from X-PAYMENT header
     * @param req payment requirements to verify against
     * @return verification response indicating if payment is valid
     * @throws IOException if network communication fails
     * @throws InterruptedException if the request is interrupted
     */
    @Override
    public VerificationResponse verify(String paymentHeader,
                                       PaymentRequirements req)
            throws IOException, InterruptedException {

        // Decode the payment header to get the full PaymentPayload
        PaymentPayload paymentPayload = PaymentPayload.fromHeader(paymentHeader);

        // v2 API uses paymentPayload and paymentRequirements directly
        Map<String, Object> body = Map.of(
                "paymentPayload", paymentPayload,
                "paymentRequirements", req
        );

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/verify"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(
                        Json.MAPPER.writeValueAsString(body)))
                .build();

        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IOException("HTTP " + response.statusCode() + ": " + response.body());
        }
        return Json.MAPPER.readValue(response.body(), VerificationResponse.class);
    }

    /* ------------------------------------------------ settle ------------- */

    /**
     * Settles a verified payment by executing the transaction on the blockchain.
     * <p>
     * This method should only be called after successful verification.
     * The facilitator will broadcast the transaction and return the transaction hash.
     * </p>
     *
     * @param paymentHeader base64-encoded payment payload from X-PAYMENT header
     * @param req payment requirements for settlement
     * @return settlement response with transaction hash
     * @throws IOException if network communication fails
     * @throws InterruptedException if the request is interrupted
     */
    @Override
    public SettlementResponse settle(String paymentHeader,
                                     PaymentRequirements req)
            throws IOException, InterruptedException {

        // Decode the payment header to get the full PaymentPayload
        PaymentPayload paymentPayload = PaymentPayload.fromHeader(paymentHeader);

        // v2 API uses paymentPayload and paymentRequirements directly
        Map<String, Object> body = Map.of(
                "paymentPayload", paymentPayload,
                "paymentRequirements", req
        );

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/settle"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(
                        Json.MAPPER.writeValueAsString(body)))
                .build();

        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IOException("HTTP " + response.statusCode() + ": " + response.body());
        }
        return Json.MAPPER.readValue(response.body(), SettlementResponse.class);
    }

    /* ------------------------------------------------ supported ---------- */

    /**
     * Gets the list of payment schemes and networks supported by this facilitator.
     * <p>
     * Use this to discover available payment options before creating payment requirements.
     * </p>
     *
     * @return set of supported payment kinds (scheme + network combinations)
     * @throws IOException if network communication fails
     * @throws InterruptedException if the request is interrupted
     */
    @Override
    public Set<Kind> supported() throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/supported"))
                .GET()
                .build();


        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IOException("HTTP " + response.statusCode() + ": " + response.body());
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> map = Json.MAPPER.readValue(response.body(), Map.class);
        List<?> kinds = (List<?>) map.getOrDefault("kinds", List.of());


        Set<Kind> out = new HashSet<>();
        for (Object k : kinds) {
            out.add(Json.MAPPER.convertValue(k, Kind.class));
        }
        return out;
    }

    /**
     * Gets the full supported response including extensions and signers.
     *
     * @return full supported response
     * @throws IOException if network communication fails
     * @throws InterruptedException if the request is interrupted
     */
    public SupportedResponse supportedFull() throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/supported"))
                .GET()
                .build();

        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IOException("HTTP " + response.statusCode() + ": " + response.body());
        }

        return Json.MAPPER.readValue(response.body(), SupportedResponse.class);
    }
}
