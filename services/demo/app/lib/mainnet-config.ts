import type { ChainConfig } from "./testnet-config";

/**
 * Mainnet chain configurations — one per facilitator-supported mainnet chain.
 * Keyed by CAIP-2 network ID.
 *
 * Data sourced from:
 *   - sdks/typescript/packages/mechanisms/evm/src/tokens.ts (USDT0/USDC/USDT addresses, EIP-712 domains)
 *   - sdks/typescript/packages/mechanisms/{chain}/src/constants.ts (non-EVM tokens)
 *   - https://facilitator.t402.io/supported (payTo addresses, schemes)
 */

export const MAINNET_CONFIGS: Record<string, ChainConfig> = {
  // ═══════════════════════════════════════════════════════════════
  // EVM — USDT0 (exact scheme, EIP-3009 transferWithAuthorization)
  // ═══════════════════════════════════════════════════════════════
  "eip155:1": {
    family: "evm", network: "eip155:1", name: "Ethereum", label: "Ethereum",
    asset: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    payTo: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    scheme: "exact-legacy", tokenSymbol: "USDT", decimals: 6,
    tokenContractName: "Tether USD", tokenContractVersion: "1",
    explorer: "https://etherscan.io/tx/",
    color: "#627EEA",
  },
  "eip155:42161": {
    family: "evm", network: "eip155:42161", name: "Arbitrum", label: "Arbitrum",
    asset: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    payTo: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    scheme: "exact", tokenSymbol: "USDT0", decimals: 6,
    tokenContractName: "USD₮0", tokenContractVersion: "1",
    explorer: "https://arbiscan.io/tx/",
    color: "#28A0F0",
  },
  "eip155:10": {
    family: "evm", network: "eip155:10", name: "Optimism", label: "Optimism",
    asset: "0x01bFF41798a0BcF287b996046Ca68b395DbC1071",
    payTo: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    scheme: "exact", tokenSymbol: "USDT0", decimals: 6,
    tokenContractName: "USD₮0", tokenContractVersion: "1",
    explorer: "https://optimistic.etherscan.io/tx/",
    color: "#FF0420",
  },
  "eip155:137": {
    family: "evm", network: "eip155:137", name: "Polygon", label: "Polygon",
    asset: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    payTo: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    scheme: "exact-legacy", tokenSymbol: "USDT0", decimals: 6,
    tokenContractName: "USD₮0", tokenContractVersion: "1",
    explorer: "https://polygonscan.com/tx/",
    color: "#8247E5",
  },
  "eip155:5000": {
    family: "evm", network: "eip155:5000", name: "Mantle", label: "Mantle",
    asset: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
    payTo: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    scheme: "exact", tokenSymbol: "USDT0", decimals: 6,
    tokenContractName: "USDT0", tokenContractVersion: "1",
    explorer: "https://mantlescan.xyz/tx/",
    color: "#000000",
  },
  "eip155:1030": {
    family: "evm", network: "eip155:1030", name: "Conflux", label: "Conflux",
    asset: "0xaf37E8B6C9ED7f6318979f56Fc287d76c30847ff",
    payTo: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    scheme: "exact", tokenSymbol: "USDT0", decimals: 6,
    tokenContractName: "USDT0", tokenContractVersion: "1",
    explorer: "https://evm.confluxscan.io/tx/",
    color: "#1A1A2E",
  },
  "eip155:1329": {
    family: "evm", network: "eip155:1329", name: "Sei", label: "Sei",
    asset: "0x9151434b16b9763660705744891fA906F660EcC5",
    payTo: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    scheme: "exact", tokenSymbol: "USDT0", decimals: 6,
    tokenContractName: "USD₮0", tokenContractVersion: "1",
    explorer: "https://seitrace.com/tx/",
    color: "#9B1C2E",
  },
  "eip155:143": {
    family: "evm", network: "eip155:143", name: "Monad", label: "Monad",
    asset: "0xe7cd86e13AC4309349F30B3435a9d337750fC82D",
    payTo: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    scheme: "exact", tokenSymbol: "USDT0", decimals: 6,
    tokenContractName: "USDT0", tokenContractVersion: "1",
    explorer: "https://explorer.monad.xyz/tx/",
    color: "#836EF9",
  },
  "eip155:57073": {
    family: "evm", network: "eip155:57073", name: "Ink", label: "Ink",
    asset: "0x0200C29006150606B650577BBE7B6248F58470c1",
    payTo: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    scheme: "exact", tokenSymbol: "USDT0", decimals: 6,
    tokenContractName: "USD₮0", tokenContractVersion: "1",
    explorer: "https://explorer.inkonchain.com/tx/",
    color: "#7B3FE4",
  },
  "eip155:80094": {
    family: "evm", network: "eip155:80094", name: "Berachain", label: "Berachain",
    asset: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
    payTo: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    scheme: "exact", tokenSymbol: "USDT0", decimals: 6,
    tokenContractName: "USD₮0", tokenContractVersion: "1",
    explorer: "https://berascan.com/tx/",
    color: "#FF6B35",
  },
  "eip155:130": {
    family: "evm", network: "eip155:130", name: "Unichain", label: "Unichain",
    asset: "0x9151434b16b9763660705744891fA906F660EcC5",
    payTo: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    scheme: "exact", tokenSymbol: "USDT0", decimals: 6,
    tokenContractName: "USD₮0", tokenContractVersion: "1",
    explorer: "https://unichain.blockscout.com/tx/",
    color: "#FF007A",
  },
  "eip155:9745": {
    family: "evm", network: "eip155:9745", name: "Plasma", label: "Plasma",
    asset: "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb",
    payTo: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    scheme: "exact", tokenSymbol: "USDT0", decimals: 6,
    tokenContractName: "USDT0", tokenContractVersion: "1",
    explorer: "https://explorer.plasma.io/tx/",
    color: "#5C2D91",
  },
  "eip155:14": {
    family: "evm", network: "eip155:14", name: "Flare", label: "Flare",
    asset: "0xe7cd86e13AC4309349F30B3435a9d337750fC82D",
    payTo: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    scheme: "exact", tokenSymbol: "USDT0", decimals: 6,
    tokenContractName: "USD₮0", tokenContractVersion: "1",
    explorer: "https://flarescan.com/tx/",
    color: "#E42058",
  },
  "eip155:30": {
    family: "evm", network: "eip155:30", name: "Rootstock", label: "Rootstock",
    asset: "0x779dED0C9e1022225F8e0630b35A9B54Be713736",
    payTo: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    scheme: "exact", tokenSymbol: "USDT0", decimals: 6,
    tokenContractName: "USD₮0", tokenContractVersion: "1",
    explorer: "https://explorer.rootstock.io/tx/",
    color: "#FF9100",
  },
  "eip155:196": {
    family: "evm", network: "eip155:196", name: "XLayer", label: "XLayer",
    asset: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
    payTo: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    scheme: "exact", tokenSymbol: "USDT0", decimals: 6,
    tokenContractName: "USD₮0", tokenContractVersion: "1",
    explorer: "https://www.okx.com/web3/explorer/xlayer/tx/",
    color: "#000000",
  },
  "eip155:21000000": {
    family: "evm", network: "eip155:21000000", name: "Corn", label: "Corn",
    asset: "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb",
    payTo: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    scheme: "exact", tokenSymbol: "USDT0", decimals: 6,
    tokenContractName: "USDT0", tokenContractVersion: "1",
    explorer: "https://cornscan.io/tx/",
    color: "#F5C842",
  },
  "eip155:999": {
    family: "evm", network: "eip155:999", name: "HyperEVM", label: "HyperEVM",
    asset: "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb",
    payTo: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    scheme: "exact", tokenSymbol: "USDT0", decimals: 6,
    tokenContractName: "USDT0", tokenContractVersion: "1",
    explorer: "https://explorer.hyperevm.xyz/tx/",
    color: "#6FE7DD",
  },
  "eip155:4326": {
    family: "evm", network: "eip155:4326", name: "MegaETH", label: "MegaETH",
    asset: "0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb",
    payTo: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    scheme: "exact", tokenSymbol: "USDT0", decimals: 6,
    tokenContractName: "USDT0", tokenContractVersion: "1",
    explorer: "https://explorer.megaeth.com/tx/",
    color: "#FF4F00",
  },
  "eip155:988": {
    family: "evm", network: "eip155:988", name: "Stable", label: "Stable",
    asset: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
    payTo: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    scheme: "exact", tokenSymbol: "USDT0", decimals: 6,
    tokenContractName: "USDT0", tokenContractVersion: "1",
    explorer: "https://explorer.stable.io/tx/",
    color: "#00D395",
  },

  // ═══════════════════════════════════════════════════════════════
  // EVM — Legacy USDT/USDT0 (exact-legacy scheme, approve+transferFrom)
  // These chains require on-chain approve before facilitator can transferFrom.
  // ═══════════════════════════════════════════════════════════════
  "eip155:56": {
    family: "evm", network: "eip155:56", name: "BNB Chain", label: "BNB",
    asset: "0x55d398326f99059fF775485246999027B3197955",
    payTo: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    scheme: "exact-legacy", tokenSymbol: "USDT", decimals: 18,
    tokenContractName: "Tether USD", tokenContractVersion: "1",
    explorer: "https://bscscan.com/tx/",
    color: "#F0B90B",
  },
  "eip155:43114": {
    family: "evm", network: "eip155:43114", name: "Avalanche", label: "Avalanche",
    asset: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
    payTo: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    scheme: "exact-legacy", tokenSymbol: "USDT", decimals: 6,
    tokenContractName: "TetherToken", tokenContractVersion: "1",
    explorer: "https://snowscan.xyz/tx/",
    color: "#E84142",
  },
  "eip155:250": {
    family: "evm", network: "eip155:250", name: "Fantom", label: "Fantom",
    asset: "0x049d68029688eabf473097a2fc38ef61633a3c7a",
    payTo: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    scheme: "exact-legacy", tokenSymbol: "USDT", decimals: 6,
    tokenContractName: "Frapped USDT", tokenContractVersion: "1",
    explorer: "https://ftmscan.com/tx/",
    color: "#1969FF",
  },
  "eip155:42220": {
    family: "evm", network: "eip155:42220", name: "Celo", label: "Celo",
    asset: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
    payTo: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    scheme: "exact-legacy", tokenSymbol: "USDT", decimals: 6,
    tokenContractName: "Tether USD", tokenContractVersion: "1",
    explorer: "https://celoscan.io/tx/",
    color: "#FCFF52",
  },
  "eip155:8217": {
    family: "evm", network: "eip155:8217", name: "Kaia", label: "Kaia",
    asset: "0xd077a400968890eacc75cdc901f0356c943e4fdb",
    payTo: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    scheme: "exact-legacy", tokenSymbol: "USDT", decimals: 6,
    tokenContractName: "Tether USD", tokenContractVersion: "1",
    explorer: "https://kaiascan.io/tx/",
    color: "#BFF009",
  },

  // ═══════════════════════════════════════════════════════════════
  // Non-EVM — exact scheme
  // ═══════════════════════════════════════════════════════════════
  "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": {
    family: "solana", network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", name: "Solana", label: "Solana",
    asset: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    payTo: "8GGtWHRQ1wz5gDKE2KXZLktqzcfV1CBqSbeUZjA7hoWL",
    scheme: "exact", tokenSymbol: "USDT", decimals: 6,
    explorer: "https://solscan.io/tx/",
    color: "#9945FF",
  },
  "ton:mainnet": {
    family: "ton", network: "ton:mainnet", name: "TON", label: "TON",
    asset: "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
    payTo: "EQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkEUe",
    scheme: "exact", tokenSymbol: "USDT", decimals: 6,
    explorer: "https://tonviewer.com/transaction/",
    color: "#0098EA",
  },
  "tron:mainnet": {
    family: "tron", network: "tron:mainnet", name: "TRON", label: "TRON",
    asset: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    payTo: "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5",
    scheme: "exact", tokenSymbol: "USDT", decimals: 6,
    explorer: "https://tronscan.org/#/transaction/",
    color: "#FF0013",
  },

  // ═══════════════════════════════════════════════════════════════
  // Non-EVM — exact-direct scheme
  // ═══════════════════════════════════════════════════════════════
  "near:mainnet": {
    family: "near", network: "near:mainnet", name: "NEAR", label: "NEAR",
    asset: "usdt.tether-token.near",
    payTo: "t402-facilitator.near",
    scheme: "exact-direct", tokenSymbol: "USDT", decimals: 6,
    explorer: "https://nearblocks.io/txns/",
    color: "#00C1DE",
  },
  "aptos:1": {
    family: "aptos", network: "aptos:1", name: "Aptos", label: "Aptos",
    asset: "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
    payTo: "0xde57951f571b0bd792d05e0e3f62fed292099b2721b8c9efc76b3eae57ad74ef",
    scheme: "exact-direct", tokenSymbol: "USDT", decimals: 6,
    explorer: "https://explorer.aptoslabs.com/txn/",
    color: "#2DD8A3",
  },
  "tezos:NetXdQprcVkpaWU": {
    family: "tezos", network: "tezos:NetXdQprcVkpaWU", name: "Tezos", label: "Tezos",
    asset: "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o",
    payTo: "tz1WGmWmJwJ4Z8DRhYxyNwQSfktFCLXB8dg6",
    scheme: "exact-direct", tokenSymbol: "USDt", decimals: 6,
    explorer: "https://tzkt.io/",
    color: "#2C7DF7",
  },
  "polkadot:68d56f15f85d3136970ec16946040bc1": {
    family: "polkadot", network: "polkadot:68d56f15f85d3136970ec16946040bc1", name: "Polkadot", label: "Polkadot",
    asset: "1984",
    payTo: "5GVGsVNg5pY8iF2Wj118mtJux1HwhVp2jrStx9fqmzVABCVL",
    scheme: "exact-direct", tokenSymbol: "USDT", decimals: 6,
    explorer: "https://assethub-polkadot.subscan.io/extrinsic/",
    color: "#E6007A",
  },
  "stacks:1": {
    family: "stacks", network: "stacks:1", name: "Stacks", label: "Stacks",
    asset: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
    payTo: "SP36B1B191JTQAZTRKKWRN7J0YHHM41W9P9P7EPR5",
    scheme: "exact-direct", tokenSymbol: "sUSDC", decimals: 6,
    explorer: "https://explorer.stacks.co/txid/",
    color: "#5546FF",
  },
  "cosmos:noble-1": {
    family: "cosmos", network: "cosmos:noble-1", name: "Noble", label: "Cosmos",
    asset: "uusdc",
    payTo: "noble1ejc2c2gvk46h7kyulx9fus85vdpq0zdjwkfav0",
    scheme: "exact-direct", tokenSymbol: "USDC", decimals: 6,
    explorer: "https://www.mintscan.io/noble/tx/",
    color: "#B7B9C8",
  },

  // ═══════════════════════════════════════════════════════════════
  // Stellar — exact scheme (pre-signed Soroban transactions)
  // ═══════════════════════════════════════════════════════════════
  "stellar:pubnet": {
    family: "stellar", network: "stellar:pubnet", name: "Stellar", label: "Stellar",
    asset: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI",
    payTo: "GBDEVU63Y6NTHJQQZIKVTC2LSQLMEAIFYRP2XAJDDQVWRDQJLEVLWM36",
    scheme: "exact", tokenSymbol: "USDC", decimals: 7,
    explorer: "https://stellar.expert/explorer/public/tx/",
    color: "#7B61FF",
  },
};

/** All mainnet CAIP-2 network IDs */
export const MAINNET_NETWORKS = Object.keys(MAINNET_CONFIGS);
