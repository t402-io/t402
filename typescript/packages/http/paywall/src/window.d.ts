import type { PaymentRequired } from "@t402/core/types";

declare global {
  interface Window {
    t402: {
      amount?: number;
      testnet?: boolean;
      paymentRequired: PaymentRequired;
      currentUrl: string;
      appName?: string;
      appLogo?: string;
      config: {
        chainConfig: Record<
          string,
          {
            usdcAddress: string;
            usdcName: string;
          }
        >;
      };
    };
  }
}
