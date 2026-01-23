/**
 * Polkadot payment scheme implementations.
 *
 * <p>This package provides scheme implementations for Polkadot Asset Hub payments
 * using the Assets pallet:
 * <ul>
 *   <li>{@link io.t402.schemes.polkadot.ClientPolkadotSigner} - Interface for client-side asset transfers</li>
 *   <li>{@link io.t402.schemes.polkadot.FacilitatorPolkadotSigner} - Interface for facilitator-side extrinsic queries</li>
 *   <li>{@link io.t402.schemes.polkadot.ExactDirectPayload} - Payment payload model</li>
 *   <li>{@link io.t402.schemes.polkadot.PolkadotConstants} - Network and asset constants</li>
 *   <li>{@link io.t402.schemes.polkadot.PolkadotSchemes} - Factory for creating schemes</li>
 * </ul>
 *
 * <p>For the exact-direct payment scheme, see {@link io.t402.schemes.polkadot.exact_direct}.
 */
package io.t402.schemes.polkadot;
