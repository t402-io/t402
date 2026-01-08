/**
 * LayerZero OFT Bridge Constants for USDT0
 *
 * USDT0 uses LayerZero's OFT (Omnichain Fungible Token) standard
 * for cross-chain transfers.
 *
 * @see https://docs.layerzero.network/v2/developers/evm/oft/quickstart
 */

import type { Address } from "viem";

/**
 * LayerZero V2 Endpoint IDs (EIDs) for supported chains
 * These are unique identifiers used by LayerZero to route messages
 *
 * @see https://docs.layerzero.network/v2/deployments/deployed-contracts
 */
export const LAYERZERO_ENDPOINT_IDS: Record<string, number> = {
  // Mainnets
  ethereum: 30101,
  arbitrum: 30110,
  base: 30184,
  optimism: 30111,
  polygon: 30109,
  avalanche: 30106,
  bsc: 30102,
  // USDT0 specific chains
  ink: 30291, // Ink mainnet
  berachain: 30362, // Berachain mainnet
  unichain: 30320, // Unichain mainnet
  // Testnets
  sepolia: 40161,
  arbitrumSepolia: 40231,
  baseSepolia: 40245,
};

/**
 * Map from CAIP-2 network ID to chain name
 */
export const NETWORK_TO_CHAIN: Record<string, string> = {
  "eip155:1": "ethereum",
  "eip155:42161": "arbitrum",
  "eip155:8453": "base",
  "eip155:10": "optimism",
  "eip155:137": "polygon",
  "eip155:43114": "avalanche",
  "eip155:56": "bsc",
  "eip155:57073": "ink",
  "eip155:80094": "berachain",
  "eip155:130": "unichain",
  // Testnets
  "eip155:11155111": "sepolia",
  "eip155:421614": "arbitrumSepolia",
  "eip155:84532": "baseSepolia",
};

/**
 * Map from chain name to CAIP-2 network ID
 */
export const CHAIN_TO_NETWORK: Record<string, string> = Object.fromEntries(
  Object.entries(NETWORK_TO_CHAIN).map(([k, v]) => [v, k]),
);

/**
 * USDT0 OFT Adapter contract addresses by chain
 * These are the contracts that handle cross-chain transfers
 */
export const USDT0_OFT_ADDRESSES: Record<string, Address> = {
  // Ethereum is the OFT Adapter (locks/unlocks tokens)
  ethereum: "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee",
  // Other chains have native USDT0 OFT contracts
  arbitrum: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  ink: "0x0200C29006150606B650577BBE7B6248F58470c1",
  berachain: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
  unichain: "0x588ce4F028D8e7B53B687865d6A67b3A54C75518",
};

/**
 * LayerZero V2 Endpoint contract addresses
 * Same address on all EVM chains
 */
export const LAYERZERO_ENDPOINT_V2: Address = "0x1a44076050125825900e736c501f859c50fE728c";

/**
 * Default gas limit for cross-chain messages
 */
export const DEFAULT_GAS_LIMIT = 200000n;

/**
 * Default extra options for LayerZero messages
 * Type 3 options with executor gas
 */
export const DEFAULT_EXTRA_OPTIONS = "0x00030100110100000000000000000000000000030d40" as `0x${string}`;

/**
 * OFT Send ABI for cross-chain transfers
 */
export const OFT_SEND_ABI = [
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

/**
 * ERC20 approval ABI for token allowance
 */
export const ERC20_APPROVE_ABI = [
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
] as const;

/**
 * Get LayerZero endpoint ID for a chain
 */
export function getEndpointId(chain: string): number | undefined {
  return LAYERZERO_ENDPOINT_IDS[chain];
}

/**
 * Get LayerZero endpoint ID from CAIP-2 network
 */
export function getEndpointIdFromNetwork(network: string): number | undefined {
  const chain = NETWORK_TO_CHAIN[network];
  return chain ? LAYERZERO_ENDPOINT_IDS[chain] : undefined;
}

/**
 * Get USDT0 OFT contract address for a chain
 */
export function getUsdt0OftAddress(chain: string): Address | undefined {
  return USDT0_OFT_ADDRESSES[chain];
}

/**
 * Check if a chain supports USDT0 bridging
 */
export function supportsBridging(chain: string): boolean {
  return chain in USDT0_OFT_ADDRESSES && chain in LAYERZERO_ENDPOINT_IDS;
}

/**
 * Get all chains that support USDT0 bridging
 */
export function getBridgeableChains(): string[] {
  return Object.keys(USDT0_OFT_ADDRESSES).filter(
    (chain) => chain in LAYERZERO_ENDPOINT_IDS,
  );
}

/**
 * Convert address to bytes32 format for LayerZero
 * Pads address with leading zeros to 32 bytes
 */
export function addressToBytes32(address: Address): `0x${string}` {
  // Remove 0x prefix, pad to 64 chars (32 bytes), add 0x prefix
  const cleanAddress = address.slice(2).toLowerCase();
  return `0x${cleanAddress.padStart(64, "0")}` as `0x${string}`;
}

/**
 * Convert bytes32 to address
 */
export function bytes32ToAddress(bytes32: `0x${string}`): Address {
  // Take last 40 characters (20 bytes)
  return `0x${bytes32.slice(-40)}` as Address;
}
