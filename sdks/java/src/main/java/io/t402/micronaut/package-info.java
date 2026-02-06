/**
 * Micronaut HTTP server filter for T402 payment protection.
 * <p>
 * This package provides a Micronaut-compatible HTTP server filter that enforces
 * T402 payment requirements on protected routes. It integrates with the T402
 * facilitator to verify payment signatures and settle payments on-chain.
 * </p>
 *
 * <h2>Key Classes</h2>
 * <ul>
 *   <li>{@link io.t402.micronaut.PaymentFilter} - Micronaut HTTP server filter for payment enforcement</li>
 * </ul>
 *
 * <h2>Usage</h2>
 * <pre>{@code
 * // Create payment filter with route configuration
 * Map<String, BigInteger> priceTable = Map.of(
 *     "/api/premium", BigInteger.valueOf(10000),
 *     "/api/report",  BigInteger.valueOf(1000000)
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
 * @see io.t402.client.FacilitatorClient
 */
package io.t402.micronaut;
