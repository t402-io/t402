export type ChainFamily = "evm" | "ton" | "tron" | "solana" | "stacks";

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
    asset: "kQBqSpvo4S87mX9tTc4FX3Sfqf4uSp3Tx-Fz4RBUfTRWBx",
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
    asset: "ST...token-usdt",
    payTo: "ST...",
    explorer: "https://explorer.stacks.co/txid/",
    explorerSuffix: "?chain=testnet",
    faucet: "https://explorer.stacks.co/sandbox/faucet",
    name: "Stacks Testnet",
    label: "Stacks",
    color: "var(--color-chain-stacks)",
    decimals: 6,
    tokenSymbol: "USDT",
  },
};

export const CHAIN_FAMILIES: ChainFamily[] = ["evm", "ton", "tron", "solana", "stacks"];

export function getExplorerUrl(family: ChainFamily, txHash: string): string {
  const config = CHAIN_CONFIGS[family];
  return `${config.explorer}${txHash}${config.explorerSuffix || ""}`;
}

export function getFaucetUrl(family: ChainFamily): string {
  return CHAIN_CONFIGS[family].faucet;
}
