"use client";

import { useAccount, useReadContract } from "wagmi";
import { useChainContext } from "@/providers/ChainProvider";
import { formatUnits } from "viem";

/** Minimal ERC-20 ABI — only balanceOf */
const erc20BalanceOfAbi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/** Threshold in smallest units below which we show "Insufficient" (0.001 with 6 decimals = 1000) */
const INSUFFICIENT_THRESHOLD = BigInt(1000);

function EvmTokenBalance() {
  const { activeConfig } = useChainContext();
  const { address, isConnected } = useAccount();

  const chainId = parseInt(activeConfig.network.split(":")[1]);

  const { data: balance, isLoading, isError } = useReadContract({
    address: activeConfig.asset as `0x${string}`,
    abi: erc20BalanceOfAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId,
    query: {
      enabled: isConnected && !!address,
      refetchInterval: 15_000,
    },
  });

  if (!isConnected || !address) {
    return <span className="text-[10px]" style={{ color: "var(--color-muted)" }}>Connect wallet</span>;
  }

  if (isLoading) {
    return <span className="text-[10px]" style={{ color: "var(--color-muted)" }}>...</span>;
  }

  if (isError || balance === undefined) {
    return <span className="text-[10px]" style={{ color: "var(--color-muted)" }}>--</span>;
  }

  const formatted = formatUnits(balance, activeConfig.decimals);
  // Show up to 4 decimal places, strip trailing zeros
  const display = parseFloat(formatted).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });

  const isInsufficient = balance < INSUFFICIENT_THRESHOLD;

  return (
    <span
      className="text-[10px] font-medium"
      style={{ color: isInsufficient ? "#EF4444" : "var(--color-muted)" }}
    >
      {isInsufficient ? "Insufficient: " : ""}
      {display} {activeConfig.tokenSymbol}
    </span>
  );
}

export function TokenBalance() {
  const { activeFamily } = useChainContext();

  if (activeFamily === "evm") {
    return <EvmTokenBalance />;
  }

  // Non-EVM chains: no easy balance read
  return (
    <span className="text-[10px]" style={{ color: "var(--color-muted)" }}>
      Connect wallet
    </span>
  );
}
