export interface DemoChain {
  id: string;
  name: string;
  network: string;
  color: string;
  family: string;
  gasless: boolean;
}

export const chains: DemoChain[] = [
  { id: "ethereum", name: "Ethereum", network: "eip155:1", color: "#627EEA", family: "EVM", gasless: true },
  { id: "base", name: "Base", network: "eip155:8453", color: "#0052FF", family: "EVM", gasless: true },
  { id: "arbitrum", name: "Arbitrum", network: "eip155:42161", color: "#28A0F0", family: "EVM", gasless: true },
  { id: "optimism", name: "Optimism", network: "eip155:10", color: "#FF0420", family: "EVM", gasless: true },
  { id: "polygon", name: "Polygon", network: "eip155:137", color: "#8247E5", family: "EVM", gasless: true },
  { id: "avalanche", name: "Avalanche", network: "eip155:43114", color: "#E84142", family: "EVM", gasless: true },
  { id: "bnb", name: "BNB Chain", network: "eip155:56", color: "#F0B90B", family: "EVM", gasless: true },
  { id: "zksync", name: "zkSync Era", network: "eip155:324", color: "#4E529A", family: "EVM", gasless: true },
  { id: "linea", name: "Linea", network: "eip155:59144", color: "#61DFFF", family: "EVM", gasless: true },
  { id: "scroll", name: "Scroll", network: "eip155:534352", color: "#FFEEDA", family: "EVM", gasless: true },
  { id: "ink", name: "Ink", network: "eip155:57073", color: "#7B3FE4", family: "EVM", gasless: true },
  { id: "berachain", name: "Berachain", network: "eip155:80094", color: "#FF6B35", family: "EVM", gasless: true },
  { id: "unichain", name: "Unichain", network: "eip155:130", color: "#FF007A", family: "EVM", gasless: true },
  { id: "mantle", name: "Mantle", network: "eip155:5000", color: "#000000", family: "EVM", gasless: true },
  { id: "sei", name: "Sei", network: "eip155:1329", color: "#9B1C2E", family: "EVM", gasless: true },
  { id: "corn", name: "Corn", network: "eip155:21000000", color: "#F5C842", family: "EVM", gasless: true },
  { id: "conflux", name: "Conflux", network: "eip155:1030", color: "#1A1A2E", family: "EVM", gasless: true },
  { id: "solana", name: "Solana", network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", color: "#9945FF", family: "Solana", gasless: false },
  { id: "ton", name: "TON", network: "ton:mainnet", color: "#0098EA", family: "TON", gasless: false },
  { id: "tron", name: "TRON", network: "tron:mainnet", color: "#FF0013", family: "TRON", gasless: false },
  { id: "near", name: "NEAR", network: "near:mainnet", color: "#00C1DE", family: "NEAR", gasless: false },
  { id: "aptos", name: "Aptos", network: "aptos:1", color: "#2DD8A3", family: "Aptos", gasless: false },
  { id: "tezos", name: "Tezos", network: "tezos:NetXdQprcVkpaWU", color: "#2C7DF7", family: "Tezos", gasless: false },
  { id: "polkadot", name: "Polkadot", network: "polkadot:68d56f15f85d3136970ec16946040bc1", color: "#E6007A", family: "Polkadot", gasless: false },
  { id: "stacks", name: "Stacks", network: "stacks:1", color: "#5546FF", family: "Stacks", gasless: false },
];

export const chainFamilies = [...new Set(chains.map((c) => c.family))];
