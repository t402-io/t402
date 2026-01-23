/**
 * Tezos payment scheme implementations.
 *
 * <p>This package provides scheme implementations for Tezos payments using FA2 tokens:
 * <ul>
 *   <li>{@link io.t402.schemes.tezos.ClientTezosSigner} - Interface for client-side FA2 transfers</li>
 *   <li>{@link io.t402.schemes.tezos.FacilitatorTezosSigner} - Interface for facilitator-side operation queries</li>
 *   <li>{@link io.t402.schemes.tezos.ExactDirectPayload} - Payment payload model</li>
 *   <li>{@link io.t402.schemes.tezos.TezosConstants} - Network and token constants</li>
 *   <li>{@link io.t402.schemes.tezos.TezosSchemes} - Factory for creating schemes</li>
 * </ul>
 *
 * <p>For the exact-direct payment scheme, see {@link io.t402.schemes.tezos.exact_direct}.
 */
package io.t402.schemes.tezos;
