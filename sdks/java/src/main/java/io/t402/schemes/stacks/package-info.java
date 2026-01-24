/**
 * Stacks payment scheme implementations.
 *
 * <p>This package provides scheme implementations for Stacks (Bitcoin L2)
 * payments using SIP-010 tokens:
 * <ul>
 *   <li>{@link io.t402.schemes.stacks.ClientStacksSigner} - Interface for client-side token transfers</li>
 *   <li>{@link io.t402.schemes.stacks.FacilitatorStacksSigner} - Interface for facilitator-side transaction queries</li>
 *   <li>{@link io.t402.schemes.stacks.ExactDirectPayload} - Payment payload model</li>
 *   <li>{@link io.t402.schemes.stacks.StacksConstants} - Network and token constants</li>
 *   <li>{@link io.t402.schemes.stacks.StacksSchemes} - Factory for creating schemes</li>
 * </ul>
 *
 * <p>For the exact-direct payment scheme, see {@link io.t402.schemes.stacks.exact_direct}.
 */
package io.t402.schemes.stacks;
