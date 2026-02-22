"""Lightning Network Exact Scheme - Server Implementation.

This module provides the server-side implementation of the exact payment
scheme for Lightning Network payments.

The server:
1. Parses user-friendly prices into satoshi amounts.
2. Generates BOLT11 invoices and adds them to the extra field.
"""

from __future__ import annotations

import logging
from decimal import Decimal, ROUND_DOWN
from typing import Any, Awaitable, Callable, Dict, List, Optional, Union

from t402.types import PaymentRequirementsV2, Network
from t402.schemes.interfaces import AssetAmount, SupportedKindDict
from t402.schemes.btc.constants import (
    SCHEME_EXACT,
    LIGHTNING_CAIP_FAMILY,
    SATS_PER_BTC,
)


logger = logging.getLogger(__name__)

# Type for invoice generator function
InvoiceGenerator = Callable[
    [str, str, int],
    Awaitable[Dict[str, str]],
]
"""Generates a BOLT11 invoice.

Args:
    amount_sats: Amount in satoshis as string.
    description: Invoice description.
    expiry: Expiry time in seconds.

Returns:
    Dict with 'bolt11_invoice' and 'payment_hash' keys.
"""


class LightningServerConfig:
    """Configuration for the LightningServerScheme.

    Attributes:
        generate_invoice: Async function to generate BOLT11 invoices.
    """

    def __init__(self, generate_invoice: InvoiceGenerator) -> None:
        self.generate_invoice = generate_invoice


class LightningServerScheme:
    """Server scheme for Lightning Network exact payments.

    Generates BOLT11 invoices and enhances payment requirements.

    Example:
        ```python
        async def my_invoice_gen(amount_sats, description, expiry):
            return {
                "bolt11_invoice": "lnbc...",
                "payment_hash": "abc123...",
            }

        scheme = LightningServerScheme(
            config=LightningServerConfig(generate_invoice=my_invoice_gen)
        )

        # Parse a BTC price to satoshis
        asset_amount = await scheme.parse_price(0.001, "lightning:mainnet")

        # Enhance requirements with BOLT11 invoice
        enhanced = await scheme.enhance_requirements(
            requirements, supported_kind, extensions
        )
        ```
    """

    def __init__(self, config: LightningServerConfig) -> None:
        """Initialize the server scheme.

        Args:
            config: Configuration with invoice generator function.
        """
        self._config = config

    @property
    def scheme(self) -> str:
        """The scheme identifier."""
        return SCHEME_EXACT

    @property
    def caip_family(self) -> str:
        """The CAIP-2 family pattern for Lightning networks."""
        return LIGHTNING_CAIP_FAMILY

    async def parse_price(
        self,
        price: Union[str, int, float, Dict[str, Any]],
        network: Network,
    ) -> AssetAmount:
        """Parse a user-friendly price to satoshi amount.

        Args:
            price: User-friendly price.
            network: Network identifier (CAIP-2 format).

        Returns:
            AssetAmount dict with amount (satoshis), asset ("BTC").

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
        """Enhance payment requirements for Lightning Network.

        Generates a BOLT11 invoice and adds it to the extra field.

        Args:
            requirements: Base payment requirements with amount set.
            supported_kind: The matched SupportedKind from facilitator.
            facilitator_extensions: Extensions supported by the facilitator.

        Returns:
            Enhanced requirements with bolt11Invoice in extra.
        """
        # Convert to dict for modification
        if hasattr(requirements, "model_dump"):
            req = requirements.model_dump(by_alias=True)
        else:
            req = dict(requirements)

        network = supported_kind.get("network", req.get("network", ""))

        # Initialize extra map if needed
        if "extra" not in req or req["extra"] is None:
            req["extra"] = {}

        extra = dict(req["extra"])

        # Generate a BOLT11 invoice for the payment
        max_timeout = req.get("maxTimeoutSeconds", 3600)
        invoice_result = await self._config.generate_invoice(
            req.get("amount", "0"),
            f"t402 payment on {network}",
            max_timeout,
        )

        extra["bolt11Invoice"] = invoice_result.get("bolt11_invoice", "")
        extra["paymentHash"] = invoice_result.get("payment_hash", "")

        req["extra"] = extra

        # Set asset to BTC if not already specified
        if not req.get("asset"):
            req["asset"] = "BTC"

        return req

    def _parse_money_to_decimal(self, price: Union[str, int, float]) -> Decimal:
        """Convert a money value to a Decimal amount."""
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
        """Default money conversion: treat amount as BTC, convert to satoshis."""
        sats = int((amount * SATS_PER_BTC).to_integral_value(rounding=ROUND_DOWN))

        return {
            "amount": str(sats),
            "asset": "BTC",
            "extra": {
                "symbol": "BTC",
                "decimals": 8,
            },
        }
