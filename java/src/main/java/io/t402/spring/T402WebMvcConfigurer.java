package io.t402.spring;

import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * WebMvc configuration for T402 payment interceptor.
 *
 * <p>This configurer registers the {@link PaymentInterceptor} to handle
 * {@code @RequirePayment} annotations on controller methods.</p>
 *
 * @see PaymentInterceptor
 * @see RequirePayment
 * @see T402AutoConfiguration
 */
public class T402WebMvcConfigurer implements WebMvcConfigurer {

    private final PaymentInterceptor paymentInterceptor;

    /**
     * Creates a new T402WebMvcConfigurer.
     *
     * @param paymentInterceptor the payment interceptor to register
     */
    public T402WebMvcConfigurer(PaymentInterceptor paymentInterceptor) {
        this.paymentInterceptor = paymentInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // Register the payment interceptor for all paths
        // The interceptor itself will check for @RequirePayment annotations
        registry.addInterceptor(paymentInterceptor)
                .addPathPatterns("/**")
                .order(1);
    }
}
