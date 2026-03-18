// Shared extension utilities
export type { WithExtensions } from "./types";

// Bazaar extension
export * from "./bazaar";
export { bazaarResourceServerExtension } from "./bazaar/server";

// Sign-in-with-x extension
export * from "./sign-in-with-x";

// Payment ID extension
export * from "./payment-id";

// EIP-2612 gas sponsoring extension
export * from "./eip2612-gas-sponsoring";

// ERC-20 approval gas sponsoring extension
export * from "./erc20-approval-gas-sponsoring";

// Offer and Receipt extension
export * from "./offer-receipt";
