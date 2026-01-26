export type ChainFamily = "evm" | "ton" | "tron" | "solana" | "stacks" | "near" | "aptos" | "tezos" | "polkadot";

export interface ChainConfig {
  family: ChainFamily;
  network: string;
  asset: string;
  payTo: string;
  explorer: string;
  explorerSuffix?: string;
  faucet: string;
  name: string;
  label: string;
  color: string;
  decimals: number;
  tokenSymbol: string;
}

export const CHAIN_CONFIGS: Record<ChainFamily, ChainConfig> = {
  evm: {
    family: "evm",
    network: "eip155:84532",
    asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    payTo: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    explorer: "https://sepolia.basescan.org/tx/",
    faucet: "https://www.alchemy.com/faucets/base-sepolia",
    name: "Base Sepolia",
    label: "EVM",
    color: "var(--color-chain-evm)",
    decimals: 6,
    tokenSymbol: "USDT",
  },
  ton: {
    family: "ton",
    network: "ton:testnet",
    asset: "kQD0GKBM8ZbryVk2aESmzfU6b9b_8era_IkvBSELujFZPsyy",
    payTo: "EQ5d11d21276ac6b5efdf179e654ff0c6eee34e0abfa263a",
    explorer: "https://testnet.tonscan.org/tx/",
    faucet: "https://t.me/testgiver_ton_bot",
    name: "TON Testnet",
    label: "TON",
    color: "var(--color-chain-ton)",
    decimals: 6,
    tokenSymbol: "USDT",
  },
  tron: {
    family: "tron",
    network: "tron:nile",
    asset: "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf",
    payTo: "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5",
    explorer: "https://nile.tronscan.org/#/transaction/",
    faucet: "https://nileex.io/join/getJoinPage",
    name: "TRON Nile",
    label: "TRON",
    color: "var(--color-chain-tron)",
    decimals: 6,
    tokenSymbol: "USDT",
  },
  solana: {
    family: "solana",
    network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
    asset: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    payTo: "8GGtWHRQ1wz5gDKE2KXZLktqzcfV1CBqSbeUZjA7hoWL",
    explorer: "https://explorer.solana.com/tx/",
    explorerSuffix: "?cluster=devnet",
    faucet: "https://faucet.solana.com",
    name: "Solana Devnet",
    label: "Solana",
    color: "var(--color-chain-solana)",
    decimals: 6,
    tokenSymbol: "USDT",
  },
  stacks: {
    family: "stacks",
    network: "stacks:2147483648",
    asset: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdt-token",
    payTo: "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG",
    explorer: "https://explorer.hiro.so/txid/",
    explorerSuffix: "?chain=testnet",
    faucet: "https://explorer.hiro.so/sandbox/faucet?chain=testnet",
    name: "Stacks Testnet",
    label: "Stacks",
    color: "var(--color-chain-stacks)",
    decimals: 6,
    tokenSymbol: "USDT",
  },
  near: {
    family: "near",
    network: "near:testnet",
    asset: "usdc.fakes.testnet",
    payTo: "t402-facilitator.testnet",
    explorer: "https://testnet.nearblocks.io/txns/",
    faucet: "https://near-faucet.io",
    name: "NEAR Testnet",
    label: "NEAR",
    color: "var(--color-chain-near)",
    decimals: 6,
    tokenSymbol: "USDC",
  },
  aptos: {
    family: "aptos",
    network: "aptos:2",
    asset: "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
    payTo: "0xc88f67e776f16dcfbf42e6bdda1b82604448899b",
    explorer: "https://explorer.aptoslabs.com/txn/",
    explorerSuffix: "?network=testnet",
    faucet: "https://aptoslabs.com/testnet-faucet",
    name: "Aptos Testnet",
    label: "Aptos",
    color: "var(--color-chain-aptos)",
    decimals: 6,
    tokenSymbol: "USDT",
  },
  tezos: {
    family: "tezos",
    network: "tezos:NetXnHfVqm9iesp",
    asset: "KT1P8RdJ5MfHMK5phKJ5JsfNfask5v2b2NQS",
    payTo: "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
    explorer: "https://ghostnet.tzkt.io/",
    faucet: "https://faucet.ghostnet.teztnets.com",
    name: "Tezos Ghostnet",
    label: "Tezos",
    color: "var(--color-chain-tezos)",
    decimals: 6,
    tokenSymbol: "USDt",
  },
  polkadot: {
    family: "polkadot",
    network: "polkadot:e143f23803ac50e8f6f8e62695d1ce9e",
    asset: "1984",
    payTo: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
    explorer: "https://assethub-westend.subscan.io/extrinsic/",
    faucet: "https://faucet.polkadot.io/?parachain=1000",
    name: "Westend Asset Hub",
    label: "Polkadot",
    color: "var(--color-chain-polkadot)",
    decimals: 6,
    tokenSymbol: "USDT",
  },
};

export const CHAIN_FAMILIES: ChainFamily[] = ["evm", "ton", "tron", "solana", "stacks", "near", "aptos", "tezos", "polkadot"];

export function getExplorerUrl(family: ChainFamily, txHash: string): string {
  const config = CHAIN_CONFIGS[family];
  return `${config.explorer}${txHash}${config.explorerSuffix || ""}`;
}

export function getFaucetUrl(family: ChainFamily): string {
  return CHAIN_CONFIGS[family].faucet;
}
