import type { PaymentPayload, PaymentRequirements } from '@t402/core/types'
import type { EmbeddedFacilitator } from './facilitator'
import type {
  EmbeddedMiddlewareOptions,
  GenericRequest,
  GenericResponse,
  NextFunction,
  PaymentLifecycleEmitterInterface,
} from './types'

/**
 * Emit a lifecycle event if a lifecycle emitter is configured.
 *
 * @param lifecycle - The lifecycle emitter, or undefined
 * @param type - The event type
 * @param payload - The payment payload
 * @param requirements - The payment requirements
 * @param extra - Additional fields to merge into the event
 */
function emitEvent(
  lifecycle: PaymentLifecycleEmitterInterface | undefined,
  type: string,
  payload: PaymentPayload,
  requirements: PaymentRequirements,
  extra?: Record<string, unknown>,
): void {
  if (!lifecycle) return
  lifecycle.emit({
    type: type as 'payment.received',
    timestamp: new Date().toISOString(),
    payload,
    requirements,
    ...extra,
  })
}

/**
 * Create an embedded payment middleware that uses an EmbeddedFacilitator
 * for in-process verification and settlement (no HTTP calls to a facilitator service).
 *
 * The middleware extracts payment information from incoming requests,
 * verifies payments, optionally settles them, and emits lifecycle events.
 *
 * @param facilitator - The EmbeddedFacilitator instance to use for verify/settle
 * @param options - Middleware configuration options
 * @returns A middleware function compatible with Express-like frameworks
 */
export function createEmbeddedPaymentMiddleware(
  facilitator: EmbeddedFacilitator,
  options: EmbeddedMiddlewareOptions,
): (req: GenericRequest, res: GenericResponse, next: NextFunction) => Promise<void> {
  const { extractPayload, getRequirements, lifecycle, autoSettle = true } = options

  return async (req: GenericRequest, res: GenericResponse, next: NextFunction): Promise<void> => {
    // Check if this route requires payment
    const requirements = getRequirements(req)
    if (!requirements) {
      next()
      return
    }

    // Extract payment payload from request
    const payload = extractPayload(req)
    if (!payload) {
      res.status(402).json({
        error: 'Payment required',
        accepts: [requirements],
      })
      return
    }

    // Emit received event
    emitEvent(lifecycle, 'payment.received', payload, requirements)

    // Verify payment
    emitEvent(lifecycle, 'payment.verifying', payload, requirements)

    const verifyResult = await facilitator.verify(payload, requirements)

    if (!verifyResult.isValid) {
      emitEvent(lifecycle, 'payment.failed', payload, requirements, {
        error: verifyResult.invalidReason || 'Verification failed',
        phase: 'verification',
      })
      res.status(402).json({
        error: 'Payment verification failed',
        reason: verifyResult.invalidReason,
      })
      return
    }

    emitEvent(lifecycle, 'payment.verified', payload, requirements, {
      result: verifyResult,
    })

    // Settle payment if autoSettle is enabled
    if (autoSettle) {
      emitEvent(lifecycle, 'payment.settling', payload, requirements)

      const settleResult = await facilitator.settle(payload, requirements)

      if (!settleResult.success) {
        emitEvent(lifecycle, 'payment.failed', payload, requirements, {
          error: settleResult.errorReason || 'Settlement failed',
          phase: 'settlement',
        })
        res.status(402).json({
          error: 'Payment settlement failed',
          reason: settleResult.errorReason,
        })
        return
      }

      emitEvent(lifecycle, 'payment.settled', payload, requirements, {
        result: settleResult,
      })

      // Add settlement headers to the response
      res.setHeader('X-Payment-Transaction', settleResult.transaction)
      res.setHeader('X-Payment-Network', settleResult.network)
      if (settleResult.payer) {
        res.setHeader('X-Payment-Payer', settleResult.payer)
      }
    }

    // Payment processed successfully, proceed to next handler
    next()
  }
}
