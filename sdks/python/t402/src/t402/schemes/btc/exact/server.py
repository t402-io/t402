"""Bitcoin On-chain Exact Scheme - Server Implementation.

This module provides the server-side implementation of the exact payment
scheme for Bitcoin on-chain payments.

The server:
1. Parses user-friendly prices into satoshi amounts.
2. Enhances payment requirements with BTC-specific metadata.
"""

from __future__ import annotations

import logging
from decimal import Decimal, ROUND_DOWN
from typing import Any, Dict, List, Optional, Union

from t402.types import PaymentRequirementsV2, Network
from t402.schemes.interfaces import AssetAmount, SupportedKindDict
from t402.schemes.btc.constants import (
    SCHEME_EXACT,
    BTC_CAIP_FAMILY,
    SATS_PER_BTC,
    is_valid_btc_network,
)


logger = logging.getLogger(__name__)


class ExactBtcServerConfig:
    """Configuration for the ExactBtcServerScheme.

    Attributes:
        pay_to: The Bitcoin address to receive payments.
    """

    def __init__(self, pay_to: str = "") -> None:
        self.pay_to = pay_to


class ExactBtcServerScheme:
    """Server scheme for Bitcoin on-chain exact payments.

    Handles parsing user-friendly prices to satoshi amounts and enhancing
    payment requirements with BTC-specific metadata.

    For Bitcoin, the asset is always "BTC" and amounts are in satoshis.

    Example:
        ```python
        scheme = ExactBtcServerScheme(
            config=ExactBtcServerConfig(pay_to="bc1q...")
        )

        # Parse a BTC price to satoshis
        asset_amount = await scheme.parse_price(0.001, "bip122:000000000019d6689c085ae165831e93")
        # Returns: {"amount": "100000", "asset": "BTC", "extra": {...}}
        ```
    """

    def __init__(
        self,
        config: Optional[ExactBtcServerConfig] = None,
    ) -> None:
        """Initialize the server scheme.

        Args:
            config: Optional configuration with payTo address.
        """
        self._config = config or ExactBtcServerConfig()

    @property
    def scheme(self) -> str:
        """The scheme identifier."""
        return SCHEME_EXACT

    @property
    def caip_family(self) -> str:
        """The CAIP-2 family pattern for BTC networks."""
        return BTC_CAIP_FAMILY

    async def parse_price(
        self,
        price: Union[str, int, float, Dict[str, Any]],
        network: Network,
    ) -> AssetAmount:
        """Parse a user-friendly price to satoshi amount and asset.

        Supports:
        - Dict (already parsed AssetAmount): returned directly
        - Number/String: treated as BTC amount, converted to satoshis

        Args:
            price: User-friendly price.
            network: Network identifier (CAIP-2 format).

        Returns:
            AssetAmount dict with amount (satoshis string), asset ("BTC"),
            and extra metadata.

        Raises:
            ValueError: If price format is invalid.
        """
        # Handle dict (already in AssetAmount format)
        if isinstance(price, dict):
            if "amount" in price:
                if not price.get("asset"):
                    raise ValueError(
                        f"Asset must be specified for AssetAmount on network {network}"
                    )
                return {
                    "amount": str(price["amount"]),
                    "asset": price["asset"],
                    "extra": price.get("extra", {}),
                }

        # Parse money to decimal
        decimal_amount = self._parse_money_to_decimal(price)

        # Default: convert to satoshis
        return self._default_money_conversion(decimal_amount)

    async def enhance_requirements(
        self,
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
        supported_kind: SupportedKindDict,
        facilitator_extensions: List[str],
    ) -> Union[PaymentRequirementsV2, Dict[str, Any]]:
        """Enhance payment requirements with BTC-specific metadata.

        Sets the payTo address and asset if not already set.

        Args:
            requirements: Base payment requirements with amount set.
            supported_kind: The matched SupportedKind from facilitator.
            facilitator_extensions: Extensions supported by the facilitator.

        Returns:
            Enhanced requirements with asset and payTo.
        """
        # Convert to dict for modification
        if hasattr(requirements, "model_dump"):
            req = requirements.model_dump(by_alias=True)
        else:
            req = dict(requirements)

        # Set payTo if not already specified
        if not req.get("payTo") and self._config.pay_to:
            req["payTo"] = self._config.pay_to

        # Set asset to BTC if not already specified
        if not req.get("asset"):
            req["asset"] = "BTC"

        return req

    def _parse_money_to_decimal(self, price: Union[str, int, float]) -> Decimal:
        """Convert a money value to a Decimal amount.

        Args:
            price: The price value to parse.

        Returns:
            Decimal amount.

        Raises:
            ValueError: If the price format is invalid.
        """
        if isinstance(price, str):
            clean_price = price.strip()
            if clean_price.startswith("$"):
                clean_price = clean_price[1:].strip()

            try:
                return Decimal(clean_price)
            except Exception:
                raise ValueError(f"Invalid money format: {price!r}")
        elif isinstance(price, (int, float)):
            if isinstance(price, float) and not (
                price == price and price != float("inf") and price != float("-inf")
            ):
                raise ValueError(f"Invalid money value: {price}")
            return Decimal(str(price))
        else:
            raise ValueError(f"Invalid money format: {price!r}")

    def _default_money_conversion(self, amount: Decimal) -> AssetAmount:
        """Default money conversion: treat amount as BTC, convert to satoshis.

        Args:
            amount: Decimal amount in BTC.

        Returns:
            AssetAmount with satoshi amount and BTC asset.
        """
        sats = int((amount * SATS_PER_BTC).to_integral_value(rounding=ROUND_DOWN))

        return {
            "amount": str(sats),
            "asset": "BTC",
            "extra": {
                "symbol": "BTC",
                "decimals": 8,
            },
        }
