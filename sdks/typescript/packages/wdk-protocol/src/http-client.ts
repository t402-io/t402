/**
 * HTTP client utilities for 402 payment handling
 */

import { decodePaymentRequiredHeader } from '@t402/core/http'
import type { PaymentRequired } from '@t402/core/types'

/** V2 header names */
const HEADER_PAYMENT_REQUIRED = 'payment-required'

/** V1 header names (fallback) */
const HEADER_X_PAYMENT = 'x-payment'

/**
 * Extract PaymentRequired from a 402 response.
 * Tries V2 header first, then falls back to V1.
 *
 * @param response - The HTTP response with status 402
 * @returns The parsed PaymentRequired object
 * @throws Error if no valid payment header is found
 */
export function extractPaymentRequired(response: Response): PaymentRequired {
  // Try V2 header
  const v2Header = response.headers.get(HEADER_PAYMENT_REQUIRED)
  if (v2Header) {
    return decodePaymentRequiredHeader(v2Header)
  }

  // Try V1 header
  const v1Header = response.headers.get(HEADER_X_PAYMENT)
  if (v1Header) {
    return decodePaymentRequiredHeader(v1Header)
  }

  throw new Error(
    'No payment requirements found in 402 response. ' +
      `Expected "${HEADER_PAYMENT_REQUIRED}" or "${HEADER_X_PAYMENT}" header.`,
  )
}
