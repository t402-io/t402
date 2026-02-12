package io.t402.micronaut;

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

import io.micronaut.http.HttpRequest;
import io.micronaut.http.HttpResponse;
import io.micronaut.http.HttpStatus;
import io.micronaut.http.MutableHttpResponse;
import io.micronaut.http.filter.HttpServerFilter;
import io.micronaut.http.filter.ServerFilterChain;
import org.reactivestreams.Publisher;

import java.io.IOException;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;
import java.util.Objects;

/**
 * Micronaut HTTP server filter that enforces T402 v2 payments on selected paths.
 * <p>
 * This filter implements the server-side of the T402 protocol for Micronaut applications,
 * intercepting requests and requiring payment before allowing access to protected resources.
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
public class PaymentFilter implements HttpServerFilter {

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

    @Override
    public Publisher<MutableHttpResponse<?>> doFilter(HttpRequest<?> request,
                                                       ServerFilterChain chain) {
        String path = request.getPath();

        // Path is free - pass through
        if (!priceTable.containsKey(path)) {
            return chain.proceed(request);
        }

        // Check V2 header first, then fall back to V1
        String header = request.getHeaders().get(HttpConstants.PAYMENT_SIGNATURE);
        if (header == null || header.isEmpty()) {
            header = request.getHeaders().get(HttpConstants.X_PAYMENT);
        }
        if (header == null || header.isEmpty()) {
            return createPublisher(respond402(request, null));
        }

        // Verify payment
        final PaymentPayload payload;
        final VerificationResponse vr;
        try {
            payload = PaymentPayload.fromHeader(header);

            // Validate resource URL matches request
            String payloadResource = getResourceUrl(payload);
            if (payloadResource != null && !matchesPath(payloadResource, path, request)) {
                return createPublisher(respond402(request, "resource mismatch"));
            }

            vr = facilitator.verify(header, buildRequirements(path));
        } catch (IllegalArgumentException ex) {
            return createPublisher(respond402(request, "malformed payment header"));
        } catch (IOException ex) {
            return createPublisher(createErrorResponse(
                    "Payment verification failed: " + ex.getMessage()));
        } catch (Exception ex) {
            return createPublisher(createErrorResponse(
                    "Internal server error during payment verification"));
        }

        if (!vr.isValid) {
            return createPublisher(respond402(request, vr.invalidReason));
        }

        // Payment verified - settle
        final String paymentHeader = header;
        try {
            SettlementResponse sr = facilitator.settle(paymentHeader, buildRequirements(path));
            if (sr == null || !sr.success) {
                String errorMsg = sr != null && sr.errorReason != null
                        ? sr.errorReason : "settlement failed";
                return createPublisher(respond402(request, errorMsg));
            }

            // Create settlement response header
            String payer = extractPayer(payload);
            String base64Header = createPaymentResponseHeader(sr, payer);
            String responseHeaderName = HttpConstants.getResponseHeaderName(payload.t402Version);

            // Wrap chain to add settlement headers to the response
            final String finalBase64Header = base64Header;
            final String finalResponseHeaderName = responseHeaderName;
            return new SettlementHeaderPublisher(
                    chain.proceed(request), finalResponseHeaderName, finalBase64Header);

        } catch (Exception ex) {
            return createPublisher(respond402(request, "settlement error: " + ex.getMessage()));
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
     * @param request the HTTP request
     * @return resource info derived from the request
     */
    private ResourceInfo buildResourceInfo(HttpRequest<?> request) {
        String fullUrl = request.getUri().toString();
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
    private String createPaymentResponseHeader(SettlementResponse sr, String payer) throws Exception {
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
     * @param request the HTTP request
     * @return true if the resource matches the request
     */
    private boolean matchesPath(String payloadResource, String path, HttpRequest<?> request) {
        if (Objects.equals(payloadResource, path)) {
            return true;
        }
        String fullUrl = request.getUri().toString();
        if (Objects.equals(payloadResource, fullUrl)) {
            return true;
        }
        return false;
    }

    /**
     * Creates a 402 Payment Required response.
     *
     * @param request the HTTP request
     * @param error optional error message
     * @return a 402 response
     */
    private MutableHttpResponse<String> respond402(HttpRequest<?> request, String error) {
        try {
            ResourceInfo resource = buildResourceInfo(request);
            PaymentRequirements requirements = buildRequirements(request.getPath());

            PaymentRequiredResponse prr = new PaymentRequiredResponse(resource, null);
            prr.t402Version = 2;
            prr.error = error;
            prr.addAccepts(requirements);

            String json = Json.MAPPER.writeValueAsString(prr);

            // V2 protocol requires base64-encoded payment requirements in header
            String base64Header = java.util.Base64.getEncoder().encodeToString(json.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return HttpResponse.<String>status(HttpStatus.PAYMENT_REQUIRED)
                    .contentType("application/json")
                    .header(io.t402.util.HttpConstants.PAYMENT_REQUIRED, base64Header)
                    .body(json);
        } catch (Exception ex) {
            return HttpResponse.<String>status(HttpStatus.PAYMENT_REQUIRED)
                    .contentType("application/json")
                    .body("{\"error\":\"" + (error != null ? error : "payment required") + "\"}");
        }
    }

    /**
     * Creates a 500 Internal Server Error response.
     *
     * @param message error message
     * @return a 500 response
     */
    private MutableHttpResponse<String> createErrorResponse(String message) {
        return HttpResponse.<String>status(HttpStatus.INTERNAL_SERVER_ERROR)
                .contentType("application/json")
                .body("{\"error\":\"" + message + "\"}");
    }

    /**
     * Wraps a single response in a Publisher.
     *
     * @param response the response to publish
     * @return a publisher that emits the response
     */
    private Publisher<MutableHttpResponse<?>> createPublisher(MutableHttpResponse<?> response) {
        return new SingleResponsePublisher(response);
    }

    /**
     * A simple Publisher that emits a single MutableHttpResponse and then completes.
     */
    private static final class SingleResponsePublisher
            implements Publisher<MutableHttpResponse<?>> {

        private final MutableHttpResponse<?> response;

        SingleResponsePublisher(MutableHttpResponse<?> response) {
            this.response = response;
        }

        @Override
        public void subscribe(org.reactivestreams.Subscriber<? super MutableHttpResponse<?>> subscriber) {
            subscriber.onSubscribe(new org.reactivestreams.Subscription() {
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
        }
    }

    /**
     * A Publisher that wraps the chain response and adds settlement headers.
     */
    private static final class SettlementHeaderPublisher
            implements Publisher<MutableHttpResponse<?>> {

        private final Publisher<MutableHttpResponse<?>> delegate;
        private final String headerName;
        private final String headerValue;

        SettlementHeaderPublisher(Publisher<MutableHttpResponse<?>> delegate,
                                  String headerName, String headerValue) {
            this.delegate = delegate;
            this.headerName = headerName;
            this.headerValue = headerValue;
        }

        @Override
        public void subscribe(org.reactivestreams.Subscriber<? super MutableHttpResponse<?>> subscriber) {
            delegate.subscribe(new org.reactivestreams.Subscriber<MutableHttpResponse<?>>() {
                @Override
                public void onSubscribe(org.reactivestreams.Subscription s) {
                    subscriber.onSubscribe(s);
                }

                @Override
                public void onNext(MutableHttpResponse<?> response) {
                    response.header(headerName, headerValue);
                    response.header("Access-Control-Expose-Headers", headerName);
                    subscriber.onNext(response);
                }

                @Override
                public void onError(Throwable t) {
                    subscriber.onError(t);
                }

                @Override
                public void onComplete() {
                    subscriber.onComplete();
                }
            });
        }
    }
}
