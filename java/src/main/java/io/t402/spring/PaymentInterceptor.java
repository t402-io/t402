package io.t402.spring;

import io.t402.client.FacilitatorClient;
import io.t402.client.SettlementResponse;
import io.t402.client.VerificationResponse;
import io.t402.model.PaymentPayload;
import io.t402.model.PaymentRequirements;
import io.t402.model.PaymentRequiredResponse;
import io.t402.model.ResourceInfo;
import io.t402.util.Json;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

import java.io.IOException;
import java.math.BigInteger;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Spring MVC Interceptor that enforces T402 payments based on {@link RequirePayment} annotations
 * and route configurations.
 *
 * <p>This interceptor checks for payment requirements in the following order:</p>
 * <ol>
 *   <li>Method-level {@code @RequirePayment} annotation</li>
 *   <li>Class-level {@code @RequirePayment} annotation</li>
 *   <li>Route configuration from {@code t402.routes} properties</li>
 * </ol>
 *
 * <p>If a payment requirement is found, the interceptor validates the X-PAYMENT header
 * against the facilitator and returns HTTP 402 if payment is invalid or missing.</p>
 *
 * @see RequirePayment
 * @see RouteConfig
 * @see T402AutoConfiguration
 */
public class PaymentInterceptor implements HandlerInterceptor {

    private final FacilitatorClient facilitator;
    private final T402Properties properties;
    private final AntPathMatcher pathMatcher = new AntPathMatcher();
    private final Map<String, PaymentRequirements> routeCache = new ConcurrentHashMap<>();

    /**
     * Creates a new PaymentInterceptor.
     *
     * @param facilitator the facilitator client for payment verification
     * @param properties the T402 configuration properties
     */
    public PaymentInterceptor(FacilitatorClient facilitator, T402Properties properties) {
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
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {

        if (!(handler instanceof HandlerMethod)) {
            return true;  // Not a controller method, skip
        }

        HandlerMethod handlerMethod = (HandlerMethod) handler;
        PaymentRequirements requirements = getPaymentRequirements(request, handlerMethod);

        if (requirements == null) {
            return true;  // No payment required for this endpoint
        }

        String paymentHeader = request.getHeader("X-PAYMENT");
        if (paymentHeader == null || paymentHeader.isEmpty()) {
            respond402(response, request, requirements, null);
            return false;
        }

        try {
            // Decode and validate the payment
            PaymentPayload payload = PaymentPayload.fromHeader(paymentHeader);

            // Validate resource URL matches request
            String payloadResource = getResourceUrl(payload);
            if (payloadResource != null && !matchesPath(payloadResource, request)) {
                respond402(response, request, requirements, "resource mismatch");
                return false;
            }

            // Verify with facilitator
            VerificationResponse vr = facilitator.verify(paymentHeader, requirements);
            if (!vr.isValid) {
                respond402(response, request, requirements, vr.invalidReason);
                return false;
            }

            // Store payment info in request for later settlement
            request.setAttribute("t402.paymentHeader", paymentHeader);
            request.setAttribute("t402.paymentRequirements", requirements);
            request.setAttribute("t402.paymentPayload", payload);

            return true;

        } catch (IllegalArgumentException ex) {
            respond402(response, request, requirements, "malformed X-PAYMENT header");
            return false;
        } catch (IOException ex) {
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Payment verification failed: " + ex.getMessage() + "\"}");
            return false;
        }
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                 Object handler, Exception ex) throws Exception {

        // Settle the payment after the request completes successfully
        String paymentHeader = (String) request.getAttribute("t402.paymentHeader");
        PaymentRequirements requirements = (PaymentRequirements) request.getAttribute("t402.paymentRequirements");

        if (paymentHeader != null && requirements != null && response.getStatus() < 400) {
            try {
                SettlementResponse sr = facilitator.settle(paymentHeader, requirements);
                if (sr != null && sr.success) {
                    // Add settlement response header
                    addSettlementHeader(response, sr, request);
                }
            } catch (Exception settleEx) {
                // Log but don't fail the response
                System.err.println("Payment settlement failed: " + settleEx.getMessage());
            }
        }
    }

    /**
     * Gets payment requirements for the request, checking annotations and route config.
     */
    private PaymentRequirements getPaymentRequirements(HttpServletRequest request, HandlerMethod handlerMethod) {
        // 1. Check method-level annotation
        RequirePayment methodAnnotation = handlerMethod.getMethodAnnotation(RequirePayment.class);
        if (methodAnnotation != null) {
            return buildRequirements(methodAnnotation);
        }

        // 2. Check class-level annotation
        RequirePayment classAnnotation = handlerMethod.getBeanType().getAnnotation(RequirePayment.class);
        if (classAnnotation != null) {
            return buildRequirements(classAnnotation);
        }

        // 3. Check route configuration
        String path = request.getRequestURI();
        for (Map.Entry<String, PaymentRequirements> entry : routeCache.entrySet()) {
            if (pathMatcher.match(entry.getKey(), path)) {
                return entry.getValue();
            }
        }

        return null;
    }

    /**
     * Builds PaymentRequirements from an annotation.
     */
    private PaymentRequirements buildRequirements(RequirePayment annotation) {
        PaymentRequirements req = new PaymentRequirements();
        req.scheme = annotation.scheme().isEmpty() ? properties.getScheme() : annotation.scheme();
        req.network = annotation.network().isEmpty() ? properties.getNetwork() : annotation.network();
        req.asset = annotation.asset().isEmpty() ? properties.getAsset() : annotation.asset();
        req.amount = properties.parseAmount(annotation.amount()).toString();
        req.payTo = properties.getPayTo();
        req.maxTimeoutSeconds = annotation.maxTimeoutSeconds() < 0
            ? properties.getMaxTimeoutSeconds()
            : annotation.maxTimeoutSeconds();
        return req;
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
    private boolean matchesPath(String payloadResource, HttpServletRequest request) {
        String path = request.getRequestURI();
        if (payloadResource.equals(path)) {
            return true;
        }
        String fullUrl = request.getRequestURL().toString();
        if (payloadResource.equals(fullUrl)) {
            return true;
        }
        String queryString = request.getQueryString();
        if (queryString != null && !queryString.isEmpty()) {
            String fullUrlWithQuery = fullUrl + "?" + queryString;
            if (payloadResource.equals(fullUrlWithQuery)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Writes a 402 Payment Required response.
     */
    private void respond402(HttpServletResponse response, HttpServletRequest request,
                            PaymentRequirements requirements, String error) throws IOException {

        response.setStatus(HttpServletResponse.SC_PAYMENT_REQUIRED);
        response.setContentType("application/json");

        ResourceInfo resource = buildResourceInfo(request);
        PaymentRequiredResponse prr = new PaymentRequiredResponse(resource, null);
        prr.t402Version = 2;
        prr.error = error;
        prr.addAccepts(requirements);

        response.getWriter().write(Json.MAPPER.writeValueAsString(prr));
    }

    /**
     * Builds ResourceInfo from the request.
     */
    private ResourceInfo buildResourceInfo(HttpServletRequest request) {
        String fullUrl = request.getRequestURL().toString();
        String queryString = request.getQueryString();
        if (queryString != null && !queryString.isEmpty()) {
            fullUrl = fullUrl + "?" + queryString;
        }
        return new ResourceInfo(fullUrl, null, "application/json");
    }

    /**
     * Adds the settlement response header.
     */
    private void addSettlementHeader(HttpServletResponse response, SettlementResponse sr,
                                      HttpServletRequest request) {
        try {
            PaymentPayload payload = (PaymentPayload) request.getAttribute("t402.paymentPayload");
            String payer = extractPayer(payload);

            io.t402.model.SettlementResponseHeader header = new io.t402.model.SettlementResponseHeader(
                true,
                sr.txHash != null ? sr.txHash : "",
                sr.networkId != null ? sr.networkId : properties.getNetwork(),
                payer
            );

            String json = Json.MAPPER.writeValueAsString(header);
            String base64 = java.util.Base64.getEncoder().encodeToString(json.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            response.setHeader("X-PAYMENT-RESPONSE", base64);
            response.setHeader("Access-Control-Expose-Headers", "X-PAYMENT-RESPONSE");
        } catch (Exception ex) {
            System.err.println("Failed to add settlement header: " + ex.getMessage());
        }
    }

    /**
     * Extracts the payer address from the payment payload.
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
}
