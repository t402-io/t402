/**
 * Exact payment scheme for Stellar blockchain.
 *
 * <p>This package provides the exact (one-shot) payment scheme implementation
 * for Stellar using Soroban smart contract token transfers (SEP-41).
 *
 * <ul>
 *   <li>{@link io.t402.schemes.stellar.exact.ExactStellarClientScheme} - Client-side payment creation</li>
 *   <li>{@link io.t402.schemes.stellar.exact.ExactStellarServerScheme} - Server-side price parsing and requirements</li>
 *   <li>{@link io.t402.schemes.stellar.exact.ExactStellarFacilitatorScheme} - Facilitator verification and settlement</li>
 * </ul>
 */
package io.t402.schemes.stellar.exact;
