/**
 * Up-To payment scheme implementation for Solana SVM.
 * <p>
 * This package provides the types for the "upto" payment scheme
 * on Solana, using SPL ApproveChecked to authorize the facilitator
 * to transfer up to a maximum amount of tokens.
 * </p>
 *
 * <h2>Key Types</h2>
 * <ul>
 *   <li>{@link io.t402.schemes.svm.upto.UptoSvmPayload} - Payment payload with signed approve transaction</li>
 *   <li>{@link io.t402.schemes.svm.upto.UptoSvmAuthorization} - Approval authorization metadata</li>
 *   <li>{@link io.t402.schemes.svm.upto.UptoSvmExtra} - Extra fields for payment requirements</li>
 * </ul>
 *
 * @see io.t402.schemes.svm
 */
package io.t402.schemes.svm.upto;
