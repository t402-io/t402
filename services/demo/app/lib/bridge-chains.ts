/**
 * Shared bridge chain registry — used by frontend hook and backend API.
 * Source: https://docs.usdt0.to/api/deployments
 */

import type { Address } from "viem";

export interface BridgeChainInfo {
  name: string;
  chainId: number;
  tokenAddress: Address;
  oftAddress: Address;
  lzEndpointId: number;
  rpc: string;
  explorerTx: string;
  category: "major" | "l2" | "other";
}

export const BRIDGE_CHAIN_REGISTRY: Record<string, BridgeChainInfo> = {
  ethereum: {
    name: "Ethereum", chainId: 1,
    tokenAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    oftAddress: "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee",
    lzEndpointId: 30101,
    rpc: "https://ethereum-rpc.publicnode.com",
    explorerTx: "https://etherscan.io/tx/",
    category: "major",
  },
  arbitrum: {
    name: "Arbitrum", chainId: 42161,
    tokenAddress: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    oftAddress: "0x14E4A1B13bf7F943c8ff7C51fb60FA964A298D92",
    lzEndpointId: 30110,
    rpc: "https://arb1.arbitrum.io/rpc",
    explorerTx: "https://arbiscan.io/tx/",
    category: "major",
  },
  optimism: {
    name: "Optimism", chainId: 10,
    tokenAddress: "0x01bFF41798a0BcF287b996046Ca68b395DbC1071",
    oftAddress: "0xF03b4d9AC1D5d1E7c4cEf54C2A313b9fe051A0aD",
    lzEndpointId: 30111,
    rpc: "https://optimism-rpc.publicnode.com",
    explorerTx: "https://optimistic.etherscan.io/tx/",
    category: "major",
  },
  polygon: {
    name: "Polygon", chainId: 137,
    tokenAddress: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    oftAddress: "0x6BA10300f0DC58B7a1e4c0e41f5daBb7D7829e13",
    lzEndpointId: 30109,
    rpc: "https://polygon-bor-rpc.publicnode.com",
    explorerTx: "https://polygonscan.com/tx/",
    category: "major",
  },
  ink: { name: "Ink", chainId: 57073, tokenAddress: "0x0200C29006150606B650577BBE7B6248F58470c1", oftAddress: "0x1cB6De532588fCA4a21B7209DE7C456AF8434A65", lzEndpointId: 30339, rpc: "https://rpc-gel.inkonchain.com", explorerTx: "https://explorer.inkonchain.com/tx/", category: "l2" },
  berachain: { name: "Berachain", chainId: 80094, tokenAddress: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736", oftAddress: "0x3Dc96399109df5ceb2C226664A086140bD0379cB", lzEndpointId: 30362, rpc: "https://rpc.berachain.com", explorerTx: "https://berascan.com/tx/", category: "l2" },
  unichain: { name: "Unichain", chainId: 130, tokenAddress: "0x9151434b16b9763660705744891fA906F660EcC5", oftAddress: "0xc07bE8994D035631c36fb4a89C918CeFB2f03EC3", lzEndpointId: 30320, rpc: "https://mainnet.unichain.org", explorerTx: "https://uniscan.xyz/tx/", category: "l2" },
  mantle: { name: "Mantle", chainId: 5000, tokenAddress: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736", oftAddress: "0xcb768e263FB1C62214E7cab4AA8d036D76dc59CC", lzEndpointId: 30181, rpc: "https://rpc.mantle.xyz", explorerTx: "https://mantlescan.xyz/tx/", category: "l2" },
  sei: { name: "Sei", chainId: 1329, tokenAddress: "0x9151434b16b9763660705744891fA906F660EcC5", oftAddress: "0x56Fe74A2e3b484b921c447357203431a3485CC60", lzEndpointId: 30280, rpc: "https://evm-rpc.sei-apis.com", explorerTx: "https://seitrace.com/tx/", category: "l2" },
  monad: { name: "Monad", chainId: 143, tokenAddress: "0xe7cd86e13AC4309349F30B3435a9d337750fC82D", oftAddress: "0x9151434b16b9763660705744891fA906F660EcC5", lzEndpointId: 30390, rpc: "https://monad-mainnet.g.alchemy.com/v2/public", explorerTx: "https://explorer.monad.xyz/tx/", category: "l2" },
  conflux: { name: "Conflux eSpace", chainId: 1030, tokenAddress: "0xaf37E8B6C9ED7f6318979f56Fc287d76c30847ff", oftAddress: "0xC57efa1c7113D98BdA6F9f249471704Ece5dd84A", lzEndpointId: 30212, rpc: "https://evm.confluxrpc.com", explorerTx: "https://evm.confluxscan.io/tx/", category: "other" },
  flare: { name: "Flare", chainId: 14, tokenAddress: "0xe7cd86e13AC4309349F30B3435a9d337750fC82D", oftAddress: "0x567287d2A9829215a37e3B88843d32f9221E7588", lzEndpointId: 30295, rpc: "https://flare-api.flare.network/ext/C/rpc", explorerTx: "https://flarescan.com/tx/", category: "other" },
  rootstock: { name: "Rootstock", chainId: 30, tokenAddress: "0x779dED0C9e1022225F8e0630b35A9B54Be713736", oftAddress: "0x1a594d5d5d1c426281C1064B07f23F57B2716B61", lzEndpointId: 30333, rpc: "https://public-node.rsk.co", explorerTx: "https://explorer.rootstock.io/tx/", category: "other" },
  xlayer: { name: "XLayer", chainId: 196, tokenAddress: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736", oftAddress: "0x94bcca6bdfd6a61817ab0e960bfede4984505554", lzEndpointId: 30274, rpc: "https://rpc.xlayer.tech", explorerTx: "https://www.okx.com/web3/explorer/xlayer/tx/", category: "other" },
  stable: { name: "Stable", chainId: 988, tokenAddress: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736", oftAddress: "0xedaba024be4d87974d5aB11C6Dd586963CcCB027", lzEndpointId: 30396, rpc: "https://rpc.stable.io", explorerTx: "https://explorer.stable.io/tx/", category: "other" },
  corn: { name: "Corn", chainId: 21000000, tokenAddress: "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb", oftAddress: "0x3f82943338a8a76c35BFA0c1828aA27fd43a34E4", lzEndpointId: 30331, rpc: "https://rpc.corn.io", explorerTx: "https://cornscan.io/tx/", category: "other" },
  plasma: { name: "Plasma", chainId: 9745, tokenAddress: "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb", oftAddress: "0x02ca37966753bDdDf11216B73B16C1dE756A7CF9", lzEndpointId: 30383, rpc: "https://rpc.plasma.io", explorerTx: "https://plasmascan.io/tx/", category: "other" },
  megaeth: { name: "MegaETH", chainId: 4326, tokenAddress: "0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb", oftAddress: "0x9151434b16b9763660705744891fa906f660ecc5", lzEndpointId: 30398, rpc: "https://rpc.megaeth.com", explorerTx: "https://explorer.megaeth.com/tx/", category: "other" },
  hyperevm: { name: "HyperEVM", chainId: 999, tokenAddress: "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb", oftAddress: "0x904861a24F30EC96ea7CFC3bE9EA4B476d237e98", lzEndpointId: 30367, rpc: "https://rpc.hyperliquid.xyz/evm", explorerTx: "https://explorer.hyperliquid.xyz/tx/", category: "other" },
  morph: { name: "Morph", chainId: 2818, tokenAddress: "0xe7cd86e13AC4309349F30B3435a9d337750fC82D", oftAddress: "0xcb768e263FB1C62214E7cab4AA8d036D76dc59CC", lzEndpointId: 30322, rpc: "https://rpc.morphl2.io", explorerTx: "https://explorer.morphl2.io/tx/", category: "other" },
  hedera: { name: "Hedera", chainId: 295, tokenAddress: "0x00000000000000000000000000000000009Ce723", oftAddress: "0xe3119e23fC2371d1E6b01775ba312035425A53d6", lzEndpointId: 30316, rpc: "https://mainnet.hashio.io/api", explorerTx: "https://hashscan.io/mainnet/transaction/", category: "other" },
  tempo: { name: "Tempo", chainId: 4217, tokenAddress: "0x20C00000000000000000000014f22CA97301EB73", oftAddress: "0xaf37E8B6C9ED7f6318979f56Fc287d76c30847ff", lzEndpointId: 30410, rpc: "https://rpc.tempo.xyz", explorerTx: "https://explorer.tempo.xyz/tx/", category: "other" },
};

/** OFT Send ABI — quoteSend (view) + send (payable) */
export const OFT_ABI = [
  {
    inputs: [{ components: [
      { name: "dstEid", type: "uint32" },
      { name: "to", type: "bytes32" },
      { name: "amountLD", type: "uint256" },
      { name: "minAmountLD", type: "uint256" },
      { name: "extraOptions", type: "bytes" },
      { name: "composeMsg", type: "bytes" },
      { name: "oftCmd", type: "bytes" },
    ], name: "_sendParam", type: "tuple" }, { name: "_payInLzToken", type: "bool" }],
    name: "quoteSend",
    outputs: [{ components: [
      { name: "nativeFee", type: "uint256" },
      { name: "lzTokenFee", type: "uint256" },
    ], name: "msgFee", type: "tuple" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ components: [
      { name: "dstEid", type: "uint32" },
      { name: "to", type: "bytes32" },
      { name: "amountLD", type: "uint256" },
      { name: "minAmountLD", type: "uint256" },
      { name: "extraOptions", type: "bytes" },
      { name: "composeMsg", type: "bytes" },
      { name: "oftCmd", type: "bytes" },
    ], name: "_sendParam", type: "tuple" },
    { components: [
      { name: "nativeFee", type: "uint256" },
      { name: "lzTokenFee", type: "uint256" },
    ], name: "_fee", type: "tuple" },
    { name: "_refundAddress", type: "address" }],
    name: "send",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
] as const;

/** ERC20 ABI for approve + allowance */
export const ERC20_ABI = [
  { inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], name: "approve", outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], name: "allowance", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
] as const;

/** Default extra options for LayerZero (200k gas) */
export const LZ_EXTRA_OPTIONS = "0x00030100110100000000000000000000000000030d40" as `0x${string}`;

/** Convert address to bytes32 for LayerZero */
export function addressToBytes32(address: string): `0x${string}` {
  return `0x${address.slice(2).toLowerCase().padStart(64, "0")}` as `0x${string}`;
}

/** Get chain info by chain key */
export function getBridgeChain(key: string): BridgeChainInfo | undefined {
  return BRIDGE_CHAIN_REGISTRY[key];
}

/** Get all bridge chain keys */
export function getBridgeChainKeys(): string[] {
  return Object.keys(BRIDGE_CHAIN_REGISTRY);
}
