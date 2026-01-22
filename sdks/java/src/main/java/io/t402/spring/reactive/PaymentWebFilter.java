package io.t402.spring.reactive;

import io.t402.client.FacilitatorClient;
import io.t402.client.VerificationResponse;
import io.t402.model.PaymentPayload;
import io.t402.model.PaymentRequirements;
import io.t402.model.PaymentRequiredResponse;
import io.t402.model.ResourceInfo;
import io.t402.spring.RouteConfig;
import io.t402.spring.T402Properties;
import io.t402.util.Json;

import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Reactive WebFilter for T402 payment protection in Spring WebFlux applications.
 *
 * <p>This filter enforces payment requirements based on route configuration for
 * reactive web applications using Spring WebFlux.</p>
 *
 * <h3>Usage</h3>
 * <p>The filter is automatically registered when using WebFlux with T402 enabled.
 * Configure routes in application.yml:</p>
 *
 * <pre>{@code
 * t402:
 *   enabled: true
 *   pay-to: "0xYourWalletAddress"
 *   routes:
 *     - path: /api/premium/**
 *       amount: "$1.00"
 * }</pre>
 *
 * @see T402WebFluxConfiguration
 * @see T402Properties
 */
public class PaymentWebFilter implements WebFilter {

    private final FacilitatorClient facilitator;
    private final T402Properties properties;
    private final AntPathMatcher pathMatcher = new AntPathMatcher();
    private final Map<String, PaymentRequirements> routeCache = new ConcurrentHashMap<>();

    /**
     * Creates a new PaymentWebFilter.
     *
     * @param facilitator the facilitator client for payment verification
     * @param properties the T402 configuration properties
     */
    public PaymentWebFilter(FacilitatorClient facilitator, T402Properties properties) {
        this.facilitator = facilitator;
        this.properties = properties;
        initializeRouteCache();
    }

    /**
     * Pre-populates the route cache from configuration.
     */
    private void initializeRouteCache() {
        List<RouteConfig> routes = properties.getRoutes();
        if (routes != null) {
            for (RouteConfig route : routes) {
                if (route.isEnabled() && route.getPath() != null) {
                    PaymentRequirements req = buildRequirements(route);
                    routeCache.put(route.getPath(), req);
                }
            }
        }
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getPath().value();

        // Find matching route
        PaymentRequirements requirements = findRequirements(path);
        if (requirements == null) {
            return chain.filter(exchange);  // No payment required
        }

        // Get payment header
        String paymentHeader = request.getHeaders().getFirst("X-PAYMENT");
        if (paymentHeader == null || paymentHeader.isEmpty()) {
            return respond402(exchange, requirements, null);
        }

        // Verify payment asynchronously
        return Mono.fromCallable(() -> {
            try {
                PaymentPayload payload = PaymentPayload.fromHeader(paymentHeader);

                // Validate resource URL matches request
                String payloadResource = getResourceUrl(payload);
                if (payloadResource != null && !matchesPath(payloadResource, request)) {
                    return new VerificationResult(false, "resource mismatch", null);
                }

                VerificationResponse vr = facilitator.verify(paymentHeader, requirements);
                return new VerificationResult(vr.isValid, vr.invalidReason, paymentHeader);
            } catch (IllegalArgumentException ex) {
                return new VerificationResult(false, "malformed X-PAYMENT header", null);
            } catch (Exception ex) {
                return new VerificationResult(false, "verification error: " + ex.getMessage(), null);
            }
        })
        .subscribeOn(Schedulers.boundedElastic())
        .flatMap(result -> {
            if (!result.valid) {
                return respond402(exchange, requirements, result.reason);
            }

            // Store payment info for settlement
            exchange.getAttributes().put("t402.paymentHeader", result.paymentHeader);
            exchange.getAttributes().put("t402.paymentRequirements", requirements);

            return chain.filter(exchange)
                .then(Mono.defer(() -> settlePayment(exchange, requirements)));
        });
    }

    /**
     * Finds payment requirements for the given path.
     */
    private PaymentRequirements findRequirements(String path) {
        for (Map.Entry<String, PaymentRequirements> entry : routeCache.entrySet()) {
            if (pathMatcher.match(entry.getKey(), path)) {
                return entry.getValue();
            }
        }
        return null;
    }

    /**
     * Builds PaymentRequirements from a route configuration.
     */
    private PaymentRequirements buildRequirements(RouteConfig route) {
        PaymentRequirements req = new PaymentRequirements();
        req.scheme = route.getScheme() != null ? route.getScheme() : properties.getScheme();
        req.network = route.getNetwork() != null ? route.getNetwork() : properties.getNetwork();
        req.asset = route.getAsset() != null ? route.getAsset() : properties.getAsset();
        req.amount = properties.parseAmount(route.getAmount()).toString();
        req.payTo = properties.getPayTo();
        req.maxTimeoutSeconds = route.getMaxTimeoutSeconds() != null
            ? route.getMaxTimeoutSeconds()
            : properties.getMaxTimeoutSeconds();
        return req;
    }

    /**
     * Gets the resource URL from a payment payload (supports v1 and v2).
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
     * Checks if the payload resource matches the request.
     */
    private boolean matchesPath(String payloadResource, ServerHttpRequest request) {
        String path = request.getPath().value();
        if (payloadResource.equals(path)) {
            return true;
        }
        String fullUrl = request.getURI().toString();
        if (payloadResource.equals(fullUrl)) {
            return true;
        }
        return false;
    }

    /**
     * Writes a 402 Payment Required response.
     */
    private Mono<Void> respond402(ServerWebExchange exchange, PaymentRequirements requirements, String error) {
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(HttpStatus.PAYMENT_REQUIRED);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);

        try {
            String fullUrl = exchange.getRequest().getURI().toString();
            ResourceInfo resource = new ResourceInfo(fullUrl, null, "application/json");

            PaymentRequiredResponse prr = new PaymentRequiredResponse(resource, null);
            prr.t402Version = 2;
            prr.error = error;
            prr.addAccepts(requirements);

            String json = Json.MAPPER.writeValueAsString(prr);
            byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
            DataBuffer buffer = response.bufferFactory().wrap(bytes);
            return response.writeWith(Mono.just(buffer));
        } catch (Exception ex) {
            String errorJson = "{\"error\":\"" + ex.getMessage() + "\"}";
            byte[] bytes = errorJson.getBytes(StandardCharsets.UTF_8);
            DataBuffer buffer = response.bufferFactory().wrap(bytes);
            return response.writeWith(Mono.just(buffer));
        }
    }

    /**
     * Settles the payment after the request completes.
     */
    private Mono<Void> settlePayment(ServerWebExchange exchange, PaymentRequirements requirements) {
        String paymentHeader = exchange.getAttribute("t402.paymentHeader");
        if (paymentHeader == null) {
            return Mono.empty();
        }

        return Mono.fromCallable(() -> {
            try {
                facilitator.settle(paymentHeader, requirements);
            } catch (Exception ex) {
                System.err.println("Payment settlement failed: " + ex.getMessage());
            }
            return null;
        })
        .subscribeOn(Schedulers.boundedElastic())
        .then();
    }

    /**
     * Internal class to hold verification result.
     */
    private static class VerificationResult {
        final boolean valid;
        final String reason;
        final String paymentHeader;

        VerificationResult(boolean valid, String reason, String paymentHeader) {
            this.valid = valid;
            this.reason = reason;
            this.paymentHeader = paymentHeader;
        }
    }
}
