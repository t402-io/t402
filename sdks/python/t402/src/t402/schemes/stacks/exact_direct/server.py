"""Stacks Exact-Direct Scheme - Server Implementation.

This module provides the server-side implementation of the exact-direct
payment scheme for Stacks (Bitcoin L2) networks.

The server:
1. Parses user-friendly prices (e.g., "$0.10") into atomic amounts
2. Enhances payment requirements with Stacks-specific metadata
   (contract address, decimals, network name, CAIP-19 asset identifier)
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Union

from t402.types import (
    PaymentRequirementsV2,
    Network,
)
from t402.schemes.interfaces import AssetAmount, SupportedKindDict
from t402.schemes.stacks.constants import (
    SCHEME_EXACT_DIRECT,
    NetworkConfig,
    TokenInfo,
    get_network_config,
    is_stacks_network,
)
from t402.schemes.stacks.types import create_asset_identifier


class ExactDirectStacksServerScheme:
    """Server scheme for Stacks exact-direct payments.

    Handles parsing user-friendly prices into atomic amounts and
    enhancing payment requirements with Stacks-specific metadata.

    Example:
        ```python
        scheme = ExactDirectStacksServerScheme()

        # Parse price to atomic units
        asset_amount = await scheme.parse_price("$0.10", "stacks:1")
        # Returns: {"amount": "100000", "asset": "stacks:1/token:SP3Y2...", "extra": {...}}

        # Enhance requirements with metadata
        enhanced = await scheme.enhance_requirements(
            requirements,
            supported_kind,
            facilitator_extensions,
        )
        ```
    """

    scheme = SCHEME_EXACT_DIRECT
    caip_family = "stacks:*"

    def __init__(self, preferred_token: Optional[str] = None):
        """Initialize the Stacks server scheme.

        Args:
            preferred_token: Override the default token symbol (e.g., "sUSDC")
        """
        self._preferred_token = preferred_token

    async def parse_price(
        self,
        price: Union[str, int, float, Dict[str, Any]],
        network: Network,
    ) -> AssetAmount:
        """Parse a user-friendly price to atomic amount and asset.

        Supports:
        - String with $ prefix: "$0.10" -> 100000 (6 decimals)
        - String without prefix: "0.10" -> 100000
        - Integer/float: 0.10 -> 100000
        - Dict (pre-parsed): {"amount": "100000", "asset": "..."}

        Args:
            price: User-friendly price value
            network: CAIP-2 network identifier

        Returns:
            AssetAmount dict with amount, asset, and extra metadata

        Raises:
            ValueError: If the network is unsupported or price is invalid
        """
        # Validate network
        if not is_stacks_network(network):
            raise ValueError(f"Invalid Stacks network: {network}")

        network_config = get_network_config(network)

        # Handle dict (already in pre-parsed format)
        if isinstance(price, dict):
            amount_str = str(price.get("amount", "0"))
            asset = price.get("asset", "")
            if not asset:
                asset = create_asset_identifier(
                    network, network_config.default_token.contract_address
                )
            extra = price.get("extra", {})
            return {
                "amount": amount_str,
                "asset": asset,
                "extra": extra,
            }

        # Get default token for this network
        token = self._get_token(network, network_config)

        # Parse price string/number to decimal
        decimal_amount = self._parse_money_to_decimal(price)

        # Convert to atomic units
        atomic_amount = self._to_atomic_units(decimal_amount, token.decimals)

        # Build asset identifier
        asset_identifier = create_asset_identifier(network, token.contract_address)

        # Build extra metadata
        extra = {
            "symbol": token.symbol,
            "name": token.name,
            "decimals": token.decimals,
            "contractAddress": token.contract_address,
        }

        return {
            "amount": str(atomic_amount),
            "asset": asset_identifier,
            "extra": extra,
        }

    async def enhance_requirements(
        self,
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
        supported_kind: SupportedKindDict,
        facilitator_extensions: List[str],
    ) -> Union[PaymentRequirementsV2, Dict[str, Any]]:
        """Enhance payment requirements with Stacks-specific metadata.

        Adds asset metadata (contract address, symbol, decimals, network name)
        and the CAIP-19 asset identifier to the requirements.

        Args:
            requirements: Base payment requirements
            supported_kind: Matched SupportedKind from facilitator
            facilitator_extensions: Extensions supported by facilitator

        Returns:
            Enhanced requirements with Stacks metadata in extra

        Raises:
            ValueError: If the network is not recognized
        """
        # Convert to dict for modification
        if hasattr(requirements, "model_dump"):
            req = requirements.model_dump(by_alias=True)
        else:
            req = dict(requirements)

        network = req.get("network", "")

        # Get network config
        network_config = get_network_config(network)

        # Get token info
        token = self._get_token(network, network_config)

        # Set asset identifier if not already set
        if not req.get("asset"):
            req["asset"] = create_asset_identifier(network, token.contract_address)

        # Ensure amount is in atomic units (no decimals)
        amount = req.get("amount", "")
        if amount and "." in amount:
            atomic = self._parse_amount_string(amount, token.decimals)
            req["amount"] = str(atomic)

        # Ensure extra exists
        if "extra" not in req or req["extra"] is None:
            req["extra"] = {}

        # Add asset metadata
        req["extra"]["contractAddress"] = token.contract_address
        req["extra"]["assetSymbol"] = token.symbol
        req["extra"]["assetDecimals"] = token.decimals
        req["extra"]["networkName"] = network_config.name

        # Add facilitator-provided extra fields from supportedKind
        if supported_kind.get("extra"):
            for key in ("contractAddress", "assetSymbol", "assetDecimals", "networkName"):
                if key in supported_kind["extra"]:
                    req["extra"][key] = supported_kind["extra"][key]

        # Copy extension keys from supportedKind
        if supported_kind.get("extra"):
            for key in facilitator_extensions:
                if key in supported_kind["extra"]:
                    req["extra"][key] = supported_kind["extra"][key]

        return req

    def _get_token(self, network: str, network_config: NetworkConfig) -> TokenInfo:
        """Get the token to use for the given network.

        Uses the preferred token if configured and available,
        otherwise falls back to the network's default token.

        Args:
            network: CAIP-2 network identifier
            network_config: Network configuration

        Returns:
            TokenInfo for the selected token
        """
        if self._preferred_token:
            if network_config.default_token.symbol == self._preferred_token:
                return network_config.default_token
        return network_config.default_token

    def _parse_money_to_decimal(self, price: Union[str, int, float]) -> float:
        """Parse a money value to a decimal float.

        Handles:
        - "$0.10" -> 0.10
        - "0.10" -> 0.10
        - 0.10 -> 0.10
        - "1.50 sUSDC" -> 1.50

        Args:
            price: Price value to parse

        Returns:
            Decimal amount as float

        Raises:
            ValueError: If the price format is invalid
        """
        if isinstance(price, (int, float)):
            return float(price)

        if isinstance(price, str):
            clean = price.strip()
            clean = clean.lstrip("$").strip()

            # Take only the numeric part (first token)
            parts = clean.split()
            if parts:
                try:
                    return float(parts[0])
                except ValueError:
                    raise ValueError(f"Failed to parse price string: '{price}'")

        raise ValueError(f"Invalid price format: {price}")

    def _to_atomic_units(self, amount: float, decimals: int) -> int:
        """Convert a decimal amount to atomic units.

        Args:
            amount: Decimal amount (e.g., 1.50)
            decimals: Number of decimal places (e.g., 6)

        Returns:
            Atomic amount as integer (e.g., 1500000)
        """
        multiplier = 10 ** decimals
        return int(round(amount * multiplier))

    def _parse_amount_string(self, amount_str: str, decimals: int) -> int:
        """Parse a decimal amount string to atomic units.

        Args:
            amount_str: Amount as string (e.g., "1.50")
            decimals: Number of decimal places

        Returns:
            Atomic amount as integer

        Raises:
            ValueError: If the amount string is invalid
        """
        try:
            amount = float(amount_str)
        except ValueError:
            raise ValueError(f"Invalid amount: {amount_str}")

        if amount < 0:
            raise ValueError(f"Amount must be non-negative: {amount_str}")

        return self._to_atomic_units(amount, decimals)
