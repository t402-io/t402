"""Tezos Exact-Direct Scheme - Server Implementation.

This module provides the server-side implementation of the exact-direct payment
scheme for Tezos. It handles price parsing (converting user-friendly prices to
atomic units) and enhancement of payment requirements with Tezos-specific
FA2 asset information (CAIP-19 identifiers, token metadata).
"""

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any, Dict, List, Optional, Union

from t402.types import (
    PaymentRequirementsV2,
    Network,
)
from t402.schemes.interfaces import AssetAmount, SupportedKindDict
from t402.schemes.tezos.constants import (
    SCHEME_EXACT_DIRECT,
    is_tezos_network,
    get_network_config,
    get_token_info,
    create_asset_identifier,
    parse_decimal_to_atomic,
    TokenInfo,
)


logger = logging.getLogger(__name__)


class ExactDirectTezosServer:
    """Server scheme for Tezos exact-direct payments.

    Handles parsing user-friendly prices (e.g., "$1.50") into atomic amounts
    and enhancing payment requirements with Tezos-specific metadata including
    CAIP-19 asset identifiers and token information.

    Example:
        ```python
        from t402.schemes.tezos import ExactDirectTezosServer

        server = ExactDirectTezosServer()

        # Parse price to atomic units
        asset_amount = await server.parse_price("$0.10", "tezos:NetXdQprcVkpaWU")
        # Returns: {
        #     "amount": "100000",
        #     "asset": "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74.../0",
        #     "extra": {"symbol": "USDt", "name": "Tether USD", "decimals": 6}
        # }

        # Enhance requirements with token metadata
        enhanced = await server.enhance_requirements(
            requirements, supported_kind, []
        )
        ```
    """

    scheme = SCHEME_EXACT_DIRECT
    caip_family = "tezos:*"

    def __init__(self, preferred_token: Optional[str] = None):
        """Initialize the Tezos exact-direct server.

        Args:
            preferred_token: Preferred token symbol (e.g., "USDt").
                If set, this token will be used for price conversions
                when available on the network. Defaults to the network's
                default token.
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
        - Dict (AssetAmount): {"amount": "100000", "asset": "tezos:.../fa2:KT1.../0"}

        Args:
            price: User-friendly price
            network: Network identifier (CAIP-2 format, e.g., "tezos:NetXdQprcVkpaWU")

        Returns:
            AssetAmount dict with amount (atomic), asset (CAIP-19), and extra metadata

        Raises:
            ValueError: If network is unsupported or price format is invalid
        """
        # Validate network
        if not is_tezos_network(network):
            raise ValueError(f"Invalid Tezos network: {network}")

        # Handle dict (already in AssetAmount format)
        if isinstance(price, dict):
            amount_str = str(price.get("amount", "0"))
            asset = price.get("asset", "")
            if not asset:
                raise ValueError(
                    f"Asset must be specified for AssetAmount on network {network}"
                )
            return {
                "amount": amount_str,
                "asset": asset,
                "extra": price.get("extra", {}),
            }

        # Get default token for the network
        token = self._get_default_token(network)
        if token is None:
            raise ValueError(f"No token configured for network {network}")

        # Parse price string/number to decimal
        amount_decimal = self._parse_money_to_decimal(price)

        # Convert to atomic units
        atomic_amount = int(amount_decimal * Decimal(10**token.decimals))

        # Build CAIP-19 asset identifier
        asset_id = create_asset_identifier(network, token.contract_address, token.token_id)

        # Build extra metadata
        extra: Dict[str, Any] = {
            "symbol": token.symbol,
            "name": token.name,
            "decimals": token.decimals,
            "tokenId": token.token_id,
        }

        return {
            "amount": str(atomic_amount),
            "asset": asset_id,
            "extra": extra,
        }

    async def enhance_requirements(
        self,
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
        supported_kind: SupportedKindDict,
        facilitator_extensions: List[str],
    ) -> Union[PaymentRequirementsV2, Dict[str, Any]]:
        """Enhance payment requirements with Tezos-specific metadata.

        Adds FA2 token information to the extra field, resolves CAIP-19 asset
        identifiers, and converts decimal amounts to atomic units if needed.

        Args:
            requirements: Base payment requirements with amount/asset set
            supported_kind: Matched SupportedKind from the facilitator
            facilitator_extensions: Extension keys supported by facilitator

        Returns:
            Enhanced requirements dict with Tezos metadata in extra field
        """
        # Convert to dict for modification
        if hasattr(requirements, "model_dump"):
            req = requirements.model_dump(by_alias=True)
        else:
            req = dict(requirements)

        network = req.get("network", "")

        # Validate network
        if not is_tezos_network(network):
            raise ValueError(f"Invalid Tezos network: {network}")

        # Get network config
        network_config = get_network_config(network)
        if network_config is None:
            raise ValueError(f"Unsupported Tezos network: {network}")

        # Resolve token info
        token = self._get_default_token(network)

        # Ensure asset is in CAIP-19 format
        if not req.get("asset") and token is not None:
            req["asset"] = create_asset_identifier(
                network, token.contract_address, token.token_id
            )

        # Convert decimal amount to atomic units if needed
        amount = req.get("amount", "")
        if amount and "." in amount and token is not None:
            req["amount"] = parse_decimal_to_atomic(amount, token.decimals)

        # Ensure extra exists
        if "extra" not in req or req["extra"] is None:
            req["extra"] = {}

        # Add token metadata to extra
        if token is not None:
            if "assetSymbol" not in req["extra"]:
                req["extra"]["assetSymbol"] = token.symbol
            if "assetDecimals" not in req["extra"]:
                req["extra"]["assetDecimals"] = token.decimals
            if "assetName" not in req["extra"]:
                req["extra"]["assetName"] = token.name

        # Add network name for convenience
        if "networkName" not in req["extra"]:
            req["extra"]["networkName"] = network_config.name

        # Copy extensions from supportedKind if provided
        if supported_kind.get("extra"):
            for key, value in supported_kind["extra"].items():
                if key not in req["extra"]:
                    req["extra"][key] = value

        return req

    def _get_default_token(self, network: str) -> Optional[TokenInfo]:
        """Get the default token for a given network.

        If a preferred token is configured, tries to use it first.
        Falls back to the network's default token.

        Args:
            network: CAIP-2 network identifier

        Returns:
            TokenInfo if available, None otherwise
        """
        # If a preferred token is configured, try to use it
        if self._preferred_token:
            token = get_token_info(network, self._preferred_token)
            if token is not None:
                return token

        # Use the network's default token
        config = get_network_config(network)
        if config is None:
            return None
        return config.default_token

    def _parse_money_to_decimal(self, price: Union[str, int, float]) -> Decimal:
        """Parse a money value to a Decimal amount.

        Handles currency symbols, whitespace, and common suffixes.

        Args:
            price: Price as string, int, or float

        Returns:
            Decimal amount

        Raises:
            ValueError: If the price format cannot be parsed
        """
        if isinstance(price, (int, float)):
            return Decimal(str(price))

        if isinstance(price, str):
            clean_price = price.strip()
            # Remove currency prefix
            if clean_price.startswith("$"):
                clean_price = clean_price[1:]
            # Remove common suffixes
            for suffix in (" USD", " USDT", " USDt"):
                if clean_price.endswith(suffix):
                    clean_price = clean_price[: -len(suffix)]
            clean_price = clean_price.strip()

            try:
                return Decimal(clean_price)
            except Exception:
                raise ValueError(f"Failed to parse price string: {price}")

        raise ValueError(f"Unsupported price type: {type(price)}")
