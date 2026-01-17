/**
 * Solana SVM blockchain support for the T402 payment protocol.
 * <p>
 * This package provides types and utilities for Solana payments
 * using SPL token transfers.
 * </p>
 *
 * <h2>Key Classes</h2>
 * <ul>
 *   <li>{@link io.t402.schemes.svm.SvmConstants} - Network IDs, token addresses, and RPC URLs</li>
 *   <li>{@link io.t402.schemes.svm.SvmAuthorization} - Transfer authorization metadata</li>
 *   <li>{@link io.t402.schemes.svm.ExactSvmPayload} - Payment payload with signed transaction</li>
 *   <li>{@link io.t402.schemes.svm.SvmUtils} - Utility functions for address validation and amount parsing</li>
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
 * // Create an authorization
 * SvmAuthorization auth = SvmAuthorization.builder()
 *     .from("9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM")
 *     .to("8GGtWHRQ1wz5gDKE2KXZLktqzcfV1CBqSbeUZjA7hoWL")
 *     .mint(SvmConstants.USDC_MAINNET_ADDRESS)
 *     .amount("1000000") // 1 USDC
 *     .validUntil(SvmUtils.calculateValidUntil(3600))
 *     .build();
 *
 * // Validate an address
 * boolean valid = SvmUtils.isValidAddress("9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM");
 *
 * // Parse amount
 * BigInteger amount = SvmUtils.parseAmount("1.50", 6); // 1500000
 * }</pre>
 *
 * @see io.t402.crypto.SvmSigner
 */
package io.t402.schemes.svm;
