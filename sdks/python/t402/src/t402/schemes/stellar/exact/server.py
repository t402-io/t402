"""Stellar Exact Scheme - Server Implementation.

This module provides the server-side implementation of the exact payment scheme
for Stellar network.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Union

from t402.types import (
    PaymentRequirementsV2,
    Network,
)
from t402.schemes.interfaces import AssetAmount, SupportedKindDict
from t402.stellar import (
    SCHEME_EXACT,
    STELLAR_PUBNET,
    STELLAR_TESTNET,
    DEFAULT_DECIMALS,
    get_network_config,
    get_default_asset,
    get_asset_info,
)


class ExactStellarServerScheme:
    """Server scheme for Stellar exact payments.

    Handles parsing user-friendly prices and enhancing payment requirements
    with Stellar-specific metadata for clients.

    Example:
        ```python
        scheme = ExactStellarServerScheme()

        # Parse price
        asset_amount = await scheme.parse_price("$0.10", "stellar:pubnet")
        # Returns: {"amount": "1000000", "asset": "CCW67...", "extra": {...}}

        # Enhance requirements
        enhanced = await scheme.enhance_requirements(
            requirements,
            supported_kind,
            facilitator_extensions,
        )
        ```
    """

    scheme = SCHEME_EXACT
    caip_family = "stellar:*"

    async def parse_price(
        self,
        price: Union[str, int, float, Dict[str, Any]],
        network: Network,
    ) -> AssetAmount:
        """Parse a user-friendly price to atomic amount and asset.

        Args:
            price: User-friendly price
            network: Network identifier (CAIP-2 format, e.g., "stellar:pubnet")

        Returns:
            AssetAmount dict with amount, asset, and extra metadata
        """
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
            raise ValueError(f"Unsupported Stellar network: {network}")

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
        atomic_amount = int(amount_decimal * Decimal(10**decimals))

        # Build extra metadata
        extra = {
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
        """Enhance payment requirements with Stellar-specific metadata.

        Args:
            requirements: Base payment requirements
            supported_kind: Matched SupportedKind from facilitator
            facilitator_extensions: Extensions supported by facilitator

        Returns:
            Enhanced requirements with Stellar metadata in extra
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

        # Add token metadata if not present
        asset_info = get_asset_info(network_str, asset)
        if asset_info:
            if "symbol" not in req["extra"]:
                req["extra"]["symbol"] = asset_info.get("symbol", "UNKNOWN")
            if "name" not in req["extra"]:
                req["extra"]["name"] = asset_info.get("name", "Unknown Token")
            if "decimals" not in req["extra"]:
                req["extra"]["decimals"] = asset_info.get("decimals", DEFAULT_DECIMALS)

        # Add network config info
        network_config = get_network_config(network_str)
        if network_config:
            if "horizonUrl" not in req["extra"]:
                req["extra"]["horizonUrl"] = network_config.get("horizon_url", "")
            if "passphrase" not in req["extra"]:
                req["extra"]["passphrase"] = network_config.get("passphrase", "")

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
        if network.startswith("stellar:"):
            if network in (STELLAR_PUBNET, STELLAR_TESTNET):
                return network
            raise ValueError(f"Unknown Stellar network: {network}")

        lower = network.lower()
        if lower in ("pubnet", "mainnet", "stellar-pubnet"):
            return STELLAR_PUBNET
        elif lower in ("testnet", "stellar-testnet"):
            return STELLAR_TESTNET

        raise ValueError(f"Unknown network: {network}")
