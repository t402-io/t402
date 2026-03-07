/**
 * Stellar blockchain payment scheme implementations.
 *
 * <p>This package provides scheme implementations for Stellar payments
 * using Soroban smart contract token transfers (SEP-41):
 * <ul>
 *   <li>{@link io.t402.schemes.stellar.ClientStellarSigner} - Interface for client-side signing</li>
 *   <li>{@link io.t402.schemes.stellar.StellarAuthorization} - Authorization data model</li>
 *   <li>{@link io.t402.schemes.stellar.ExactStellarPayload} - Payment payload model</li>
 *   <li>{@link io.t402.schemes.stellar.StellarConstants} - Network and token constants</li>
 * </ul>
 *
 * <p>For the exact payment scheme, see {@link io.t402.schemes.stellar.exact}.
 */
package io.t402.schemes.stellar;
