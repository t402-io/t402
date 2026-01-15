/**
 * Safe Smart Account for ERC-4337
 *
 * Implements SmartAccountSigner using Safe's 4337 module.
 * Supports:
 * - Single-owner and multi-sig configurations
 * - Counterfactual address computation
 * - Safe 4337 module v0.3.0
 *
 * @see https://docs.safe.global/advanced/erc-4337
 */

import type { Address, Hex, PublicClient, WalletClient } from "viem";
import {
  encodeFunctionData,
  encodeAbiParameters,
  concat,
  keccak256,
  getContractAddress,
  hexToBytes,
} from "viem";
import type { SmartAccountSigner } from "../types.js";

/**
 * Safe 4337 module addresses (v0.3.0)
 * Deployed on all major EVM chains at the same addresses
 */
export const SAFE_4337_ADDRESSES = {
  /** Safe 4337 Module */
  module: "0xa581c4A4DB7175302464fF3C06380BC3270b4037" as Address,
  /** Safe Module Setup */
  moduleSetup: "0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47" as Address,
  /** Safe Singleton */
  singleton: "0x29fcB43b46531BcA003ddC8FCB67FFE91900C762" as Address,
  /** Safe Proxy Factory */
  proxyFactory: "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67" as Address,
  /** Safe Fallback Handler */
  fallbackHandler: "0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99" as Address,
  /** Add Modules Lib */
  addModulesLib: "0x8EcD4ec46D4D2a6B64fE960B3D64e8B94B2234eb" as Address,
} as const;

/**
 * Safe Proxy Factory ABI (essential functions)
 */
const PROXY_FACTORY_ABI = [
  {
    inputs: [
      { name: "singleton", type: "address" },
      { name: "initializer", type: "bytes" },
      { name: "saltNonce", type: "uint256" },
    ],
    name: "createProxyWithNonce",
    outputs: [{ name: "proxy", type: "address" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "singleton", type: "address" },
      { name: "initializer", type: "bytes" },
      { name: "saltNonce", type: "uint256" },
    ],
    name: "proxyCreationCode",
    outputs: [{ name: "", type: "bytes" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

/**
 * Safe Singleton ABI (essential functions)
 */
const SAFE_ABI = [
  {
    inputs: [
      { name: "owners", type: "address[]" },
      { name: "threshold", type: "uint256" },
      { name: "to", type: "address" },
      { name: "data", type: "bytes" },
      { name: "fallbackHandler", type: "address" },
      { name: "paymentToken", type: "address" },
      { name: "payment", type: "uint256" },
      { name: "paymentReceiver", type: "address" },
    ],
    name: "setup",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
      { name: "operation", type: "uint8" },
    ],
    name: "execTransactionFromModule",
    outputs: [{ name: "success", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

/**
 * Add Modules Lib ABI
 */
const ADD_MODULES_LIB_ABI = [
  {
    inputs: [{ name: "modules", type: "address[]" }],
    name: "enableModules",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

/**
 * Safe 4337 Module ABI
 */
const SAFE_4337_MODULE_ABI = [
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
      { name: "operation", type: "uint8" },
    ],
    name: "executeUserOp",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "tos", type: "address[]" },
      { name: "values", type: "uint256[]" },
      { name: "datas", type: "bytes[]" },
      { name: "operations", type: "uint8[]" },
    ],
    name: "executeUserOpBatch",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

/**
 * Safe smart account configuration
 */
export interface SafeSmartAccountConfig {
  /** Wallet client for signing */
  signer: WalletClient;
  /** Public client for reading chain state */
  publicClient: PublicClient;
  /** Chain ID */
  chainId: number;
  /** Owner addresses (for multi-sig, defaults to signer address) */
  owners?: Address[];
  /** Threshold for multi-sig (defaults to 1) */
  threshold?: number;
  /** Salt nonce for address generation */
  saltNonce?: bigint;
  /** Custom Safe addresses (optional) */
  addresses?: Partial<typeof SAFE_4337_ADDRESSES>;
}

/**
 * Safe smart account implementing SmartAccountSigner
 */
export class SafeSmartAccount implements SmartAccountSigner {
  private readonly signer: WalletClient;
  private readonly publicClient: PublicClient;
  private readonly owners: Address[];
  private readonly threshold: number;
  private readonly saltNonce: bigint;
  private readonly addresses: typeof SAFE_4337_ADDRESSES;

  private cachedAddress?: Address;
  private cachedInitCode?: Hex;
  private deploymentChecked = false;
  private isAccountDeployed = false;

  constructor(config: SafeSmartAccountConfig) {
    this.signer = config.signer;
    this.publicClient = config.publicClient;
    // Note: chainId from config is available for future use
    void config.chainId;
    this.threshold = config.threshold ?? 1;
    this.saltNonce = config.saltNonce ?? 0n;
    this.addresses = {
      ...SAFE_4337_ADDRESSES,
      ...config.addresses,
    };

    // Default to signer address if no owners provided
    if (config.owners && config.owners.length > 0) {
      this.owners = config.owners;
    } else if (config.signer.account?.address) {
      this.owners = [config.signer.account.address];
    } else {
      throw new Error("Either owners or signer with account must be provided");
    }

    if (this.threshold > this.owners.length) {
      throw new Error("Threshold cannot be greater than number of owners");
    }
  }

  /**
   * Get the smart account address (counterfactual)
   */
  async getAddress(): Promise<Address> {
    if (this.cachedAddress) {
      return this.cachedAddress;
    }

    const initCode = await this.getInitCode();

    // Extract initializer from init code
    const initializerData = `0x${initCode.slice(2 + 40 * 2)}` as Hex;

    // Compute counterfactual address
    const salt = keccak256(
      encodeAbiParameters(
        [{ type: "bytes32" }, { type: "uint256" }],
        [keccak256(initializerData), this.saltNonce],
      ),
    );

    // Get proxy creation code
    const proxyCreationCode = await this.publicClient.readContract({
      address: this.addresses.proxyFactory,
      abi: PROXY_FACTORY_ABI,
      functionName: "proxyCreationCode",
      args: [this.addresses.singleton, initializerData, this.saltNonce],
    }) as Hex;

    // Compute CREATE2 address
    this.cachedAddress = getContractAddress({
      bytecode: proxyCreationCode,
      from: this.addresses.proxyFactory,
      opcode: "CREATE2",
      salt,
    });

    return this.cachedAddress;
  }

  /**
   * Sign a UserOperation hash
   */
  async signUserOpHash(userOpHash: Hex): Promise<Hex> {
    if (!this.signer.account) {
      throw new Error("Signer account not available");
    }

    // Sign the hash with EIP-712 formatted signature for Safe
    const signature = await this.signer.signMessage({
      account: this.signer.account,
      message: { raw: hexToBytes(userOpHash) },
    });

    // Format signature for Safe (add signature type byte)
    // Type 0: EOA signature (most common)
    return concat([signature, "0x00"]) as Hex;
  }

  /**
   * Get the account's init code for deployment
   */
  async getInitCode(): Promise<Hex> {
    // Check if already deployed
    if (await this.isDeployed()) {
      return "0x" as Hex;
    }

    if (this.cachedInitCode) {
      return this.cachedInitCode;
    }

    // Build Safe setup data with 4337 module
    const setupModulesData = encodeFunctionData({
      abi: ADD_MODULES_LIB_ABI,
      functionName: "enableModules",
      args: [[this.addresses.module]],
    });

    const safeSetupData = encodeFunctionData({
      abi: SAFE_ABI,
      functionName: "setup",
      args: [
        this.owners,
        BigInt(this.threshold),
        this.addresses.addModulesLib, // to: AddModulesLib
        setupModulesData, // data: enableModules([module])
        this.addresses.fallbackHandler,
        "0x0000000000000000000000000000000000000000" as Address, // paymentToken
        0n, // payment
        "0x0000000000000000000000000000000000000000" as Address, // paymentReceiver
      ],
    });

    // Build factory call data
    const createProxyData = encodeFunctionData({
      abi: PROXY_FACTORY_ABI,
      functionName: "createProxyWithNonce",
      args: [this.addresses.singleton, safeSetupData, this.saltNonce],
    });

    // Init code = factory address + factory call data
    this.cachedInitCode = concat([
      this.addresses.proxyFactory,
      createProxyData,
    ]) as Hex;

    return this.cachedInitCode;
  }

  /**
   * Check if the account is deployed
   */
  async isDeployed(): Promise<boolean> {
    if (this.deploymentChecked) {
      return this.isAccountDeployed;
    }

    const address = this.cachedAddress ?? await this.getAddress();
    const code = await this.publicClient.getCode({ address });

    this.deploymentChecked = true;
    this.isAccountDeployed = code !== undefined && code !== "0x";

    return this.isAccountDeployed;
  }

  /**
   * Encode a call to the account's execute function
   */
  encodeExecute(target: Address, value: bigint, data: Hex): Hex {
    return encodeFunctionData({
      abi: SAFE_4337_MODULE_ABI,
      functionName: "executeUserOp",
      args: [
        target,
        value,
        data,
        0, // operation: CALL
      ],
    });
  }

  /**
   * Encode a batch call to the account's executeBatch function
   */
  encodeExecuteBatch(
    targets: Address[],
    values: bigint[],
    datas: Hex[],
  ): Hex {
    if (targets.length !== values.length || targets.length !== datas.length) {
      throw new Error("Array lengths must match");
    }

    const operations = targets.map(() => 0); // All CALL operations

    return encodeFunctionData({
      abi: SAFE_4337_MODULE_ABI,
      functionName: "executeUserOpBatch",
      args: [targets, values, datas, operations],
    });
  }

  /**
   * Get the counterfactual address without caching
   */
  async getCounterfactualAddress(): Promise<Address> {
    return this.getAddress();
  }

  /**
   * Get the account's nonce from EntryPoint
   */
  async getNonce(entryPoint: Address, key = 0n): Promise<bigint> {
    const address = await this.getAddress();

    const nonce = await this.publicClient.readContract({
      address: entryPoint,
      abi: [
        {
          inputs: [
            { name: "sender", type: "address" },
            { name: "key", type: "uint192" },
          ],
          name: "getNonce",
          outputs: [{ name: "nonce", type: "uint256" }],
          stateMutability: "view",
          type: "function",
        },
      ],
      functionName: "getNonce",
      args: [address, key],
    });

    return nonce as bigint;
  }

  /**
   * Get the Safe's owners
   */
  getOwners(): Address[] {
    return [...this.owners];
  }

  /**
   * Get the Safe's threshold
   */
  getThreshold(): number {
    return this.threshold;
  }

  /**
   * Clear cached values (useful after deployment)
   */
  clearCache(): void {
    this.cachedAddress = undefined;
    this.cachedInitCode = undefined;
    this.deploymentChecked = false;
    this.isAccountDeployed = false;
  }
}

/**
 * Create a Safe smart account
 */
export function createSafeSmartAccount(
  config: SafeSmartAccountConfig,
): SafeSmartAccount {
  return new SafeSmartAccount(config);
}
