package io.t402.quarkus;

import io.t402.client.FacilitatorClient;
import io.t402.client.SettlementResponse;
import io.t402.client.VerificationResponse;
import io.t402.model.PaymentPayload;
import io.t402.model.PaymentRequirements;
import io.t402.model.PaymentRequiredResponse;
import io.t402.model.ResourceInfo;
import io.t402.model.SettlementResponseHeader;
import io.t402.util.HttpConstants;
import io.t402.util.Json;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.container.ContainerResponseContext;
import jakarta.ws.rs.container.ContainerResponseFilter;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;

import java.io.IOException;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;
import java.util.Objects;

/**
 * Quarkus JAX-RS container filter that enforces T402 v2 payments on selected paths.
 * <p>
 * This filter implements both {@link ContainerRequestFilter} and {@link ContainerResponseFilter}
 * to handle the full T402 payment lifecycle in JAX-RS applications. The request filter verifies
 * payment headers and the response filter adds settlement headers after successful processing.
 * </p>
 *
 * <h3>Usage</h3>
 * <pre>{@code
 * Map<String, BigInteger> priceTable = Map.of(
 *     "/api/premium", BigInteger.valueOf(10000),   // 0.01 USDC
 *     "/api/report",  BigInteger.valueOf(1000000)  // 1.00 USDC
 * );
 *
 * PaymentFilter filter = new PaymentFilter(
 *     "0xYourWalletAddress",
 *     priceTable,
 *     new HttpFacilitatorClient("https://facilitator.t402.io")
 * );
 * }</pre>
 *
 * @see io.t402.server.PaymentFilter
 * @see FacilitatorClient
 */
@Provider
public class PaymentFilter implements ContainerRequestFilter, ContainerResponseFilter {

    /** Request property key for storing the payment header. */
    static final String PROP_PAYMENT_HEADER = "t402.paymentHeader";

    /** Request property key for storing the payment requirements. */
    static final String PROP_PAYMENT_REQUIREMENTS = "t402.paymentRequirements";

    /** Request property key for storing the payment payload. */
    static final String PROP_PAYMENT_PAYLOAD = "t402.paymentPayload";

    private final String payTo;
    private final Map<String, BigInteger> priceTable;
    private final FacilitatorClient facilitator;

    private String defaultNetwork = "eip155:84532";
    private String defaultAsset = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
    private int defaultTimeoutSeconds = 30;

    /**
     * Creates a payment filter that enforces T402 v2 payments on configured paths.
     *
     * @param payTo wallet address for payments
     * @param priceTable maps request paths to required payment amounts in atomic units
     * @param facilitator client for payment verification and settlement
     */
    public PaymentFilter(String payTo,
                         Map<String, BigInteger> priceTable,
                         FacilitatorClient facilitator) {
        this.payTo = Objects.requireNonNull(payTo);
        this.priceTable = Objects.requireNonNull(priceTable);
        this.facilitator = Objects.requireNonNull(facilitator);
    }

    /**
     * Creates a payment filter with custom network configuration.
     *
     * @param payTo wallet address for payments
     * @param priceTable maps request paths to required payment amounts
     * @param facilitator client for payment verification and settlement
     * @param network blockchain network in CAIP-2 format (e.g., "eip155:8453")
     * @param asset token contract address
     */
    public PaymentFilter(String payTo,
                         Map<String, BigInteger> priceTable,
                         FacilitatorClient facilitator,
                         String network,
                         String asset) {
        this(payTo, priceTable, facilitator);
        this.defaultNetwork = network;
        this.defaultAsset = asset;
    }

    /* ------------------------------------------------ request filter ---- */

    @Override
    public void filter(ContainerRequestContext requestContext) throws IOException {
        String path = "/" + requestContext.getUriInfo().getPath();

        // Path is free - pass through
        if (!priceTable.containsKey(path)) {
            return;
        }

        // Check V2 header first, then fall back to V1
        String header = requestContext.getHeaderString(HttpConstants.PAYMENT_SIGNATURE);
        if (header == null || header.isEmpty()) {
            header = requestContext.getHeaderString(HttpConstants.X_PAYMENT);
        }
        if (header == null || header.isEmpty()) {
            requestContext.abortWith(respond402(requestContext, null));
            return;
        }

        // Verify payment
        final PaymentPayload payload;
        final VerificationResponse vr;
        try {
            payload = PaymentPayload.fromHeader(header);

            // Validate resource URL matches request
            String payloadResource = getResourceUrl(payload);
            if (payloadResource != null && !matchesPath(payloadResource, path, requestContext)) {
                requestContext.abortWith(respond402(requestContext, "resource mismatch"));
                return;
            }

            vr = facilitator.verify(header, buildRequirements(path));
        } catch (IllegalArgumentException ex) {
            requestContext.abortWith(respond402(requestContext, "malformed payment header"));
            return;
        } catch (IOException ex) {
            requestContext.abortWith(createErrorResponse(
                    "Payment verification failed: " + ex.getMessage()));
            return;
        } catch (Exception ex) {
            requestContext.abortWith(createErrorResponse(
                    "Internal server error during payment verification"));
            return;
        }

        if (!vr.isValid) {
            requestContext.abortWith(respond402(requestContext, vr.invalidReason));
            return;
        }

        // Store payment info for settlement in response filter
        requestContext.setProperty(PROP_PAYMENT_HEADER, header);
        requestContext.setProperty(PROP_PAYMENT_REQUIREMENTS, buildRequirements(path));
        requestContext.setProperty(PROP_PAYMENT_PAYLOAD, payload);
    }

    /* ------------------------------------------------ response filter --- */

    @Override
    public void filter(ContainerRequestContext requestContext,
                       ContainerResponseContext responseContext) throws IOException {

        String paymentHeader = (String) requestContext.getProperty(PROP_PAYMENT_HEADER);
        PaymentRequirements requirements =
                (PaymentRequirements) requestContext.getProperty(PROP_PAYMENT_REQUIREMENTS);
        PaymentPayload payload =
                (PaymentPayload) requestContext.getProperty(PROP_PAYMENT_PAYLOAD);

        if (paymentHeader == null || requirements == null) {
            return;
        }

        // Only settle if the response was successful (status < 400)
        if (responseContext.getStatus() >= 400) {
            return;
        }

        try {
            SettlementResponse sr = facilitator.settle(paymentHeader, requirements);
            if (sr != null && sr.success) {
                String payer = extractPayer(payload);
                String base64Header = createPaymentResponseHeader(sr, payer);
                int version = payload != null ? payload.t402Version : 2;
                String responseHeaderName = HttpConstants.getResponseHeaderName(version);

                responseContext.getHeaders().putSingle(responseHeaderName, base64Header);
                responseContext.getHeaders().putSingle("Access-Control-Expose-Headers",
                        responseHeaderName);
            }
        } catch (Exception ex) {
            System.err.println("Payment settlement failed: " + ex.getMessage());
        }
    }

    /* ------------------------------------------------ helpers ---------- */

    /**
     * Builds a v2 PaymentRequirements object for the given path.
     *
     * @param path the request path
     * @return payment requirements for the path
     */
    private PaymentRequirements buildRequirements(String path) {
        PaymentRequirements pr = new PaymentRequirements();
        pr.scheme = "exact";
        pr.network = defaultNetwork;
        pr.amount = priceTable.get(path).toString();
        pr.asset = defaultAsset;
        pr.payTo = payTo;
        pr.maxTimeoutSeconds = defaultTimeoutSeconds;
        return pr;
    }

    /**
     * Builds a v2 ResourceInfo object for the given request.
     *
     * @param requestContext the container request context
     * @return resource info derived from the request
     */
    private ResourceInfo buildResourceInfo(ContainerRequestContext requestContext) {
        String fullUrl = requestContext.getUriInfo().getRequestUri().toString();
        return new ResourceInfo(fullUrl, null, "application/json");
    }

    /**
     * Creates a base64-encoded payment response header.
     *
     * @param sr the settlement response
     * @param payer the payer address
     * @return base64-encoded JSON header
     * @throws Exception if serialization fails
     */
    private String createPaymentResponseHeader(SettlementResponse sr, String payer)
            throws Exception {
        SettlementResponseHeader settlementHeader = new SettlementResponseHeader(
                true,
                sr.transaction != null ? sr.transaction : "",
                sr.network != null ? sr.network : defaultNetwork,
                payer
        );

        String jsonString = Json.MAPPER.writeValueAsString(settlementHeader);
        return Base64.getEncoder().encodeToString(jsonString.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Extracts the payer wallet address from a payment payload.
     *
     * @param payload the payment payload
     * @return the payer address, or null if not found
     */
    private String extractPayer(PaymentPayload payload) {
        if (payload == null || payload.payload == null) {
            return null;
        }
        try {
            Object authorization = payload.payload.get("authorization");
            if (authorization instanceof Map) {
                Object from = ((Map<?, ?>) authorization).get("from");
                return from instanceof String ? (String) from : null;
            }
        } catch (Exception ex) {
            // Ignore extraction errors
        }
        return null;
    }

    /**
     * Gets the resource URL from a payment payload, supporting both v1 and v2 formats.
     *
     * @param payload the payment payload
     * @return the resource URL, or null if not present
     */
    private String getResourceUrl(PaymentPayload payload) {
        if (payload.resource != null && payload.resource.url != null) {
            return payload.resource.url;
        }
        if (payload.payload != null && payload.payload.get("resource") instanceof String) {
            return (String) payload.payload.get("resource");
        }
        return null;
    }

    /**
     * Checks if the payload resource matches the request path.
     *
     * @param payloadResource the resource URL from the payload
     * @param path the request path
     * @param requestContext the container request context
     * @return true if the resource matches the request
     */
    private boolean matchesPath(String payloadResource, String path,
                                ContainerRequestContext requestContext) {
        if (Objects.equals(payloadResource, path)) {
            return true;
        }
        String fullUrl = requestContext.getUriInfo().getRequestUri().toString();
        if (Objects.equals(payloadResource, fullUrl)) {
            return true;
        }
        return false;
    }

    /**
     * Creates a 402 Payment Required response.
     *
     * @param requestContext the container request context
     * @param error optional error message
     * @return a JAX-RS 402 response
     */
    private Response respond402(ContainerRequestContext requestContext, String error) {
        try {
            ResourceInfo resource = buildResourceInfo(requestContext);
            String path = "/" + requestContext.getUriInfo().getPath();
            PaymentRequirements requirements = buildRequirements(path);

            PaymentRequiredResponse prr = new PaymentRequiredResponse(resource, null);
            prr.t402Version = 2;
            prr.error = error;
            prr.addAccepts(requirements);

            String json = Json.MAPPER.writeValueAsString(prr);

            // V2 protocol requires base64-encoded payment requirements in header
            String base64Header = java.util.Base64.getEncoder().encodeToString(json.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return Response.status(402)
                    .type(MediaType.APPLICATION_JSON)
                    .header(io.t402.util.HttpConstants.PAYMENT_REQUIRED, base64Header)
                    .entity(json)
                    .build();
        } catch (Exception ex) {
            return Response.status(402)
                    .type(MediaType.APPLICATION_JSON)
                    .entity("{\"error\":\"" + (error != null ? error : "payment required") + "\"}")
                    .build();
        }
    }

    /**
     * Creates a 500 Internal Server Error response.
     *
     * @param message error message
     * @return a JAX-RS 500 response
     */
    private Response createErrorResponse(String message) {
        return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .type(MediaType.APPLICATION_JSON)
                .entity("{\"error\":\"" + message + "\"}")
                .build();
    }
}
