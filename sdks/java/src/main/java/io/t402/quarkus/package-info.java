/**
 * Quarkus JAX-RS filter for T402 payment protection.
 * <p>
 * This package provides a JAX-RS-compatible container request/response filter that
 * enforces T402 payment requirements on protected routes. It integrates with the T402
 * facilitator to verify payment signatures and settle payments on-chain.
 * </p>
 *
 * <h2>Key Classes</h2>
 * <ul>
 *   <li>{@link io.t402.quarkus.PaymentFilter} - JAX-RS container filter for payment enforcement</li>
 * </ul>
 *
 * <h2>Usage</h2>
 * <pre>{@code
 * // Register the filter as a JAX-RS provider
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
package io.t402.quarkus;
