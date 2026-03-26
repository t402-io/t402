/**
 * ParaSwap DEX aggregator service for real swap quotes
 * Free API, no auth needed
 */

// Supported tokens on Arbitrum (chain ID 42161)
const SWAP_TOKENS = [
  { symbol: "USDT", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6, name: "Tether USD" },
  { symbol: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6, name: "USD Coin" },
  { symbol: "ETH", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18, name: "Ethereum" },
  { symbol: "WBTC", address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", decimals: 8, name: "Wrapped Bitcoin" },
  { symbol: "ARB", address: "0x912CE59144191C1204E64559FE8253a0e49E6548", decimals: 18, name: "Arbitrum" },
  { symbol: "LINK", address: "0xf97f4df75117a78c1A5a0DBb814Af92458539FB4", decimals: 18, name: "Chainlink" },
  { symbol: "UNI", address: "0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0", decimals: 18, name: "Uniswap" },
  { symbol: "DAI", address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", decimals: 18, name: "Dai" },
];

const NETWORK_ID = 42161; // Arbitrum One
const PARASWAP_API = "https://api.paraswap.io";

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

export function getSupportedTokens() { return SWAP_TOKENS; }

export async function getSwapQuote(params: {
  srcToken: string;  // token address
  destToken: string;
  amount: string;    // in token smallest units
  srcDecimals: number;
  destDecimals: number;
}): Promise<SwapQuote | null> {
  try {
    const url = `${PARASWAP_API}/prices?srcToken=${params.srcToken}&destToken=${params.destToken}&amount=${params.amount}&srcDecimals=${params.srcDecimals}&destDecimals=${params.destDecimals}&network=${NETWORK_ID}&side=SELL`;

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
    const srcInfo = SWAP_TOKENS.find(t => t.address.toLowerCase() === params.srcToken.toLowerCase());
    const destInfo = SWAP_TOKENS.find(t => t.address.toLowerCase() === params.destToken.toLowerCase());

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
}): Promise<SwapTx | null> {
  try {
    const res = await fetch(`${PARASWAP_API}/transactions/${NETWORK_ID}?ignoreChecks=true`, {
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
      chainId: data.chainId || NETWORK_ID,
    };
  } catch (error) {
    console.error("[swap] Build tx failed:", error instanceof Error ? error.message : error);
    return null;
  }
}
