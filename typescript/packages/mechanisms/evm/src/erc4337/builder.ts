/**
 * ERC-4337 UserOperation Builder
 *
 * Builds UserOperations from transaction intents for ERC-4337 v0.7.
 * Handles gas estimation, nonce management, and operation packing.
 */

import type { Address, Hex, PublicClient } from "viem";
import { concat, pad, toHex } from "viem";
import type {
  UserOperation,
  PackedUserOperation,
  SmartAccountSigner,
  TransactionIntent,
  GasEstimate,
  PaymasterData,
} from "./types.js";
import {
  ENTRYPOINT_V07_ADDRESS,
  ENTRYPOINT_V07_ABI,
  DEFAULT_GAS_LIMITS,
  packAccountGasLimits,
  packGasFees,
} from "./constants.js";

/**
 * Builder configuration
 */
export interface UserOpBuilderOptions {
  /** EntryPoint address (defaults to v0.7) */
  entryPoint?: Address;
  /** Default gas multiplier for safety margin */
  gasMultiplier?: number;
}

/**
 * UserOperation Builder for creating and packing operations
 */
export class UserOpBuilder {
  private readonly entryPoint: Address;
  private readonly gasMultiplier: number;

  /**
   * Create a new UserOpBuilder instance
   *
   * @param options - Optional configuration for the builder
   */
  constructor(options: UserOpBuilderOptions = {}) {
    this.entryPoint = options.entryPoint ?? ENTRYPOINT_V07_ADDRESS;
    this.gasMultiplier = options.gasMultiplier ?? 1.2;
  }

  /**
   * Build a UserOperation from a transaction intent
   *
   * @param signer - The smart account signer
   * @param intent - The transaction intent to execute
   * @param client - The public client for chain interaction
   * @param gasEstimate - Optional gas estimates (uses defaults if not provided)
   * @param paymaster - Optional paymaster data for sponsored transactions
   * @returns A UserOperation ready for signing
   */
  async buildUserOp(
    signer: SmartAccountSigner,
    intent: TransactionIntent,
    client: PublicClient,
    gasEstimate?: GasEstimate,
    paymaster?: PaymasterData,
  ): Promise<UserOperation> {
    const sender = await signer.getAddress();
    const nonce = await this.getNonce(client, sender);
    const isDeployed = await signer.isDeployed();
    const initCode = isDeployed ? "0x" : await signer.getInitCode();

    // Encode the call data for the smart account's execute function
    const callData = signer.encodeExecute(intent.to, intent.value ?? 0n, intent.data ?? "0x");

    // Get gas prices from the chain
    const { maxFeePerGas, maxPriorityFeePerGas } = await this.getGasPrices(client);

    // Use provided gas estimate or defaults
    const gas = gasEstimate ?? DEFAULT_GAS_LIMITS;

    // Apply safety multiplier to gas limits
    const verificationGasLimit = this.applyMultiplier(gas.verificationGasLimit);
    const callGasLimit = this.applyMultiplier(gas.callGasLimit);
    const preVerificationGas = this.applyMultiplier(gas.preVerificationGas);

    // Build paymaster data if provided
    const paymasterAndData = paymaster ? this.encodePaymasterData(paymaster) : ("0x" as Hex);

    return {
      sender,
      nonce,
      initCode: initCode as Hex,
      callData,
      verificationGasLimit,
      callGasLimit,
      preVerificationGas,
      maxPriorityFeePerGas,
      maxFeePerGas,
      paymasterAndData,
      signature: "0x" as Hex, // Will be filled after signing
    };
  }

  /**
   * Build a batch UserOperation from multiple transaction intents
   *
   * @param signer - The smart account signer
   * @param intents - Array of transaction intents to execute
   * @param client - The public client for chain interaction
   * @param gasEstimate - Optional gas estimates (uses defaults if not provided)
   * @param paymaster - Optional paymaster data for sponsored transactions
   * @returns A UserOperation ready for signing
   */
  async buildBatchUserOp(
    signer: SmartAccountSigner,
    intents: TransactionIntent[],
    client: PublicClient,
    gasEstimate?: GasEstimate,
    paymaster?: PaymasterData,
  ): Promise<UserOperation> {
    const sender = await signer.getAddress();
    const nonce = await this.getNonce(client, sender);
    const isDeployed = await signer.isDeployed();
    const initCode = isDeployed ? "0x" : await signer.getInitCode();

    // Encode batch call data
    const targets = intents.map(i => i.to);
    const values = intents.map(i => i.value ?? 0n);
    const datas = intents.map(i => (i.data ?? "0x") as Hex);
    const callData = signer.encodeExecuteBatch(targets, values, datas);

    // Get gas prices
    const { maxFeePerGas, maxPriorityFeePerGas } = await this.getGasPrices(client);

    // Use provided gas estimate or defaults (with higher limits for batch)
    const gas = gasEstimate ?? {
      verificationGasLimit: DEFAULT_GAS_LIMITS.verificationGasLimit,
      callGasLimit: DEFAULT_GAS_LIMITS.callGasLimit * BigInt(intents.length),
      preVerificationGas: DEFAULT_GAS_LIMITS.preVerificationGas,
    };

    const verificationGasLimit = this.applyMultiplier(gas.verificationGasLimit);
    const callGasLimit = this.applyMultiplier(gas.callGasLimit);
    const preVerificationGas = this.applyMultiplier(gas.preVerificationGas);

    const paymasterAndData = paymaster ? this.encodePaymasterData(paymaster) : ("0x" as Hex);

    return {
      sender,
      nonce,
      initCode: initCode as Hex,
      callData,
      verificationGasLimit,
      callGasLimit,
      preVerificationGas,
      maxPriorityFeePerGas,
      maxFeePerGas,
      paymasterAndData,
      signature: "0x" as Hex,
    };
  }

  /**
   * Pack a UserOperation for on-chain submission (v0.7 format)
   *
   * @param userOp - The UserOperation to pack
   * @returns The packed UserOperation for on-chain submission
   */
  packUserOp(userOp: UserOperation): PackedUserOperation {
    return {
      sender: userOp.sender,
      nonce: userOp.nonce,
      initCode: userOp.initCode,
      callData: userOp.callData,
      accountGasLimits: packAccountGasLimits(userOp.verificationGasLimit, userOp.callGasLimit),
      preVerificationGas: userOp.preVerificationGas,
      gasFees: packGasFees(userOp.maxPriorityFeePerGas, userOp.maxFeePerGas),
      paymasterAndData: userOp.paymasterAndData,
      signature: userOp.signature,
    };
  }

  /**
   * Compute the UserOperation hash for signing
   *
   * @param userOp - The UserOperation to hash
   * @param client - The public client for chain interaction
   * @param _ - The chain ID (reserved for future use)
   * @returns The UserOperation hash
   */
  async getUserOpHash(userOp: UserOperation, client: PublicClient, _: number): Promise<Hex> {
    const packed = this.packUserOp(userOp);

    // Convert to the tuple format expected by the ABI
    const userOpTuple = {
      sender: packed.sender,
      nonce: packed.nonce,
      initCode: packed.initCode,
      callData: packed.callData,
      accountGasLimits: packed.accountGasLimits as `0x${string}`,
      preVerificationGas: packed.preVerificationGas,
      gasFees: packed.gasFees as `0x${string}`,
      paymasterAndData: packed.paymasterAndData,
      signature: packed.signature,
    } as const;

    // Call EntryPoint's getUserOpHash
    const hash = await client.readContract({
      address: this.entryPoint,
      abi: ENTRYPOINT_V07_ABI,
      functionName: "getUserOpHash",
      args: [userOpTuple],
    });

    return hash as Hex;
  }

  /**
   * Sign a UserOperation
   *
   * @param userOp - The UserOperation to sign
   * @param signer - The smart account signer
   * @param client - The public client for chain interaction
   * @param chainId - The chain ID for the signature
   * @returns The UserOperation with signature attached
   */
  async signUserOp(
    userOp: UserOperation,
    signer: SmartAccountSigner,
    client: PublicClient,
    chainId: number,
  ): Promise<UserOperation> {
    const userOpHash = await this.getUserOpHash(userOp, client, chainId);
    const signature = await signer.signUserOpHash(userOpHash);

    return {
      ...userOp,
      signature,
    };
  }

  /**
   * Get the nonce for an account from EntryPoint
   *
   * @param client - The public client for chain interaction
   * @param sender - The smart account address
   * @returns The current nonce for the account
   */
  private async getNonce(client: PublicClient, sender: Address): Promise<bigint> {
    try {
      const nonce = await client.readContract({
        address: this.entryPoint,
        abi: ENTRYPOINT_V07_ABI,
        functionName: "getNonce",
        args: [sender, 0n], // Use key 0 for default nonce space
      });
      return nonce as bigint;
    } catch {
      // Account may not exist yet, return 0
      return 0n;
    }
  }

  /**
   * Get current gas prices from the chain
   *
   * @param client - The public client for chain interaction
   * @returns The current gas prices for EIP-1559 transactions
   */
  private async getGasPrices(
    client: PublicClient,
  ): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
    const block = await client.getBlock({ blockTag: "latest" });
    const baseFee = block.baseFeePerGas ?? 0n;

    // Use EIP-1559 pricing
    const maxPriorityFeePerGas = 1_500_000_000n; // 1.5 gwei default tip
    const maxFeePerGas = baseFee * 2n + maxPriorityFeePerGas;

    return { maxFeePerGas, maxPriorityFeePerGas };
  }

  /**
   * Apply gas multiplier for safety margin
   *
   * @param gas - The gas amount to multiply
   * @returns The gas amount with safety margin applied
   */
  private applyMultiplier(gas: bigint): bigint {
    return BigInt(Math.ceil(Number(gas) * this.gasMultiplier));
  }

  /**
   * Encode paymaster data for the UserOperation
   *
   * @param paymaster - The paymaster configuration
   * @returns The encoded paymaster data
   */
  private encodePaymasterData(paymaster: PaymasterData): Hex {
    // Pack: paymaster (20 bytes) + verification gas (16 bytes) + postOp gas (16 bytes) + data
    const paymasterAddress = paymaster.paymaster;
    const verificationGas = pad(toHex(paymaster.paymasterVerificationGasLimit), {
      size: 16,
    });
    const postOpGas = pad(toHex(paymaster.paymasterPostOpGasLimit), { size: 16 });

    return concat([paymasterAddress, verificationGas, postOpGas, paymaster.paymasterData]) as Hex;
  }
}

/**
 * Create a UserOpBuilder instance
 *
 * @param options - Optional configuration for the builder
 * @returns A new UserOpBuilder instance
 */
export function createUserOpBuilder(options?: UserOpBuilderOptions): UserOpBuilder {
  return new UserOpBuilder(options);
}
