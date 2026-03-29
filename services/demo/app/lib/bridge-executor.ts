/**
 * Real cross-chain bridge executor for USDT0 via LayerZero OFT
 *
 * Uses a self-contained CHAIN_REGISTRY (22 chains) and calls OFT contracts
 * directly via viem — no dependency on SDK address constants.
 *
 * Requires BRIDGE_WALLET_PRIVATE_KEY env var (uses Facilitator wallet).
 * Falls back to null (caller uses simulation) if not configured.
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  type Address,
  pad,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

// ---------------------------------------------------------------------------
// ABI fragments — only what we need
// ---------------------------------------------------------------------------

const OFT_SEND_ABI = [
  {
    inputs: [
      {
        components: [
          { name: "dstEid", type: "uint32" },
          { name: "to", type: "bytes32" },
          { name: "amountLD", type: "uint256" },
          { name: "minAmountLD", type: "uint256" },
          { name: "extraOptions", type: "bytes" },
          { name: "composeMsg", type: "bytes" },
          { name: "oftCmd", type: "bytes" },
        ],
        name: "_sendParam",
        type: "tuple",
      },
      {
        components: [
          { name: "nativeFee", type: "uint256" },
          { name: "lzTokenFee", type: "uint256" },
        ],
        name: "_fee",
        type: "tuple",
      },
      { name: "_refundAddress", type: "address" },
    ],
    name: "send",
    outputs: [
      {
        components: [
          { name: "guid", type: "bytes32" },
          { name: "nonce", type: "uint64" },
          {
            components: [
              { name: "nativeFee", type: "uint256" },
              { name: "lzTokenFee", type: "uint256" },
            ],
            name: "fee",
            type: "tuple",
          },
        ],
        name: "msgReceipt",
        type: "tuple",
      },
      {
        components: [
          { name: "amountSentLD", type: "uint256" },
          { name: "amountReceivedLD", type: "uint256" },
        ],
        name: "oftReceipt",
        type: "tuple",
      },
    ],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { name: "dstEid", type: "uint32" },
          { name: "to", type: "bytes32" },
          { name: "amountLD", type: "uint256" },
          { name: "minAmountLD", type: "uint256" },
          { name: "extraOptions", type: "bytes" },
          { name: "composeMsg", type: "bytes" },
          { name: "oftCmd", type: "bytes" },
        ],
        name: "_sendParam",
        type: "tuple",
      },
      { name: "_payInLzToken", type: "bool" },
    ],
    name: "quoteSend",
    outputs: [
      {
        components: [
          { name: "nativeFee", type: "uint256" },
          { name: "lzTokenFee", type: "uint256" },
        ],
        name: "msgFee",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// ---------------------------------------------------------------------------
// CHAIN_REGISTRY — single source of truth for all 22 USDT0 chains
// Source: https://docs.usdt0.to/technical-documentation/deployments
// ---------------------------------------------------------------------------

export interface ChainEntry {
  name: string;
  chainId: number;
  nativeSymbol: string;
  tokenAddress: Address;
  oftAddress: Address;
  lzEndpointId: number;
  rpc: string;
  explorerTx: string;
  category: "major" | "l2" | "other";
}

export const CHAIN_REGISTRY: Record<string, ChainEntry> = {
  ethereum: {
    name: "Ethereum",
    nativeSymbol: "ETH",
    chainId: 1,
    tokenAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    oftAddress: "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee",
    lzEndpointId: 30101,
    rpc: "https://ethereum-rpc.publicnode.com",
    explorerTx: "https://etherscan.io/tx/",
    category: "major",
  },
  arbitrum: {
    name: "Arbitrum",
    nativeSymbol: "ETH",
    chainId: 42161,
    tokenAddress: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    oftAddress: "0x14E4A1B13bf7F943c8ff7C51fb60FA964A298D92",
    lzEndpointId: 30110,
    rpc: "https://arbitrum-one-rpc.publicnode.com",
    explorerTx: "https://arbiscan.io/tx/",
    category: "major",
  },
  optimism: {
    name: "Optimism",
    nativeSymbol: "ETH",
    chainId: 10,
    tokenAddress: "0x01bFF41798a0BcF287b996046Ca68b395DbC1071",
    oftAddress: "0xF03b4d9AC1D5d1E7c4cEf54C2A313b9fe051A0aD",
    lzEndpointId: 30111,
    rpc: "https://optimism-rpc.publicnode.com",
    explorerTx: "https://optimistic.etherscan.io/tx/",
    category: "major",
  },
  polygon: {
    name: "Polygon",
    nativeSymbol: "POL",
    chainId: 137,
    tokenAddress: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    oftAddress: "0x6BA10300f0DC58B7a1e4c0e41f5daBb7D7829e13",
    lzEndpointId: 30109,
    rpc: "https://polygon-bor-rpc.publicnode.com",
    explorerTx: "https://polygonscan.com/tx/",
    category: "major",
  },
  ink: {
    name: "Ink",
    nativeSymbol: "ETH",
    chainId: 57073,
    tokenAddress: "0x0200C29006150606B650577BBE7B6248F58470c1",
    oftAddress: "0x1cB6De532588fCA4a21B7209DE7C456AF8434A65",
    lzEndpointId: 30339,
    rpc: "https://rpc-gel.inkonchain.com",
    explorerTx: "https://explorer.inkonchain.com/tx/",
    category: "l2",
  },
  berachain: {
    name: "Berachain",
    nativeSymbol: "ETH",
    chainId: 80094,
    tokenAddress: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
    oftAddress: "0x3Dc96399109df5ceb2C226664A086140bD0379cB",
    lzEndpointId: 30362,
    rpc: "https://rpc.berachain.com",
    explorerTx: "https://berascan.com/tx/",
    category: "l2",
  },
  unichain: {
    name: "Unichain",
    nativeSymbol: "ETH",
    chainId: 130,
    tokenAddress: "0x9151434b16b9763660705744891fA906F660EcC5",
    oftAddress: "0xc07bE8994D035631c36fb4a89C918CeFB2f03EC3",
    lzEndpointId: 30320,
    rpc: "https://mainnet.unichain.org",
    explorerTx: "https://uniscan.xyz/tx/",
    category: "l2",
  },
  mantle: {
    name: "Mantle",
    nativeSymbol: "MNT",
    chainId: 5000,
    tokenAddress: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
    oftAddress: "0xcb768e263FB1C62214E7cab4AA8d036D76dc59CC",
    lzEndpointId: 30181,
    rpc: "https://rpc.mantle.xyz",
    explorerTx: "https://mantlescan.xyz/tx/",
    category: "l2",
  },
  sei: {
    name: "Sei",
    nativeSymbol: "SEI",
    chainId: 1329,
    tokenAddress: "0x9151434b16b9763660705744891fA906F660EcC5",
    oftAddress: "0x56Fe74A2e3b484b921c447357203431a3485CC60",
    lzEndpointId: 30280,
    rpc: "https://evm-rpc.sei-apis.com",
    explorerTx: "https://seitrace.com/tx/",
    category: "l2",
  },
  monad: {
    name: "Monad",
    nativeSymbol: "MON",
    chainId: 143,
    tokenAddress: "0xe7cd86e13AC4309349F30B3435a9d337750fC82D",
    oftAddress: "0x9151434b16b9763660705744891fA906F660EcC5",
    lzEndpointId: 30390,
    rpc: "https://monad-mainnet.g.alchemy.com/v2/public",
    explorerTx: "https://explorer.monad.xyz/tx/",
    category: "l2",
  },
  conflux: {
    name: "Conflux eSpace",
    nativeSymbol: "CFX",
    chainId: 1030,
    tokenAddress: "0xaf37E8B6C9ED7f6318979f56Fc287d76c30847ff",
    oftAddress: "0xC57efa1c7113D98BdA6F9f249471704Ece5dd84A",
    lzEndpointId: 30212,
    rpc: "https://evm.confluxrpc.com",
    explorerTx: "https://evm.confluxscan.io/tx/",
    category: "other",
  },
  flare: {
    name: "Flare",
    nativeSymbol: "FLR",
    chainId: 14,
    tokenAddress: "0xe7cd86e13AC4309349F30B3435a9d337750fC82D",
    oftAddress: "0x567287d2A9829215a37e3B88843d32f9221E7588",
    lzEndpointId: 30295,
    rpc: "https://flare-api.flare.network/ext/C/rpc",
    explorerTx: "https://flarescan.com/tx/",
    category: "other",
  },
  rootstock: {
    name: "Rootstock",
    nativeSymbol: "RBTC",
    chainId: 30,
    tokenAddress: "0x779dED0C9e1022225F8e0630b35A9B54Be713736",
    oftAddress: "0x1a594d5d5d1c426281C1064B07f23F57B2716B61",
    lzEndpointId: 30333,
    rpc: "https://public-node.rsk.co",
    explorerTx: "https://explorer.rootstock.io/tx/",
    category: "other",
  },
  xlayer: {
    name: "X Layer",
    nativeSymbol: "OKB",
    chainId: 196,
    tokenAddress: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
    oftAddress: "0x94bcca6bdfd6a61817ab0e960bfede4984505554",
    lzEndpointId: 30274,
    rpc: "https://rpc.xlayer.tech",
    explorerTx: "https://www.okx.com/web3/explorer/xlayer/tx/",
    category: "other",
  },
  stable: {
    name: "Stable",
    nativeSymbol: "ETH",
    chainId: 988,
    tokenAddress: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
    oftAddress: "0xedaba024be4d87974d5aB11C6Dd586963CcCB027",
    lzEndpointId: 30396,
    rpc: "https://rpc.stable.io",
    explorerTx: "https://explorer.stable.io/tx/",
    category: "other",
  },
  corn: {
    name: "Corn",
    nativeSymbol: "ETH",
    chainId: 21000000,
    tokenAddress: "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb",
    oftAddress: "0x3f82943338a8a76c35BFA0c1828aA27fd43a34E4",
    lzEndpointId: 30331,
    rpc: "https://rpc.corn.io",
    explorerTx: "https://cornscan.io/tx/",
    category: "other",
  },
  plasma: {
    name: "Plasma",
    nativeSymbol: "ETH",
    chainId: 9745,
    tokenAddress: "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb",
    oftAddress: "0x02ca37966753bDdDf11216B73B16C1dE756A7CF9",
    lzEndpointId: 30383,
    rpc: "https://rpc.plasma.io",
    explorerTx: "https://plasmascan.io/tx/",
    category: "other",
  },
  megaeth: {
    name: "MegaETH",
    nativeSymbol: "ETH",
    chainId: 4326,
    tokenAddress: "0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb",
    oftAddress: "0x9151434b16b9763660705744891fa906f660ecc5",
    lzEndpointId: 30398,
    rpc: "https://rpc.megaeth.com",
    explorerTx: "https://explorer.megaeth.com/tx/",
    category: "other",
  },
  hyperevm: {
    name: "HyperEVM",
    nativeSymbol: "ETH",
    chainId: 999,
    tokenAddress: "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb",
    oftAddress: "0x904861a24F30EC96ea7CFC3bE9EA4B476d237e98",
    lzEndpointId: 30367,
    rpc: "https://rpc.hyperliquid.xyz/evm",
    explorerTx: "https://explorer.hyperliquid.xyz/tx/",
    category: "other",
  },
  morph: {
    name: "Morph",
    nativeSymbol: "ETH",
    chainId: 2818,
    tokenAddress: "0xe7cd86e13AC4309349F30B3435a9d337750fC82D",
    oftAddress: "0xcb768e263FB1C62214E7cab4AA8d036D76dc59CC",
    lzEndpointId: 30322,
    rpc: "https://rpc.morphl2.io",
    explorerTx: "https://explorer.morphl2.io/tx/",
    category: "other",
  },
  hedera: {
    name: "Hedera",
    nativeSymbol: "HBAR",
    chainId: 295,
    tokenAddress: "0x00000000000000000000000000000000009Ce723",
    oftAddress: "0xe3119e23fC2371d1E6b01775ba312035425A53d6",
    lzEndpointId: 30316,
    rpc: "https://mainnet.hashio.io/api",
    explorerTx: "https://hashscan.io/mainnet/transaction/",
    category: "other",
  },
  tempo: {
    name: "Tempo",
    nativeSymbol: "ETH",
    chainId: 4217,
    tokenAddress: "0x20C00000000000000000000014f22CA97301EB73",
    oftAddress: "0xaf37E8B6C9ED7f6318979f56Fc287d76c30847ff",
    lzEndpointId: 30410,
    rpc: "https://rpc.tempo.xyz",
    explorerTx: "https://explorer.tempo.xyz/tx/",
    category: "other",
  },
};

// ---------------------------------------------------------------------------
// Default LayerZero extra options (Type 3, executor gas 200_000)
// ---------------------------------------------------------------------------

const DEFAULT_EXTRA_OPTIONS =
  "0x00030100110100000000000000000000000000030d40" as `0x${string}`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addressToBytes32(address: Address): `0x${string}` {
  return pad(address, { size: 32 });
}

function makeViemChain(entry: ChainEntry) {
  return {
    id: entry.chainId,
    name: entry.name,
    nativeCurrency: { name: entry.nativeSymbol, symbol: entry.nativeSymbol, decimals: 18 },
    rpcUrls: { default: { http: [entry.rpc] } },
  } as const;
}

// ---------------------------------------------------------------------------
// Exported query helpers
// ---------------------------------------------------------------------------

/** Get the full chain registry (for frontend dropdowns, etc.) */
export function getChainRegistry(): Record<string, ChainEntry> {
  return CHAIN_REGISTRY;
}

/** Get a single chain entry by key */
export function getChainEntry(chain: string): ChainEntry | undefined {
  return CHAIN_REGISTRY[chain];
}

/** Build a block-explorer URL for a transaction */
export function getExplorerTxUrl(chain: string, txHash: string): string {
  const entry = CHAIN_REGISTRY[chain];
  if (!entry) return `https://layerzeroscan.com/tx/${txHash}`;
  return `${entry.explorerTx}${txHash}`;
}

/** Check if a chain pair supports real USDT0 OFT bridging */
export function supportsRealBridge(fromChain: string, toChain: string): boolean {
  return (
    fromChain !== toChain &&
    fromChain in CHAIN_REGISTRY &&
    toChain in CHAIN_REGISTRY
  );
}

/** Get chains that support real bridging (from the SDK's perspective — for compat) */
export function getRealBridgeChains(): string[] {
  return Object.keys(CHAIN_REGISTRY);
}

/** Get the list of chains configured in the demo bridge chain map */
export function getSupportedBridgeChains(): string[] {
  return Object.keys(CHAIN_REGISTRY);
}

// ---------------------------------------------------------------------------
// Types (unchanged signatures)
// ---------------------------------------------------------------------------

export interface BridgeQuoteResult {
  available: boolean;
  nativeFee: string;
  nativeFeeFormatted: string;
  amountToSend: string;
  minAmountToReceive: string;
  estimatedTime: number;
  estimatedTimeFormatted: string;
  fromChain: string;
  toChain: string;
  protocol: string;
  // Optional balance info
  bridgeLiquidity?: string;
  bridgeLiquidityFormatted?: string;
  sufficientLiquidity?: boolean;
}

export interface BridgeExecutionResult {
  txHash: string;
  messageGuid: string;
  estimatedTime: number;
  layerZeroScanUrl: string;
  fromChain: string;
  toChain: string;
  amountSent: string;
}

// ---------------------------------------------------------------------------
// Estimated cross-chain time heuristic (seconds)
// ---------------------------------------------------------------------------

function estimateBridgeTime(from: string, to: string): number {
  const entry = CHAIN_REGISTRY[from];
  if (!entry) return 300;
  // Major ↔ Major is slower (finality); L2s are faster
  if (entry.category === "major" && CHAIN_REGISTRY[to]?.category === "major") return 600;
  if (entry.category === "major" || CHAIN_REGISTRY[to]?.category === "major") return 300;
  return 120; // L2 ↔ L2
}

// ---------------------------------------------------------------------------
// Build the LayerZero SendParam tuple
// ---------------------------------------------------------------------------

function buildSendParam(params: {
  toChain: string;
  amount: bigint;
  recipient: Address;
}) {
  const dstEntry = CHAIN_REGISTRY[params.toChain];
  if (!dstEntry) throw new Error(`Unknown destination chain: ${params.toChain}`);

  // 0.5% slippage
  const minAmount = params.amount - (params.amount * BigInt(50)) / BigInt(10000);

  return {
    dstEid: dstEntry.lzEndpointId,
    to: addressToBytes32(params.recipient),
    amountLD: params.amount,
    minAmountLD: minAmount,
    extraOptions: DEFAULT_EXTRA_OPTIONS,
    composeMsg: "0x" as `0x${string}`,
    oftCmd: "0x" as `0x${string}`,
  };
}

// ---------------------------------------------------------------------------
// quoteBridge
// ---------------------------------------------------------------------------

export async function quoteBridge(params: {
  fromChain: string;
  toChain: string;
  amount: bigint;
  recipient: string;
}): Promise<BridgeQuoteResult | null> {
  if (params.amount <= BigInt(0)) return null;

  const rawKey = process.env.BRIDGE_WALLET_PRIVATE_KEY;
  if (!rawKey) {
    console.log("[bridge-quote] BRIDGE_WALLET_PRIVATE_KEY not configured");
    return null;
  }

  if (!supportsRealBridge(params.fromChain, params.toChain)) {
    console.log(`[bridge-quote] Chain pair ${params.fromChain} -> ${params.toChain} not supported`);
    return null;
  }

  const srcEntry = CHAIN_REGISTRY[params.fromChain];
  if (!srcEntry) return null;

  try {
    const privateKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`;
    const account = privateKeyToAccount(privateKey);

    const publicClient = createPublicClient({
      chain: makeViemChain(srcEntry),
      transport: http(srcEntry.rpc),
    });

    // Build SendParam
    const sendParam = buildSendParam({
      toChain: params.toChain,
      amount: params.amount,
      recipient: params.recipient as Address,
    });

    console.log(`[bridge-quote] Quoting ${params.fromChain} -> ${params.toChain}, amount: ${params.amount}`);

    // Direct OFT.quoteSend call
    const quoteResult = await publicClient.readContract({
      address: srcEntry.oftAddress,
      abi: OFT_SEND_ABI,
      functionName: "quoteSend",
      args: [
        {
          dstEid: sendParam.dstEid,
          to: sendParam.to,
          amountLD: sendParam.amountLD,
          minAmountLD: sendParam.minAmountLD,
          extraOptions: sendParam.extraOptions,
          composeMsg: sendParam.composeMsg,
          oftCmd: sendParam.oftCmd,
        },
        false, // payInLzToken
      ],
    });

    const nativeFee = quoteResult.nativeFee;

    // Format native fee
    const feeEth = Number(nativeFee) / 1e18;
    const feeStr = feeEth < 0.0001 ? feeEth.toExponential(2) : feeEth.toFixed(6);
    const nativeFeeFormatted = `${feeStr} ${srcEntry.nativeSymbol}`;

    // Estimated time
    const estimatedTime = estimateBridgeTime(params.fromChain, params.toChain);
    const minutes = Math.ceil(estimatedTime / 60);
    const estimatedTimeFormatted = `~${minutes} min`;

    // Min amount after slippage
    const minAmountToReceive = params.amount - (params.amount * BigInt(50)) / BigInt(10000);

    // Check bridge wallet USDT0 balance on source chain (token contract, NOT OFT)
    const result: BridgeQuoteResult = {
      available: true,
      nativeFee: nativeFee.toString(),
      nativeFeeFormatted,
      amountToSend: params.amount.toString(),
      minAmountToReceive: minAmountToReceive.toString(),
      estimatedTime,
      estimatedTimeFormatted,
      fromChain: params.fromChain,
      toChain: params.toChain,
      protocol: "LayerZero V2",
    };

    try {
      const balance = await publicClient.readContract({
        address: srcEntry.tokenAddress,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [account.address],
      });
      result.bridgeLiquidity = balance.toString();
      result.bridgeLiquidityFormatted = `${(Number(balance) / 1e6).toFixed(4)} USDT0`;
      result.sufficientLiquidity = balance >= params.amount;
    } catch {
      /* non-critical — some RPCs may fail */
    }

    return result;
  } catch (error) {
    console.error(`[bridge-quote] Failed:`, error instanceof Error ? error.message : error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// executeBridge
// ---------------------------------------------------------------------------

export async function executeBridge(params: {
  fromChain: string;
  toChain: string;
  amount: bigint;
  recipient: string;
}): Promise<BridgeExecutionResult | null> {
  const rawKey = process.env.BRIDGE_WALLET_PRIVATE_KEY;
  if (!rawKey) {
    console.log("[bridge] BRIDGE_WALLET_PRIVATE_KEY not configured, using simulation");
    return null;
  }

  if (!supportsRealBridge(params.fromChain, params.toChain)) {
    console.log(`[bridge] Chain pair ${params.fromChain} -> ${params.toChain} not supported`);
    return null;
  }

  const srcEntry = CHAIN_REGISTRY[params.fromChain];
  if (!srcEntry) return null;

  try {
    const privateKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`;
    const account = privateKeyToAccount(privateKey);
    const viemChain = makeViemChain(srcEntry);

    const publicClient = createPublicClient({
      chain: viemChain,
      transport: http(srcEntry.rpc),
    });

    const walletClient = createWalletClient({
      chain: viemChain,
      transport: http(srcEntry.rpc),
      account,
    });

    // ---- Step 1: Ensure token allowance for OFT contract ----
    const currentAllowance = await publicClient.readContract({
      address: srcEntry.tokenAddress,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [account.address, srcEntry.oftAddress],
    });

    if (currentAllowance < params.amount) {
      console.log(`[bridge] Approving OFT to spend USDT0 (current: ${currentAllowance}, need: ${params.amount})`);
      const approveTx = await walletClient.writeContract({
        address: srcEntry.tokenAddress,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [srcEntry.oftAddress, params.amount],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveTx, timeout: 60_000 });
      console.log(`[bridge] Approval confirmed: ${approveTx}`);
    }

    // ---- Step 2: Quote ----
    const sendParam = buildSendParam({
      toChain: params.toChain,
      amount: params.amount,
      recipient: params.recipient as Address,
    });

    const sendParamTuple = {
      dstEid: sendParam.dstEid,
      to: sendParam.to,
      amountLD: sendParam.amountLD,
      minAmountLD: sendParam.minAmountLD,
      extraOptions: sendParam.extraOptions,
      composeMsg: sendParam.composeMsg,
      oftCmd: sendParam.oftCmd,
    };

    console.log(`[bridge] Quoting ${params.fromChain} -> ${params.toChain}, amount: ${params.amount}`);

    const quoteResult = await publicClient.readContract({
      address: srcEntry.oftAddress,
      abi: OFT_SEND_ABI,
      functionName: "quoteSend",
      args: [sendParamTuple, false],
    });

    const nativeFee = quoteResult.nativeFee;
    console.log(`[bridge] Quote: nativeFee=${nativeFee}`);

    // ---- Step 3: Send ----
    const txHash = await walletClient.writeContract({
      address: srcEntry.oftAddress,
      abi: OFT_SEND_ABI,
      functionName: "send",
      args: [
        sendParamTuple,
        { nativeFee, lzTokenFee: BigInt(0) },
        account.address, // refundAddress
      ],
      value: nativeFee,
    });

    console.log(`[bridge] TX submitted: ${txHash}`);

    // Wait for receipt to extract guid from logs
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: 120_000,
    });

    // Extract message GUID from OFTSent event logs (topic[0] is event sig, topic[1] is guid)
    // OFTSent(bytes32 guid, uint32 dstEid, address fromAddress, uint256 amountSentLD, uint256 amountReceivedLD)
    const OFT_SENT_TOPIC = "0x85496b760a4b7f8d66384b9df21b381f5d1b1e79f229a47aaf4c232edc2fe59a";
    const guidLog = receipt.logs.find((log) => log.topics[0] === OFT_SENT_TOPIC);
    const messageGuid = guidLog?.topics[1] ?? txHash;

    const estimatedTime = estimateBridgeTime(params.fromChain, params.toChain);

    console.log(`[bridge] Success! txHash=${txHash}, guid=${messageGuid}`);

    return {
      txHash,
      messageGuid,
      estimatedTime,
      layerZeroScanUrl: `https://layerzeroscan.com/tx/${txHash}`,
      fromChain: params.fromChain,
      toChain: params.toChain,
      amountSent: params.amount.toString(),
    };
  } catch (error) {
    console.error(`[bridge] Failed:`, error instanceof Error ? error.message : error);
    return null;
  }
}
