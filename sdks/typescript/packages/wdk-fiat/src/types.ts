/**
 * Fiat On/Off-Ramp Types
 *
 * Protocol-agnostic abstractions for fiat ↔ crypto conversion.
 * Implementations can target MoonPay, Transak, Ramp, etc.
 */

export type FiatOperation = "buy" | "sell";

export interface FiatQuote {
  protocol: string;
  cryptoAsset: string;
  fiatCurrency: string;
  cryptoAmount: string;
  fiatAmount: string;
  fee: string;
  rate: string;
}

export interface FiatResult {
  success: boolean;
  protocol: string;
  transactionId: string;
  status: "pending" | "completed" | "failed";
  redirectUrl?: string;
}

export interface SupportedAsset {
  symbol: string;
  name: string;
  chains: string[];
}

export interface SupportedCurrency {
  code: string;
  name: string;
  symbol: string;
}

export interface FiatConfig {
  protocol: string;
  apiKey: string;
  environment?: "sandbox" | "production";
  /** Referral/affiliate code for revenue sharing with the fiat provider */
  referralCode?: string;
}

/**
 * Fiat provider interface — implement for each payment processor.
 */
export interface FiatProvider {
  readonly name: string;

  quoteBuy(chain: string, cryptoAsset: string, fiatCurrency: string, amount: string): Promise<FiatQuote>;
  buy(chain: string, cryptoAsset: string, fiatCurrency: string, amount: string): Promise<FiatResult>;

  quoteSell(chain: string, cryptoAsset: string, fiatCurrency: string, amount: string): Promise<FiatQuote>;
  sell(chain: string, cryptoAsset: string, fiatCurrency: string, amount: string): Promise<FiatResult>;

  getSupportedAssets(chain: string): Promise<SupportedAsset[]>;
  getSupportedCurrencies(chain: string): Promise<SupportedCurrency[]>;

  getTransactionStatus(transactionId: string): Promise<FiatResult>;
}
