export type ChainFamily = "evm" | "ton" | "tron" | "solana" | "stacks" | "near" | "aptos" | "tezos" | "polkadot" | "cosmos";

export interface ChainConfig {
  family: ChainFamily;
  network: string;
  asset: string;
  payTo: string;
  explorer: string;
  explorerSuffix?: string;
  name: string;
  label: string;
  color: string;
  decimals: number;
  tokenSymbol: string;
  /** EIP-712 domain name for the token contract (EVM only) */
  tokenContractName?: string;
  /** EIP-712 domain version (EVM only) */
  tokenContractVersion?: string;
  /** Faucet for native gas token */
  gasFaucet: string;
  /** Display label for gas faucet (e.g. "Base Sepolia ETH") */
  gasFaucetLabel: string;
  /** Faucet for test stablecoin (USDT/USDC) */
  tokenFaucet: string;
  /** Display label for token faucet */
  tokenFaucetLabel: string;
}

export const CHAIN_CONFIGS: Record<ChainFamily, ChainConfig> = {
  evm: {
    family: "evm",
    network: "eip155:84532",
    asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    payTo: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    explorer: "https://sepolia.basescan.org/tx/",
    name: "Base Sepolia",
    label: "EVM",
    color: "var(--color-chain-evm)",
    decimals: 6,
    tokenSymbol: "USDC",
    tokenContractName: "USD Coin",
    tokenContractVersion: "2",
    gasFaucet: "https://www.alchemy.com/faucets/base-sepolia",
    gasFaucetLabel: "Base Sepolia ETH",
    tokenFaucet: "https://faucet.circle.com/",
    tokenFaucetLabel: "USDC (Circle Faucet)",
  },
  ton: {
    family: "ton",
    network: "ton:testnet",
    asset: "kQD0GKBM8ZbryVk2aESmzfU6b9b_8era_IkvBSELujFZPsyy",
    payTo: "EQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkEUe",
    explorer: "https://testnet.tonscan.org/tx/",
    name: "TON Testnet",
    label: "TON",
    color: "var(--color-chain-ton)",
    decimals: 6,
    tokenSymbol: "USDT",
    gasFaucet: "https://t.me/testgiver_ton_bot",
    gasFaucetLabel: "Testnet TON",
    tokenFaucet: "https://testnet.tonscan.org/address/kQD0GKBM8ZbryVk2aESmzfU6b9b_8era_IkvBSELujFZPsyy",
    tokenFaucetLabel: "USDT (Testnet Jetton — mint via wallet)",
  },
  tron: {
    family: "tron",
    network: "tron:nile",
    asset: "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf",
    payTo: "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5",
    explorer: "https://nile.tronscan.org/#/transaction/",
    name: "TRON Nile",
    label: "TRON",
    color: "var(--color-chain-tron)",
    decimals: 6,
    tokenSymbol: "USDT",
    gasFaucet: "https://nileex.io/join/getJoinPage",
    gasFaucetLabel: "Nile TRX",
    tokenFaucet: "https://nileex.io/join/getJoinPage",
    tokenFaucetLabel: "USDT (same faucet — select TRC-20)",
  },
  solana: {
    family: "solana",
    network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
    asset: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    payTo: "8GGtWHRQ1wz5gDKE2KXZLktqzcfV1CBqSbeUZjA7hoWL",
    explorer: "https://explorer.solana.com/tx/",
    explorerSuffix: "?cluster=devnet",
    name: "Solana Devnet",
    label: "Solana",
    color: "var(--color-chain-solana)",
    decimals: 6,
    tokenSymbol: "USDT",
    gasFaucet: "https://faucet.solana.com",
    gasFaucetLabel: "Devnet SOL",
    tokenFaucet: "https://spl-token-faucet.com/?token-name=USDT",
    tokenFaucetLabel: "USDT (SPL Token Faucet)",
  },
  stacks: {
    family: "stacks",
    network: "stacks:2147483648",
    asset: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdt-token",
    payTo: "SP36B1B191JTQAZTRKKWRN7J0YHHM41W9P9P7EPR5",
    explorer: "https://explorer.hiro.so/txid/",
    explorerSuffix: "?chain=testnet",
    name: "Stacks Testnet",
    label: "Stacks",
    color: "var(--color-chain-stacks)",
    decimals: 6,
    tokenSymbol: "USDT",
    gasFaucet: "https://explorer.hiro.so/sandbox/faucet?chain=testnet",
    gasFaucetLabel: "Testnet STX",
    tokenFaucet: "https://explorer.hiro.so/sandbox/deploy?chain=testnet",
    tokenFaucetLabel: "USDT (deploy mock contract via Sandbox)",
  },
  near: {
    family: "near",
    network: "near:testnet",
    asset: "usdc.fakes.testnet",
    payTo: "t402-facilitator.testnet",
    explorer: "https://testnet.nearblocks.io/txns/",
    name: "NEAR Testnet",
    label: "NEAR",
    color: "var(--color-chain-near)",
    decimals: 6,
    tokenSymbol: "USDC",
    gasFaucet: "https://near-faucet.io",
    gasFaucetLabel: "Testnet NEAR",
    tokenFaucet: "https://near-faucet.io",
    tokenFaucetLabel: "USDC (usdc.fakes.testnet — same faucet)",
  },
  aptos: {
    family: "aptos",
    network: "aptos:2",
    asset: "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
    payTo: "0xde57951f571b0bd792d05e0e3f62fed292099b2721b8c9efc76b3eae57ad74ef",
    explorer: "https://explorer.aptoslabs.com/txn/",
    explorerSuffix: "?network=testnet",
    name: "Aptos Testnet",
    label: "Aptos",
    color: "var(--color-chain-aptos)",
    decimals: 6,
    tokenSymbol: "USDT",
    gasFaucet: "https://aptoslabs.com/testnet-faucet",
    gasFaucetLabel: "Testnet APT",
    tokenFaucet: "https://aptoslabs.com/testnet-faucet",
    tokenFaucetLabel: "USDT (same faucet — includes test coins)",
  },
  tezos: {
    family: "tezos",
    network: "tezos:NetXnHfVqm9iesp",
    asset: "KT1P8RdJ5MfHMK5phKJ5JsfNfask5v2b2NQS",
    payTo: "tz1WGmWmJwJ4Z8DRhYxyNwQSfktFCLXB8dg6",
    explorer: "https://ghostnet.tzkt.io/",
    name: "Tezos Ghostnet",
    label: "Tezos",
    color: "var(--color-chain-tezos)",
    decimals: 6,
    tokenSymbol: "USDt",
    gasFaucet: "https://faucet.ghostnet.teztnets.com",
    gasFaucetLabel: "Ghostnet XTZ",
    tokenFaucet: "https://faucet.ghostnet.teztnets.com",
    tokenFaucetLabel: "USDt (same faucet — includes FA2 tokens)",
  },
  polkadot: {
    family: "polkadot",
    network: "polkadot:e143f23803ac50e8f6f8e62695d1ce9e",
    asset: "1984",
    payTo: "5GVGsVNg5pY8iF2Wj118mtJux1HwhVp2jrStx9fqmzVABCVL",
    explorer: "https://assethub-westend.subscan.io/extrinsic/",
    name: "Westend Asset Hub",
    label: "Polkadot",
    color: "var(--color-chain-polkadot)",
    decimals: 6,
    tokenSymbol: "USDT",
    gasFaucet: "https://faucet.polkadot.io/?parachain=1000",
    gasFaucetLabel: "Westend WND",
    tokenFaucet: "https://faucet.polkadot.io/?parachain=1000",
    tokenFaucetLabel: "USDT (Asset 1984 — teleport or sudo mint)",
  },
  cosmos: {
    family: "cosmos",
    network: "cosmos:grand-1",
    asset: "uusdc",
    payTo: "noble1ejc2c2gvk46h7kyulx9fus85vdpq0zdjwkfav0",
    explorer: "https://www.mintscan.io/noble-testnet/tx/",
    name: "Noble Testnet",
    label: "Cosmos",
    color: "var(--color-chain-cosmos)",
    decimals: 6,
    tokenSymbol: "USDC",
    gasFaucet: "https://faucet.testnet.noble.strange.love",
    gasFaucetLabel: "Noble testnet gas",
    tokenFaucet: "https://faucet.testnet.noble.strange.love",
    tokenFaucetLabel: "USDC (same faucet — includes uusdc)",
  },
};

export const CHAIN_FAMILIES: ChainFamily[] = ["evm", "ton", "tron", "solana", "stacks", "near", "aptos", "tezos", "polkadot", "cosmos"];

export function getExplorerUrl(family: ChainFamily, txHash: string): string {
  const config = CHAIN_CONFIGS[family];
  return `${config.explorer}${txHash}${config.explorerSuffix || ""}`;
}

export function getFaucetUrl(family: ChainFamily): string {
  return CHAIN_CONFIGS[family].gasFaucet;
}

export function getTokenFaucetUrl(family: ChainFamily): string {
  return CHAIN_CONFIGS[family].tokenFaucet;
}
