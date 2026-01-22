/**
 * Solana SVM blockchain support for the T402 payment protocol.
 * <p>
 * This package provides types, utilities, and scheme implementations for Solana payments
 * using SPL token transfers.
 * </p>
 *
 * <h2>Key Classes</h2>
 * <ul>
 *   <li>{@link io.t402.schemes.svm.SvmConstants} - Network IDs, token addresses, and RPC URLs</li>
 *   <li>{@link io.t402.schemes.svm.SvmAuthorization} - Transfer authorization metadata</li>
 *   <li>{@link io.t402.schemes.svm.ExactSvmPayload} - Payment payload with signed transaction</li>
 *   <li>{@link io.t402.schemes.svm.SvmUtils} - Utility functions for address validation and amount parsing</li>
 *   <li>{@link io.t402.schemes.svm.ClientSvmSigner} - Interface for client-side signing</li>
 *   <li>{@link io.t402.schemes.svm.FacilitatorSvmSigner} - Interface for facilitator operations</li>
 * </ul>
 *
 * <h2>Scheme Implementations</h2>
 * <ul>
 *   <li>{@link io.t402.schemes.svm.exact.ExactSvmServerScheme} - Server-side price parsing</li>
 *   <li>{@link io.t402.schemes.svm.exact.ExactSvmClientScheme} - Client-side payload creation</li>
 *   <li>{@link io.t402.schemes.svm.exact.ExactSvmFacilitatorScheme} - Verification and settlement</li>
 * </ul>
 *
 * <h2>Supported Networks</h2>
 * <ul>
 *   <li>Solana Mainnet: {@code solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp}</li>
 *   <li>Solana Devnet: {@code solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1}</li>
 *   <li>Solana Testnet: {@code solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z}</li>
 * </ul>
 *
 * <h2>Example Usage</h2>
 * <pre>{@code
 * // Server: Create payment requirements
 * ExactSvmServerScheme serverScheme = new ExactSvmServerScheme();
 * Map<String, Object> requirements = serverScheme.createPaymentRequirements(
 *     SvmConstants.SOLANA_MAINNET,
 *     "8GGtWHRQ1wz5gDKE2KXZLktqzcfV1CBqSbeUZjA7hoWL",
 *     "1000000", null, 3600, feePayer);
 *
 * // Client: Create and sign payment
 * ExactSvmClientScheme clientScheme = new ExactSvmClientScheme(signer);
 * Map<String, Object> payload = clientScheme.createPaymentPayloadFromTransaction(
 *     requirements, signedTransaction);
 *
 * // Facilitator: Verify and settle
 * ExactSvmFacilitatorScheme facilitatorScheme = new ExactSvmFacilitatorScheme(facilitatorSigner);
 * SettlementResult result = facilitatorScheme.settleSync(payload, requirements);
 * }</pre>
 *
 * @see io.t402.crypto.SvmSigner
 * @see io.t402.schemes.svm.exact
 */
package io.t402.schemes.svm;
