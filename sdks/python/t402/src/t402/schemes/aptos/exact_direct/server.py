"""Aptos Exact-Direct Scheme - Server Implementation.

This module provides the server-side implementation of the exact-direct payment
scheme for Aptos. It handles parsing user-friendly prices into atomic units
and enhancing payment requirements with Aptos-specific metadata.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Union

from t402.types import (
    PaymentRequirementsV2,
    Network,
)
from t402.schemes.interfaces import AssetAmount, SupportedKindDict
from t402.schemes.aptos.constants import (
    SCHEME_EXACT_DIRECT,
    CAIP_FAMILY,
    DEFAULT_DECIMALS,
    get_network_config,
    get_token_by_address,
    get_token_info,
    parse_amount,
    TokenInfo,
)


logger = logging.getLogger(__name__)


class ExactDirectAptosServerScheme:
    """Server scheme for Aptos exact-direct payments.

    Handles parsing user-friendly prices (e.g., "$1.50") into atomic FA amounts
    and enhancing payment requirements with Aptos-specific metadata such as
    token symbol, name, and decimals.

    Example:
        ```python
        scheme = ExactDirectAptosServerScheme()

        # Parse a price
        asset_amount = await scheme.parse_price("$0.10", "aptos:1")
        # Returns: {"amount": "100000", "asset": "0xf73e...", "extra": {...}}

        # Enhance requirements
        enhanced = await scheme.enhance_requirements(
            requirements,
            supported_kind,
            facilitator_extensions,
        )
        ```

    Attributes:
        scheme: The scheme identifier ("exact-direct").
        caip_family: The CAIP-2 family pattern ("aptos:*").
    """

    scheme = SCHEME_EXACT_DIRECT
    caip_family = CAIP_FAMILY

    def __init__(self, preferred_token: Optional[str] = None) -> None:
        """Initialize the Aptos exact-direct server scheme.

        Args:
            preferred_token: Preferred token symbol (e.g., "USDT").
                Defaults to the network's default token if not specified.
        """
        self._preferred_token = preferred_token

    async def parse_price(
        self,
        price: Union[str, int, float, Dict[str, Any]],
        network: Network,
    ) -> AssetAmount:
        """Parse a user-friendly price to atomic amount and asset.

        Supports multiple input formats:
        - String with $ prefix: "$0.10" -> 100000 (6 decimals)
        - String without prefix: "0.10" -> 100000
        - Integer/float: 0.10 -> 100000
        - Dict (pre-parsed TokenAmount): {"amount": "100000", "asset": "0x..."}

        Args:
            price: User-friendly price in any supported format.
            network: CAIP-2 network identifier (e.g., "aptos:1").

        Returns:
            AssetAmount dict with:
            - amount: Atomic amount as string
            - asset: FA metadata address
            - extra: Token metadata (symbol, name, decimals)

        Raises:
            ValueError: If price format is invalid or network is unsupported.
        """
        network_str = str(network)

        # Validate network
        config = get_network_config(network_str)
        if not config:
            raise ValueError(f"Unsupported Aptos network: {network}")

        # Handle dict (already in TokenAmount format)
        if isinstance(price, dict):
            amount_val = price.get("amount", "0")
            asset = price.get("asset", config.default_token.metadata_address)
            extra = price.get("extra", {})

            if not asset:
                raise ValueError(
                    f"Asset address must be specified for AssetAmount on network {network}"
                )

            return {
                "amount": str(amount_val),
                "asset": asset,
                "extra": extra,
            }

        # Parse money to decimal number
        decimal_amount = self._parse_money_to_decimal(price)

        # Get the appropriate token
        token = self._get_default_token(network_str, config)

        # Convert decimal to atomic units
        amount_str = f"{decimal_amount:.{token.decimals}f}"
        atomic_amount = parse_amount(amount_str, token.decimals)

        return {
            "amount": str(atomic_amount),
            "asset": token.metadata_address,
            "extra": {
                "symbol": token.symbol,
                "name": token.name,
                "decimals": token.decimals,
            },
        }

    async def enhance_requirements(
        self,
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
        supported_kind: SupportedKindDict,
        facilitator_extensions: List[str],
    ) -> Union[PaymentRequirementsV2, Dict[str, Any]]:
        """Enhance payment requirements with Aptos-specific metadata.

        Adds FA token metadata (symbol, name, decimals) to the extra field
        and converts decimal amounts to atomic units if needed.

        Args:
            requirements: Base payment requirements with amount/asset set.
            supported_kind: The matched SupportedKind from the facilitator.
            facilitator_extensions: Extensions supported by the facilitator.

        Returns:
            Enhanced requirements with Aptos metadata in the extra field.

        Raises:
            ValueError: If the network is unsupported or amount parsing fails.
        """
        # Convert to dict for modification
        if hasattr(requirements, "model_dump"):
            req = requirements.model_dump(by_alias=True)
        else:
            req = dict(requirements)

        network = req.get("network", "")
        asset = req.get("asset", "")

        # Validate network
        config = get_network_config(network)
        if not config:
            raise ValueError(f"Unsupported Aptos network: {network}")

        # Determine token info
        token_info: Optional[TokenInfo] = None
        if asset:
            # Try to find by address
            token_info = get_token_by_address(network, asset)
            if not token_info:
                # Use generic token with default decimals
                token_info = TokenInfo(
                    metadata_address=asset,
                    symbol="UNKNOWN",
                    name="Unknown Token",
                    decimals=DEFAULT_DECIMALS,
                )
        else:
            # Use default token
            token_info = self._get_default_token(network, config)
            req["asset"] = token_info.metadata_address

        # Convert decimal amount to atomic units if needed
        amount = req.get("amount", "")
        if amount and "." in amount:
            atomic = parse_amount(amount, token_info.decimals)
            req["amount"] = str(atomic)

        # Initialize extra map if needed
        if "extra" not in req or req["extra"] is None:
            req["extra"] = {}

        # Add asset metadata to extra
        req["extra"]["symbol"] = token_info.symbol
        req["extra"]["name"] = token_info.name
        req["extra"]["decimals"] = token_info.decimals

        # Copy facilitator-provided extra fields
        kind_extra = supported_kind.get("extra") if isinstance(supported_kind, dict) else None
        if kind_extra:
            if "assetSymbol" in kind_extra:
                req["extra"]["assetSymbol"] = kind_extra["assetSymbol"]
            if "assetDecimals" in kind_extra:
                req["extra"]["assetDecimals"] = kind_extra["assetDecimals"]

            # Copy specific extension keys
            for key in facilitator_extensions:
                if key in kind_extra:
                    req["extra"][key] = kind_extra[key]

        return req

    def _get_default_token(self, network: str, config: Any) -> TokenInfo:
        """Get the default token for a network, considering preferred token config.

        Args:
            network: CAIP-2 network identifier.
            config: NetworkConfig for the network.

        Returns:
            TokenInfo for the default or preferred token.
        """
        if self._preferred_token:
            token = get_token_info(network, self._preferred_token)
            if token:
                return token
        return config.default_token

    def _parse_money_to_decimal(self, price: Union[str, int, float]) -> float:
        """Convert a price value to a decimal amount.

        Args:
            price: Price as string (e.g., "$1.50"), int, or float.

        Returns:
            Decimal amount as float.

        Raises:
            ValueError: If the price format cannot be parsed.
        """
        if isinstance(price, str):
            clean = price.strip()
            # Remove $ prefix
            if clean.startswith("$"):
                clean = clean[1:].strip()
            # Take the first token (handle "1.50 USDT" format)
            parts = clean.split()
            if parts:
                try:
                    return float(parts[0])
                except ValueError:
                    raise ValueError(f"Failed to parse price string: '{price}'")
            raise ValueError(f"Empty price string: '{price}'")

        if isinstance(price, (int, float)):
            return float(price)

        raise ValueError(f"Invalid price format: {price}")
