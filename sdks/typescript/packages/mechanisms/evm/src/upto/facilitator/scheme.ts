import {
  PaymentPayload,
  PaymentRequirements,
  SchemeNetworkFacilitator,
  SettleResponse,
  VerifyResponse,
} from "@t402/core/types";
import { getAddress, Hex, encodeFunctionData, parseAbi } from "viem";
import { permitTypes, UptoEIP2612Payload, isUptoEIP2612Payload } from "../../types.js";
import { FacilitatorEvmSigner } from "../../signer.js";

/**
 * T402UptoRouter contract ABI (only the functions we need)
 */
const T402_UPTO_ROUTER_ABI = parseAbi([
  "function executeUptoTransfer(address token, address from, address to, uint256 maxAmount, uint256 settleAmount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external",
  "function isFacilitator(address facilitator) external view returns (bool)",
  "function checkPermitValidity(address token, address from, uint256 maxAmount) external view returns (bool valid, uint256 balance)",
]);

/**
 * Configuration for UptoEvmFacilitatorScheme
 */
export interface UptoEvmFacilitatorSchemeConfig {
  /**
   * Router contract addresses by network (CAIP-2 format)
   *
   * @example { "eip155:8453": "0x..." }
   */
  routerAddresses?: Record<string, string>;
}

/**
 * EVM facilitator implementation for the Up-To payment scheme.
 *
 * Handles verification and settlement of upto payments using
 * the T402UptoRouter contract.
 *
 * @example
 * ```typescript
 * import { UptoEvmFacilitatorScheme } from "@t402/evm/upto/facilitator";
 *
 * const facilitator = new UptoEvmFacilitatorScheme(signer, {
 *   routerAddresses: {
 *     "eip155:8453": "0x...",  // Base mainnet router
 *     "eip155:84532": "0x...", // Base Sepolia router
 *   },
 * });
 *
 * facilitatorServer.registerScheme(facilitator);
 * ```
 */
export class UptoEvmFacilitatorScheme implements SchemeNetworkFacilitator {
  readonly scheme = "upto";
  readonly caipFamily = "eip155:*";
  private readonly config: UptoEvmFacilitatorSchemeConfig;

  /**
   * Creates a new UptoEvmFacilitatorScheme instance.
   *
   * @param signer - The EVM signer for facilitator operations
   * @param config - Optional configuration
   */
  constructor(
    private readonly signer: FacilitatorEvmSigner,
    config?: UptoEvmFacilitatorSchemeConfig,
  ) {
    this.config = config ?? {};
  }

  /**
   * Get mechanism-specific extra data for the supported kinds endpoint.
   *
   * @param network - The network identifier
   * @returns Extra data including router address if configured
   */
  getExtra(network: string): Record<string, unknown> | undefined {
    const routerAddress = this.config.routerAddresses?.[network];
    if (routerAddress) {
      return { routerAddress };
    }
    return undefined;
  }

  /**
   * Get signer addresses used by this facilitator.
   *
   * @param _ - The network identifier (unused for EVM)
   * @returns Array of facilitator wallet addresses
   */
  getSigners(_: string): string[] {
    return [...this.signer.getAddresses()];
  }

  /**
   * Verifies an upto payment payload.
   *
   * @param payload - The payment payload to verify
   * @param requirements - The payment requirements
   * @returns Promise resolving to verification response
   */
  async verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<VerifyResponse> {
    const uptoPayload = payload.payload as UptoEIP2612Payload | undefined;

    // Validate payload structure
    if (!uptoPayload || !isUptoEIP2612Payload(uptoPayload)) {
      return {
        isValid: false,
        invalidReason: "invalid_payload_structure",
        payer: undefined,
      };
    }

    // Verify scheme matches
    if (payload.accepted.scheme !== "upto" || requirements.scheme !== "upto") {
      return {
        isValid: false,
        invalidReason: "unsupported_scheme",
        payer: uptoPayload.authorization.owner,
      };
    }

    // Verify EIP-712 domain parameters exist
    if (!requirements.extra?.name || !requirements.extra?.version) {
      return {
        isValid: false,
        invalidReason: "missing_eip712_domain",
        payer: uptoPayload.authorization.owner,
      };
    }

    // Get maxAmount from extra
    const maxAmount = requirements.extra?.maxAmount as string | undefined;
    if (!maxAmount) {
      return {
        isValid: false,
        invalidReason: "missing_maxAmount",
        payer: uptoPayload.authorization.owner,
      };
    }

    // Verify network matches
    if (payload.accepted.network !== requirements.network) {
      return {
        isValid: false,
        invalidReason: "network_mismatch",
        payer: uptoPayload.authorization.owner,
      };
    }

    // Verify deadline hasn't passed
    const deadline = parseInt(uptoPayload.authorization.deadline);
    const now = Math.floor(Date.now() / 1000);
    if (deadline <= now) {
      return {
        isValid: false,
        invalidReason: "permit_expired",
        payer: uptoPayload.authorization.owner,
      };
    }

    // Verify maxAmount matches
    if (uptoPayload.authorization.value !== maxAmount) {
      return {
        isValid: false,
        invalidReason: "amount_mismatch",
        payer: uptoPayload.authorization.owner,
      };
    }

    // Verify spender matches the trusted router address
    // SECURITY: The permit must authorize the router contract as spender.
    // Without this check, an attacker can sign a permit for a different spender,
    // pass verification, trigger protected handler execution, and settlement
    // would then fail because the router is not the authorized spender.
    const routerAddress = requirements.extra?.routerAddress as string | undefined;
    if (!routerAddress) {
      return {
        isValid: false,
        invalidReason: "missing_router_address",
        payer: uptoPayload.authorization.owner,
      };
    }
    if (getAddress(uptoPayload.authorization.spender) !== getAddress(routerAddress)) {
      return {
        isValid: false,
        invalidReason: "spender_mismatch: permit must authorize the router contract",
        payer: uptoPayload.authorization.owner,
      };
    }

    // Verify on-chain permit nonce matches payload nonce
    try {
      const onChainNonce = await this.signer.readContract({
        address: getAddress(requirements.asset),
        abi: [{ type: "function", name: "nonces", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" }],
        functionName: "nonces",
        args: [getAddress(uptoPayload.authorization.owner)],
      }) as bigint;
      if (onChainNonce !== BigInt(uptoPayload.authorization.nonce)) {
        return {
          isValid: false,
          invalidReason: "invalid_nonce: on-chain nonce does not match payload",
          payer: uptoPayload.authorization.owner,
        };
      }
    } catch {
      // nonces() may not exist on all tokens — continue
    }

    // Verify payer has sufficient balance
    try {
      const balance = await this.signer.readContract({
        address: getAddress(requirements.asset),
        abi: [{ type: "function", name: "balanceOf", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" }],
        functionName: "balanceOf",
        args: [getAddress(uptoPayload.authorization.owner)],
      }) as bigint;
      if (balance < BigInt(maxAmount)) {
        return {
          isValid: false,
          invalidReason: "insufficient_balance",
          payer: uptoPayload.authorization.owner,
        };
      }
    } catch {
      // balanceOf may fail — continue with verification
    }

    // Build typed data for signature verification
    const chainId = parseInt(requirements.network.split(":")[1]);
    const permitTypedData = {
      types: permitTypes,
      primaryType: "Permit" as const,
      domain: {
        name: requirements.extra.name as string,
        version: requirements.extra.version as string,
        chainId,
        verifyingContract: getAddress(requirements.asset),
      },
      message: {
        owner: getAddress(uptoPayload.authorization.owner),
        spender: getAddress(routerAddress),
        value: BigInt(uptoPayload.authorization.value),
        nonce: BigInt(uptoPayload.authorization.nonce),
        deadline: BigInt(uptoPayload.authorization.deadline),
      },
    };

    // Reconstruct signature
    const signature =
      `0x${uptoPayload.signature.r.slice(2)}${uptoPayload.signature.s.slice(2)}${uptoPayload.signature.v.toString(16).padStart(2, "0")}` as Hex;

    // Verify signature
    try {
      const isValid = await this.signer.verifyTypedData({
        address: uptoPayload.authorization.owner,
        ...permitTypedData,
        signature,
      });

      if (!isValid) {
        return {
          isValid: false,
          invalidReason: "invalid_signature",
          payer: uptoPayload.authorization.owner,
        };
      }
    } catch (error) {
      return {
        isValid: false,
        invalidReason: `signature_verification_failed: ${error instanceof Error ? error.message : "unknown"}`,
        payer: uptoPayload.authorization.owner,
      };
    }

    return {
      isValid: true,
      payer: uptoPayload.authorization.owner,
    };
  }

  /**
   * Settles an upto payment by calling the T402UptoRouter contract.
   *
   * @param payload - The verified payment payload
   * @param requirements - The payment requirements
   * @returns Promise resolving to settlement response
   */
  async settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<SettleResponse> {
    const uptoPayload = payload.payload as UptoEIP2612Payload;

    // Get upto-specific fields from extra
    const maxAmount = requirements.extra?.maxAmount as string;
    const minAmount = requirements.extra?.minAmount as string | undefined;
    const routerAddress = requirements.extra?.routerAddress as string | undefined;

    if (!maxAmount) {
      return {
        success: false,
        errorReason: "maxAmount not found in payment requirements",
        transaction: "",
        network: requirements.network,
        payer: uptoPayload.authorization.owner,
      };
    }

    // For upto scheme, settle the maxAmount (actual usage-based settlement
    // would require additional parameters passed via extension)
    const settleAmount = maxAmount;

    // Validate minimum amount
    if (minAmount && BigInt(settleAmount) < BigInt(minAmount)) {
      return {
        success: false,
        errorReason: `Settle amount ${settleAmount} below minimum ${minAmount}`,
        transaction: "",
        network: requirements.network,
        payer: uptoPayload.authorization.owner,
      };
    }

    // Get router address
    if (!routerAddress) {
      return {
        success: false,
        errorReason: "Router address not configured",
        transaction: "",
        network: requirements.network,
        payer: uptoPayload.authorization.owner,
      };
    }

    try {
      // Execute the transfer through the router
      const txHash = await this.signer.sendTransaction({
        to: getAddress(routerAddress),
        data: encodeFunctionData({
          abi: T402_UPTO_ROUTER_ABI,
          functionName: "executeUptoTransfer",
          args: [
            getAddress(requirements.asset),
            getAddress(uptoPayload.authorization.owner),
            getAddress(requirements.payTo),
            BigInt(maxAmount),
            BigInt(settleAmount),
            BigInt(uptoPayload.authorization.deadline),
            uptoPayload.signature.v,
            uptoPayload.signature.r as Hex,
            uptoPayload.signature.s as Hex,
          ],
        }),
      });

      // Wait for confirmation
      const receipt = await this.signer.waitForTransactionReceipt({ hash: txHash });

      if (receipt.status !== "success") {
        return {
          success: false,
          errorReason: "transaction_reverted",
          transaction: txHash,
          network: requirements.network,
          payer: uptoPayload.authorization.owner,
        };
      }

      return {
        success: true,
        transaction: txHash,
        network: requirements.network,
        payer: uptoPayload.authorization.owner,
      };
    } catch (error) {
      return {
        success: false,
        errorReason: `Settlement failed: ${error instanceof Error ? error.message : "unknown"}`,
        transaction: "",
        network: requirements.network,
        payer: uptoPayload.authorization.owner,
      };
    }
  }
}

/**
 * Factory function to create an UptoEvmFacilitatorScheme.
 *
 * @param signer - The EVM signer
 * @param config - Configuration options
 * @returns A new UptoEvmFacilitatorScheme instance
 */
export function createUptoEvmFacilitatorScheme(
  signer: FacilitatorEvmSigner,
  config?: UptoEvmFacilitatorSchemeConfig,
): UptoEvmFacilitatorScheme {
  return new UptoEvmFacilitatorScheme(signer, config);
}
