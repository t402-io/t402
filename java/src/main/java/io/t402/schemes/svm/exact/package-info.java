/**
 * Exact payment scheme implementation for Solana SVM.
 * <p>
 * This package provides the complete implementation of the "exact" payment scheme
 * for Solana, including client, server, and facilitator components.
 * </p>
 *
 * <h2>Components</h2>
 * <ul>
 *   <li>{@link io.t402.schemes.svm.exact.ExactSvmServerScheme} - Server-side price parsing and requirements</li>
 *   <li>{@link io.t402.schemes.svm.exact.ExactSvmClientScheme} - Client-side payment payload creation</li>
 *   <li>{@link io.t402.schemes.svm.exact.ExactSvmFacilitatorScheme} - Facilitator verification and settlement</li>
 * </ul>
 *
 * <h2>Usage Flow</h2>
 * <pre>{@code
 * // 1. Server creates payment requirements
 * ExactSvmServerScheme serverScheme = new ExactSvmServerScheme();
 * Map<String, Object> priceInfo = serverScheme.parsePrice("1.50", network);
 * Map<String, Object> requirements = serverScheme.createPaymentRequirements(
 *     network, payTo, priceInfo.get("amount"), null, 3600, feePayer);
 *
 * // 2. Client creates and signs payment
 * ExactSvmClientScheme clientScheme = new ExactSvmClientScheme(clientSigner);
 * Map<String, Object> payload = clientScheme.createPaymentPayloadSync(
 *     requirements, () -> buildTransaction(...));
 *
 * // 3. Facilitator verifies and settles
 * ExactSvmFacilitatorScheme facilitatorScheme = new ExactSvmFacilitatorScheme(facilitatorSigner);
 * VerificationResult result = facilitatorScheme.verifySync(payload, requirements);
 * if (result.isValid) {
 *     SettlementResult settlement = facilitatorScheme.settleSync(payload, requirements);
 * }
 * }</pre>
 *
 * @see io.t402.schemes.svm
 */
package io.t402.schemes.svm.exact;
