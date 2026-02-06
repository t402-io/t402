/**
 * TRON Up-To Payment Scheme
 *
 * Re-exports all upto scheme types for TRON TRC-20 approve + transferFrom payments.
 */

export type { UptoTronAuthorization, UptoTronPayload, UptoTronExtra } from './types.js'

export { isUptoTronPayload, isUptoTronExtra } from './types.js'
