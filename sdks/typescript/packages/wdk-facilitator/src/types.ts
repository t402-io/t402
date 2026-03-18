/**
 * Types for the WDK-to-Facilitator adapter.
 *
 * Bridges WDK wallet accounts to t402 FacilitatorSigner interfaces,
 * enabling any WDK wallet to act as a self-custodial facilitator.
 */

/**
 * Minimal WDK wallet account interface.
 * Compatible with @tetherto/wdk-wallet-evm WalletAccountEvm.
 */
export interface WdkWalletAccount {
  /** Wallet address */
  address: string;

  /** Sign EIP-712 typed data */
  signTypedData(params: {
    domain: Record<string, unknown>;
    types: Record<string, Array<{ name: string; type: string }>>;
    primaryType: string;
    message: Record<string, unknown>;
  }): Promise<string>;

  /** Read from a smart contract */
  readContract(params: {
    address: string;
    abi: readonly unknown[];
    functionName: string;
    args?: unknown[];
  }): Promise<unknown>;

  /** Write to a smart contract */
  writeContract(params: {
    address: string;
    abi: readonly unknown[];
    functionName: string;
    args?: unknown[];
  }): Promise<string>;

  /** Get transaction receipt */
  waitForTransactionReceipt(txHash: string): Promise<{
    status: "success" | "reverted";
    blockNumber: bigint;
    transactionHash: string;
  }>;

  /** Get bytecode at address */
  getCode?(address: string): Promise<string>;

  /** Get ERC-20 token balance */
  getTokenBalance?(tokenAddress: string): Promise<bigint>;
}

/**
 * t402 FacilitatorEvmSigner interface (from @t402/evm-core).
 */
export interface FacilitatorEvmSigner {
  getAddresses(): string[];

  readContract(
    address: string,
    abi: readonly unknown[],
    functionName: string,
    ...args: unknown[]
  ): Promise<unknown>;

  writeContract(
    address: string,
    abi: readonly unknown[],
    functionName: string,
    ...args: unknown[]
  ): Promise<string>;

  verifyTypedData(
    address: string,
    domain: Record<string, unknown>,
    types: Record<string, Array<{ name: string; type: string }>>,
    primaryType: string,
    message: Record<string, unknown>,
    signature: string,
  ): Promise<boolean>;

  sendTransaction(to: string, data: Uint8Array): Promise<string>;

  waitForTransactionReceipt(txHash: string): Promise<{
    status: number;
    blockNumber: number;
    transactionHash: string;
  }>;

  getBalance(address: string, tokenAddress: string): Promise<bigint>;
  getChainID(): Promise<bigint>;
  getCode(address: string): Promise<Uint8Array>;
}
