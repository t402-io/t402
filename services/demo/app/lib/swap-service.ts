/**
 * ParaSwap DEX aggregator service for real swap quotes
 * Free API, no auth needed — multi-chain support
 */

interface SwapChain {
  name: string;
  chainId: number;
  nativeCurrency: { symbol: string; decimals: number };
  tokens: { symbol: string; address: string; decimals: number; name: string }[];
  paraswapSpender: string; // TokenTransferProxy address
  explorerUrl: string;
}

const SWAP_CHAINS: Record<string, SwapChain> = {
  ethereum: {
    name: "Ethereum", chainId: 1,
    nativeCurrency: { symbol: "ETH", decimals: 18 },
    paraswapSpender: "0x216b4b4ba9f3e719726886d34a177484278bfcae",
    explorerUrl: "https://etherscan.io",
    tokens: [
      { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6, name: "Tether USD" },
      { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6, name: "USD Coin" },
      { symbol: "ETH", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18, name: "Ethereum" },
      { symbol: "WBTC", address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", decimals: 8, name: "Wrapped Bitcoin" },
      { symbol: "DAI", address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18, name: "Dai" },
      { symbol: "LINK", address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", decimals: 18, name: "Chainlink" },
    ],
  },
  arbitrum: {
    name: "Arbitrum", chainId: 42161,
    nativeCurrency: { symbol: "ETH", decimals: 18 },
    paraswapSpender: "0x216b4b4ba9f3e719726886d34a177484278bfcae",
    explorerUrl: "https://arbiscan.io",
    tokens: [
      { symbol: "USDT", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6, name: "Tether USD" },
      { symbol: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6, name: "USD Coin" },
      { symbol: "ETH", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18, name: "Ethereum" },
      { symbol: "WBTC", address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", decimals: 8, name: "Wrapped Bitcoin" },
      { symbol: "ARB", address: "0x912CE59144191C1204E64559FE8253a0e49E6548", decimals: 18, name: "Arbitrum" },
      { symbol: "LINK", address: "0xf97f4df75117a78c1A5a0DBb814Af92458539FB4", decimals: 18, name: "Chainlink" },
      { symbol: "UNI", address: "0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0", decimals: 18, name: "Uniswap" },
      { symbol: "DAI", address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", decimals: 18, name: "Dai" },
    ],
  },
  optimism: {
    name: "Optimism", chainId: 10,
    nativeCurrency: { symbol: "ETH", decimals: 18 },
    paraswapSpender: "0x216b4b4ba9f3e719726886d34a177484278bfcae",
    explorerUrl: "https://optimistic.etherscan.io",
    tokens: [
      { symbol: "USDT", address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", decimals: 6, name: "Tether USD" },
      { symbol: "USDC", address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", decimals: 6, name: "USD Coin" },
      { symbol: "ETH", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18, name: "Ethereum" },
      { symbol: "WBTC", address: "0x68f180fcCe6836688e9084f035309E29Bf0A2095", decimals: 8, name: "Wrapped Bitcoin" },
      { symbol: "OP", address: "0x4200000000000000000000000000000000000042", decimals: 18, name: "Optimism" },
      { symbol: "DAI", address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", decimals: 18, name: "Dai" },
    ],
  },
  polygon: {
    name: "Polygon", chainId: 137,
    nativeCurrency: { symbol: "MATIC", decimals: 18 },
    paraswapSpender: "0x216b4b4ba9f3e719726886d34a177484278bfcae",
    explorerUrl: "https://polygonscan.com",
    tokens: [
      { symbol: "USDT", address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6, name: "Tether USD" },
      { symbol: "USDC", address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6, name: "USD Coin" },
      { symbol: "MATIC", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18, name: "Polygon" },
      { symbol: "WBTC", address: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6", decimals: 8, name: "Wrapped Bitcoin" },
      { symbol: "DAI", address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", decimals: 18, name: "Dai" },
    ],
  },
  bsc: {
    name: "BNB Chain", chainId: 56,
    nativeCurrency: { symbol: "BNB", decimals: 18 },
    paraswapSpender: "0x216b4b4ba9f3e719726886d34a177484278bfcae",
    explorerUrl: "https://bscscan.com",
    tokens: [
      { symbol: "USDT", address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18, name: "Tether USD" },
      { symbol: "USDC", address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18, name: "USD Coin" },
      { symbol: "BNB", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18, name: "BNB" },
      { symbol: "BTCB", address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c", decimals: 18, name: "Bitcoin BEP2" },
      { symbol: "DAI", address: "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3", decimals: 18, name: "Dai" },
    ],
  },
  avalanche: {
    name: "Avalanche", chainId: 43114,
    nativeCurrency: { symbol: "AVAX", decimals: 18 },
    paraswapSpender: "0x216b4b4ba9f3e719726886d34a177484278bfcae",
    explorerUrl: "https://snowtrace.io",
    tokens: [
      { symbol: "USDT", address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", decimals: 6, name: "Tether USD" },
      { symbol: "USDC", address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", decimals: 6, name: "USD Coin" },
      { symbol: "AVAX", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18, name: "Avalanche" },
      { symbol: "WBTC", address: "0x50b7545627a5162F82A992c33b87aDc75187B218", decimals: 8, name: "Wrapped Bitcoin" },
      { symbol: "DAI", address: "0xd586E7F844cEa2F87f50152665BCbc2C279D8d70", decimals: 18, name: "Dai" },
    ],
  },
  base: {
    name: "Base", chainId: 8453,
    nativeCurrency: { symbol: "ETH", decimals: 18 },
    paraswapSpender: "0x93aAAe79a53759cD164340E4C8766E4Db5331cD7",
    explorerUrl: "https://basescan.org",
    tokens: [
      { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6, name: "USD Coin" },
      { symbol: "ETH", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18, name: "Ethereum" },
      { symbol: "DAI", address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", decimals: 18, name: "Dai" },
    ],
  },
};

// Backward-compatible defaults
const DEFAULT_CHAIN_KEY = "arbitrum";

const PARASWAP_API = "https://api.paraswap.io";

function getChain(chainKey?: string): SwapChain {
  const key = chainKey || DEFAULT_CHAIN_KEY;
  const chain = SWAP_CHAINS[key];
  if (!chain) throw new Error(`Unsupported chain: ${key}`);
  return chain;
}

export interface SwapQuote {
  srcToken: string;
  srcSymbol: string;
  srcAmount: string;
  destToken: string;
  destSymbol: string;
  destAmount: string;
  destAmountFormatted: string;
  minReceived: string;    // after 0.5% slippage
  rate: string;           // "1 USDT = 0.000481 ETH"
  priceImpact: string;    // "0.02%"
  gasCostUSD: string;     // "$0.05"
  route: string[];        // ["PancakeswapV3 (83%)", "SushiSwapV3 (17%)"]
  estimatedGas: string;
  priceRoute: any;        // raw ParaSwap priceRoute, needed to build tx
}

export interface SwapTx {
  to: string;
  data: string;
  value: string;
  chainId: number;
}

export function getSupportedTokens(chainKey?: string) {
  return getChain(chainKey).tokens;
}

export function getSupportedChains() {
  return Object.entries(SWAP_CHAINS).map(([key, chain]) => ({
    key,
    name: chain.name,
    chainId: chain.chainId,
    nativeCurrency: chain.nativeCurrency,
    paraswapSpender: chain.paraswapSpender,
    explorerUrl: chain.explorerUrl,
    tokenCount: chain.tokens.length,
  }));
}

export function getParaswapSpender(chainKey?: string): string {
  return getChain(chainKey).paraswapSpender;
}

export function getChainExplorerUrl(chainKey?: string): string {
  return getChain(chainKey).explorerUrl;
}

export async function getSwapQuote(params: {
  srcToken: string;  // token address
  destToken: string;
  amount: string;    // in token smallest units
  srcDecimals: number;
  destDecimals: number;
  chainKey?: string;
}): Promise<SwapQuote | null> {
  try {
    const chain = getChain(params.chainKey);
    const networkId = chain.chainId;
    const tokens = chain.tokens;

    const url = `${PARASWAP_API}/prices?srcToken=${params.srcToken}&destToken=${params.destToken}&amount=${params.amount}&srcDecimals=${params.srcDecimals}&destDecimals=${params.destDecimals}&network=${networkId}&side=SELL`;

    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;

    const data = await res.json();
    const pr = data.priceRoute;
    if (!pr) return null;

    // Extract route info (deduplicate by exchange name)
    const routeMap = new Map<string, number>();
    for (const bestRoute of pr.bestRoute || []) {
      for (const swap of bestRoute.swaps || []) {
        for (const ex of swap.swapExchanges || []) {
          const name = ex.exchange;
          routeMap.set(name, (routeMap.get(name) || 0) + Number(ex.percent || 0));
        }
      }
    }
    const routes = Array.from(routeMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, pct]) => `${name} (${Math.round(pct)}%)`)
      .slice(0, 5);

    // Find token info
    const srcInfo = tokens.find(t => t.address.toLowerCase() === params.srcToken.toLowerCase());
    const destInfo = tokens.find(t => t.address.toLowerCase() === params.destToken.toLowerCase());

    const destAmount = pr.destAmount;
    const destFloat = Number(destAmount) / Math.pow(10, params.destDecimals);
    const destFormatted = destFloat.toFixed(params.destDecimals > 8 ? 8 : 6).replace(/\.?0+$/, "");

    // Min received after 0.5% slippage
    const minReceivedFloat = destFloat * 0.995;
    const minReceived = minReceivedFloat.toFixed(params.destDecimals > 8 ? 8 : 6).replace(/\.?0+$/, "");

    const srcFormatted = (Number(params.amount) / Math.pow(10, params.srcDecimals));
    const rate = `1 ${srcInfo?.symbol || "?"} = ${(destFloat / srcFormatted).toFixed(8)} ${destInfo?.symbol || "?"}`;

    return {
      srcToken: params.srcToken,
      srcSymbol: srcInfo?.symbol || "?",
      srcAmount: params.amount,
      destToken: params.destToken,
      destSymbol: destInfo?.symbol || "?",
      destAmount,
      destAmountFormatted: destFormatted,
      minReceived,
      rate,
      priceImpact: pr.priceImpact ? `${(Number(pr.priceImpact) * 100).toFixed(2)}%` : "<0.01%",
      gasCostUSD: pr.gasCostUSD ? `$${Number(pr.gasCostUSD).toFixed(2)}` : "~$0.05",
      route: routes,
      estimatedGas: pr.gasCost || "500000",
      priceRoute: pr,
    };
  } catch (error) {
    console.error("[swap] Quote failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

export async function buildSwapTransaction(params: {
  srcToken: string;
  destToken: string;
  srcAmount: string;
  priceRoute: any;
  userAddress: string;
  slippage?: number; // bps, default 100 (1%)
  chainKey?: string;
}): Promise<SwapTx | null> {
  try {
    const chain = getChain(params.chainKey);
    const networkId = chain.chainId;

    const res = await fetch(`${PARASWAP_API}/transactions/${networkId}?ignoreChecks=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        srcToken: params.srcToken,
        destToken: params.destToken,
        srcAmount: params.srcAmount,
        priceRoute: params.priceRoute,
        userAddress: params.userAddress,
        partner: "t402",
        slippage: params.slippage ?? 100,
        deadline: Math.floor(Date.now() / 1000) + 300, // 5 min
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.to || !data.data) return null;
    return {
      to: data.to,
      data: data.data,
      value: data.value || "0",
      chainId: data.chainId || networkId,
    };
  } catch (error) {
    console.error("[swap] Build tx failed:", error instanceof Error ? error.message : error);
    return null;
  }
}
