/**
 * Cosmos/Noble payment scheme implementations.
 *
 * <p>This package provides scheme implementations for Cosmos payments
 * using the exact-direct scheme with native USDC on Noble:
 * <ul>
 *   <li>{@link io.t402.schemes.cosmos.ClientCosmosSigner} - Interface for client-side transaction signing</li>
 *   <li>{@link io.t402.schemes.cosmos.FacilitatorCosmosSigner} - Interface for facilitator-side verification</li>
 *   <li>{@link io.t402.schemes.cosmos.ExactDirectPayload} - Payment payload model with txHash</li>
 *   <li>{@link io.t402.schemes.cosmos.CosmosTransactionResult} - Transaction query result model</li>
 *   <li>{@link io.t402.schemes.cosmos.CosmosConstants} - Network and token constants</li>
 *   <li>{@link io.t402.schemes.cosmos.CosmosSchemes} - Factory for creating scheme instances</li>
 * </ul>
 *
 * <p>For the exact-direct payment scheme, see {@link io.t402.schemes.cosmos.exact}.
 */
package io.t402.schemes.cosmos;
