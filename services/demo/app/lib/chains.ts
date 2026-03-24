export interface DemoChain {
  id: string;
  name: string;
  network: string;
  color: string;
  family: string;
  gasless: boolean;
}

export const chains: DemoChain[] = [
  // EVM — exact/upto scheme (Facilitator-supported mainnets)
  { id: "arbitrum", name: "Arbitrum", network: "eip155:42161", color: "#28A0F0", family: "EVM", gasless: true },
  { id: "ethereum", name: "Ethereum", network: "eip155:1", color: "#627EEA", family: "EVM", gasless: true },
  { id: "optimism", name: "Optimism", network: "eip155:10", color: "#FF0420", family: "EVM", gasless: true },
  { id: "polygon", name: "Polygon", network: "eip155:137", color: "#8247E5", family: "EVM", gasless: true },
  { id: "avalanche", name: "Avalanche", network: "eip155:43114", color: "#E84142", family: "EVM", gasless: true },
  { id: "bnb", name: "BNB Chain", network: "eip155:56", color: "#F0B90B", family: "EVM", gasless: true },
  { id: "kaia", name: "Kaia", network: "eip155:8217", color: "#BFF009", family: "EVM", gasless: true },
  { id: "fantom", name: "Fantom", network: "eip155:250", color: "#1969FF", family: "EVM", gasless: true },
  { id: "celo", name: "Celo", network: "eip155:42220", color: "#FCFF52", family: "EVM", gasless: true },
  { id: "flare", name: "Flare", network: "eip155:14", color: "#E42058", family: "EVM", gasless: true },
  { id: "rootstock", name: "Rootstock", network: "eip155:30", color: "#FF9100", family: "EVM", gasless: true },
  { id: "xlayer", name: "XLayer", network: "eip155:196", color: "#000000", family: "EVM", gasless: true },
  { id: "ink", name: "Ink", network: "eip155:57073", color: "#7B3FE4", family: "EVM", gasless: true },
  { id: "berachain", name: "Berachain", network: "eip155:80094", color: "#FF6B35", family: "EVM", gasless: true },
  { id: "unichain", name: "Unichain", network: "eip155:130", color: "#FF007A", family: "EVM", gasless: true },
  { id: "mantle", name: "Mantle", network: "eip155:5000", color: "#000000", family: "EVM", gasless: true },
  { id: "sei", name: "Sei", network: "eip155:1329", color: "#9B1C2E", family: "EVM", gasless: true },
  { id: "corn", name: "Corn", network: "eip155:21000000", color: "#F5C842", family: "EVM", gasless: true },
  { id: "conflux", name: "Conflux", network: "eip155:1030", color: "#1A1A2E", family: "EVM", gasless: true },
  { id: "monad", name: "Monad", network: "eip155:143", color: "#836EF9", family: "EVM", gasless: true },
  { id: "megaeth", name: "MegaETH", network: "eip155:4326", color: "#FF4F00", family: "EVM", gasless: true },
  { id: "hyperevm", name: "HyperEVM", network: "eip155:999", color: "#6FE7DD", family: "EVM", gasless: true },
  { id: "stable", name: "Stable", network: "eip155:988", color: "#00D395", family: "EVM", gasless: true },
  { id: "plasma", name: "Plasma", network: "eip155:9745", color: "#5C2D91", family: "EVM", gasless: true },
  // Non-EVM
  { id: "solana", name: "Solana", network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", color: "#9945FF", family: "Solana", gasless: false },
  { id: "ton", name: "TON", network: "ton:mainnet", color: "#0098EA", family: "TON", gasless: false },
  { id: "tron", name: "TRON", network: "tron:mainnet", color: "#FF0013", family: "TRON", gasless: false },
  { id: "near", name: "NEAR", network: "near:mainnet", color: "#00C1DE", family: "NEAR", gasless: false },
  { id: "aptos", name: "Aptos", network: "aptos:1", color: "#2DD8A3", family: "Aptos", gasless: false },
  { id: "tezos", name: "Tezos", network: "tezos:NetXdQprcVkpaWU", color: "#2C7DF7", family: "Tezos", gasless: false },
  { id: "polkadot", name: "Polkadot", network: "polkadot:68d56f15f85d3136970ec16946040bc1", color: "#E6007A", family: "Polkadot", gasless: false },
  { id: "stacks", name: "Stacks", network: "stacks:1", color: "#5546FF", family: "Stacks", gasless: false },
  { id: "noble", name: "Noble", network: "cosmos:noble-1", color: "#B7B9C8", family: "Cosmos", gasless: false },
];

export const chainFamilies = [...new Set(chains.map((c) => c.family))];
