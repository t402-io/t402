"""TRON Exact Scheme - Server Implementation.

This module provides the server-side implementation of the exact payment scheme
for TRON network.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Optional, Union

from t402.types import (
    PaymentRequirementsV2,
    Network,
)
from t402.schemes.interfaces import AssetAmount, SupportedKindDict
from t402.tron import (
    SCHEME_EXACT,
    TRON_MAINNET,
    TRON_NILE,
    TRON_SHASTA,
    DEFAULT_DECIMALS,
    get_network_config,
    get_default_asset,
    get_asset_info,
    normalize_network as tron_normalize_network,
)


class ExactTronServerScheme:
    """Server scheme for TRON exact payments.

    Handles parsing user-friendly prices and enhancing payment requirements
    with TRON-specific metadata for clients.

    Example:
        ```python
        scheme = ExactTronServerScheme()

        # Parse price
        asset_amount = await scheme.parse_price("$0.10", "tron:mainnet")
        # Returns: {"amount": "100000", "asset": "TR7N...", "extra": {...}}

        # Enhance requirements
        enhanced = await scheme.enhance_requirements(
            requirements,
            supported_kind,
            facilitator_extensions,
        )
        ```
    """

    scheme = SCHEME_EXACT
    caip_family = "tron:*"

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
        - Dict (TokenAmount): {"amount": "100000", "asset": "TR7N..."}

        Args:
            price: User-friendly price
            network: Network identifier (CAIP-2 format, e.g., "tron:mainnet")

        Returns:
            AssetAmount dict with amount, asset, and extra metadata
        """
        # Normalize network
        network_str = self._normalize_network(network)

        # Handle dict (already in TokenAmount format)
        if isinstance(price, dict):
            return {
                "amount": str(price.get("amount", "0")),
                "asset": price.get("asset", ""),
                "extra": price.get("extra", {}),
            }

        # Get default asset (USDT) for the network
        default_asset = get_default_asset(network_str)
        if not default_asset:
            raise ValueError(f"Unsupported TRON network: {network}")

        asset_address = default_asset["contract_address"]
        decimals = default_asset.get("decimals", DEFAULT_DECIMALS)

        # Parse price string/number
        if isinstance(price, str):
            if price.startswith("$"):
                price = price[1:]
            amount_decimal = Decimal(price)
        else:
            amount_decimal = Decimal(str(price))

        # Convert to atomic units
        atomic_amount = int(amount_decimal * Decimal(10 ** decimals))

        # Build extra metadata
        extra = {
            "symbol": default_asset.get("symbol", "USDT"),
            "name": default_asset.get("name", "Tether USD"),
            "decimals": decimals,
        }

        return {
            "amount": str(atomic_amount),
            "asset": asset_address,
            "extra": extra,
        }

    async def enhance_requirements(
        self,
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
        supported_kind: SupportedKindDict,
        facilitator_extensions: List[str],
    ) -> Union[PaymentRequirementsV2, Dict[str, Any]]:
        """Enhance payment requirements with TRON-specific metadata.

        Adds TRC-20 token metadata to the extra field so clients can
        properly build the transfer transaction.

        Args:
            requirements: Base payment requirements
            supported_kind: Matched SupportedKind from facilitator
            facilitator_extensions: Extensions supported by facilitator

        Returns:
            Enhanced requirements with TRON metadata in extra
        """
        # Convert to dict for modification
        if hasattr(requirements, "model_dump"):
            req = requirements.model_dump(by_alias=True)
        else:
            req = dict(requirements)

        network = req.get("network", "")
        asset = req.get("asset", "")

        # Normalize network
        network_str = self._normalize_network(network)

        # Ensure extra exists
        if "extra" not in req or req["extra"] is None:
            req["extra"] = {}

        # Add TRC-20 metadata if not present
        asset_info = get_asset_info(network_str, asset)
        if asset_info:
            if "symbol" not in req["extra"]:
                req["extra"]["symbol"] = asset_info.get("symbol", "UNKNOWN")
            if "name" not in req["extra"]:
                req["extra"]["name"] = asset_info.get("name", "Unknown TRC20")
            if "decimals" not in req["extra"]:
                req["extra"]["decimals"] = asset_info.get("decimals", DEFAULT_DECIMALS)

        # Add network config info
        network_config = get_network_config(network_str)
        if network_config:
            if "endpoint" not in req["extra"]:
                req["extra"]["endpoint"] = network_config.get("endpoint", "")

        # Add facilitator extra data if available
        if supported_kind.get("extra"):
            for key, value in supported_kind["extra"].items():
                if key not in req["extra"]:
                    req["extra"][key] = value

        return req

    def _normalize_network(self, network: str) -> str:
        """Normalize network identifier to CAIP-2 format.

        Args:
            network: Network identifier

        Returns:
            Normalized CAIP-2 network string

        Raises:
            ValueError: If network is not supported
        """
        # Use the tron module's normalize function
        try:
            return tron_normalize_network(network)
        except ValueError:
            # Re-raise with consistent error message
            raise ValueError(f"Unknown TRON network: {network}")
