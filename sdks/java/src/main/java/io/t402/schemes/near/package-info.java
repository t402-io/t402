/**
 * NEAR payment scheme implementations.
 *
 * <p>This package provides scheme implementations for NEAR payments
 * using the exact-direct scheme with NEP-141 ft_transfer:
 * <ul>
 *   <li>{@link io.t402.schemes.near.ClientNearSigner} - Interface for client-side transaction signing</li>
 *   <li>{@link io.t402.schemes.near.FacilitatorNearSigner} - Interface for facilitator-side verification</li>
 *   <li>{@link io.t402.schemes.near.ExactDirectPayload} - Payment payload model with txHash</li>
 *   <li>{@link io.t402.schemes.near.NearConstants} - Network and token constants</li>
 *   <li>{@link io.t402.schemes.near.NearSchemes} - Factory for creating scheme instances</li>
 * </ul>
 *
 * <p>For the exact-direct payment scheme, see {@link io.t402.schemes.near.exact}.
 */
package io.t402.schemes.near;
