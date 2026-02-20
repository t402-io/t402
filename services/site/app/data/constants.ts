export const PROTOCOL_STATS = {
  chains: 44,
  networks: 44,
  kinds: 64,
  families: 10,
  sdkCount: 4,
  tsPackages: 36,
  httpFrameworks: 18,
} as const;

export const SDK_VERSIONS = {
  typescript: "2.6.0",
  python: "1.11.0",
  go: "1.11.0",
  java: "1.11.0",
} as const;

export const CHAIN_FAMILIES = [
  { name: "EVM", color: "#627EEA", count: 19 },
  { name: "Solana", color: "#9945FF", count: 1 },
  { name: "TON", color: "#0098EA", count: 1 },
  { name: "TRON", color: "#FF0013", count: 1 },
  { name: "NEAR", color: "#00C08B", count: 1 },
  { name: "Aptos", color: "#2DD8A3", count: 1 },
  { name: "Tezos", color: "#2C7DF7", count: 1 },
  { name: "Polkadot", color: "#E6007A", count: 1 },
  { name: "Stacks", color: "#5546FF", count: 1 },
  { name: "Cosmos", color: "#2E3148", count: 1 },
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
