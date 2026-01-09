/**
 * WDK Smart Account
 *
 * Wraps a Tether WDK account to work with ERC-4337 smart accounts.
 * Creates a Safe smart account with the WDK account as the owner/signer.
 */

import type { Address, Hex, PublicClient } from "viem";
import {
  encodeFunctionData,
  encodeAbiParameters,
  concat,
  keccak256,
  getContractAddress,
  hexToBytes,
  createWalletClient,
  http,
  custom,
} from "viem";
import type { SmartAccountSigner } from "@t402/evm";
import type { WdkAccount, WdkSmartAccountConfig } from "./types.js";

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
 * WDK Smart Account
 *
 * Creates a Safe smart account using a WDK account as the owner/signer.
 * Implements SmartAccountSigner for ERC-4337 compatibility.
 */
export class WdkSmartAccount implements SmartAccountSigner {
  private readonly wdkAccount: WdkAccount;
  private readonly publicClient: PublicClient;
  private readonly chainId: number;
  private readonly owners: Address[];
  private readonly threshold: number;
  private readonly saltNonce: bigint;

  private cachedAddress?: Address;
  private cachedInitCode?: Hex;
  private cachedOwnerAddress?: Address;
  private deploymentChecked = false;
  private isAccountDeployed = false;

  constructor(config: WdkSmartAccountConfig) {
    this.wdkAccount = config.wdkAccount;
    this.publicClient = config.publicClient;
    this.chainId = config.chainId;
    this.threshold = config.threshold ?? 1;
    this.saltNonce = config.saltNonce ?? 0n;

    // Owners will be set when we get the WDK account address
    this.owners = config.additionalOwners ?? [];
  }

  /**
   * Initialize the account (fetch WDK address)
   * Call this before using the account
   */
  async initialize(): Promise<void> {
    if (!this.cachedOwnerAddress) {
      const address = await this.wdkAccount.getAddress();
      this.cachedOwnerAddress = address as Address;

      // Add WDK account as the first owner if not already in owners
      if (!this.owners.includes(this.cachedOwnerAddress)) {
        this.owners.unshift(this.cachedOwnerAddress);
      }
    }
  }

  /**
   * Get the WDK account's EOA address
   */
  async getOwnerAddress(): Promise<Address> {
    await this.initialize();
    return this.cachedOwnerAddress!;
  }

  /**
   * Get the smart account address (counterfactual)
   */
  async getAddress(): Promise<Address> {
    await this.initialize();

    if (this.cachedAddress) {
      return this.cachedAddress;
    }

    const initCode = await this.getInitCode();

    // If already deployed, get address from code
    if (initCode === "0x") {
      // Need to compute it anyway for first time
      const initializerData = await this.buildInitializer();
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
    } else {
      // Extract initializer from init code
      const initializerData = `0x${initCode.slice(2 + 40 * 2)}` as Hex;

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
    }

    return this.cachedAddress;
  }

  /**
   * Sign a UserOperation hash using the WDK account
   */
  async signUserOpHash(userOpHash: Hex): Promise<Hex> {
    await this.initialize();

    // Sign the hash using WDK account's signMessage
    // The hash is signed as raw bytes (personal_sign format)
    const signature = await this.wdkAccount.signMessage(userOpHash);

    // Format signature for Safe (add signature type byte)
    // Type 0: EOA signature
    return concat([signature as Hex, "0x00"]) as Hex;
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

    const safeSetupData = await this.buildInitializer();

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
  private async buildInitializer(): Promise<Hex> {
    await this.initialize();

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
 * Create a WDK smart account
 */
export async function createWdkSmartAccount(
  config: WdkSmartAccountConfig,
): Promise<WdkSmartAccount> {
  const account = new WdkSmartAccount(config);
  await account.initialize();
  return account;
}
