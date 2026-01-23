"""Solana SVM Exact Scheme - Server Implementation.

This module provides the server-side implementation of the exact payment scheme
for Solana network.

The server parses user-friendly prices into atomic token amounts and enhances
payment requirements with the facilitator's fee payer address so clients can
build transactions correctly.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Optional, Union

from t402.types import (
    PaymentRequirementsV2,
    Network,
)
from t402.schemes.interfaces import AssetAmount, SupportedKindDict
from t402.svm import (
    SCHEME_EXACT,
    SOLANA_MAINNET,
    DEFAULT_DECIMALS,
    normalize_network,
    get_network_config,
    get_default_asset,
    get_asset_info,
    is_svm_network,
)


class ExactSvmServerScheme:
    """Server scheme for Solana exact payments.

    Handles parsing user-friendly prices and enhancing payment requirements
    with SVM-specific metadata for clients.

    Example:
        ```python
        scheme = ExactSvmServerScheme()

        # Parse price
        asset_amount = await scheme.parse_price(
            "$0.10", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"
        )
        # Returns: {"amount": "100000", "asset": "EPjFWdd5...", "extra": {...}}

        # Enhance requirements
        enhanced = await scheme.enhance_requirements(
            requirements,
            supported_kind,
            facilitator_extensions,
        )
        ```
    """

    scheme = SCHEME_EXACT
    caip_family = "solana:*"

    async def parse_price(
        self,
        price: Union[str, int, float, Dict[str, Any]],
        network: Network,
    ) -> AssetAmount:
        """Parse a user-friendly price to atomic amount and asset.

        Supports:
        - String with $ prefix: "$0.10" -> 100000 (6 decimals for USDC)
        - String without prefix: "0.10" -> 100000
        - Integer/float: 0.10 -> 100000
        - Dict (TokenAmount): {"amount": "100000", "asset": "EPjFWdd5..."}

        Args:
            price: User-friendly price
            network: Network identifier (CAIP-2 format)

        Returns:
            AssetAmount dict with amount, asset, and extra metadata

        Raises:
            ValueError: If price format is invalid or network is unsupported
        """
        # Validate and normalize network
        network_str = self._normalize_network(network)

        # Handle dict (already in TokenAmount format)
        if isinstance(price, dict):
            return {
                "amount": str(price.get("amount", "0")),
                "asset": price.get("asset", ""),
                "extra": price.get("extra", {}),
            }

        # Get default asset (USDC) for the network
        default_asset = get_default_asset(network_str)
        if not default_asset:
            raise ValueError(f"Unsupported Solana network: {network}")

        asset_address = default_asset["mint_address"]
        decimals = default_asset.get("decimals", DEFAULT_DECIMALS)

        # Parse price string/number
        if isinstance(price, str):
            if price.startswith("$"):
                price = price[1:]
            amount_decimal = Decimal(price)
        else:
            amount_decimal = Decimal(str(price))

        # Convert to atomic units
        atomic_amount = int(amount_decimal * Decimal(10**decimals))

        # Build extra metadata
        extra: Dict[str, Any] = {
            "symbol": default_asset.get("symbol", "USDC"),
            "name": default_asset.get("name", "USD Coin"),
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
        """Enhance payment requirements with SVM-specific metadata.

        Adds the facilitator's fee payer address and token metadata to the
        extra field so clients can build valid transactions.

        Args:
            requirements: Base payment requirements
            supported_kind: Matched SupportedKind from facilitator's /supported
            facilitator_extensions: Extensions supported by facilitator

        Returns:
            Enhanced requirements with SVM metadata in extra
        """
        # Convert to dict for modification
        if hasattr(requirements, "model_dump"):
            req = requirements.model_dump(by_alias=True)
        else:
            req = dict(requirements)

        network = req.get("network", "")
        asset = req.get("asset", "")

        # Normalize network to CAIP-2 format
        network_str = self._normalize_network(network)
        req["network"] = network_str

        # Ensure extra exists
        if "extra" not in req or req["extra"] is None:
            req["extra"] = {}

        # Add token metadata if available
        asset_info = get_asset_info(network_str, asset)
        if asset_info:
            if "symbol" not in req["extra"]:
                req["extra"]["symbol"] = asset_info.get("symbol", "UNKNOWN")
            if "name" not in req["extra"]:
                req["extra"]["name"] = asset_info.get("name", "Unknown Token")
            if "decimals" not in req["extra"]:
                req["extra"]["decimals"] = asset_info.get(
                    "decimals", DEFAULT_DECIMALS
                )

        # Add facilitator extra data (fee payer address)
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
            ValueError: If network is not a supported Solana network
        """
        if not is_svm_network(network):
            raise ValueError(f"Not a Solana network: {network}")
        return normalize_network(network)
