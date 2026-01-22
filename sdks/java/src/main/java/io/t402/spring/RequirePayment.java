package io.t402.spring;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Annotation to require payment for accessing a controller method or class.
 *
 * <p>When applied to a method, payment will be required for that specific endpoint.
 * When applied to a class, payment will be required for all endpoints in that controller.</p>
 *
 * <h3>Usage Examples</h3>
 *
 * <p><b>Method-level annotation:</b></p>
 * <pre>{@code
 * @RestController
 * public class ApiController {
 *
 *     @RequirePayment(amount = "10000")  // 0.01 USDC (6 decimals)
 *     @GetMapping("/api/premium")
 *     public String premiumEndpoint() {
 *         return "Premium content";
 *     }
 *
 *     @RequirePayment(amount = "$0.50")  // Using dollar notation
 *     @GetMapping("/api/report")
 *     public String generateReport() {
 *         return "Report data";
 *     }
 * }
 * }</pre>
 *
 * <p><b>Class-level annotation:</b></p>
 * <pre>{@code
 * @RestController
 * @RequirePayment(amount = "100000")  // 0.10 USDC for all endpoints
 * public class PremiumController {
 *
 *     @GetMapping("/premium/data")
 *     public String getData() { ... }
 *
 *     @RequirePayment(amount = "1000000")  // Override: 1.00 USDC for this endpoint
 *     @GetMapping("/premium/expensive")
 *     public String getExpensiveData() { ... }
 * }
 * }</pre>
 *
 * <h3>Amount Formats</h3>
 * <ul>
 *   <li>{@code "10000"} - Atomic units (10000 = 0.01 USDC with 6 decimals)</li>
 *   <li>{@code "$0.01"} - Dollar notation (automatically converted to atomic units)</li>
 *   <li>{@code "0.01"} - Decimal notation (automatically converted to atomic units)</li>
 * </ul>
 *
 * @see T402AutoConfiguration
 * @see PaymentInterceptor
 */
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface RequirePayment {

    /**
     * The payment amount required.
     *
     * <p>Supports multiple formats:</p>
     * <ul>
     *   <li>Atomic units: {@code "10000"} (0.01 USDC with 6 decimals)</li>
     *   <li>Dollar notation: {@code "$0.01"}, {@code "$1.50"}</li>
     *   <li>Decimal notation: {@code "0.01"}, {@code "1.50"}</li>
     * </ul>
     *
     * @return the payment amount
     */
    String amount();

    /**
     * The token asset address. If not specified, uses the default from configuration.
     *
     * @return the token contract address, or empty string to use default
     */
    String asset() default "";

    /**
     * The network identifier in CAIP-2 format. If not specified, uses the default from configuration.
     *
     * <p>Examples: {@code "eip155:8453"} (Base), {@code "eip155:84532"} (Base Sepolia)</p>
     *
     * @return the network identifier, or empty string to use default
     */
    String network() default "";

    /**
     * The payment scheme. Defaults to "exact".
     *
     * @return the payment scheme
     */
    String scheme() default "exact";

    /**
     * Optional description of what the payment is for.
     *
     * @return the payment description
     */
    String description() default "";

    /**
     * Maximum timeout for payment in seconds. If not specified, uses the default from configuration.
     *
     * @return the maximum timeout in seconds, or -1 to use default
     */
    int maxTimeoutSeconds() default -1;
}
