/**
 * WDK Integration Adapters
 *
 * Adapters for integrating T402WDK with other T402 protocol components:
 * - A2A (Agent-to-Agent) transport
 * - Facilitator settlement
 * - SIWx (Sign-In-With-X) authentication
 */

export {
  createWdkA2APaymentClient,
  type WdkA2AOptions,
  type WdkA2APaymentClient,
  type A2APaymentRequired,
  type A2APaymentPayload,
} from './a2a-adapter.js'

export {
  toFacilitatorWdkSigner,
  createFacilitatorSigners,
  type FacilitatorWdkSignerOptions,
  type FacilitatorWdkSigner,
} from './facilitator-adapter.js'

export { toSIWxSigner, createSIWxSigners, type SIWxSigner } from './siwx-adapter.js'
