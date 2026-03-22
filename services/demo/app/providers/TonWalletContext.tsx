"use client";

import { type ReactNode } from "react";
import { useTonConnectUI, useTonAddress } from "@tonconnect/ui-react";
import { TonWalletContext as TonCtx } from "@/hooks/useTonPayment";

/**
 * Inner component that reads from @tonconnect/ui-react hooks
 * and provides values via our custom TonWalletContext.
 * Loaded lazily by TonConnectProvider.
 */
export default function TonWalletContextProvider({ children }: { children: ReactNode }) {
  const [tonConnectUI] = useTonConnectUI();
  const rawAddress = useTonAddress(false);
  const friendlyAddress = useTonAddress(true);

  return (
    <TonCtx.Provider
      value={{
        tonConnectUI,
        rawAddress: rawAddress || null,
        friendlyAddress: friendlyAddress || null,
      }}
    >
      {children}
    </TonCtx.Provider>
  );
}
