package io.t402.spring.reactive;

import io.t402.client.FacilitatorClient;
import io.t402.client.HttpFacilitatorClient;
import io.t402.spring.T402Properties;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.web.server.WebFilter;

/**
 * Spring WebFlux auto-configuration for T402 payment integration.
 *
 * <p>This configuration is automatically applied when:</p>
 * <ul>
 *   <li>Spring WebFlux is on the classpath</li>
 *   <li>The application is a reactive web application</li>
 *   <li>{@code t402.enabled=true} is set</li>
 * </ul>
 *
 * <h3>Configuration Example</h3>
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
 * <h3>Usage in WebFlux Controller</h3>
 * <pre>{@code
 * @RestController
 * public class ApiController {
 *
 *     @GetMapping("/api/premium/data")
 *     public Mono<String> premiumData() {
 *         return Mono.just("Premium content");
 *     }
 * }
 * }</pre>
 *
 * <p>Note: The {@code @RequirePayment} annotation is not supported in WebFlux applications.
 * Use route-based configuration instead.</p>
 *
 * @see PaymentWebFilter
 * @see T402Properties
 */
@AutoConfiguration
@ConditionalOnClass({WebFilter.class, reactor.core.publisher.Mono.class})
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.REACTIVE)
@ConditionalOnProperty(prefix = "t402", name = "enabled", havingValue = "true", matchIfMissing = false)
@EnableConfigurationProperties(T402Properties.class)
public class T402WebFluxConfiguration {

    /**
     * Creates the FacilitatorClient bean for reactive applications.
     *
     * <p>Note: This uses the synchronous HttpFacilitatorClient wrapped in reactive calls.
     * For high-throughput reactive applications, consider implementing a reactive client.</p>
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
     * Creates the PaymentWebFilter for reactive payment protection.
     *
     * @param facilitator the facilitator client
     * @param properties T402 configuration properties
     * @return A configured PaymentWebFilter
     */
    @Bean
    @ConditionalOnMissingBean
    public PaymentWebFilter paymentWebFilter(FacilitatorClient facilitator, T402Properties properties) {
        return new PaymentWebFilter(facilitator, properties);
    }
}
