/**
 * Permit2 Types
 *
 * Type definitions for Uniswap Permit2 SignatureTransfer scheme.
 */

/**
 * Token permissions for Permit2
 */
export type TokenPermissions = {
  /** ERC20 token address */
  token: `0x${string}`;
  /** Maximum amount permitted to transfer */
  amount: string;
};

/**
 * Permit2 PermitTransferFrom parameters
 */
export type PermitTransferFrom = {
  /** Token and amount permissions */
  permitted: TokenPermissions;
  /** Unique nonce (monotonically increasing per owner on the Permit2 contract) */
  nonce: string;
  /** Unix timestamp deadline for the permit */
  deadline: string;
};

/**
 * Transfer details for Permit2
 */
export type SignatureTransferDetails = {
  /** Recipient address */
  to: `0x${string}`;
  /** Requested transfer amount */
  requestedAmount: string;
};

/**
 * Permit2 payment payload (V2)
 */
export type Permit2PayloadV2 = {
  /** The permit parameters */
  permit: PermitTransferFrom;
  /** Transfer destination and amount */
  transferDetails: SignatureTransferDetails;
  /** EIP-712 signature */
  signature: `0x${string}`;
  /** Token owner address */
  owner: `0x${string}`;
};
