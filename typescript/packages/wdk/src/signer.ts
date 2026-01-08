/**
 * WDK Signer implementation for T402 payments
 *
 * This signer wraps the Tether WDK account to provide a T402-compatible
 * signing interface for EVM chains.
 */

import type { Address } from "viem";
import type { ClientEvmSigner } from "@t402/evm";
import type { WDKAccount, WDKInstance, TypedDataDomain, TypedDataTypes } from "./types.js";
import { getChainId } from "./chains.js";

/**
 * WDK Signer for T402 EVM payments
 *
 * Implements the ClientEvmSigner interface from @t402/evm,
 * wrapping a Tether WDK account for signing operations.
 *
 * @example
 * ```typescript
 * import { T402WDK } from '@t402/wdk';
 *
 * const wdk = new T402WDK(seedPhrase, { arbitrum: 'https://arb1.arbitrum.io/rpc' });
 * const signer = await wdk.getSigner('arbitrum');
 *
 * // Use with T402 client
 * const client = createT402HTTPClient({
 *   signers: [{ scheme: 'exact', signer }]
 * });
 * ```
 */
export class WDKSigner implements ClientEvmSigner {
  private _wdk: WDKInstance;
  private _chain: string;
  private _accountIndex: number;
  private _account: WDKAccount | null = null;
  private _address: Address | null = null;

  /**
   * Create a new WDK signer
   *
   * @param wdk - The WDK instance
   * @param chain - Chain name (e.g., "arbitrum", "ethereum")
   * @param accountIndex - HD wallet account index (default: 0)
   */
  constructor(wdk: WDKInstance, chain: string, accountIndex = 0) {
    this._wdk = wdk;
    this._chain = chain;
    this._accountIndex = accountIndex;
  }

  /**
   * Get the wallet address
   * Lazily initializes the account if not already done
   */
  get address(): Address {
    if (!this._address) {
      throw new Error(
        "Signer not initialized. Call initialize() first or use createWDKSigner() async factory.",
      );
    }
    return this._address;
  }

  /**
   * Initialize the signer by fetching the account
   * Must be called before using the signer
   */
  async initialize(): Promise<void> {
    if (this._account) return;

    this._account = await this._wdk.getAccount(this._chain, this._accountIndex);
    const addressString = await this._account.getAddress();
    this._address = addressString as Address;
  }

  /**
   * Get the underlying WDK account
   * Initializes if not already done
   */
  private async getAccount(): Promise<WDKAccount> {
    if (!this._account) {
      await this.initialize();
    }
    return this._account!;
  }

  /**
   * Sign EIP-712 typed data for T402 payments
   *
   * This is the primary signing method used by T402 for EIP-3009
   * transferWithAuthorization payments.
   */
  async signTypedData(message: {
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    primaryType: string;
    message: Record<string, unknown>;
  }): Promise<`0x${string}`> {
    const account = await this.getAccount();

    const signature = await account.signTypedData({
      domain: message.domain,
      types: message.types,
      primaryType: message.primaryType,
      message: message.message,
    });

    return signature as `0x${string}`;
  }

  /**
   * Sign a personal message
   */
  async signMessage(message: string | Uint8Array): Promise<`0x${string}`> {
    const account = await this.getAccount();

    const messageStr = typeof message === "string" ? message : Buffer.from(message).toString("utf-8");

    const signature = await account.signMessage(messageStr);
    return signature as `0x${string}`;
  }

  /**
   * Get the chain name
   */
  getChain(): string {
    return this._chain;
  }

  /**
   * Get the chain ID
   */
  getChainId(): number {
    return getChainId(this._chain);
  }

  /**
   * Get the account index
   */
  getAccountIndex(): number {
    return this._accountIndex;
  }

  /**
   * Get native token balance (ETH, etc.)
   */
  async getBalance(): Promise<bigint> {
    const account = await this.getAccount();
    return account.getBalance();
  }

  /**
   * Get ERC20 token balance
   */
  async getTokenBalance(tokenAddress: Address): Promise<bigint> {
    const account = await this.getAccount();
    return account.getTokenBalance(tokenAddress);
  }

  /**
   * Estimate gas for a transaction
   */
  async estimateGas(params: { to: Address; value?: bigint; data?: string }): Promise<bigint> {
    const account = await this.getAccount();
    return account.estimateGas({
      to: params.to,
      value: params.value,
      data: params.data,
    });
  }

  /**
   * Send a transaction (for advanced use cases)
   */
  async sendTransaction(params: {
    to: Address;
    value?: bigint;
    data?: string;
  }): Promise<{ hash: `0x${string}` }> {
    const account = await this.getAccount();

    const hash = await account.sendTransaction({
      to: params.to,
      value: params.value,
      data: params.data,
    });

    return { hash: hash as `0x${string}` };
  }
}

/**
 * Create an initialized WDK signer
 *
 * This async factory function creates and initializes a WDK signer,
 * ensuring the address is available immediately.
 *
 * @example
 * ```typescript
 * const signer = await createWDKSigner(wdkInstance, 'arbitrum');
 * console.log('Address:', signer.address); // Works immediately
 * ```
 */
export async function createWDKSigner(
  wdk: WDKInstance,
  chain: string,
  accountIndex = 0,
): Promise<WDKSigner> {
  const signer = new WDKSigner(wdk, chain, accountIndex);
  await signer.initialize();
  return signer;
}

/**
 * Mock WDK signer for testing purposes
 *
 * Implements the same interface but uses a fixed private key
 * for deterministic testing.
 */
export class MockWDKSigner implements ClientEvmSigner {
  readonly address: Address;
  private _privateKey: `0x${string}`;

  constructor(address: Address, privateKey: `0x${string}`) {
    this.address = address;
    this._privateKey = privateKey;
  }

  async signTypedData(_message: {
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    primaryType: string;
    message: Record<string, unknown>;
  }): Promise<`0x${string}`> {
    // Mock signature - in real tests, use viem's signTypedData
    return "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
  }

  async signMessage(_message: string | Uint8Array): Promise<`0x${string}`> {
    return "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
  }
}
