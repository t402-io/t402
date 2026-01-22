package io.t402.spring;

import io.t402.client.FacilitatorClient;
import io.t402.client.HttpFacilitatorClient;
import io.t402.server.PaymentFilter;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;

import java.math.BigInteger;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Spring Boot auto-configuration for T402 payment integration.
 *
 * <p>This auto-configuration provides:</p>
 * <ul>
 *   <li>A {@link FacilitatorClient} bean for payment verification and settlement</li>
 *   <li>A {@link PaymentInterceptor} for handling {@code @RequirePayment} annotations</li>
 *   <li>A {@link PaymentFilter} for legacy filter-based payment protection</li>
 *   <li>Support for route-based pricing via {@code t402.routes} configuration</li>
 * </ul>
 *
 * <h3>Basic Configuration</h3>
 * <pre>{@code
 * t402:
 *   enabled: true
 *   facilitator-url: https://facilitator.t402.io
 *   pay-to: "0xYourWalletAddress"
 *   asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
 * }</pre>
 *
 * <h3>Annotation-Based Usage</h3>
 * <pre>{@code
 * @RestController
 * public class ApiController {
 *
 *     @RequirePayment(amount = "$0.01")
 *     @GetMapping("/api/premium")
 *     public String premiumEndpoint() {
 *         return "Premium content";
 *     }
 * }
 * }</pre>
 *
 * <h3>Route-Based Configuration</h3>
 * <pre>{@code
 * t402:
 *   enabled: true
 *   pay-to: "0xYourWalletAddress"
 *   routes:
 *     - path: /api/premium/**
 *       amount: "$1.00"
 *     - path: /api/basic/*
 *       amount: "10000"
 * }</pre>
 *
 * @see RequirePayment
 * @see T402Properties
 * @see RouteConfig
 */
@AutoConfiguration
@ConditionalOnClass(PaymentFilter.class)
@ConditionalOnProperty(prefix = "t402", name = "enabled", havingValue = "true", matchIfMissing = false)
@EnableConfigurationProperties(T402Properties.class)
public class T402AutoConfiguration {

    /**
     * Creates the default FacilitatorClient bean.
     *
     * @param properties T402 configuration properties
     * @return A configured HttpFacilitatorClient
     */
    @Bean
    @ConditionalOnMissingBean
    public FacilitatorClient facilitatorClient(T402Properties properties) {
        return new HttpFacilitatorClient(properties.getFacilitatorUrl());
    }

    /**
     * Creates the PaymentInterceptor for handling @RequirePayment annotations.
     *
     * @param facilitatorClient the facilitator client
     * @param properties T402 configuration properties
     * @return A configured PaymentInterceptor
     */
    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
    public PaymentInterceptor paymentInterceptor(FacilitatorClient facilitatorClient, T402Properties properties) {
        return new PaymentInterceptor(facilitatorClient, properties);
    }

    /**
     * Creates the WebMvcConfigurer for registering the PaymentInterceptor.
     *
     * @param paymentInterceptor the payment interceptor to register
     * @return A configured T402WebMvcConfigurer
     */
    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
    public T402WebMvcConfigurer t402WebMvcConfigurer(PaymentInterceptor paymentInterceptor) {
        return new T402WebMvcConfigurer(paymentInterceptor);
    }

    /**
     * Creates and registers the PaymentFilter for legacy filter-based protection.
     *
     * <p>This filter is registered but disabled by default when using annotation-based
     * payment protection. It can be enabled for specific URL patterns that don't use
     * controller methods (e.g., static resources).</p>
     *
     * <p>The price table is built from the {@code t402.routes} configuration.</p>
     *
     * @param facilitatorClient The facilitator client for payment verification
     * @param properties T402 configuration properties
     * @return A FilterRegistrationBean configured for T402 payments
     */
    @Bean
    @ConditionalOnMissingBean(name = "t402PaymentFilterRegistration")
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
    public FilterRegistrationBean<PaymentFilter> t402PaymentFilterRegistration(
            FacilitatorClient facilitatorClient,
            T402Properties properties) {

        FilterRegistrationBean<PaymentFilter> registration = new FilterRegistrationBean<>();

        // Build price table from route configuration
        Map<String, BigInteger> priceTable = buildPriceTable(properties);

        // Only create filter if there are routes configured
        if (priceTable.isEmpty()) {
            registration.setEnabled(false);
            registration.setFilter(new PaymentFilter(
                properties.getPayTo() != null ? properties.getPayTo() : "",
                Map.of(),
                facilitatorClient
            ));
            return registration;
        }

        PaymentFilter filter = new PaymentFilter(
            properties.getPayTo(),
            priceTable,
            facilitatorClient,
            properties.getNetwork(),
            properties.getAsset()
        );

        registration.setFilter(filter);

        // Register for configured route paths
        for (String path : priceTable.keySet()) {
            // Convert path patterns for servlet filter (** -> *)
            String filterPath = path.replace("/**", "/*");
            registration.addUrlPatterns(filterPath);
        }

        registration.setName("t402PaymentFilter");
        registration.setOrder(100);  // Lower priority than interceptor
        registration.setEnabled(false);  // Disabled by default, interceptor handles requests

        return registration;
    }

    /**
     * Builds a price table from route configuration.
     */
    private Map<String, BigInteger> buildPriceTable(T402Properties properties) {
        Map<String, BigInteger> priceTable = new HashMap<>();
        List<RouteConfig> routes = properties.getRoutes();

        if (routes != null) {
            for (RouteConfig route : routes) {
                if (route.isEnabled() && route.getPath() != null && route.getAmount() != null) {
                    BigInteger amount = properties.parseAmount(route.getAmount());
                    priceTable.put(route.getPath(), amount);
                }
            }
        }

        return priceTable;
    }
}
