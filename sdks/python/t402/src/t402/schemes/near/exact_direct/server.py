"""NEAR Exact-Direct Scheme - Server Implementation.

This module provides the server-side implementation of the exact-direct payment
scheme for NEAR networks.

The server:
1. Parses user-friendly prices into atomic token amounts (6 decimals for USDT).
2. Enhances payment requirements with the token contract address and metadata.
"""

from __future__ import annotations

import logging
from decimal import Decimal, ROUND_DOWN
from typing import Any, Dict, List, Optional, Union

from t402.types import PaymentRequirementsV2, Network
from t402.schemes.interfaces import AssetAmount, SupportedKindDict
from t402.schemes.near.constants import (
    SCHEME_EXACT_DIRECT,
    CAIP_FAMILY,
    TokenInfo,
    get_network_config,
    get_token_by_contract,
    get_token_info,
    is_valid_network,
)


logger = logging.getLogger(__name__)


class ExactDirectNearServerConfig:
    """Configuration for the ExactDirectNearServerScheme.

    Attributes:
        preferred_token: Preferred token symbol (e.g., "USDT").
            Defaults to the network's default token if not set.
    """

    def __init__(self, preferred_token: Optional[str] = None) -> None:
        self.preferred_token = preferred_token


class ExactDirectNearServerScheme:
    """Server scheme for NEAR exact-direct payments.

    Handles parsing user-friendly prices to atomic token amounts and enhancing
    payment requirements with NEAR-specific metadata.

    Example:
        ```python
        scheme = ExactDirectNearServerScheme()

        # Parse a USD price to USDT atomic units
        asset_amount = await scheme.parse_price("$1.50", "near:mainnet")
        # Returns: {"amount": "1500000", "asset": "usdt.tether-token.near", "extra": {...}}

        # Enhance requirements with token metadata
        enhanced = await scheme.enhance_requirements(
            requirements, supported_kind, extensions
        )
        ```
    """

    def __init__(
        self,
        config: Optional[ExactDirectNearServerConfig] = None,
    ) -> None:
        """Initialize the server scheme.

        Args:
            config: Optional configuration. If not provided, defaults are used.
        """
        self._config = config or ExactDirectNearServerConfig()

    @property
    def scheme(self) -> str:
        """The scheme identifier."""
        return SCHEME_EXACT_DIRECT

    @property
    def caip_family(self) -> str:
        """The CAIP-2 family pattern for NEAR networks."""
        return CAIP_FAMILY

    async def parse_price(
        self,
        price: Union[str, int, float, Dict[str, Any]],
        network: Network,
    ) -> AssetAmount:
        """Parse a user-friendly price to atomic amount and asset.

        Supports:
        - String with $ prefix: "$1.50" -> 1500000 (6 decimals)
        - String without prefix: "1.50" -> 1500000
        - Integer/float: 1.50 -> 1500000
        - Dict (already parsed): {"amount": "1500000", "asset": "usdt.tether-token.near"}

        Args:
            price: User-friendly price.
            network: Network identifier (CAIP-2 format, e.g., "near:mainnet").

        Returns:
            AssetAmount dict with amount (atomic units string), asset (contract ID),
            and extra metadata (symbol, decimals).

        Raises:
            ValueError: If price format is invalid or network is unsupported.
        """
        if not is_valid_network(network):
            raise ValueError(f"Unsupported network: {network}")

        # Handle dict (already in AssetAmount format)
        if isinstance(price, dict):
            if "amount" in price:
                token = self._get_default_token(network)
                asset = price.get("asset", token.contract_id)
                extra = price.get("extra", {})
                return {
                    "amount": str(price["amount"]),
                    "asset": asset,
                    "extra": extra,
                }

        # Parse money to decimal
        decimal_amount = self._parse_money_to_decimal(price)

        # Convert to atomic units using the default token
        return self._default_money_conversion(decimal_amount, network)

    async def enhance_requirements(
        self,
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
        supported_kind: SupportedKindDict,
        facilitator_extensions: List[str],
    ) -> Union[PaymentRequirementsV2, Dict[str, Any]]:
        """Enhance payment requirements with NEAR-specific metadata.

        Adds token contract as asset and includes symbol/decimals metadata
        from the facilitator's supported kinds response.

        Args:
            requirements: Base payment requirements with amount set.
            supported_kind: The matched SupportedKind from facilitator.
            facilitator_extensions: Extensions supported by the facilitator.

        Returns:
            Enhanced requirements with asset and extra metadata.
        """
        # Convert to dict for modification
        if hasattr(requirements, "model_dump"):
            req = requirements.model_dump(by_alias=True)
        else:
            req = dict(requirements)

        network = req.get("network", "")

        if not is_valid_network(network):
            raise ValueError(f"Unsupported network: {network}")

        # If asset is not set, use the default token for the network
        if not req.get("asset"):
            token = self._get_default_token(network)
            req["asset"] = token.contract_id

        # If amount contains a decimal point, convert to atomic units
        amount = req.get("amount", "")
        if amount and "." in amount:
            token = get_token_by_contract(network, req["asset"])
            decimals = token.decimals if token else 6
            req["amount"] = self._to_atomic_units(amount, decimals)

        # Initialize extra map if needed
        if "extra" not in req or req["extra"] is None:
            req["extra"] = {}

        # Add facilitator-provided extra fields (asset metadata)
        if supported_kind.get("extra"):
            sk_extra = supported_kind["extra"]
            if "assetSymbol" in sk_extra:
                req["extra"]["assetSymbol"] = sk_extra["assetSymbol"]
            if "assetDecimals" in sk_extra:
                req["extra"]["assetDecimals"] = sk_extra["assetDecimals"]

        # Copy extension keys from supportedKind
        if supported_kind.get("extra"):
            for key in facilitator_extensions:
                if key in supported_kind["extra"]:
                    req["extra"][key] = supported_kind["extra"][key]

        return req

    def _get_default_token(self, network: str) -> TokenInfo:
        """Get the default token for a network.

        Priority: configured preferred_token > network default.

        Args:
            network: The CAIP-2 network identifier.

        Returns:
            TokenInfo for the default token.
        """
        # If a preferred token is configured, try to use it
        if self._config.preferred_token:
            token = get_token_info(network, self._config.preferred_token)
            if token:
                return token

        # Fall back to network default
        config = get_network_config(network)
        if config:
            return config.default_token

        # Final fallback (should not happen for valid networks)
        from t402.schemes.near.constants import USDT_MAINNET
        return USDT_MAINNET

    def _parse_money_to_decimal(self, price: Union[str, int, float]) -> Decimal:
        """Convert a money value to a Decimal amount.

        Handles formats like "$1.50", "1.50", 1.50, etc.

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
                clean_price = clean_price[1:]
            clean_price = clean_price.strip()

            # Use the first space-separated part as the amount
            parts = clean_price.split()
            if parts:
                try:
                    return Decimal(parts[0])
                except Exception:
                    raise ValueError(f"Failed to parse price string: {price!r}")
            raise ValueError("Empty price string after cleanup")
        elif isinstance(price, (int, float)):
            return Decimal(str(price))
        else:
            raise ValueError(f"Invalid price format: {price!r}")

    def _default_money_conversion(self, amount: Decimal, network: str) -> AssetAmount:
        """Convert a decimal amount to the default token's atomic units.

        Args:
            amount: Decimal amount in human-readable units.
            network: The CAIP-2 network identifier.

        Returns:
            AssetAmount with atomic units, contract ID, and metadata.
        """
        token = self._get_default_token(network)
        atomic_amount = self._to_atomic_units(str(amount), token.decimals)

        return {
            "amount": atomic_amount,
            "asset": token.contract_id,
            "extra": {
                "symbol": token.symbol,
                "decimals": token.decimals,
            },
        }

    def _to_atomic_units(self, amount: str, decimals: int) -> str:
        """Convert a decimal string amount to atomic units string.

        For example, with decimals=6: "1.50" -> "1500000".

        Args:
            amount: The decimal amount string.
            decimals: The number of decimal places for the token.

        Returns:
            Atomic units as a string.

        Raises:
            ValueError: If the amount is invalid or negative.
        """
        amount = amount.strip()
        parsed = Decimal(amount)

        if parsed < 0:
            raise ValueError("Amount must be non-negative")

        # Convert to atomic units
        multiplier = Decimal(10) ** decimals
        atomic = parsed * multiplier

        # Truncate to integer (no rounding up)
        atomic_int = int(atomic.to_integral_value(rounding=ROUND_DOWN))

        return str(atomic_int)
