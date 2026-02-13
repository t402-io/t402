/**
 * Status Data for t402 Facilitator
 */

export interface FacilitatorNetwork {
  network: string;
  name: string;
  family: string;
  status: "operational" | "degraded" | "maintenance";
  walletAddress: string;
  explorerUrl: string;
}

export interface ServiceEndpoint {
  name: string;
  url: string;
  description: string;
}

export const serviceEndpoints: ServiceEndpoint[] = [
  {
    name: "Health",
    url: "https://facilitator.t402.io/health",
    description: "Liveness probe",
  },
  {
    name: "Ready",
    url: "https://facilitator.t402.io/ready",
    description: "Readiness probe",
  },
  {
    name: "Supported",
    url: "https://facilitator.t402.io/supported",
    description: "Supported networks and schemes",
  },
  {
    name: "Metrics",
    url: "https://facilitator.t402.io/metrics",
    description: "Prometheus metrics",
  },
  {
    name: "Grafana",
    url: "https://grafana.facilitator.t402.io",
    description: "Real-time monitoring dashboard",
  },
];

export const facilitatorWallets = [
  {
    family: "EVM",
    chains: "Ethereum, Base, Arbitrum, Optimism, and all EVM networks",
    address: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    explorerUrl:
      "https://etherscan.io/address/0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
  },
  {
    family: "Solana",
    chains: "Solana Mainnet",
    address: "8GGtWHRQ1wz5gDKE2KXZLktqzcfV1CBqSbeUZjA7hoWL",
    explorerUrl:
      "https://solscan.io/account/8GGtWHRQ1wz5gDKE2KXZLktqzcfV1CBqSbeUZjA7hoWL",
  },
  {
    family: "TON",
    chains: "TON Mainnet",
    address: "EQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkEUe",
    explorerUrl:
      "https://tonviewer.com/EQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkEUe",
  },
  {
    family: "TRON",
    chains: "TRON Mainnet",
    address: "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5",
    explorerUrl:
      "https://tronscan.org/#/address/TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5",
  },
  {
    family: "Stacks",
    chains: "Stacks Mainnet",
    address: "SP36B1B191JTQAZTRKKWRN7J0YHHM41W9P9P7EPR5",
    explorerUrl:
      "https://explorer.hiro.so/address/SP36B1B191JTQAZTRKKWRN7J0YHHM41W9P9P7EPR5",
  },
  {
    family: "Cosmos",
    chains: "Noble Mainnet",
    address: "noble1ejc2c2gvk46h7kyulx9fus85vdpq0zdjwkfav0",
    explorerUrl:
      "https://www.mintscan.io/noble/account/noble1ejc2c2gvk46h7kyulx9fus85vdpq0zdjwkfav0",
  },
];

export const networks: FacilitatorNetwork[] = [
  // EVM Networks
  {
    network: "eip155:1",
    name: "Ethereum",
    family: "EVM",
    status: "operational",
    walletAddress: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    explorerUrl: "https://etherscan.io",
  },
  {
    network: "eip155:8453",
    name: "Base",
    family: "EVM",
    status: "operational",
    walletAddress: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    explorerUrl: "https://basescan.org",
  },
  {
    network: "eip155:42161",
    name: "Arbitrum",
    family: "EVM",
    status: "operational",
    walletAddress: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    explorerUrl: "https://arbiscan.io",
  },
  {
    network: "eip155:10",
    name: "Optimism",
    family: "EVM",
    status: "operational",
    walletAddress: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    explorerUrl: "https://optimistic.etherscan.io",
  },
  {
    network: "eip155:137",
    name: "Polygon",
    family: "EVM",
    status: "operational",
    walletAddress: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    explorerUrl: "https://polygonscan.com",
  },
  {
    network: "eip155:43114",
    name: "Avalanche",
    family: "EVM",
    status: "operational",
    walletAddress: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    explorerUrl: "https://snowtrace.io",
  },
  {
    network: "eip155:56",
    name: "BNB Chain",
    family: "EVM",
    status: "operational",
    walletAddress: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    explorerUrl: "https://bscscan.com",
  },
  {
    network: "eip155:324",
    name: "zkSync Era",
    family: "EVM",
    status: "operational",
    walletAddress: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    explorerUrl: "https://explorer.zksync.io",
  },
  {
    network: "eip155:59144",
    name: "Linea",
    family: "EVM",
    status: "operational",
    walletAddress: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    explorerUrl: "https://lineascan.build",
  },
  {
    network: "eip155:534352",
    name: "Scroll",
    family: "EVM",
    status: "operational",
    walletAddress: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    explorerUrl: "https://scrollscan.com",
  },
  {
    network: "eip155:250",
    name: "Fantom",
    family: "EVM",
    status: "operational",
    walletAddress: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    explorerUrl: "https://ftmscan.com",
  },
  {
    network: "eip155:42220",
    name: "Celo",
    family: "EVM",
    status: "operational",
    walletAddress: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    explorerUrl: "https://celoscan.io",
  },
  {
    network: "eip155:5000",
    name: "Mantle",
    family: "EVM",
    status: "operational",
    walletAddress: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    explorerUrl: "https://mantlescan.xyz",
  },
  {
    network: "eip155:57073",
    name: "Ink",
    family: "EVM",
    status: "operational",
    walletAddress: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    explorerUrl: "https://explorer.inkonchain.com",
  },
  {
    network: "eip155:80094",
    name: "Berachain",
    family: "EVM",
    status: "operational",
    walletAddress: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    explorerUrl: "https://berascan.com",
  },
  {
    network: "eip155:130",
    name: "Unichain",
    family: "EVM",
    status: "operational",
    walletAddress: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    explorerUrl: "https://uniscan.xyz",
  },
  {
    network: "eip155:1329",
    name: "Sei",
    family: "EVM",
    status: "operational",
    walletAddress: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    explorerUrl: "https://seitrace.com",
  },
  {
    network: "eip155:8217",
    name: "Kaia",
    family: "EVM",
    status: "operational",
    walletAddress: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    explorerUrl: "https://kaiascan.io",
  },
  {
    network: "eip155:14",
    name: "Flare",
    family: "EVM",
    status: "operational",
    walletAddress: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    explorerUrl: "https://flarescan.com",
  },
  // Non-EVM Networks
  {
    network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    name: "Solana",
    family: "Solana",
    status: "operational",
    walletAddress: "8GGtWHRQ1wz5gDKE2KXZLktqzcfV1CBqSbeUZjA7hoWL",
    explorerUrl: "https://solscan.io",
  },
  {
    network: "ton:mainnet",
    name: "TON",
    family: "TON",
    status: "operational",
    walletAddress: "EQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkEUe",
    explorerUrl: "https://tonviewer.com",
  },
  {
    network: "tron:mainnet",
    name: "TRON",
    family: "TRON",
    status: "operational",
    walletAddress: "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5",
    explorerUrl: "https://tronscan.org",
  },
  {
    network: "near:mainnet",
    name: "NEAR",
    family: "NEAR",
    status: "operational",
    walletAddress: "t402.near",
    explorerUrl: "https://nearblocks.io",
  },
  {
    network: "aptos:1",
    name: "Aptos",
    family: "Aptos",
    status: "operational",
    walletAddress: "verification-only",
    explorerUrl: "https://explorer.aptoslabs.com",
  },
  {
    network: "tezos:NetXdQprcVkpaWU",
    name: "Tezos",
    family: "Tezos",
    status: "operational",
    walletAddress: "verification-only",
    explorerUrl: "https://tzkt.io",
  },
  {
    network: "polkadot:68d56f15f85d3136970ec16946040bc1",
    name: "Polkadot Asset Hub",
    family: "Polkadot",
    status: "operational",
    walletAddress: "verification-only",
    explorerUrl: "https://assethub-polkadot.subscan.io",
  },
  {
    network: "stacks:1",
    name: "Stacks",
    family: "Stacks",
    status: "operational",
    walletAddress: "SP36B1B191JTQAZTRKKWRN7J0YHHM41W9P9P7EPR5",
    explorerUrl: "https://explorer.stacks.co",
  },
  {
    network: "cosmos:noble-1",
    name: "Cosmos / Noble",
    family: "Cosmos",
    status: "operational",
    walletAddress: "noble1ejc2c2gvk46h7kyulx9fus85vdpq0zdjwkfav0",
    explorerUrl: "https://www.mintscan.io/noble",
  },
];
