"use client";

import { useChainContext } from "@/providers/ChainProvider";
import { useDemoContext } from "@/providers/DemoProvider";
import { useWalletReady } from "@/providers/ClientProviders";
import { useMultiChainPayment } from "@/hooks/useMultiChainPayment";
import { useAccount, useSwitchChain } from "wagmi";
import { Check, X, AlertCircle } from "lucide-react";
import { getConfigByNetwork } from "@/lib/chain-registry";

function ChecklistInner() {
  const { activeConfig, activeFamily } = useChainContext();
  const { isConnected } = useMultiChainPayment();
  const evmAccount = useAccount();
  const { switchChain } = useSwitchChain();

  // Check if wallet is on the correct chain (EVM only)
  const requiredChainId = activeFamily === "evm" ? parseInt(activeConfig.network.split(":")[1]) : null;
  const walletChainId = evmAccount.chain?.id ?? null;
  const wrongChain = activeFamily === "evm" && isConnected && requiredChainId && walletChainId && walletChainId !== requiredChainId;

  const isLegacy = activeFamily === "evm" && activeConfig.scheme === "exact-legacy";

  const checks = [
    {
      label: `Chain: ${activeConfig.name} (${activeConfig.tokenSymbol})`,
      ok: true,
      help: isLegacy ? "Legacy token — requires approve + sign (2 steps)" : undefined,
    },
    {
      label: isConnected ? "Wallet connected" : "Wallet not connected",
      ok: isConnected,
      help: !isConnected ? "Click Connect Wallet in the header" : undefined,
    },
    ...(wrongChain
      ? [
          {
            label: `Wrong network: wallet on ${evmAccount.chain?.name || `Chain ${walletChainId}`}`,
            ok: false,
            help: `Need ${activeConfig.name}`,
            action: async () => {
              try {
                switchChain?.({ chainId: requiredChainId! });
              } catch {
                // If switch fails, try adding the chain
                const provider = (window as any).ethereum;
                if (provider?.request) {
                  const cfg = getConfigByNetwork(activeConfig.network);
                  try {
                    await provider.request({
                      method: "wallet_addEthereumChain",
                      params: [{
                        chainId: `0x${requiredChainId!.toString(16)}`,
                        chainName: cfg?.name || activeConfig.name,
                        rpcUrls: [`https://${activeConfig.name.toLowerCase().replace(/\s/g, "-")}-rpc.publicnode.com`],
                        nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
                      }],
                    });
                  } catch { /* user rejected */ }
                }
              }
            },
            actionLabel: `Switch to ${activeConfig.name}`,
          },
        ]
      : []),
  ];

  const allReady = checks.every((c) => c.ok);
  if (allReady) return null;

  return (
    <div
      className="rounded-xl p-4 mb-6 text-xs"
      style={{
        background: "var(--color-warning-dim)",
        border: "1px solid var(--color-warning)",
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <AlertCircle size={14} style={{ color: "var(--color-warning)" }} />
        <span className="font-semibold" style={{ color: "var(--color-warning)" }}>
          Before you can pay
        </span>
      </div>
      <div className="space-y-1.5">
        {checks.map((check, i) => (
          <div key={i} className="flex items-center gap-2">
            {check.ok ? (
              <Check size={12} style={{ color: "var(--color-success)" }} />
            ) : (
              <X size={12} style={{ color: "var(--color-error)" }} />
            )}
            <span style={{ color: check.ok ? "var(--color-success)" : "var(--color-error)" }}>
              {check.label}
            </span>
            {check.help && (
              <span style={{ color: "var(--color-muted)" }}> — {check.help}</span>
            )}
            {"action" in check && check.action && (
              <button
                onClick={check.action}
                className="px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer hover:opacity-80"
                style={{ background: "var(--color-brand)", color: "white" }}
              >
                {check.actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PaymentChecklist() {
  const { isDemo } = useDemoContext();
  const walletReady = useWalletReady();

  // In demo mode or before wallet providers mount, don't show
  if (isDemo || !walletReady) return null;

  return <ChecklistInner />;
}
