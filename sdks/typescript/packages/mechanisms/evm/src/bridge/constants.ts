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
  // Mainnets — from https://docs.usdt0.to/technical-documentation/deployments
  ethereum: 30101,
  arbitrum: 30110,
  base: 30184,
  optimism: 30111,
  polygon: 30109,
  avalanche: 30106,
  bsc: 30102,
  // USDT0 native chains
  ink: 30339,
  berachain: 30362,
  unichain: 30320,
  mantle: 30181,
  sei: 30280,
  conflux: 30212,
  monad: 30390,
  flare: 30295,
  rootstock: 30333,
  xlayer: 30274,
  stable: 30396,
  corn: 30331,
  plasma: 30383,
  megaeth: 30398,
  hyperevm: 30367,
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
  "eip155:5000": "mantle",
  "eip155:1329": "sei",
  "eip155:1030": "conflux",
  "eip155:143": "monad",
  "eip155:14": "flare",
  "eip155:30": "rootstock",
  "eip155:196": "xlayer",
  "eip155:988": "stable",
  "eip155:21000000": "corn",
  "eip155:9745": "plasma",
  "eip155:4326": "megaeth",
  "eip155:999": "hyperevm",
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
  // Ethereum OFT Adapter (locks/unlocks native USDT ↔ USDT0)
  ethereum: "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee",
  // L2 OFT contracts (NOT the token address — the OFT with quoteSend/send)
  // Source: https://docs.usdt0.to/technical-documentation/deployments
  arbitrum: "0x14E4A1B13bf7F943c8ff7C51fb60FA964A298D92",
  ink: "0x1cB6De532588fCA4a21B7209DE7C456AF8434A65",
  berachain: "0x3Dc96399109df5ceb2C226664A086140bD0379cB",
  unichain: "0xc07bE8994D035631c36fb4a89C918CeFB2f03EC3",
  optimism: "0xF03b4d9AC1D5d1E7c4cEf54C2A313b9fe051A0aD",
  polygon: "0x6BA10300f0DC58B7a1e4c0e41f5daBb7D7829e13",
  mantle: "0xcb768e263FB1C62214E7cab4AA8d036D76dc59CC",
  sei: "0x56Fe74A2e3b484b921c447357203431a3485CC60",
  conflux: "0xC57efa1c7113D98BdA6F9f249471704Ece5dd84A",
  monad: "0x9151434b16b9763660705744891fA906F660EcC5",
  flare: "0x567287d2A9829215a37e3B88843d32f9221E7588",
  rootstock: "0x1a594d5d5d1c426281C1064B07f23F57B2716B61",
  xlayer: "0x94bcca6bdfd6a61817ab0e960bfede4984505554",
  stable: "0xedaba024be4d87974d5aB11C6Dd586963CcCB027",
  corn: "0x3f82943338a8a76c35BFA0c1828aA27fd43a34E4",
  plasma: "0x02ca37966753bDdDf11216B73B16C1dE756A7CF9",
  megaeth: "0x9151434b16b9763660705744891fa906f660ecc5",
  hyperevm: "0x904861a24F30EC96ea7CFC3bE9EA4B476d237e98",
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
export const DEFAULT_EXTRA_OPTIONS =
  "0x00030100110100000000000000000000000000030d40" as `0x${string}`;

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
 *
 * @param chain - The chain name (e.g., 'ethereum', 'arbitrum')
 * @returns The LayerZero endpoint ID, or undefined if chain not supported
 */
export function getEndpointId(chain: string): number | undefined {
  return LAYERZERO_ENDPOINT_IDS[chain];
}

/**
 * Get LayerZero endpoint ID from CAIP-2 network
 *
 * @param network - The CAIP-2 network identifier (e.g., 'eip155:1' for Ethereum)
 * @returns The LayerZero endpoint ID, or undefined if network not supported
 */
export function getEndpointIdFromNetwork(network: string): number | undefined {
  const chain = NETWORK_TO_CHAIN[network];
  return chain ? LAYERZERO_ENDPOINT_IDS[chain] : undefined;
}

/**
 * Get USDT0 OFT contract address for a chain
 *
 * @param chain - The chain name (e.g., 'ethereum', 'arbitrum')
 * @returns The USDT0 OFT contract address, or undefined if chain not supported
 */
export function getUsdt0OftAddress(chain: string): Address | undefined {
  return USDT0_OFT_ADDRESSES[chain];
}

/**
 * Check if a chain supports USDT0 bridging
 *
 * @param chain - The chain name to check (e.g., 'ethereum', 'arbitrum')
 * @returns True if the chain supports USDT0 bridging, false otherwise
 */
export function supportsBridging(chain: string): boolean {
  return chain in USDT0_OFT_ADDRESSES && chain in LAYERZERO_ENDPOINT_IDS;
}

/**
 * Get all chains that support USDT0 bridging
 *
 * @returns Array of chain names that support USDT0 bridging
 */
export function getBridgeableChains(): string[] {
  return Object.keys(USDT0_OFT_ADDRESSES).filter(chain => chain in LAYERZERO_ENDPOINT_IDS);
}

/**
 * Convert address to bytes32 format for LayerZero
 * Pads address with leading zeros to 32 bytes
 *
 * @param address - The EVM address to convert
 * @returns The address as a bytes32 hex string with leading zeros
 */
export function addressToBytes32(address: Address): `0x${string}` {
  // Remove 0x prefix, pad to 64 chars (32 bytes), add 0x prefix
  const cleanAddress = address.slice(2).toLowerCase();
  return `0x${cleanAddress.padStart(64, "0")}` as `0x${string}`;
}

/**
 * Convert bytes32 to address
 *
 * @param bytes32 - The bytes32 hex string to convert
 * @returns The extracted EVM address from the last 20 bytes
 */
export function bytes32ToAddress(bytes32: `0x${string}`): Address {
  // Take last 40 characters (20 bytes)
  return `0x${bytes32.slice(-40)}` as Address;
}
