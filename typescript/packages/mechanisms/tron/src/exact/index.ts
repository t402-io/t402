/**
 * TRON Exact Payment Scheme
 *
 * Re-exports all exact scheme components for client, server, and facilitator.
 */

// Client exports
export { ExactTronScheme as ExactTronClientScheme } from "./client/scheme.js";
export type { ExactTronSchemeConfig as ExactTronClientSchemeConfig } from "./client/scheme.js";
export { registerExactTronScheme as registerExactTronClientScheme } from "./client/register.js";
export type { TronClientConfig } from "./client/register.js";

// Server exports
export { ExactTronScheme as ExactTronServerScheme } from "./server/scheme.js";
export type { ExactTronSchemeConfig as ExactTronServerSchemeConfig } from "./server/scheme.js";
export { registerExactTronScheme as registerExactTronServerScheme } from "./server/register.js";
export type { TronResourceServerConfig } from "./server/register.js";

// Facilitator exports
export { ExactTronScheme as ExactTronFacilitatorScheme } from "./facilitator/scheme.js";
export type { ExactTronSchemeConfig as ExactTronFacilitatorSchemeConfig } from "./facilitator/scheme.js";
export { registerExactTronScheme as registerExactTronFacilitatorScheme } from "./facilitator/register.js";
export type { TronFacilitatorConfig } from "./facilitator/register.js";
