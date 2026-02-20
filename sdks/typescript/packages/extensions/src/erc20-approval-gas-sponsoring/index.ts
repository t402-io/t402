/**
 * @module erc20-approval-gas-sponsoring - t402 Payment Protocol ERC-20 Approval Gas Sponsoring Extension
 *
 * This module provides ERC-20 approve()-based gas sponsoring for the t402 protocol.
 * For tokens WITHOUT EIP-2612 permit support, the client signs an offline approve()
 * transaction and the facilitator broadcasts it on their behalf. The facilitator pays
 * gas for the approval and settlement transactions.
 *
 * @example Server-side usage
 * ```typescript
 * import {
 *   declareERC20ApprovalGasSponsorExtension,
 *   parseERC20ApprovalGasSponsorHeader,
 *   validateERC20ApprovalGasSponsorPayload,
 * } from "@t402/extensions/erc20-approval-gas-sponsoring";
 *
 * // Declare extension in 402 response
 * const extension = declareERC20ApprovalGasSponsorExtension({
 *   sponsoredNetworks: ["eip155:8453", "eip155:42161"],
 *   maxAmount: "1000000000",
 *   sponsorAddress: "0xFacilitator...",
 *   requiresAtomicBatch: true,
 * });
 *
 * // Parse and validate client header
 * const payload = parseERC20ApprovalGasSponsorHeader(
 *   request.headers['x-t402-erc20-approval-gas-sponsoring']
 * );
 * const result = validateERC20ApprovalGasSponsorPayload(payload, extension.info);
 * ```
 *
 * @example Client-side usage
 * ```typescript
 * import {
 *   encodeApproveCalldata,
 *   createERC20ApprovalGasSponsorPayload,
 *   encodeERC20ApprovalGasSponsorHeader,
 *   ERC20_APPROVAL_GAS_SPONSOR_HEADER_NAME,
 * } from "@t402/extensions/erc20-approval-gas-sponsoring";
 *
 * const calldata = encodeApproveCalldata(sponsorAddress, "1000000");
 * const signedTx = await wallet.signTransaction({
 *   to: tokenAddress,
 *   data: calldata,
 *   chainId: 8453,
 * });
 *
 * const payload = createERC20ApprovalGasSponsorPayload(extensionInfo, {
 *   network: "eip155:8453",
 *   from: wallet.address,
 *   asset: tokenAddress,
 *   amount: "1000000",
 *   signedApprovalTx: signedTx,
 *   chainId: 8453,
 * });
 *
 * fetch(url, {
 *   headers: { [ERC20_APPROVAL_GAS_SPONSOR_HEADER_NAME]: encodeERC20ApprovalGasSponsorHeader(payload) }
 * });
 * ```
 *
 * @example Facilitator-side usage
 * ```typescript
 * import {
 *   extractERC20ApprovalGasSponsorPayload,
 *   processERC20ApprovalPayload,
 *   validateAndExtractApproval,
 *   decodeApproveCalldata,
 * } from "@t402/extensions/erc20-approval-gas-sponsoring";
 *
 * const result = validateAndExtractApproval(
 *   paymentPayload.extensions,
 *   extensionInfo
 * );
 * if (result.valid && result.payload) {
 *   // Fund client with gas if needed, broadcast approval tx, then settle
 * }
 * ```
 */

// Type exports
export type {
  ERC20ApprovalGasSponsorExtensionInfo,
  ERC20ApprovalGasSponsorExtension,
  ERC20ApprovalGasSponsorPayload,
  DeclareERC20ApprovalGasSponsorOptions,
  ValidateERC20ApprovalGasSponsorOptions,
  ERC20ApprovalGasSponsorValidationResult,
  CreateERC20ApprovalParams,
} from "./types.js";

// Server exports
export {
  declareERC20ApprovalGasSponsorExtension,
  parseERC20ApprovalGasSponsorHeader,
  validateERC20ApprovalGasSponsorPayload,
} from "./server.js";

// Client exports
export {
  encodeApproveCalldata,
  createERC20ApprovalGasSponsorPayload,
  encodeERC20ApprovalGasSponsorHeader,
  ERC20_APPROVAL_GAS_SPONSOR_EXTENSION_KEY,
  ERC20_APPROVAL_GAS_SPONSOR_HEADER_NAME,
  APPROVE_FUNCTION_SELECTOR,
} from "./client.js";

// Facilitator exports
export {
  extractERC20ApprovalGasSponsorPayload,
  processERC20ApprovalPayload,
  validateAndExtractApproval,
  decodeApproveCalldata,
} from "./facilitator.js";
