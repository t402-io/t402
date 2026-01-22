/**
 * EVM Signer Types
 *
 * Type definitions for T402 EVM signers (clients and facilitators).
 * These interfaces are compatible with viem but don't require it.
 */

import type { Address, Hex } from "./primitives";

/**
 * ClientEvmSigner - Used by T402 clients to sign payment authorizations
 *
 * This is typically a LocalAccount or wallet that holds private keys
 * and can sign EIP-712 typed data for payment authorizations.
 * Compatible with viem's LocalAccount interface.
 */
export type ClientEvmSigner = {
  readonly address: Address;
  signTypedData(message: {
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    primaryType: string;
    message: Record<string, unknown>;
  }): Promise<Hex>;
};

/**
 * FacilitatorEvmSigner - Used by T402 facilitators to verify and settle payments
 *
 * This is typically a viem PublicClient + WalletClient combination that can
 * read contract state, verify signatures, write transactions, and wait for receipts.
 * Compatible with viem's client interface.
 *
 * Supports multiple addresses for load balancing, key rotation, and high availability.
 */
export type FacilitatorEvmSigner = {
  /**
   * Get all addresses this facilitator can use for signing
   * Enables dynamic address selection for load balancing and key rotation
   */
  getAddresses(): readonly Address[];

  readContract(args: {
    address: Address;
    abi: readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
  }): Promise<unknown>;

  verifyTypedData(args: {
    address: Address;
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    primaryType: string;
    message: Record<string, unknown>;
    signature: Hex;
  }): Promise<boolean>;

  writeContract(args: {
    address: Address;
    abi: readonly unknown[];
    functionName: string;
    args: readonly unknown[];
  }): Promise<Hex>;

  sendTransaction(args: { to: Address; data: Hex }): Promise<Hex>;

  waitForTransactionReceipt(args: { hash: Hex }): Promise<{ status: string }>;

  getCode(args: { address: Address }): Promise<Hex | undefined>;
};

/**
 * Converts a signer to a ClientEvmSigner
 *
 * @param signer - The signer to convert to a ClientEvmSigner
 * @returns The converted signer
 */
export function toClientEvmSigner(signer: ClientEvmSigner): ClientEvmSigner {
  return signer;
}

/**
 * Converts a viem client with single address to a FacilitatorEvmSigner
 * Wraps the single address in a getAddresses() function for compatibility
 *
 * @param client - The client to convert (must have 'address' property)
 * @returns FacilitatorEvmSigner with getAddresses() support
 */
export function toFacilitatorEvmSigner(
  client: Omit<FacilitatorEvmSigner, "getAddresses"> & { address: Address },
): FacilitatorEvmSigner {
  return {
    ...client,
    getAddresses: () => [client.address],
  };
}
