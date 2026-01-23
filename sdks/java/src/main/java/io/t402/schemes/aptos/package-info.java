/**
 * Aptos payment scheme implementations.
 *
 * <p>This package provides scheme implementations for Aptos payments
 * using the exact-direct pattern with Fungible Asset transfers:
 * <ul>
 *   <li>{@link io.t402.schemes.aptos.ClientAptosSigner} - Interface for client-side signing</li>
 *   <li>{@link io.t402.schemes.aptos.FacilitatorAptosSigner} - Interface for facilitator-side queries</li>
 *   <li>{@link io.t402.schemes.aptos.ExactDirectPayload} - Payment payload model</li>
 *   <li>{@link io.t402.schemes.aptos.AptosConstants} - Network and token constants</li>
 *   <li>{@link io.t402.schemes.aptos.AptosSchemes} - Factory methods</li>
 * </ul>
 *
 * <p>For the exact-direct payment scheme, see {@link io.t402.schemes.aptos.exact}.
 */
package io.t402.schemes.aptos;
