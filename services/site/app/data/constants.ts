export const PROTOCOL_STATS = {
  chains: 47,
  networks: 47,
  kinds: 69,
  families: 13,
  sdkCount: 4,
  tsPackages: 42,
  httpFrameworks: 18,
} as const;

export const SDK_VERSIONS = {
  typescript: "2.8.0",
  python: "1.12.1",
  go: "1.12.1",
  java: "1.12.1",
} as const;

export const CHAIN_FAMILIES = [
  { name: "EVM", color: "#627EEA", count: 25 },
  { name: "Solana", color: "#9945FF", count: 1 },
  { name: "TON", color: "#0098EA", count: 1 },
  { name: "TRON", color: "#FF0013", count: 1 },
  { name: "NEAR", color: "#00C08B", count: 1 },
  { name: "Aptos", color: "#2DD8A3", count: 1 },
  { name: "Tezos", color: "#2C7DF7", count: 1 },
  { name: "Polkadot", color: "#E6007A", count: 1 },
  { name: "Stacks", color: "#5546FF", count: 1 },
  { name: "Cosmos", color: "#2E3148", count: 1 },
  { name: "Stellar", color: "#7C8CF8", count: 1 },
  { name: "Bitcoin", color: "#F7931A", count: 2 },
  { name: "Spark", color: "#FF6B35", count: 1 },
] as const;

export const FACILITATOR_WALLETS = {
  evm: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
  solana: "8GGtWHRQ1wz5gDKE2KXZLktqzcfV1CBqSbeUZjA7hoWL",
  tonMainnet: "EQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkEUe",
  tonTestnet: "kQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkP6U",
  tron: "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5",
  stacks: "SP36B1B191JTQAZTRKKWRN7J0YHHM41W9P9P7EPR5",
  cosmos: "noble1ejc2c2gvk46h7kyulx9fus85vdpq0zdjwkfav0",
} as const;
// Trigger Vercel rebuild 1773934395
