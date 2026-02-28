// Client
export { Permit2ProxyEvmScheme as Permit2ProxyEvmClientScheme } from "./client/scheme";
export { registerPermit2ProxyEvmScheme as registerPermit2ProxyEvmClientScheme } from "./client/register";
export type { Permit2ProxyEvmClientConfig } from "./client/register";

// Server
export { Permit2ProxyEvmScheme as Permit2ProxyEvmServerScheme } from "./server/scheme";
export type { Permit2ProxyEvmSchemeConfig as Permit2ProxyEvmServerSchemeConfig } from "./server/scheme";
export { registerPermit2ProxyEvmScheme as registerPermit2ProxyEvmServerScheme } from "./server/register";
export type { Permit2ProxyEvmResourceServerConfig } from "./server/register";

// Facilitator
export { Permit2ProxyEvmScheme as Permit2ProxyEvmFacilitatorScheme } from "./facilitator/scheme";
export type { Permit2ProxyEvmSchemeConfig as Permit2ProxyEvmFacilitatorSchemeConfig } from "./facilitator/scheme";
export { registerPermit2ProxyEvmScheme as registerPermit2ProxyEvmFacilitatorScheme } from "./facilitator/register";
export type { Permit2ProxyEvmFacilitatorConfig } from "./facilitator/register";

// Types
export type {
  Permit2ProxyPayloadV2,
  T402Witness,
  PermitTransferFrom,
  TokenPermissions,
} from "./types";

// Constants
export {
  PERMIT2_ADDRESS,
  SCHEME_PERMIT2_PROXY,
  T402_EXACT_PERMIT2_PROXY,
  T402_UPTO_PERMIT2_PROXY,
  WITNESS_TYPEHASH,
  WITNESS_TYPE_STRING,
  permit2WitnessTypes,
  permit2ProxyExactABI,
  permit2ProxyUptoABI,
} from "./constants";
