/**
 * Up-To Scheme for TON
 *
 * The upto scheme enables usage-based billing on TON using an escrow pattern:
 * 1. Client signs a transfer of maxAmount to the facilitator's holding address
 * 2. Facilitator broadcasts the transfer, then sends settleAmount to payTo
 *    and refunds (maxAmount - settleAmount) back to the client
 *
 * @module
 */

// Re-export types
export type { UptoTonAuthorization, UptoTonPayload, UptoTonExtra } from './types.js'

export { isUptoTonPayload } from './types.js'
