"""CoinGecko-backed token price fetcher with in-memory cache.

Mirrors the TypeScript `@t402/mcp` price service so cross-SDK behavior is
identical for MCP agents: same coin mapping, same cache TTL, same demo
table. Pure stdlib + requests (already a transitive dep via web3).
"""

from __future__ import annotations

import time
from threading import Lock
from typing import Optional
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import json

COINGECKO_API = "https://api.coingecko.com/api/v3/simple/price"
"""Base URL for CoinGecko simple price queries."""

PRICE_CACHE_TTL = 5 * 60.0
"""Cache lifetime in seconds — matches TS implementation."""

TOKEN_TO_COINGECKO_ID: dict[str, str] = {
    "ETH": "ethereum",
    "MATIC": "matic-network",
    "AVAX": "avalanche-2",
    "BERA": "berachain-bera",
    "USDC": "usd-coin",
    "USDT": "tether",
    "USDT0": "tether",
}
"""Curated ticker → CoinGecko slug mapping. Unknown tickers fall back to
the lowercased ticker as a best-effort guess."""

_DEMO_PRICES: dict[str, float] = {
    "ETH": 3250.42,
    "MATIC": 0.58,
    "AVAX": 24.15,
    "BERA": 3.82,
    "USDC": 1.0,
    "USDT": 1.0,
    "USDT0": 1.0,
}

_cache: dict[str, tuple[dict[str, float], float]] = {}
_cache_lock = Lock()


def get_token_prices(
    tokens: list[str],
    currency: str = "usd",
    *,
    timeout: float = 10.0,
) -> dict[str, float]:
    """Fetch live token prices from CoinGecko, with a 5-minute cache.

    Tokens are deduplicated and upper-cased before lookup. The result is a
    mapping from the upper-cased ticker to a price in the target currency;
    unknown tickers resolve to 0.0.
    """
    if currency == "":
        currency = "usd"

    upper_tokens: list[str] = []
    seen: set[str] = set()
    for t in tokens:
        u = t.upper()
        if u not in seen:
            upper_tokens.append(u)
            seen.add(u)

    cache_key = f"{currency}:{','.join(sorted(upper_tokens))}"
    with _cache_lock:
        entry = _cache.get(cache_key)
        if entry and time.time() - entry[1] < PRICE_CACHE_TTL:
            return entry[0]

    coin_ids: list[str] = []
    coin_seen: set[str] = set()
    token_to_coin: dict[str, str] = {}
    for token in upper_tokens:
        coin_id = TOKEN_TO_COINGECKO_ID.get(token, token.lower())
        token_to_coin[token] = coin_id
        if coin_id not in coin_seen:
            coin_ids.append(coin_id)
            coin_seen.add(coin_id)

    query = urlencode({"ids": ",".join(coin_ids), "vs_currencies": currency})
    url = f"{COINGECKO_API}?{query}"
    req = Request(url, headers={"User-Agent": "t402-mcp/1.0"})

    with urlopen(req, timeout=timeout) as resp:
        if resp.status != 200:
            raise RuntimeError(f"CoinGecko API error: {resp.status}")
        data = json.loads(resp.read().decode("utf-8"))

    prices: dict[str, float] = {}
    for token in upper_tokens:
        coin_id = token_to_coin[token]
        prices[token] = float(data.get(coin_id, {}).get(currency, 0.0))

    with _cache_lock:
        _cache[cache_key] = (prices, time.time())
    return prices


def get_token_prices_demo(tokens: list[str]) -> dict[str, float]:
    """Return demo prices for the given tokens without touching the network.

    Matches the TS demo table; unknown tickers resolve to 0.0.
    """
    out: dict[str, float] = {}
    for token in tokens:
        u = token.upper()
        out[u] = _DEMO_PRICES.get(u, 0.0)
    return out


def clear_price_cache() -> None:
    """Reset the in-memory cache. Test hook only."""
    with _cache_lock:
        _cache.clear()
