/**
 * WDK Multi-sig Smart Account
 *
 * Creates a Safe smart account with multiple WDK signers as owners.
 * Supports M-of-N threshold signatures for ERC-4337.
 */

import type { Address, Hex, PublicClient } from "viem";
import {
  encodeFunctionData,
  encodeAbiParameters,
  concat,
  keccak256,
  getContractAddress,
} from "viem";
import type { WDKSigner } from "@t402/wdk";
import type { MultiSigSmartAccountSigner, MultiSigWDKConfig } from "./types.js";
import { SAFE_4337_ADDRESSES, DEFAULTS } from "./constants.js";
import { MultiSigError } from "./errors.js";
import {
  combineSignatures,
  formatSignatureForSafe,
  sortAddresses,
  isValidThreshold,
  areAddressesUnique,
} from "./utils.js";

/**
 * Safe Proxy Factory ABI
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
 * Safe Singleton ABI
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
 * Multi-sig WDK Smart Account
 *
 * Creates a Safe smart account using multiple WDK accounts as owners.
 * Implements MultiSigSmartAccountSigner for ERC-4337 compatibility.
 */
export class MultiSigWdkSmartAccount implements MultiSigSmartAccountSigner {
  private readonly wdkSigners: WDKSigner[];
  private readonly publicClient: PublicClient;
  private readonly chainId: number;
  private readonly threshold: number;
  private readonly saltNonce: bigint;

  private owners: Address[] = [];
  private cachedAddress?: Address;
  private cachedInitCode?: Hex;
  private deploymentChecked = false;
  private isAccountDeployed = false;
  private initialized = false;

  constructor(config: MultiSigWDKConfig) {
    // Validate owner count
    if (config.owners.length === 0) {
      throw MultiSigError.insufficientSigners(1, 0);
    }

    if (config.owners.length > DEFAULTS.MAX_OWNERS) {
      throw new MultiSigError(
        "MULTISIG_INVALID_THRESHOLD" as any,
        `Too many owners: ${config.owners.length} exceeds max ${DEFAULTS.MAX_OWNERS}`,
        { ownerCount: config.owners.length, maxOwners: DEFAULTS.MAX_OWNERS },
      );
    }

    // Validate threshold
    if (!isValidThreshold(config.threshold, config.owners.length)) {
      throw MultiSigError.invalidThreshold(config.threshold, config.owners.length);
    }

    this.wdkSigners = config.owners;
    this.publicClient = config.publicClient;
    this.chainId = config.chainId;
    this.threshold = config.threshold;
    this.saltNonce = config.saltNonce ?? DEFAULTS.SALT_NONCE;
  }

  /**
   * Initialize the account by fetching all owner addresses
   * Must be called before using the account
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Get addresses from all WDK signers
    const addressPromises = this.wdkSigners.map(async (signer) => {
      if (!signer.isInitialized) {
        await signer.initialize();
      }
      return signer.address;
    });

    const addresses = await Promise.all(addressPromises);

    // Validate all addresses are unique
    if (!areAddressesUnique(addresses)) {
      throw new MultiSigError(
        "MULTISIG_INVALID_THRESHOLD" as any,
        "Duplicate owner addresses detected",
        { addresses },
      );
    }

    // Sort owners for consistent Safe initialization
    this.owners = sortAddresses(addresses);
    this.initialized = true;
  }

  /**
   * Check if initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw MultiSigError.notInitialized();
    }
  }

  /**
   * Get the smart account address (counterfactual)
   */
  async getAddress(): Promise<Address> {
    await this.initialize();

    if (this.cachedAddress) {
      return this.cachedAddress;
    }

    const initializerData = this.buildInitializer();

    const salt = keccak256(
      encodeAbiParameters(
        [{ type: "bytes32" }, { type: "uint256" }],
        [keccak256(initializerData), this.saltNonce],
      ),
    );

    const proxyCreationCode = (await this.publicClient.readContract({
      address: SAFE_4337_ADDRESSES.proxyFactory,
      abi: PROXY_FACTORY_ABI,
      functionName: "proxyCreationCode",
      args: [SAFE_4337_ADDRESSES.singleton, initializerData, this.saltNonce],
    })) as Hex;

    this.cachedAddress = getContractAddress({
      bytecode: proxyCreationCode,
      from: SAFE_4337_ADDRESSES.proxyFactory,
      opcode: "CREATE2",
      salt,
    });

    return this.cachedAddress;
  }

  /**
   * Sign a UserOperation hash with the first available signer
   * For multi-sig, use signWithOwner() or collect signatures manually
   */
  async signUserOpHash(userOpHash: Hex): Promise<Hex> {
    await this.initialize();

    // Sign with first signer only (basic mode)
    // For full multi-sig, use signWithOwner() and combineSignatures()
    const firstSigner = this.wdkSigners[0];
    if (!firstSigner) {
      throw MultiSigError.insufficientSigners(1, 0);
    }
    const signature = await firstSigner.signMessage(userOpHash);
    return formatSignatureForSafe(signature as Hex);
  }

  /**
   * Sign a UserOperation hash with a specific owner
   *
   * @param userOpHash - Hash to sign
   * @param ownerIndex - Index of the owner in the sorted owner list
   * @returns Signature formatted for Safe
   */
  async signWithOwner(userOpHash: Hex, ownerIndex: number): Promise<Hex> {
    await this.initialize();

    const ownerAddress = this.owners[ownerIndex];
    if (!ownerAddress) {
      throw MultiSigError.ownerNotFound(ownerIndex);
    }

    // Find the signer that matches this owner index
    const signer = this.wdkSigners.find(
      (s) => s.address.toLowerCase() === ownerAddress.toLowerCase(),
    );

    if (!signer) {
      throw MultiSigError.ownerNotFound(ownerIndex);
    }

    const signature = await signer.signMessage(userOpHash);
    return formatSignatureForSafe(signature as Hex);
  }

  /**
   * Combine multiple signatures into Safe's expected format
   *
   * @param signatures - Map of owner index to signature
   * @returns Combined signature
   */
  combineSignatures(signatures: Map<number, Hex>): Hex {
    this.ensureInitialized();
    return combineSignatures(signatures, this.owners);
  }

  /**
   * Check if enough signatures have been collected
   *
   * @param signatures - Map of owner index to signature
   * @returns True if threshold is met
   */
  hasEnoughSignatures(signatures: Map<number, Hex>): boolean {
    return signatures.size >= this.threshold;
  }

  /**
   * Get the account's init code for deployment
   */
  async getInitCode(): Promise<Hex> {
    await this.initialize();

    // Check if already deployed
    if (await this.isDeployed()) {
      return "0x" as Hex;
    }

    if (this.cachedInitCode) {
      return this.cachedInitCode;
    }

    const safeSetupData = this.buildInitializer();

    // Build factory call data
    const createProxyData = encodeFunctionData({
      abi: PROXY_FACTORY_ABI,
      functionName: "createProxyWithNonce",
      args: [SAFE_4337_ADDRESSES.singleton, safeSetupData, this.saltNonce],
    });

    // Init code = factory address + factory call data
    this.cachedInitCode = concat([
      SAFE_4337_ADDRESSES.proxyFactory,
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

    await this.initialize();
    const address = this.cachedAddress ?? (await this.getAddress());
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
      args: [target, value, data, 0], // operation: CALL
    });
  }

  /**
   * Encode a batch call to the account's executeBatch function
   */
  encodeExecuteBatch(targets: Address[], values: bigint[], datas: Hex[]): Hex {
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
   * Build the Safe setup initializer data
   */
  private buildInitializer(): Hex {
    this.ensureInitialized();

    // Build Safe setup data with 4337 module
    const setupModulesData = encodeFunctionData({
      abi: ADD_MODULES_LIB_ABI,
      functionName: "enableModules",
      args: [[SAFE_4337_ADDRESSES.module]],
    });

    return encodeFunctionData({
      abi: SAFE_ABI,
      functionName: "setup",
      args: [
        this.owners,
        BigInt(this.threshold),
        SAFE_4337_ADDRESSES.addModulesLib, // to: AddModulesLib
        setupModulesData, // data: enableModules([module])
        SAFE_4337_ADDRESSES.fallbackHandler,
        "0x0000000000000000000000000000000000000000" as Address, // paymentToken
        0n, // payment
        "0x0000000000000000000000000000000000000000" as Address, // paymentReceiver
      ],
    });
  }

  /**
   * Get all owner addresses (sorted)
   */
  getOwners(): Address[] {
    this.ensureInitialized();
    return [...this.owners];
  }

  /**
   * Get the threshold
   */
  getThreshold(): number {
    return this.threshold;
  }

  /**
   * Get all WDK signers
   */
  getSigners(): WDKSigner[] {
    return [...this.wdkSigners];
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
 * Create and initialize a multi-sig WDK smart account
 */
export async function createMultiSigWdkSmartAccount(
  config: MultiSigWDKConfig,
): Promise<MultiSigWdkSmartAccount> {
  const account = new MultiSigWdkSmartAccount(config);
  await account.initialize();
  return account;
}
