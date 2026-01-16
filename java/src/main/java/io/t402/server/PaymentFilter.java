package io.t402.server;

import io.t402.client.FacilitatorClient;
import io.t402.client.SettlementResponse;
import io.t402.client.VerificationResponse;
import io.t402.model.ExactSchemePayload;
import io.t402.model.PaymentPayload;
import io.t402.model.PaymentRequirements;
import io.t402.model.PaymentRequiredResponse;
import io.t402.model.ResourceInfo;
import io.t402.model.SettlementResponseHeader;
import io.t402.util.Json;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.math.BigInteger;
import java.util.Map;
import java.util.Objects;

/**
 * Servlet/Spring filter that enforces t402 v2 payments on selected paths.
 * <p>
 * This filter implements the server-side of the t402 protocol, intercepting requests
 * and requiring payment before allowing access to protected resources.
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
 */
public class PaymentFilter implements Filter {

    private final String payTo;
    private final Map<String, BigInteger> priceTable;   // path → amount
    private final FacilitatorClient facilitator;

    // Default configuration - can be customized via constructor or setters
    private String defaultNetwork = "eip155:84532";  // Base Sepolia (CAIP-2 format)
    private String defaultAsset = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";  // USDC on Base Sepolia
    private int defaultTimeoutSeconds = 30;

    /**
     * Creates a payment filter that enforces t402 v2 payments on configured paths.
     *
     * @param payTo wallet address for payments
     * @param priceTable maps request paths to required payment amounts in atomic units.
     *                   Uses exact, case-sensitive matching against {@code HttpServletRequest#getRequestURI()}.
     *                   Query parameters are included in matching, HTTP method is ignored.
     *                   Paths not present in the map allow free access. Values are atomic units
     *                   assuming 6-decimal tokens (10000 = 0.01 USDC, 1000000 = 1.00 USDC).
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

    /* ------------------------------------------------ core -------------- */

    @Override
    public void doFilter(ServletRequest req,
                         ServletResponse res,
                         FilterChain chain)
            throws IOException, ServletException {

        if (!(req instanceof HttpServletRequest) ||
            !(res instanceof HttpServletResponse)) {
            chain.doFilter(req, res);          // non-HTTP
            return;
        }

        HttpServletRequest request = (HttpServletRequest) req;
        HttpServletResponse response = (HttpServletResponse) res;
        String path = request.getRequestURI();

        /* -------- path is free? skip check ----------------------------- */
        if (!priceTable.containsKey(path)) {
            chain.doFilter(req, res);
            return;
        }

        String header = request.getHeader("X-PAYMENT");
        if (header == null || header.isEmpty()) {
            respond402(response, request, null);
            return;
        }

        VerificationResponse vr;
        PaymentPayload payload;
        try {
            payload = PaymentPayload.fromHeader(header);

            // Validate resource URL matches request (v2 uses resource.url, v1 uses payload.resource)
            String payloadResource = getResourceUrl(payload);
            if (payloadResource != null && !matchesPath(payloadResource, path, request)) {
                respond402(response, request, "resource mismatch");
                return;
            }

            vr = facilitator.verify(header, buildRequirements(path));
        } catch (IllegalArgumentException ex) {
            // Malformed payment header - client error
            respond402(response, request, "malformed X-PAYMENT header");
            return;
        } catch (IOException ex) {
            // Network/communication error with facilitator - server error
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.setContentType("application/json");
            try {
                response.getWriter().write("{\"error\":\"Payment verification failed: " + ex.getMessage() + "\"}");
            } catch (IOException writeEx) {
                // If we can't write the response, at least set the status
                System.err.println("Failed to write error response: " + writeEx.getMessage());
            }
            return;
        } catch (Exception ex) {
            // Other unexpected errors - server error
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.setContentType("application/json");
            try {
                response.getWriter().write("{\"error\":\"Internal server error during payment verification\"}");
            } catch (IOException writeEx) {
                System.err.println("Failed to write error response: " + writeEx.getMessage());
            }
            return;
        }

        if (!vr.isValid) {
            respond402(response, request, vr.invalidReason);
            return;
        }

        /* -------- payment verified → continue business logic ----------- */
        chain.doFilter(req, res);

        /* -------- settlement (return errors to user) ------------- */
        try {
            SettlementResponse sr = facilitator.settle(header, buildRequirements(path));
            if (sr == null || !sr.success) {
                // Settlement failed - return 402 if headers not sent yet
                if (!response.isCommitted()) {
                    String errorMsg = sr != null && sr.error != null ? sr.error : "settlement failed";
                    respond402(response, request, errorMsg);
                }
                return;
            }

            // Settlement succeeded - add settlement response header (base64-encoded JSON)
            try {
                // Extract payer from payment payload (wallet address of person making payment)
                String payer = extractPayerFromPayload(payload);

                String base64Header = createPaymentResponseHeader(sr, payer);
                response.setHeader("X-PAYMENT-RESPONSE", base64Header);

                // Set CORS header to expose X-PAYMENT-RESPONSE to browser clients
                response.setHeader("Access-Control-Expose-Headers", "X-PAYMENT-RESPONSE");
            } catch (Exception ex) {
                // If header creation fails, return 500
                if (!response.isCommitted()) {
                    response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                    response.setContentType("application/json");
                    try {
                        response.getWriter().write("{\"error\":\"Failed to create settlement response header\"}");
                    } catch (IOException writeEx) {
                        System.err.println("Failed to write error response: " + writeEx.getMessage());
                    }
                }
                return;
            }
        } catch (Exception ex) {
            // Network/communication errors during settlement - return 402
            if (!response.isCommitted()) {
                respond402(response, request, "settlement error: " + ex.getMessage());
            }
            return;
        }
    }

    /* ------------------------------------------------ helpers ---------- */

    /**
     * Build a v2 PaymentRequirements object for the given path and price.
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
     * Build a v2 ResourceInfo object for the given request.
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
     * Create a base64-encoded payment response header.
     */
    private String createPaymentResponseHeader(SettlementResponse sr, String payer) throws Exception {
        SettlementResponseHeader settlementHeader = new SettlementResponseHeader(
            true,
            sr.txHash != null ? sr.txHash : "",
            sr.networkId != null ? sr.networkId : defaultNetwork,
            payer
        );

        String jsonString = Json.MAPPER.writeValueAsString(settlementHeader);
        return Base64.getEncoder().encodeToString(jsonString.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Extract the payer wallet address from payment payload.
     */
    private String extractPayerFromPayload(PaymentPayload payload) {
        try {
            // Convert the generic payload map to a typed ExactSchemePayload
            ExactSchemePayload exactPayload = Json.MAPPER.convertValue(payload.payload, ExactSchemePayload.class);
            return exactPayload.authorization != null ? exactPayload.authorization.from : null;
        } catch (Exception ex) {
            // If conversion fails, fall back to manual extraction for compatibility
            try {
                Object authorization = payload.payload.get("authorization");
                if (authorization instanceof Map) {
                    Object from = ((Map<?, ?>) authorization).get("from");
                    return from instanceof String ? (String) from : null;
                }
            } catch (Exception ignored) {
                // Ignore any extraction errors
            }
            return null;
        }
    }

    /**
     * Get the resource URL from a payment payload, supporting both v1 and v2 formats.
     */
    private String getResourceUrl(PaymentPayload payload) {
        // v2 format: resource.url
        if (payload.resource != null && payload.resource.url != null) {
            return payload.resource.url;
        }
        // v1 format: payload["resource"]
        if (payload.payload != null && payload.payload.get("resource") instanceof String) {
            return (String) payload.payload.get("resource");
        }
        return null;
    }

    /**
     * Check if the payload resource matches the request path.
     */
    private boolean matchesPath(String payloadResource, String path, HttpServletRequest request) {
        // Direct path match
        if (Objects.equals(payloadResource, path)) {
            return true;
        }
        // Full URL match
        String fullUrl = request.getRequestURL().toString();
        if (Objects.equals(payloadResource, fullUrl)) {
            return true;
        }
        // URL with query string match
        String queryString = request.getQueryString();
        if (queryString != null && !queryString.isEmpty()) {
            String fullUrlWithQuery = fullUrl + "?" + queryString;
            if (Objects.equals(payloadResource, fullUrlWithQuery)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Write a v2 JSON 402 response.
     */
    private void respond402(HttpServletResponse resp,
                            HttpServletRequest req,
                            String error)
            throws IOException {

        resp.setStatus(HttpServletResponse.SC_PAYMENT_REQUIRED);
        resp.setContentType("application/json");

        String path = req.getRequestURI();
        ResourceInfo resource = buildResourceInfo(req);
        PaymentRequirements requirements = buildRequirements(path);

        PaymentRequiredResponse prr = new PaymentRequiredResponse(resource, null);
        prr.t402Version = 2;
        prr.error = error;
        prr.addAccepts(requirements);

        resp.getWriter().write(Json.MAPPER.writeValueAsString(prr));
    }
}
