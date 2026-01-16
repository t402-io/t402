package io.t402.spring;

import io.t402.client.FacilitatorClient;
import io.t402.client.HttpFacilitatorClient;
import io.t402.server.PaymentFilter;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;

/**
 * Spring Boot auto-configuration for T402 payment integration.
 *
 * <p>This auto-configuration provides:</p>
 * <ul>
 *   <li>A {@link FacilitatorClient} bean for payment verification and settlement</li>
 *   <li>A {@link PaymentFilter} that can be registered for specific URL patterns</li>
 * </ul>
 *
 * <p>To enable, add the following to your application.yml:</p>
 * <pre>{@code
 * t402:
 *   enabled: true
 *   facilitator-url: https://facilitator.t402.io
 *   pay-to: "0x..."
 *   asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
 * }</pre>
 *
 * <p>Example usage in a Spring Boot application:</p>
 * <pre>{@code
 * @RestController
 * public class ApiController {
 *
 *     @GetMapping("/api/premium")
 *     public ResponseEntity<String> premiumEndpoint() {
 *         // This endpoint is protected by the PaymentFilter
 *         return ResponseEntity.ok("Premium content");
 *     }
 * }
 * }</pre>
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
     * Creates and registers the PaymentFilter.
     *
     * <p>By default, the filter is registered for /api/* URL patterns.
     * Override this bean to customize the URL patterns or price table.</p>
     *
     * @param facilitatorClient The facilitator client for payment verification
     * @param properties        T402 configuration properties
     * @return A FilterRegistrationBean configured for T402 payments
     */
    @Bean
    @ConditionalOnMissingBean(name = "t402PaymentFilterRegistration")
    public FilterRegistrationBean<PaymentFilter> t402PaymentFilterRegistration(
            FacilitatorClient facilitatorClient,
            T402Properties properties) {

        FilterRegistrationBean<PaymentFilter> registration = new FilterRegistrationBean<>();

        // Create a default price table - users should override this bean for custom pricing
        java.util.Map<String, java.math.BigInteger> priceTable = new java.util.HashMap<>();
        // Default: 1 USDC (1_000_000 atomic units with 6 decimals) for /api/* endpoints
        priceTable.put("/api/*", java.math.BigInteger.valueOf(1_000_000));

        PaymentFilter filter = new PaymentFilter(
            properties.getPayTo(),
            priceTable,
            facilitatorClient
        );

        registration.setFilter(filter);
        registration.addUrlPatterns("/api/*"); // Default: protect /api/* endpoints
        registration.setName("t402PaymentFilter");
        registration.setOrder(1);

        return registration;
    }
}
