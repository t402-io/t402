/**
 * Spark (Bitcoin L2) payment types.
 */

export const SCHEME_EXACT = "exact";
export const NETWORK_MAINNET = "spark:mainnet";
export const NETWORK_TESTNET = "spark:testnet";
export const PAYMENT_TYPE_SPARK = "spark";
export const PAYMENT_TYPE_LIGHTNING = "lightning";

export interface SparkPayload {
  paymentType: "spark" | "lightning";
  transferId?: string;
  preimage?: string;
  paymentHash?: string;
}

export interface TransferInfo {
  id: string;
  amount: number; // satoshis
  sender: string;
  receiver: string;
  status: TransferStatus;
}

export enum TransferStatus {
  Pending = 0,
  Completed = 5,
  Failed = 9,
}

export interface SparkSigner {
  getTransfer(transferId: string): Promise<TransferInfo>;
  getAddress(): string;
}
